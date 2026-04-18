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

CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_assignments_employee_date ON assignments(employee_id, assignment_date);
CREATE INDEX idx_attendance_employee_date ON attendance_sessions(employee_id, DATE(check_in_time));
CREATE INDEX idx_attendance_worksite ON attendance_sessions(worksite_id);
