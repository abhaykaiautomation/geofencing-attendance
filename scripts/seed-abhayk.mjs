import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_Bxpb0dvMAn3I@ep-plain-darkness-a4r01o13-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

const EMAIL    = 'abhayk@rrsent.com';
const PASSWORD = 'Abhay@1234';
const NAME     = 'Abhay K';

// ── 1. Firebase user ────────────────────────────────────────────────────────
let fbUid;
try {
  const existing = await auth.getUserByEmail(EMAIL);
  fbUid = existing.uid;
  console.log(`Firebase user already exists: ${fbUid}`);
} catch {
  const created = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NAME });
  fbUid = created.uid;
  console.log(`Firebase user created: ${fbUid}`);
}

// ── 2. DB employee ──────────────────────────────────────────────────────────
const empRes = await pool.query(
  `INSERT INTO employees (id, name, email, role)
   VALUES (gen_random_uuid(), $1, $2, 'employee')
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
   RETURNING id, name, email`,
  [NAME, EMAIL]
);
const emp = empRes.rows[0];
console.log(`Employee: ${emp.id} — ${emp.name} <${emp.email}>`);

// ── 3. Project assignments ──────────────────────────────────────────────────
// Projects: 1=Office Renovation, 2=Warehouse Expansion, 4=Parking Lot Resurfacing
const projectAssignments = [
  { projectId: 1, role: 'Developer' },
  { projectId: 2, role: 'Site Engineer' },
  { projectId: 4, role: 'Consultant' },
];

for (const { projectId, role } of projectAssignments) {
  await pool.query(
    `INSERT INTO employee_projects (employee_id, project_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (employee_id, project_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING id`,
    [emp.id, projectId, role]
  );
  console.log(`Assigned to project ${projectId} as ${role}`);
}

// ── 4. Time entries for April 2026 ─────────────────────────────────────────
// Working days Mon-Fri, Apr 1–30 2026
const workDays = [];
for (let d = 1; d <= 30; d++) {
  const date = new Date(2026, 3, d); // month is 0-indexed
  const dow  = date.getDay();
  if (dow !== 0 && dow !== 6) workDays.push(`2026-04-${String(d).padStart(2, '0')}`);
}

// Distribute hours across 3 projects with variety
const entries = [
  // Project 1 — Office Renovation (heavier, most days)
  ...workDays.filter((_, i) => i % 3 !== 2).map((date, i) => ({
    projectId: 1, date, hours: [6, 7, 8, 7.5, 6.5][i % 5], type: 'Regular Hours',
  })),
  // Project 2 — Warehouse Expansion (mid days)
  ...workDays.filter((_, i) => i % 3 !== 0).map((date, i) => ({
    projectId: 2, date, hours: [4, 5, 3.5, 4.5, 5][i % 5], type: 'Regular Hours',
  })),
  // Project 4 — Parking Lot (occasional, last week focus)
  ...workDays.filter((_, i) => i >= 14).map((date, i) => ({
    projectId: 4, date, hours: [2, 3, 2.5, 2, 3.5][i % 5], type: 'Regular Hours',
  })),
];

// Max 24h/day guard — dedupe by project+date, keep first
const seen = new Set();
const dedupedEntries = entries.filter(e => {
  const key = `${e.projectId}-${e.date}`;
  if (seen.has(key)) return false;
  seen.add(key); return true;
});

for (const e of dedupedEntries) {
  await pool.query(
    `INSERT INTO time_entries (employee_id, project_id, work_date, hours, time_type, billable)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [emp.id, e.projectId, e.date, e.hours, e.type]
  );
}
console.log(`Inserted ${dedupedEntries.length} time entries for April 2026`);

// ── Summary ─────────────────────────────────────────────────────────────────
const totals = await pool.query(
  `SELECT p.name, COUNT(*) days, SUM(t.hours) total_hours
   FROM time_entries t JOIN projects p ON p.id = t.project_id
   WHERE t.employee_id = $1 AND work_date BETWEEN '2026-04-01' AND '2026-04-30'
   GROUP BY p.name ORDER BY p.name`,
  [emp.id]
);
console.log('\n── April 2026 Summary ──');
totals.rows.forEach(r => console.log(`  ${r.name}: ${r.days} days, ${r.total_hours}h`));
console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);

await pool.end();
process.exit(0);
