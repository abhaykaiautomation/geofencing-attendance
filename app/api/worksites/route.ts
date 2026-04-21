import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await queryDB('SELECT * FROM worksites ORDER BY id');
    const rows = result.rows.map((r: any) => ({
      id:          r.id,
      name:        r.name,
      address:     r.address,
      latitude:    parseFloat(r.latitude),
      longitude:   parseFloat(r.longitude),
      entryRadius: parseFloat(r.entry_radius),
      exitRadius:  parseFloat(r.exit_radius),
    }));
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching worksites:', error);
    return NextResponse.json({ error: 'Failed to fetch worksites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, address, latitude, longitude, entryRadius, exitRadius } = body;

    const result = await queryDB(
      'INSERT INTO worksites (name, address, latitude, longitude, entry_radius, exit_radius) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, address, latitude, longitude, entryRadius ?? 1.0, exitRadius ?? 2.0]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: `A worksite named "${error.detail?.match(/\(name\)=\(([^)]+)\)/)?.[1] ?? 'that name'}" already exists.` }, { status: 409 });
    }
    console.error('Error creating worksite:', error);
    return NextResponse.json({ error: 'Failed to create worksite' }, { status: 500 });
  }
}