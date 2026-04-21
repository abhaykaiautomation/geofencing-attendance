import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_Bxpb0dvMAn3I@ep-plain-darkness-a4r01o13-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const EMAIL = 'abhayk@rrsent.com';

// 1. Find all employee records for this email
const empRows = await pool.query(
  `SELECT id, name, email, role, created_at FROM employees WHERE email = $1 ORDER BY created_at`,
  [EMAIL]
);
console.log(`Found ${empRows.rowCount} employee record(s) for ${EMAIL}:`);
empRows.rows.forEach(r => console.log(`  ${r.id}  created: ${r.created_at}`));

if (empRows.rowCount < 2) {
  console.log('No duplicate found — nothing to fix.');
  await pool.end(); process.exit(0);
}

// Keep the NEWEST record (the one the app uses via upsert-on-login)
const sorted = [...empRows.rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
const keepId   = sorted[0].id;   // newest — app resolves to this
const deleteId = sorted[1].id;   // older  — seed data is under this

console.log(`\nKeeping:  ${keepId}`);
console.log(`Deleting: ${deleteId}`);

// 2. Count data under each
const [teKeep, teDel, epKeep, epDel] = await Promise.all([
  pool.query(`SELECT COUNT(*) FROM time_entries     WHERE employee_id = $1`, [keepId]),
  pool.query(`SELECT COUNT(*) FROM time_entries     WHERE employee_id = $1`, [deleteId]),
  pool.query(`SELECT COUNT(*) FROM employee_projects WHERE employee_id = $1`, [keepId]),
  pool.query(`SELECT COUNT(*) FROM employee_projects WHERE employee_id = $1`, [deleteId]),
]);
console.log(`\ntime_entries:      keep=${teKeep.rows[0].count}  delete=${teDel.rows[0].count}`);
console.log(`employee_projects: keep=${epKeep.rows[0].count}  delete=${epDel.rows[0].count}`);

// 3. Re-link time_entries from deleteId → keepId
const reTe = await pool.query(
  `UPDATE time_entries SET employee_id = $1 WHERE employee_id = $2 RETURNING id`,
  [keepId, deleteId]
);
console.log(`\nRe-linked ${reTe.rowCount} time_entries to ${keepId}`);

// 4. Re-link employee_projects — skip duplicates (ON CONFLICT DO NOTHING)
const epRows = await pool.query(
  `SELECT project_id, role FROM employee_projects WHERE employee_id = $1`,
  [deleteId]
);
let epMoved = 0;
for (const row of epRows.rows) {
  const res = await pool.query(
    `INSERT INTO employee_projects (employee_id, project_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (employee_id, project_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id`,
    [keepId, row.project_id, row.role]
  );
  if (res.rowCount > 0) epMoved++;
}
console.log(`Re-linked ${epMoved} employee_projects to ${keepId}`);

// 5. Delete the old duplicate record (and any remaining refs)
await pool.query(`DELETE FROM employee_projects WHERE employee_id = $1`, [deleteId]);
await pool.query(`DELETE FROM employees WHERE id = $1`, [deleteId]);
console.log(`Deleted duplicate employee ${deleteId}`);

// 6. Verify final state
const check = await pool.query(
  `SELECT COUNT(*) FROM time_entries WHERE employee_id = $1`, [keepId]
);
const epCheck = await pool.query(
  `SELECT p.name, ep.role FROM employee_projects ep JOIN projects p ON p.id = ep.project_id WHERE ep.employee_id = $1`,
  [keepId]
);
console.log(`\n── Final state for ${keepId} ──`);
console.log(`time_entries: ${check.rows[0].count}`);
console.log(`projects: ${epCheck.rows.map(r => `${r.name} (${r.role})`).join(', ')}`);

await pool.end();
process.exit(0);
