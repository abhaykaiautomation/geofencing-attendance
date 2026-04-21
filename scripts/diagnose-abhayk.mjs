import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_Bxpb0dvMAn3I@ep-plain-darkness-a4r01o13-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const EMAIL = 'abhayk@rrsent.com';

// 1. Employee records
const emp = await pool.query(`SELECT id, name, email, role, created_at FROM employees WHERE email = $1`, [EMAIL]);
console.log(`\n── Employees with email ${EMAIL} ──`);
emp.rows.forEach(r => console.log(`  id=${r.id}  role=${r.role}  created=${r.created_at}`));

const empId = emp.rows[0]?.id;
if (!empId) { console.log('No employee found!'); await pool.end(); process.exit(1); }

// 2. Project assignments
const ep = await pool.query(
  `SELECT ep.id, ep.project_id, ep.role, p.name AS project_name
   FROM employee_projects ep JOIN projects p ON p.id = ep.project_id
   WHERE ep.employee_id = $1`, [empId]
);
console.log(`\n── employee_projects for ${empId} ──`);
if (ep.rows.length === 0) console.log('  (none)');
ep.rows.forEach(r => console.log(`  project_id=${r.project_id} (${r.project_name})  role=${r.role}`));

// 3. Time entries count
const te = await pool.query(
  `SELECT COUNT(*) total, MIN(work_date) first_date, MAX(work_date) last_date
   FROM time_entries WHERE employee_id = $1`, [empId]
);
console.log(`\n── time_entries for ${empId} ──`);
console.log(`  count=${te.rows[0].total}  range=${te.rows[0].first_date} → ${te.rows[0].last_date}`);

// 4. April time entries per project
const apr = await pool.query(
  `SELECT p.name AS project_name, COUNT(*) days, SUM(t.hours) total_hours
   FROM time_entries t JOIN projects p ON p.id = t.project_id
   WHERE t.employee_id = $1 AND t.work_date BETWEEN '2026-04-01' AND '2026-04-30'
   GROUP BY p.name ORDER BY p.name`, [empId]
);
console.log(`\n── April 2026 time entries ──`);
if (apr.rows.length === 0) console.log('  (none for April 2026)');
apr.rows.forEach(r => console.log(`  ${r.project_name}: ${r.days} days, ${r.total_hours}h`));

// 5. Projects table
const projs = await pool.query(`SELECT id, name FROM projects ORDER BY id`);
console.log(`\n── All projects ──`);
projs.rows.forEach(r => console.log(`  id=${r.id}  name=${r.name}`));

await pool.end();
process.exit(0);
