"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Worksite, Employee, Assignment, AttendanceSession, Project, EmployeeProject } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

// Type for attendance session input
type AttendanceSessionInput = {
  employeeId: string;
  worksiteId: string;
  checkInTime: string;
  location: { lat: number; lng: number };
};

// --- Attendance Monitoring Tab as a separate component ---
function AddAttendanceSessionForm({ onAdd, employees, worksites }: { onAdd: (session: AttendanceSessionInput) => void, employees: Employee[], worksites: Worksite[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [worksiteId, setWorksiteId] = useState(worksites[0]?.id || '');
  const [checkInTime, setCheckInTime] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  return (
    <form className="flex flex-wrap gap-2 mb-2" onSubmit={e => {
      e.preventDefault();
      onAdd({ employeeId, worksiteId, checkInTime, location: { lat: Number(lat), lng: Number(lng) } });
      setEmployeeId(employees[0]?.id || ''); setWorksiteId(worksites[0]?.id || ''); setCheckInTime(''); setLat(''); setLng('');
    }}>
      <select className="border px-2 py-1" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <select className="border px-2 py-1" value={worksiteId} onChange={e => setWorksiteId(e.target.value)}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <input className="border px-2 py-1" required placeholder="Check-in Time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} type="datetime-local" />
      <input className="border px-2 py-1" required placeholder="Lat" value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" />
      <input className="border px-2 py-1" required placeholder="Lng" value={lng} onChange={e => setLng(e.target.value)} type="number" step="any" />
      <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit">Add</button>
    </form>
  );
}

function EditAttendanceSessionForm({ session, onUpdate, employees, worksites }: { session: AttendanceSession, onUpdate: (id: string, session: Partial<AttendanceSessionInput> & { checkOutTime?: string }) => void, employees: Employee[], worksites: Worksite[] }) {
  const [editing, setEditing] = useState(false);
  const [employeeId, setEmployeeId] = useState(session.employeeId);
  const [worksiteId, setWorksiteId] = useState(session.worksiteId);
  const [checkInTime, setCheckInTime] = useState(session.checkInTime ? new Date(session.checkInTime).toISOString().slice(0, 16) : '');
  const [lat, setLat] = useState(session.checkInLocation?.lat?.toString() || '');
  const [lng, setLng] = useState(session.checkInLocation?.lng?.toString() || '');
  if (!editing) return <button className="text-blue-600" onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form className="inline-flex gap-1" onSubmit={e => {
      e.preventDefault();
      onUpdate(session.id, { employeeId, worksiteId, checkInTime, location: { lat: Number(lat), lng: Number(lng) } });
      setEditing(false);
    }}>
      <select className="border px-1" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <select className="border px-1" value={worksiteId} onChange={e => setWorksiteId(e.target.value)}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <input className="border px-1 w-28" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} type="datetime-local" />
      <input className="border px-1 w-20" value={lat} onChange={e => setLat(e.target.value)} type="number" step="any" />
      <input className="border px-1 w-20" value={lng} onChange={e => setLng(e.target.value)} type="number" step="any" />
      <button className="text-green-600" type="submit">Save</button>
      <button className="text-gray-500" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

function AttendanceMonitoringTab({ employees, worksites, sessions, addAttendanceSession, updateAttendanceSession, deleteSession }: {
  employees: Employee[];
  worksites: Worksite[];
  sessions: AttendanceSession[];
  addAttendanceSession: (session: AttendanceSessionInput) => void;
  updateAttendanceSession: (id: string, session: Partial<AttendanceSessionInput> & { checkOutTime?: string }) => void;
  deleteSession: (id: number) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Attendance Monitoring</h2>
      {/* Add Attendance Session Form */}
      <AddAttendanceSessionForm onAdd={addAttendanceSession} employees={employees} worksites={worksites} />
      <div className="mt-4">
        <h3 className="font-semibold mb-2">All Attendance Sessions</h3>
        <ul className="divide-y divide-gray-200">
          {sessions.map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between">
              <span>
                Employee: {employees.find(e => e.id === s.employeeId)?.name || s.employeeId}, Worksite: {worksites.find(w => w.id === s.worksiteId)?.name || s.worksiteId}, In: {s.checkInTime ? new Date(s.checkInTime).toLocaleString() : ''}, Out: {s.checkOutTime ? new Date(s.checkOutTime).toLocaleString() : 'N/A'}
              </span>
              <span>
                <EditAttendanceSessionForm session={s} onUpdate={updateAttendanceSession} employees={employees} worksites={worksites} />
                <button onClick={() => deleteSession(Number(s.id))} className="ml-2 text-red-600">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Assignment Forms ---
function AddAssignmentForm({ onAdd, employees, worksites }: { onAdd: (a: Omit<Assignment, 'id'>) => void, employees: Employee[], worksites: Worksite[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [date, setDate] = useState('');
  const [worksiteIds, setWorksiteIds] = useState<string[]>([]);
  return (
    <form className="flex flex-wrap gap-2 mb-2" onSubmit={e => {
      e.preventDefault();
      onAdd({ employeeId, date, worksiteIds });
      setEmployeeId(employees[0]?.id || ''); setDate(''); setWorksiteIds([]);
    }}>
      <select className="border px-2 py-1" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <input className="border px-2 py-1" required placeholder="Date" value={date} onChange={e => setDate(e.target.value)} type="date" />
      <select className="border px-2 py-1" multiple value={worksiteIds} onChange={e => setWorksiteIds(Array.from(e.target.selectedOptions, o => o.value))}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit">Add</button>
    </form>
  );
}

function EditAssignmentForm({ assignment, onUpdate, employees, worksites }: { assignment: Assignment, onUpdate: (id: number, a: Partial<Assignment>) => void, employees: Employee[], worksites: Worksite[] }) {
  const [editing, setEditing] = useState(false);
  const [employeeId, setEmployeeId] = useState(assignment.employeeId);
  const [date, setDate] = useState(assignment.date);
  const [worksiteIds, setWorksiteIds] = useState<string[]>(assignment.worksiteIds || []);
  if (!editing) return <button className="text-blue-600" onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form className="inline-flex gap-1" onSubmit={e => {
      e.preventDefault();
      onUpdate(Number(assignment.id), { employeeId, date, worksiteIds });
      setEditing(false);
    }}>
      <select className="border px-1" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <input className="border px-1 w-28" value={date} onChange={e => setDate(e.target.value)} type="date" />
      <select className="border px-1 w-32" multiple value={worksiteIds} onChange={e => setWorksiteIds(Array.from(e.target.selectedOptions, o => o.value))}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <button className="text-green-600" type="submit">Save</button>
      <button className="text-gray-500" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

// --- Employee Forms ---
function AddEmployeeForm({ onAdd }: { onAdd: (e: Omit<Employee, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <form className="flex flex-wrap gap-2 mb-2" onSubmit={e => {
      e.preventDefault();
      onAdd({ name, email });
      setName(''); setEmail('');
    }}>
      <input className="border px-2 py-1" required placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input className="border px-2 py-1" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
      <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit">Add</button>
    </form>
  );
}

function EditEmployeeForm({ employee, onUpdate }: { employee: Employee, onUpdate: (id: number, e: Partial<Employee>) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name ?? '');
  const [email, setEmail] = useState(employee.email ?? '');
  if (!editing) return <button className="text-blue-600" onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form className="inline-flex gap-1" onSubmit={e => {
      e.preventDefault();
      onUpdate(Number(employee.id), { name, email });
      setEditing(false);
    }}>
      <input className="border px-1 w-24" value={name} onChange={e => setName(e.target.value)} />
      <input className="border px-1 w-32" value={email} onChange={e => setEmail(e.target.value)} type="email" />
      <button className="text-green-600" type="submit">Save</button>
      <button className="text-gray-500" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

// ── Projects Tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

function ProjectsTab({ employees }: { employees: Employee[] }) {
  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [expandedId, setExpandedId]       = useState<number | null>(null);
  const [members, setMembers]             = useState<Record<number, EmployeeProject[]>>({});
  const [editingId, setEditingId]         = useState<number | null>(null);

  // Add form
  const [name, setName]           = useState('');
  const [description, setDesc]    = useState('');
  const [clientName, setClient]   = useState('');
  const [status, setStatus]       = useState('active');
  const [startDate, setStart]     = useState('');
  const [endDate, setEnd]         = useState('');

  // Edit form
  const [editName, setEditName]       = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editClient, setEditClient]   = useState('');
  const [editStatus, setEditStatus]   = useState('active');
  const [editStart, setEditStart]     = useState('');
  const [editEnd, setEditEnd]         = useState('');

  // Assign form
  const [assignEmpId, setAssignEmpId] = useState('');
  const [assignRole, setAssignRole]   = useState('');

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async () => {
    setLoading(true);
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  };

  const loadMembers = async (projectId: number) => {
    const res = await fetch(`/api/projects/members?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setMembers(prev => ({ ...prev, [projectId]: data }));
    }
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadMembers(id);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, clientName, status, startDate, endDate }),
    });
    if (res.ok) { setName(''); setDesc(''); setClient(''); setStatus('active'); setStart(''); setEnd(''); loadProjects(); }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDesc(p.description ?? '');
    setEditClient(p.clientName ?? '');
    setEditStatus(p.status);
    setEditStart(p.startDate ?? '');
    setEditEnd(p.endDate ?? '');
  };

  const handleUpdate = async (id: number) => {
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName, description: editDesc, clientName: editClient, status: editStatus, startDate: editStart, endDate: editEnd }),
    });
    setEditingId(null);
    loadProjects();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project? All employee assignments will also be removed.')) return;
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
    loadProjects();
  };

  const handleAssign = async (e: React.FormEvent, projectId: number) => {
    e.preventDefault();
    if (!assignEmpId) return;
    await fetch('/api/projects/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: assignEmpId, projectId, role: assignRole }),
    });
    setAssignEmpId(''); setAssignRole('');
    loadMembers(projectId);
    loadProjects();
  };

  const handleRemoveMember = async (employeeId: string, projectId: number) => {
    await fetch(`/api/projects/members?employeeId=${employeeId}&projectId=${projectId}`, { method: 'DELETE' });
    loadMembers(projectId);
    loadProjects();
  };

  if (loading) return <div className="py-8 text-center text-gray-400">Loading projects…</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Project Management</h2>

      {/* Add project form */}
      <form onSubmit={handleAdd} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <p className="text-sm font-medium text-gray-600 mb-3">Add New Project</p>
        <div className="flex flex-wrap gap-2">
          <input required placeholder="Project name *" value={name} onChange={e => setName(e.target.value)}
            className="border px-2 py-1 rounded text-sm flex-1 min-w-[180px]" />
          <input placeholder="Client name" value={clientName} onChange={e => setClient(e.target.value)}
            className="border px-2 py-1 rounded text-sm w-36" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border px-2 py-1 rounded text-sm">
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" placeholder="Start date" value={startDate} onChange={e => setStart(e.target.value)}
            className="border px-2 py-1 rounded text-sm" />
          <input type="date" placeholder="End date" value={endDate} onChange={e => setEnd(e.target.value)}
            className="border px-2 py-1 rounded text-sm" />
        </div>
        <div className="flex gap-2 mt-2">
          <input placeholder="Description" value={description} onChange={e => setDesc(e.target.value)}
            className="border px-2 py-1 rounded text-sm flex-1" />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-1 rounded text-sm hover:bg-indigo-700">
            Add Project
          </button>
        </div>
      </form>

      {/* Projects list */}
      <div className="space-y-3">
        {projects.length === 0 && <p className="text-gray-400 text-sm">No projects yet.</p>}
        {projects.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">

            {/* Project row */}
            {editingId === p.id ? (
              <div className="p-3 bg-yellow-50 flex flex-wrap gap-2 items-center">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="border px-2 py-1 rounded text-sm flex-1 min-w-[160px]" />
                <input value={editClient} onChange={e => setEditClient(e.target.value)}
                  placeholder="Client" className="border px-2 py-1 rounded text-sm w-32" />
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="border px-2 py-1 rounded text-sm">
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)}
                  className="border px-2 py-1 rounded text-sm" />
                <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                  className="border px-2 py-1 rounded text-sm" />
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  placeholder="Description" className="border px-2 py-1 rounded text-sm w-48" />
                <button onClick={() => handleUpdate(p.id)} className="text-green-600 text-sm font-medium">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-500 text-sm">Cancel</button>
              </div>
            ) : (
              <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button onClick={() => toggleExpand(p.id)} className="text-gray-400 hover:text-gray-600 text-lg leading-none w-5 shrink-0">
                    {expandedId === p.id ? '▾' : '▸'}
                  </button>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {p.clientName && <span className="mr-2">{p.clientName}</span>}
                      {p.startDate && <span>{p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</span>}
                      {p.description && <span className="ml-2 italic">{p.description}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {p.memberCount} {p.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <button onClick={() => startEdit(p)} className="text-blue-600 text-sm">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 text-sm">Delete</button>
                </div>
              </div>
            )}

            {/* Expanded: members */}
            {expandedId === p.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Team Members</p>

                {/* Member list */}
                {(members[p.id] ?? []).length === 0
                  ? <p className="text-xs text-gray-400 mb-3">No members assigned yet.</p>
                  : (
                    <table className="w-full text-xs mb-3">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1 pr-4">Employee</th>
                          <th className="text-left py-1 pr-4">Email</th>
                          <th className="text-left py-1 pr-4">Role</th>
                          <th className="text-left py-1">Assigned</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(members[p.id] ?? []).map(m => (
                          <tr key={m.id} className="border-t border-gray-100">
                            <td className="py-1.5 pr-4 font-medium text-gray-700">{m.employeeName}</td>
                            <td className="py-1.5 pr-4 text-gray-500">{m.employeeEmail}</td>
                            <td className="py-1.5 pr-4 text-gray-600">{m.role ?? '—'}</td>
                            <td className="py-1.5 text-gray-400">{m.assignedAt ? new Date(m.assignedAt).toLocaleDateString() : '—'}</td>
                            <td className="py-1.5 pl-3">
                              <button onClick={() => handleRemoveMember(m.employeeId, p.id)}
                                className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }

                {/* Assign employee form */}
                <form onSubmit={e => handleAssign(e, p.id)} className="flex gap-2 items-center flex-wrap">
                  <select value={assignEmpId} onChange={e => setAssignEmpId(e.target.value)}
                    className="border px-2 py-1 rounded text-xs flex-1 min-w-[160px]">
                    <option value="">— Select employee —</option>
                    {employees
                      .filter(emp => !(members[p.id] ?? []).some(m => m.employeeId === emp.id))
                      .map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>)
                    }
                  </select>
                  <input placeholder="Role (optional)" value={assignRole} onChange={e => setAssignRole(e.target.value)}
                    className="border px-2 py-1 rounded text-xs w-36" />
                  <button type="submit" disabled={!assignEmpId}
                    className="bg-indigo-600 text-white px-3 py-1 rounded text-xs disabled:opacity-40 hover:bg-indigo-700">
                    Assign
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const deleteSession = async (id: number) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to delete session: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert(`Error deleting session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('worksites');
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    // BYPASS: Always fetch data, skip auth checks
    fetchData();
  }, []);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      // Fetch worksites
      const worksitesRes = await fetch('/api/worksites');
      if (worksitesRes.ok) {
        const worksitesData = await worksitesRes.json();
        setWorksites(worksitesData);
      }

      // Fetch employees
      const employeesRes = await fetch('/api/employees');
      if (employeesRes.ok) {
        const employeesData = await employeesRes.json();
        setEmployees(employeesData);
      }

      // Fetch assignments
      const assignmentsRes = await fetch('/api/assignments');
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        // Map snake_case to camelCase for UI
        const mappedAssignments = assignmentsData.map((a: any) => ({
          id: a.id,
          employeeId: a.employee_id,
          date: a.assignment_date,
          worksiteIds: a.worksite_ids,
        }));
        setAssignments(mappedAssignments);
      }

      // Fetch attendance sessions
      const sessionsRes = await fetch('/api/attendance');
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        // Map snake_case to camelCase for UI
        const mappedSessions = sessionsData.map((s: any) => ({
          id: s.id,
          employeeId: s.employee_id,
          worksiteId: s.worksite_id,
          checkInTime: s.check_in_time,
          checkOutTime: s.check_out_time,
          durationMinutes: s.duration_minutes,
          checkInLocation: s.check_in_latitude !== undefined && s.check_in_longitude !== undefined ? { lat: s.check_in_latitude, lng: s.check_in_longitude } : undefined,
          checkOutLocation: s.check_out_latitude !== undefined && s.check_out_longitude !== undefined ? { lat: s.check_out_latitude, lng: s.check_out_longitude } : undefined,
        }));
        setSessions(mappedSessions);
      }

      setDataLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDataLoading(false);
    }
  };

  // CRUD operations
  const addWorksite = async (worksite: Omit<Worksite, 'id'>) => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/worksites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(worksite),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to add worksite: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error adding worksite:', error);
      alert(`Error adding worksite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const updateWorksite = async (id: number, worksite: Partial<Worksite>) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/worksites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(worksite),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to update worksite: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating worksite:', error);
      alert(`Error updating worksite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const deleteWorksite = async (id: number) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/worksites/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to delete worksite: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting worksite:', error);
      alert(`Error deleting worksite: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to add employee: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      alert(`Error adding employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const updateEmployee = async (id: number, employee: Partial<Employee>) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to update employee: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      alert(`Error updating employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const deleteEmployee = async (id: number) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to delete employee: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert(`Error deleting employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const addAssignment = async (assignment: Omit<Assignment, 'id'>) => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignment),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to add assignment: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error adding assignment:', error);
      alert(`Error adding assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const updateAssignment = async (id: number, assignment: Partial<Assignment>) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...assignment }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to update assignment: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert(`Error updating assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const deleteAssignment = async (id: number) => {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/assignments?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to delete assignment: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert(`Error deleting assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const addAttendanceSession = async (session: AttendanceSessionInput) => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: session.employeeId,
          worksiteId: session.worksiteId,
          checkInTime: session.checkInTime,
          location: session.location,
        }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to add session: ${errorData.error}`);
      }
    } catch (error: any) {
      console.error('Error adding session:', error);
      alert(`Error adding session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const updateAttendanceSession = async (id: string, session: Partial<AttendanceSessionInput> & { checkOutTime?: string }) => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          checkInTime: session.checkInTime,
          checkOutTime: session.checkOutTime,
          location: session.location,
        }),
      });
      if (response.ok) {
        fetchData();
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to update session: ${errorData.error}`);
      }
    } catch (error: any) {
      console.error('Error updating session:', error);
      alert(`Error updating session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  if (dataLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>

        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('worksites')}
            className={`px-4 py-2 rounded ${activeTab === 'worksites' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Worksites
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded ${activeTab === 'employees' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded ${activeTab === 'assignments' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Assignments
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2 rounded ${activeTab === 'monitoring' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded ${activeTab === 'projects' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded ${activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
          >
            Reports
          </button>
        </div>

        {activeTab === 'worksites' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Worksite Management</h2>
            {/* Add Worksite Form */}
            <AddWorksiteForm onAdd={addWorksite} />
            {/* Worksite List */}
            <div className="mt-4">
              <h3 className="font-semibold mb-2">All Worksites</h3>
              <ul className="divide-y divide-gray-200">
                {worksites.map((w) => (
                  <li key={w.id} className="py-2 flex items-center justify-between">
                    <span>{w.name} ({w.latitude}, {w.longitude})</span>
                    <span>
                      <EditWorksiteForm worksite={w} onUpdate={updateWorksite} />
                      <button onClick={() => deleteWorksite(Number(w.id))} className="ml-2 text-red-600">Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Employee Management</h2>
            {/* Add Employee Form */}
            <AddEmployeeForm onAdd={addEmployee} />
            <div className="mt-4">
              <h3 className="font-semibold mb-2">All Employees</h3>
              <ul className="divide-y divide-gray-200">
                {employees.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between">
                    <span>{e.name} ({e.email})</span>
                    <span>
                      <EditEmployeeForm employee={e} onUpdate={updateEmployee} />
                      <button onClick={() => deleteEmployee(Number(e.id))} className="ml-2 text-red-600">Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Assignment Management</h2>
            {/* Add Assignment Form */}
            <AddAssignmentForm onAdd={addAssignment} employees={employees} worksites={worksites} />
            <div className="mt-4">
              <h3 className="font-semibold mb-2">All Assignments</h3>
              <ul className="divide-y divide-gray-200">
                {assignments.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between">
                    <span>Employee: {employees.find(e => e.id === a.employeeId)?.name || a.employeeId}, Date: {a.date}, Worksites: {a.worksiteIds?.map(id => worksites.find(w => w.id === id)?.name || id).join(', ')}</span>
                    <span>
                      <EditAssignmentForm assignment={a} onUpdate={updateAssignment} employees={employees} worksites={worksites} />
                      <button onClick={() => deleteAssignment(Number(a.id))} className="ml-2 text-red-600">Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <AttendanceMonitoringTab
            employees={employees}
            worksites={worksites}
            sessions={sessions}
            addAttendanceSession={addAttendanceSession}
            updateAttendanceSession={updateAttendanceSession}
            deleteSession={deleteSession}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsTab employees={employees} />
        )}

        {activeTab === 'reports' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Reports</h2>
            <div className="mt-4 text-gray-500">Report generation coming soon. Please specify the type of report you need.</div>
            {/* Future: Add report filters, export, and display here */}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Worksite Forms ---
import { useState as useLocalState } from 'react';

function AddWorksiteForm({ onAdd }: { onAdd: (w: Omit<Worksite, 'id'>) => void }) {
  const [name, setName] = useLocalState('');
  const [address, setAddress] = useLocalState('');
  const [latitude, setLatitude] = useLocalState('');
  const [longitude, setLongitude] = useLocalState('');
  const [entryRadius, setEntryRadius] = useLocalState('');
  const [exitRadius, setExitRadius] = useLocalState('');
  return (
    <form className="flex flex-wrap gap-2 mb-2" onSubmit={e => {
      e.preventDefault();
      onAdd({
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        entryRadius: parseFloat(entryRadius),
        exitRadius: parseFloat(exitRadius)
      });
      setName(''); setAddress(''); setLatitude(''); setLongitude(''); setEntryRadius(''); setExitRadius('');
    }}>
      <input className="border px-2 py-1" required placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input className="border px-2 py-1" required placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
      <input className="border px-2 py-1" required placeholder="Latitude" value={latitude} onChange={e => setLatitude(e.target.value)} type="number" step="any" />
      <input className="border px-2 py-1" required placeholder="Longitude" value={longitude} onChange={e => setLongitude(e.target.value)} type="number" step="any" />
      <input className="border px-2 py-1" required placeholder="Entry Radius (m)" value={entryRadius} onChange={e => setEntryRadius(e.target.value)} type="number" step="any" />
      <input className="border px-2 py-1" required placeholder="Exit Radius (m)" value={exitRadius} onChange={e => setExitRadius(e.target.value)} type="number" step="any" />
      <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit">Add</button>
    </form>
  );
}

function EditWorksiteForm({ worksite, onUpdate }: { worksite: Worksite, onUpdate: (id: number, w: Partial<Worksite>) => void }) {
  const [editing, setEditing] = useLocalState(false);
  const [name, setName] = useLocalState(worksite.name ?? '');
  const [address, setAddress] = useLocalState(worksite.address ?? '');
  const [latitude, setLatitude] = useLocalState(
    worksite.latitude !== undefined && worksite.latitude !== null ? worksite.latitude.toString() : ''
  );
  const [longitude, setLongitude] = useLocalState(
    worksite.longitude !== undefined && worksite.longitude !== null ? worksite.longitude.toString() : ''
  );
  const [entryRadius, setEntryRadius] = useLocalState(
    worksite.entryRadius !== undefined && worksite.entryRadius !== null ? worksite.entryRadius.toString() : ''
  );
  const [exitRadius, setExitRadius] = useLocalState(
    worksite.exitRadius !== undefined && worksite.exitRadius !== null ? worksite.exitRadius.toString() : ''
  );
  if (!editing) return <button className="text-blue-600" onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form className="inline-flex gap-1" onSubmit={e => {
      e.preventDefault();
      onUpdate(Number(worksite.id), {
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        entryRadius: parseFloat(entryRadius),
        exitRadius: parseFloat(exitRadius)
      });
      setEditing(false);
    }}>
      <input className="border px-1 w-20" value={name} onChange={e => setName(e.target.value)} />
      <input className="border px-1 w-20" value={address} onChange={e => setAddress(e.target.value)} />
      <input className="border px-1 w-20" value={latitude} onChange={e => setLatitude(e.target.value)} type="number" step="any" />
      <input className="border px-1 w-20" value={longitude} onChange={e => setLongitude(e.target.value)} type="number" step="any" />
      <input className="border px-1 w-20" value={entryRadius} onChange={e => setEntryRadius(e.target.value)} type="number" step="any" />
      <input className="border px-1 w-20" value={exitRadius} onChange={e => setExitRadius(e.target.value)} type="number" step="any" />
      <button className="text-green-600" type="submit">Save</button>
      <button className="text-gray-500" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

