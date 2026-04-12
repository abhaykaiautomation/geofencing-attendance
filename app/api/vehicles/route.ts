import { queryDB } from '../../../lib/db';
import { NextResponse } from 'next/server';

// GET /api/vehicles?limit=50&vin=XXX
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vin   = searchParams.get('vin');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    let query  = `
      SELECT v.*, w.name AS worksite_name
      FROM current_vehicle_locations v
      LEFT JOIN worksites w ON w.id = v.worksite_id
    `;
    const params: any[] = [];

    if (vin) {
      query += ' WHERE v.vin ILIKE $1';
      params.push(`%${vin}%`);
    }

    query += ` ORDER BY v.scanned_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await queryDB(query, params);

    const rows = result.rows.map((r: any) => ({
      id:           r.id,
      vin:          r.vin,
      latitude:     parseFloat(r.latitude),
      longitude:    parseFloat(r.longitude),
      accuracy:     r.accuracy ? parseFloat(r.accuracy) : null,
      scannedBy:    r.scanned_by,
      worksiteId:   r.worksite_id,
      worksiteName: r.worksite_name,
      notes:        r.notes,
      scannedAt:    r.scanned_at,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching vehicle locations:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicle locations' }, { status: 500 });
  }
}

// POST /api/vehicles
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vin, latitude, longitude, accuracy, scannedBy, worksiteId, notes } = body;

    if (!vin || !latitude || !longitude) {
      return NextResponse.json({ error: 'vin, latitude, and longitude are required' }, { status: 400 });
    }

    // Basic VIN format check (17 chars, no I/O/Q)
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
      return NextResponse.json({ error: 'Invalid VIN format' }, { status: 400 });
    }

    const result = await queryDB(
      `INSERT INTO current_vehicle_locations
         (vin, latitude, longitude, accuracy, scanned_by, worksite_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [vin.toUpperCase(), latitude, longitude, accuracy ?? null, scannedBy ?? null, worksiteId ?? null, notes ?? null]
    );

    const r = result.rows[0];
    return NextResponse.json({
      id:         r.id,
      vin:        r.vin,
      latitude:   parseFloat(r.latitude),
      longitude:  parseFloat(r.longitude),
      accuracy:   r.accuracy ? parseFloat(r.accuracy) : null,
      scannedBy:  r.scanned_by,
      worksiteId: r.worksite_id,
      notes:      r.notes,
      scannedAt:  r.scanned_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error inserting vehicle location:', error);
    return NextResponse.json({ error: 'Failed to insert vehicle location' }, { status: 500 });
  }
}
