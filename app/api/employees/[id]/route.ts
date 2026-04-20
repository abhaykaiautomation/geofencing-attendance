import { queryDB } from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, email, role } = await request.json();

    const result = await queryDB(
      `UPDATE employees
       SET name  = COALESCE($1, name),
           email = COALESCE($2, email),
           role  = COALESCE($3, role)
       WHERE id = $4 RETURNING *`,
      [name ?? null, email ?? null, role ?? null, id]
    );

    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await queryDB('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
