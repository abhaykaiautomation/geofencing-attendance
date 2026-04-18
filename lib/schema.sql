-- Run this SQL script in PostgreSQL to set up the database schema

CREATE TABLE employees (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE worksites (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  entry_radius DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
  exit_radius DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  worksite_ids INTEGER[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, assignment_date)
);

CREATE TABLE attendance_sessions (
  id SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  worksite_id INTEGER NOT NULL REFERENCES worksites(id),
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP,
  duration_minutes INTEGER,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  client_name  VARCHAR(255),
  status       VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_projects (
  id          SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        VARCHAR(255),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, project_id)
);

CREATE TABLE time_entries (
  id          SERIAL PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  hours       DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  time_type   VARCHAR(100) NOT NULL DEFAULT 'Regular Hours',
  billable    BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, project_id, work_date, time_type)
);

CREATE INDEX idx_time_entries_emp_date ON time_entries(employee_id, work_date);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_assignments_employee_date ON assignments(employee_id, assignment_date);
CREATE INDEX idx_attendance_employee_date ON attendance_sessions(employee_id, DATE(check_in_time));
CREATE INDEX idx_attendance_worksite ON attendance_sessions(worksite_id);
