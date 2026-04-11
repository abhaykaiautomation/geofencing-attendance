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
}