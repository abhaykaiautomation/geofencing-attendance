export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, employeeId, date, worksiteIds } = body;
    if (!id) {
      return NextResponse.json({ error: 'Assignment id is required' }, { status: 400 });
    }
    const result = await queryDB(
      'UPDATE assignments SET employee_id = $1, assignment_date = $2, worksite_ids = $3 WHERE id = $4 RETURNING *',
      [employeeId, date, worksiteIds, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Assignment id is required' }, { status: 400 });
    }
    const result = await queryDB('DELETE FROM assignments WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const date = searchParams.get('date');

  let query = 'SELECT * FROM assignments';
  const params: any[] = [];

  if (employeeId && date) {
    query += ' WHERE employee_id = $1 AND assignment_date = $2';
    params.push(employeeId, date);
  } else if (employeeId) {
    query += ' WHERE employee_id = $1';
    params.push(employeeId);
  } else if (date) {
    query += ' WHERE assignment_date = $1';
    params.push(date);
  }

  const mapRow = (row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    date: row.assignment_date instanceof Date
      ? row.assignment_date.toISOString().split('T')[0]
      : String(row.assignment_date).split('T')[0],
    worksiteIds: row.worksite_ids ?? [],
  });

  try {
    const result = await queryDB(query, params);
    if (employeeId && date) {
      if (result.rows.length === 0) {
        return NextResponse.json({ id: null, employeeId, date, worksiteIds: [] });
      }
      return NextResponse.json(mapRow(result.rows[0]));
    }
    return NextResponse.json(result.rows.map(mapRow));
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, date, worksiteIds } = body;

    const result = await queryDB(
      'INSERT INTO assignments (employee_id, assignment_date, worksite_ids) VALUES ($1, $2, $3) ON CONFLICT (employee_id, assignment_date) DO UPDATE SET worksite_ids = $3 RETURNING *',
      [employeeId, date, worksiteIds]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}