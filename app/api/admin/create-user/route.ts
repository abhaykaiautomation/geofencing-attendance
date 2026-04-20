import { queryDB } from '../../../../lib/db';
import { NextResponse } from 'next/server';

// POST /api/admin/create-user
// Creates a Firebase Auth account + a matching DB employee record
export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'name, email and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
    }

    // 1. Create Firebase Auth user via REST API
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      }
    );
    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      const code = firebaseData?.error?.message ?? 'UNKNOWN';
      const messages: Record<string, string> = {
        EMAIL_EXISTS:            'An account with this email already exists.',
        INVALID_EMAIL:           'Invalid email address.',
        WEAK_PASSWORD:           'Password is too weak (min 6 characters).',
        OPERATION_NOT_ALLOWED:   'Email/password sign-in is not enabled in Firebase.',
      };
      return NextResponse.json({ error: messages[code] ?? `Firebase error: ${code}` }, { status: 400 });
    }

    // 2. Create employee record in DB (upsert — safe if email already exists)
    const dbRes = await queryDB(
      `INSERT INTO employees (id, name, email)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name, email]
    );

    return NextResponse.json({
      employee: dbRes.rows[0],
      firebaseUid: firebaseData.localId,
      role: role ?? 'employee',
    }, { status: 201 });

  } catch (error) {
    console.error('create-user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
