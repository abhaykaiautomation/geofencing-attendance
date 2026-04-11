import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await queryDB('SELECT * FROM worksites ORDER BY id');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching worksites:', error);
    return NextResponse.json({ error: 'Failed to fetch worksites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, address, latitude, longitude, entry_radius, exit_radius } = body;

    const result = await queryDB(
      'INSERT INTO worksites (name, address, latitude, longitude, entry_radius, exit_radius) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, address, latitude, longitude, entry_radius || 1.0, exit_radius || 2.0]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating worksite:', error);
    return NextResponse.json({ error: 'Failed to create worksite' }, { status: 500 });
  }
}