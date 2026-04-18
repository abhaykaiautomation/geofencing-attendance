import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

const mapRow = (r: any) => ({
  id:          r.id,
  employeeId:  r.employee_id,
  projectId:   r.project_id,
  projectName: r.project_name ?? null,
  workDate:    r.work_date,   // pg returns DATE as plain string after type parser override
  hours:       parseFloat(r.hours),
  timeType:    r.time_type,
  billable:    r.billable,
  notes:       r.notes ?? null,
});

// GET /api/time-entries?employeeId=X&startDate=Y&endDate=Z
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const startDate  = searchParams.get('startDate');
  const endDate    = searchParams.get('endDate');

  if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });

  try {
    let query = `
      SELECT te.*, p.name AS project_name
      FROM time_entries te
      LEFT JOIN projects p ON p.id = te.project_id
      WHERE te.employee_id = $1
    `;
    const params: any[] = [employeeId];

    if (startDate) { params.push(startDate); query += ` AND te.work_date >= $${params.length}`; }
    if (endDate)   { params.push(endDate);   query += ` AND te.work_date <= $${params.length}`; }

    query += ' ORDER BY te.work_date, te.project_id';

    const result = await queryDB(query, params);
    return NextResponse.json(result.rows.map(mapRow));
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
  }
}

// POST /api/time-entries — upsert by (employee_id, project_id, work_date, time_type)
export async function POST(request: Request) {
  try {
    const { employeeId, projectId, workDate, hours, timeType, billable, notes } = await request.json();

    if (!employeeId || !projectId || !workDate || hours == null)
      return NextResponse.json({ error: 'employeeId, projectId, workDate, hours are required' }, { status: 400 });

    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24)
      return NextResponse.json({ error: 'hours must be between 0.01 and 24' }, { status: 400 });

    const result = await queryDB(
      `INSERT INTO time_entries (employee_id, project_id, work_date, hours, time_type, billable, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_id, project_id, work_date, time_type)
       DO UPDATE SET hours = EXCLUDED.hours, billable = EXCLUDED.billable,
                     notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [employeeId, projectId, workDate, h, timeType ?? 'Regular Hours', billable ?? true, notes ?? null]
    );

    return NextResponse.json(mapRow(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error('Error saving time entry:', error);
    return NextResponse.json({ error: 'Failed to save time entry' }, { status: 500 });
  }
}

// DELETE /api/time-entries?id=X
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await queryDB('DELETE FROM time_entries WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
  }
}
