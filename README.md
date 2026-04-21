# GeoFencing Attendance

A production-ready, mobile-first Progressive Web App (PWA) for employee attendance tracking using GPS geofencing. Employees are automatically prompted to check in or out when they enter or leave a worksite radius. Admins manage worksites, employees, projects, time entries, and attendance sessions from a unified dashboard.

**Live app:** https://geofencing-psi.vercel.app

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Testing as Admin](#testing-as-admin)
- [Testing as Employee](#testing-as-employee)
- [Mobile Setup (PWA)](#mobile-setup-pwa)
- [Deploying to Vercel](#deploying-to-vercel)
- [API Reference](#api-reference)
- [Default Accounts](#default-accounts)

---

## Features

### Employee
- **Timesheet** — weekly view of hours logged per project, with editable cells (Draft → Submit → Approve flow)
- **Attendance popup** — enter lat/lng manually or tap "Use My Location" to check in/out of a worksite
- **Auto-open on arrival** — popup opens automatically when GPS detects the employee is within a worksite's entry radius
- **Auto check-in/out** — background `watchPosition` silently records entry/exit without any user interaction, with a 5-minute cooldown
- **Smart week navigation** — Prev/Next buttons are only enabled when data exists in that direction; page auto-jumps to the most recent week with entries
- **Change password** — in-app password change via Firebase
- **PWA** — installable on iPhone/Android as a home screen app with no App Store required

### Admin
- **Employee management** — create, edit, delete employees; assign roles (admin / employee)
- **Project management** — create projects with client name, status, dates; assign employees with roles
- **Worksite management** — add worksites with GPS coordinates, entry radius, and exit radius (in metres)
- **Attendance monitoring** — view all check-in/out sessions per employee per day, with exact timestamps, duration, and ACTIVE badge for open sessions
- **Employee view** — searchable dropdown to open any employee's timesheet in read-only mode
- **Time entry oversight** — view, edit, or delete any employee's time entries

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS + inline styles (dark design system) |
| Auth | Firebase Authentication (email/password) |
| Database | PostgreSQL on [Neon](https://neon.tech) (serverless, SSL) |
| ORM | Raw SQL via `pg` pool |
| Hosting | Vercel (edge functions + CDN) |
| PWA | next-pwa (service worker + manifest) |
| Icons | sharp (server-side PNG generation) |
| Distance | Haversine formula (browser-side, metres) |

---

## Architecture

```
Browser / Mobile PWA
        │
        │  HTTPS
        ▼
┌─────────────────────────┐
│       Vercel Edge        │
│  Next.js App Router      │
│  ├─ /app/login           │  Firebase Auth (client SDK)
│  ├─ /app/admin           │  Role guard: role = 'admin'
│  ├─ /app/employee        │  Role guard: any authenticated user
│  └─ /app/api/*           │  REST API routes (server-side)
└────────────┬────────────┘
             │  pg Pool (SSL)
             ▼
┌─────────────────────────┐
│      Neon PostgreSQL     │
│  employees               │
│  projects                │
│  employee_projects       │
│  worksites               │
│  time_entries            │
│  attendance_sessions     │
└─────────────────────────┘
```

**Auth flow:** Firebase issues a JWT on login. The client stores `uid` and `email`. On first access to `/employee`, the app POSTs the email to `/api/employees` which upserts the employee record and returns the DB UUID. All subsequent API calls use that UUID.

**Role flow:** The `employees` table has a `role` column (`admin` | `employee`). After login, the app fetches the employee record by email and reads the role. Admins are redirected to `/admin`; non-admins trying to access `/admin` are redirected to `/employee`.

---

## Database Schema

```sql
-- Employees
CREATE TABLE employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'employee',  -- 'admin' | 'employee'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  client_name TEXT,
  status      TEXT DEFAULT 'active',  -- active | completed | on_hold | cancelled
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Employee ↔ Project assignments
CREATE TABLE employee_projects (
  id          SERIAL PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, project_id)
);

-- Worksites
CREATE TABLE worksites (
  id           SERIAL PRIMARY KEY,
  name         TEXT UNIQUE NOT NULL,
  address      TEXT,
  latitude     NUMERIC(10,7) NOT NULL,
  longitude    NUMERIC(10,7) NOT NULL,
  entry_radius NUMERIC DEFAULT 100,   -- metres: check-in when inside
  exit_radius  NUMERIC DEFAULT 150,   -- metres: check-out when outside
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Time entries (manual timesheet hours)
CREATE TABLE time_entries (
  id          SERIAL PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  hours       NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  time_type   TEXT DEFAULT 'Regular Hours',
  billable    BOOLEAN DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, project_id, work_date, time_type)
);

-- Attendance sessions (geofence check-in/out)
CREATE TABLE attendance_sessions (
  id                  SERIAL PRIMARY KEY,
  employee_id         UUID REFERENCES employees(id) ON DELETE CASCADE,
  worksite_id         INTEGER REFERENCES worksites(id) ON DELETE CASCADE,
  check_in_time       TIMESTAMPTZ NOT NULL,
  check_out_time      TIMESTAMPTZ,
  duration_minutes    INTEGER,
  check_in_location   JSONB,   -- { lat, lng }
  check_out_location  JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- A [Firebase](https://console.firebase.google.com) project with Email/Password auth enabled

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/abhaykaiautomation/geofencing-attendance.git
   cd geofencing-attendance
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env.local`** in the project root:
   ```env
   # Firebase (from Firebase Console → Project Settings → Your Apps)
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...

   # PostgreSQL (Neon connection string)
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   ```

4. **Run database migrations** — execute the schema SQL above in your Neon SQL editor, or use the Neon console.

5. **Seed an admin user**
   ```bash
   # Place your Firebase service account key at ./serviceAccountKey.json
   # (Download from Firebase Console → Project Settings → Service Accounts)
   node scripts/seed-admin.mjs
   ```
   Or create manually:
   - Create a Firebase user via Firebase Console → Authentication
   - Insert into DB: `INSERT INTO employees (name, email, role) VALUES ('Admin', 'admin@example.com', 'admin');`

6. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Where to find it | Required |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web App | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same as above | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same as above | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same as above | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same as above | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same as above | Yes |
| `DATABASE_URL` | Neon Console → Connection Details → Connection string | Yes |

> **Note:** `.env.local` is gitignored. Never commit credentials. Set these same variables in your Vercel dashboard under Project → Settings → Environment Variables.

---

## Testing as Admin

### Login
1. Go to the app URL (or `http://localhost:3000`)
2. Enter admin credentials:
   - **Email:** `admin@example.com`
   - **Password:** `Admin@1234`
3. You land on the **Admin Dashboard**

### Manage Worksites
1. Click the **Worksites** tab
2. Click **Add Worksite** → fill in name, address, latitude/longitude
3. Set **Entry Radius** (metres) — employee can check in when within this distance
4. Set **Exit Radius** (metres) — must be larger than entry radius; employee checks out when beyond this
5. Click **Save** → worksite appears in the list
6. To edit: click the pencil icon on any row
7. To delete: click the trash icon

> **Tip:** Find GPS coordinates for any address at [maps.google.com](https://maps.google.com) → right-click the location → the lat/lng appears at the top of the context menu.

### Manage Employees
1. Click the **Employees** tab
2. Click **Add Employee** → enter name, email, select role (`admin` or `employee`)
3. A Firebase account is created automatically with a temporary password
4. To edit name/role: click the pencil icon
5. To delete: click the trash icon (also removes all their time entries and assignments)

### Manage Projects
1. Click the **Projects** tab
2. Click **Add Project** → enter name, client name, status, start/end dates
3. To assign employees to a project: click **Manage Members** → search for employee → click **Assign**
4. Set the employee's role on the project (e.g. Developer, Site Engineer)

### View an Employee's Timesheet
1. Click the **Employee View** button (top right of admin dashboard)
2. A searchable dropdown appears — type the employee name or email
3. Select the employee → their timesheet opens in **read-only** mode
4. Use **◀ Prev** / **Next ▶** to navigate weeks
5. Click **← Back to Admin** banner to return

### Monitor Attendance
1. Click the **Attendance** tab
2. Filter by employee name or date range
3. Each row shows: employee, worksite, check-in time, check-out time, duration, status
4. **ACTIVE** badge = employee is currently checked in (no check-out yet)
5. Sessions created both manually (via popup) and automatically (via background GPS) appear here

---

## Testing as Employee

### Login
1. Go to the app URL
2. Enter employee credentials:
   - **Email:** `abhayk@rrsent.com`
   - **Password:** `Abhay@1234`
3. You land on the **Employee Timesheet**

### View Timesheet
1. The weekly timesheet loads with your assigned projects as rows
2. Use **◀ Prev** / **Next ▶** to navigate weeks (buttons are greyed out when no data exists in that direction)
3. For `abhayk@rrsent.com`, April 2026 has 37 time entries across 3 projects — navigate back to see them
4. The **summary strip** at the top shows total hours, billable hours, and current status

### Log Time Manually
1. Ensure status is **Draft** (Submit button visible at top right)
2. Click any cell in the timesheet grid (row = project, column = day)
3. Type the number of hours (e.g. `8`) → press **Enter** to save, **Escape** to cancel
4. The cell turns teal when hours are saved
5. Delete hours by clicking the cell and clearing the value → Enter
6. Click **Submit** to submit the week for approval

### Record Attendance via GPS
1. Click the **📍 Attendance** button (top right)
2. **Option A — Manual coordinates:** Type latitude and longitude → click **Check Location**
3. **Option B — GPS:** Click **Use My Location** → browser requests location permission → coordinates auto-fill → click **Check Location**
4. If within a worksite's entry radius: a **Check In** button appears
5. Click **Check In** → popup closes after 1.5 seconds with a success toast
6. To check out: open the popup again when outside the exit radius → **Check Out** button appears

### Auto Attendance (Background GPS)
- The page silently calls `navigator.geolocation.watchPosition` in the background
- If you cross into a worksite's entry radius, a check-in is recorded automatically
- A teal banner appears at the top: _"📍 Auto checked in at [Worksite Name]"_
- If you move outside the exit radius while checked in, a check-out is recorded automatically
- An amber banner appears: _"📍 Auto checked out from [Worksite Name]"_
- A 5-minute cooldown prevents duplicate records

### Change Password
1. Click **Change Password** (top right)
2. Enter your current password, then new password twice
3. Click **Update Password** — takes effect immediately

---

## Mobile Setup (PWA)

The app is a Progressive Web App. It can be installed on iOS and Android directly from the browser — no App Store required.

### iPhone / iPad (iOS Safari)

1. Open **Safari** on your iPhone (must be Safari, not Chrome or Firefox)
2. Navigate to the app: `https://geofencing-psi.vercel.app`
3. Tap the **Share** button — the box with an arrow pointing up, at the bottom of the screen
4. Scroll down in the share sheet and tap **"Add to Home Screen"**
5. Optionally rename the app → tap **Add** in the top right
6. The app icon appears on your home screen
7. Tap it — the app opens **full screen** with no browser address bar

**What you get on iOS:**
- Full-screen experience (no Safari UI)
- Home screen icon with the teal location pin
- GPS check-in/out works in the foreground
- Offline support for previously loaded pages

**iOS limitation:** Background GPS tracking (auto check-in when screen is locked) is restricted by iOS. The attendance popup and manual/foreground GPS work fully. For background tracking on iOS, a native app via Capacitor + TestFlight is required.

---

### Android (Chrome)

1. Open **Chrome** on your Android device
2. Navigate to the app: `https://geofencing-psi.vercel.app`
3. Tap the **three-dot menu** (top right)
4. Tap **"Add to Home screen"** or **"Install app"**
5. Tap **Install** in the confirmation dialog
6. The app appears in your app drawer and home screen

**Android advantages over iOS:**
- Background GPS tracking works (watchPosition survives screen lock)
- Auto check-in/out functions even when the screen is off
- More reliable PWA push notifications (future feature)

---

### Share the Install Link

Send this link to employees — they just open it in Safari (iOS) or Chrome (Android):

```
https://geofencing-psi.vercel.app
```

No IT department, no app store approval, no device management needed.

---

## Deploying to Vercel

### First-time setup

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Add all environment variables under **Settings → Environment Variables** (see [Environment Variables](#environment-variables) section)
4. Click **Deploy**

### Using Vercel CLI

```bash
# Install CLI
npm install -g vercel

# Login
vercel login

# Set the DATABASE_URL (critical — must match your Neon connection string)
vercel env add DATABASE_URL production

# Deploy
vercel --prod
```

### Re-deploy after env variable changes

Environment variable changes require a new deployment to take effect:
```bash
vercel --prod --yes
```

### Verify the database is connected

```bash
vercel curl "/api/time-entries?employeeId=<uuid>&range=true"
# Should return: {"minDate":"...","maxDate":"..."}
# If it returns {"minDate":null,"maxDate":null} — check DATABASE_URL is set correctly
```

---

## API Reference

All routes are under `/api/`. Authentication is handled client-side by Firebase; the API routes trust the client-provided `employeeId`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/employees` | List all employees |
| `GET` | `/api/employees?email=X` | Get employee by email |
| `POST` | `/api/employees` | Upsert employee by email (called on login) |
| `GET` | `/api/employees/[id]` | Get single employee by UUID |
| `PATCH` | `/api/employees/[id]` | Update employee name/role |
| `DELETE` | `/api/employees/[id]` | Delete employee and all related data |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project |
| `PATCH` | `/api/projects/[id]` | Update project |
| `DELETE` | `/api/projects/[id]` | Delete project |
| `GET` | `/api/projects/members?employeeId=X` | Get all projects for an employee |
| `GET` | `/api/projects/members?projectId=X` | Get all employees on a project |
| `POST` | `/api/projects/members` | Assign employee to project |
| `DELETE` | `/api/projects/members?employeeId=X&projectId=Y` | Remove assignment |
| `GET` | `/api/worksites` | List all worksites |
| `POST` | `/api/worksites` | Create worksite |
| `PATCH` | `/api/worksites/[id]` | Update worksite |
| `DELETE` | `/api/worksites/[id]` | Delete worksite |
| `GET` | `/api/time-entries?employeeId=X&startDate=Y&endDate=Z` | Get time entries for a week |
| `GET` | `/api/time-entries?employeeId=X&range=true` | Get min/max work date for employee |
| `POST` | `/api/time-entries` | Upsert time entry |
| `DELETE` | `/api/time-entries?id=X` | Delete time entry |
| `GET` | `/api/attendance?employeeId=X` | Get attendance sessions (open ones first) |
| `POST` | `/api/attendance` | Create check-in session |
| `PATCH` | `/api/attendance` | Record check-out (by sessionId) |
| `POST` | `/api/admin/create-user` | Create Firebase user + DB employee |

---

## Default Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@1234` |
| Admin | `admin1@example.com` | `Admin@1234` |
| Employee | `abhayk@rrsent.com` | `Abhay@1234` |

> `abhayk@rrsent.com` has 37 pre-seeded time entries for April 2026 across 3 projects (Office Renovation, Warehouse Expansion, Parking Lot Resurfacing).

---

## Project Structure

```
geofencing/
├── app/
│   ├── admin/              # Admin dashboard (role-guarded)
│   ├── employee/           # Employee timesheet + attendance
│   ├── login/              # Firebase email/password login
│   ├── api/
│   │   ├── admin/          # User creation endpoint
│   │   ├── attendance/     # Check-in / check-out sessions
│   │   ├── employees/      # Employee CRUD
│   │   ├── projects/       # Project CRUD + member assignments
│   │   ├── time-entries/   # Timesheet entries
│   │   └── worksites/      # Worksite CRUD
│   ├── layout.tsx          # Root layout (PWA meta, install prompt)
│   └── page.tsx            # Home (redirects based on role)
├── components/
│   ├── AuthProvider.tsx    # Firebase auth state → React context
│   ├── ChangePasswordModal.tsx
│   └── InstallPrompt.tsx   # iOS "Add to Home Screen" banner
├── contexts/
│   └── AuthContext.tsx     # useAuth hook
├── lib/
│   └── db.ts               # PostgreSQL pool (Neon SSL)
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── icon-192.png        # App icon (192×192)
│   └── icon-512.png        # App icon (512×512)
├── scripts/
│   ├── seed-abhayk.mjs     # Seed test employee + April 2026 data
│   ├── gen-icons.mjs       # Regenerate PNG app icons
│   ├── reset-passwords.mjs # Reset Firebase passwords via Admin SDK
│   └── diagnose-abhayk.mjs # Debug DB state for an employee
├── types/
│   └── index.ts            # Shared TypeScript interfaces
├── next.config.ts          # Next.js + PWA config
└── .env.local              # Local environment variables (gitignored)
```

---

## License

© RRS Enterprise. All rights reserved. Unauthorized use, reproduction, or distribution of this software is strictly prohibited.
