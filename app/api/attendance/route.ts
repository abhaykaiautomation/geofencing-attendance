import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId');
  const date = searchParams.get('date');

  let query = 'SELECT * FROM attendance_sessions';
  const params: any[] = [];

  if (employeeId && date) {
    query += ' WHERE employee_id = $1 AND DATE(check_in_time) = $2';
    params.push(employeeId, date);
  } else if (employeeId) {
    query += ' WHERE employee_id = $1';
    params.push(employeeId);
  } else if (date) {
    query += ' WHERE DATE(check_in_time) = $1';
    params.push(date);
  }

  query += ' ORDER BY check_in_time DESC';

  try {
    const result = await queryDB(query, params);
    const sessions = result.rows.map((row: any) => ({
      id: row.id,
      employeeId: row.employee_id,
      worksiteId: row.worksite_id,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time ?? null,
      durationMinutes: row.duration_minutes ?? null,
      checkInLocation: { lat: row.check_in_latitude, lng: row.check_in_longitude },
      checkOutLocation: row.check_out_latitude ? { lat: row.check_out_latitude, lng: row.check_out_longitude } : null,
    }));
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching attendance sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, worksiteId, checkInTime, location } = body;

    const result = await queryDB(
      'INSERT INTO attendance_sessions (employee_id, worksite_id, check_in_time, check_in_latitude, check_in_longitude) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employeeId, worksiteId, checkInTime, location.lat, location.lng]
    );

    const row = result.rows[0];
    return NextResponse.json({
      id: row.id,
      employeeId: row.employee_id,
      worksiteId: row.worksite_id,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time ?? null,
      durationMinutes: row.duration_minutes ?? null,
      checkInLocation: { lat: row.check_in_latitude, lng: row.check_in_longitude },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating attendance session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, checkOutTime, location } = body;

    // Fetch check_in_time to compute duration
    const existing = await queryDB('SELECT check_in_time FROM attendance_sessions WHERE id = $1', [sessionId]);
    const checkInTime = existing.rows[0]?.check_in_time;
    const durationMinutes = checkInTime
      ? Math.round((new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / 60000)
      : null;

    const result = await queryDB(
      'UPDATE attendance_sessions SET check_out_time = $1, check_out_latitude = $2, check_out_longitude = $3, duration_minutes = $4 WHERE id = $5 RETURNING *',
      [checkOutTime, location?.lat ?? null, location?.lng ?? null, durationMinutes, sessionId]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating attendance session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}