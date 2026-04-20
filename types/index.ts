export interface Worksite {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  entryRadius: number;
  exitRadius: number;
}

export interface AttendanceSession {
  id: string;
  employeeId: string;
  worksiteId: string;
  checkInTime: Date;
  checkOutTime?: Date;
  durationMinutes?: number;
  checkInLocation: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
}

export interface Assignment {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  worksiteIds: string[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  clientName?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  startDate?: string;
  endDate?: string;
  memberCount?: number;
}

export interface TimeEntry {
  id: number;
  employeeId: string;
  projectId: number;
  projectName?: string;
  workDate: string;   // YYYY-MM-DD
  hours: number;
  timeType: string;
  billable: boolean;
  notes?: string;
}

export interface EmployeeProject {
  id: number;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  projectId: number;
  projectName?: string;
  role?: string;
  assignedAt?: string;
}