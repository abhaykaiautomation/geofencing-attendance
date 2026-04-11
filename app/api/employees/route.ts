import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  try {
    if (email) {
      // Return single employee by email
      const result = await queryDB('SELECT * FROM employees WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      return NextResponse.json(result.rows[0]);
    } else {
      // Return all employees
      const result = await queryDB('SELECT * FROM employees', []);
      return NextResponse.json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching employee(s):', error);
    return NextResponse.json({ error: 'Failed to fetch employee(s)' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Try to find existing employee
    const existing = await queryDB('SELECT * FROM employees WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      return NextResponse.json(existing.rows[0]);
    }

    // Create new employee
    const result = await queryDB(
      'INSERT INTO employees (id, name, email) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
      [name || email.split('@')[0], email]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating/fetching employee:', error);
    return NextResponse.json({ error: 'Failed to create/fetch employee' }, { status: 500 });
  }
}