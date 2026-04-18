import { queryDB } from '../../../../lib/db';
import { NextResponse } from 'next/server';

// GET /api/projects/members?projectId=X  OR  ?employeeId=X
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId  = searchParams.get('projectId');
  const employeeId = searchParams.get('employeeId');

  try {
    if (projectId) {
      // All employees on a project
      const result = await queryDB(`
        SELECT ep.*, e.name AS employee_name, e.email AS employee_email
        FROM employee_projects ep
        JOIN employees e ON e.id = ep.employee_id
        WHERE ep.project_id = $1
        ORDER BY e.name
      `, [projectId]);

      return NextResponse.json(result.rows.map((r: any) => ({
        id:            r.id,
        employeeId:    r.employee_id,
        employeeName:  r.employee_name,
        employeeEmail: r.employee_email,
        projectId:     r.project_id,
        role:          r.role ?? null,
        assignedAt:    r.assigned_at,
      })));
    }

    if (employeeId) {
      // All projects for an employee
      const result = await queryDB(`
        SELECT ep.*, p.name AS project_name, p.status, p.client_name,
               p.start_date, p.end_date
        FROM employee_projects ep
        JOIN projects p ON p.id = ep.project_id
        WHERE ep.employee_id = $1
        ORDER BY p.name
      `, [employeeId]);

      return NextResponse.json(result.rows.map((r: any) => ({
        id:          r.id,
        employeeId:  r.employee_id,
        projectId:   r.project_id,
        projectName: r.project_name,
        status:      r.status,
        clientName:  r.client_name ?? null,
        startDate:   r.start_date ?? null,
        endDate:     r.end_date   ?? null,
        role:        r.role ?? null,
        assignedAt:  r.assigned_at,
      })));
    }

    return NextResponse.json({ error: 'projectId or employeeId required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/projects/members  — assign employee to project
export async function POST(request: Request) {
  try {
    const { employeeId, projectId, role } = await request.json();
    if (!employeeId || !projectId)
      return NextResponse.json({ error: 'employeeId and projectId are required' }, { status: 400 });

    const result = await queryDB(
      `INSERT INTO employee_projects (employee_id, project_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, project_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [employeeId, projectId, role ?? null]
    );
    return NextResponse.json({ id: result.rows[0].id, employeeId, projectId, role: result.rows[0].role }, { status: 201 });
  } catch (error) {
    console.error('Error assigning employee to project:', error);
    return NextResponse.json({ error: 'Failed to assign employee' }, { status: 500 });
  }
}

// DELETE /api/projects/members?employeeId=X&projectId=Y
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const projectId  = searchParams.get('projectId');
    if (!employeeId || !projectId)
      return NextResponse.json({ error: 'employeeId and projectId are required' }, { status: 400 });

    await queryDB(
      'DELETE FROM employee_projects WHERE employee_id = $1 AND project_id = $2',
      [employeeId, projectId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing employee from project:', error);
    return NextResponse.json({ error: 'Failed to remove employee' }, { status: 500 });
  }
}
