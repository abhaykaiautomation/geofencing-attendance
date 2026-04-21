import { queryDB } from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, address, latitude, longitude, entryRadius, exitRadius } = await request.json();

    const result = await queryDB(
      `UPDATE worksites
       SET name         = COALESCE($1, name),
           address      = COALESCE($2, address),
           latitude     = COALESCE($3, latitude),
           longitude    = COALESCE($4, longitude),
           entry_radius = COALESCE($5, entry_radius),
           exit_radius  = COALESCE($6, exit_radius)
       WHERE id = $7 RETURNING *`,
      [
        name      ?? null,
        address   ?? null,
        latitude  ?? null,
        longitude ?? null,
        entryRadius ?? null,
        exitRadius  ?? null,
        id,
      ]
    );

    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Worksite not found' }, { status: 404 });

    const r = result.rows[0];
    return NextResponse.json({
      id: r.id, name: r.name, address: r.address,
      latitude: parseFloat(r.latitude), longitude: parseFloat(r.longitude),
      entryRadius: parseFloat(r.entry_radius), exitRadius: parseFloat(r.exit_radius),
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: `A worksite with that name already exists.` }, { status: 409 });
    }
    console.error('Error updating worksite:', error);
    return NextResponse.json({ error: 'Failed to update worksite' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await queryDB('DELETE FROM worksites WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0)
      return NextResponse.json({ error: 'Worksite not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting worksite:', error);
    return NextResponse.json({ error: 'Failed to delete worksite' }, { status: 500 });
  }
}
