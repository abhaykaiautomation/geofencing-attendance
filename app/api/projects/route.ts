import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

const mapProject = (r: any) => ({
  id:          r.id,
  name:        r.name,
  description: r.description ?? null,
  clientName:  r.client_name ?? null,
  status:      r.status,
  startDate:   r.start_date ?? null,
  endDate:     r.end_date   ?? null,
  memberCount: Number(r.member_count ?? 0),
  createdAt:   r.created_at,
});

// GET /api/projects
export async function GET() {
  try {
    const result = await queryDB(`
      SELECT p.*,
             COUNT(ep.id) AS member_count
      FROM projects p
      LEFT JOIN employee_projects ep ON ep.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return NextResponse.json(result.rows.map(mapProject));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects
export async function POST(request: Request) {
  try {
    const { name, description, clientName, status, startDate, endDate } = await request.json();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const result = await queryDB(
      `INSERT INTO projects (name, description, client_name, status, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description ?? null, clientName ?? null, status ?? 'active', startDate ?? null, endDate ?? null]
    );
    return NextResponse.json(mapProject(result.rows[0]), { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

// PATCH /api/projects
export async function PATCH(request: Request) {
  try {
    const { id, name, description, clientName, status, startDate, endDate } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const result = await queryDB(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description  = COALESCE($2, description),
           client_name  = COALESCE($3, client_name),
           status       = COALESCE($4, status),
           start_date   = COALESCE($5, start_date),
           end_date     = COALESCE($6, end_date),
           updated_at   = NOW()
       WHERE id = $7 RETURNING *`,
      [name ?? null, description ?? null, clientName ?? null, status ?? null, startDate ?? null, endDate ?? null, id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(mapProject(result.rows[0]));
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects?id=X
export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const result = await queryDB('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
