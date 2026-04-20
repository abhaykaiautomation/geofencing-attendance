"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Worksite, Employee, Assignment, AttendanceSession, Project, EmployeeProject } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

const C = {
  base:     '#09090f',
  surface:  '#111118',
  elev:     '#1a1a25',
  input:    '#16161f',
  border:   'rgba(255,255,255,0.07)',
  borderMd: 'rgba(255,255,255,0.11)',
  t1:       '#eeeef5',
  t2:       'rgba(238,238,245,0.55)',
  t3:       'rgba(238,238,245,0.28)',
  indigo:   '#6366f1',
  indigoDim:'rgba(99,102,241,0.12)',
  teal:     '#0d9488',
  tealDim:  'rgba(13,148,136,0.12)',
  green:    '#16a34a',
  greenDim: 'rgba(22,163,74,0.15)',
  red:      '#dc2626',
  redDim:   'rgba(220,38,38,0.15)',
  amber:    '#d97706',
  amberDim: 'rgba(217,119,6,0.15)',
};

// ── shared style helpers ──────────────────────────────────────────────────────
const inputSx: React.CSSProperties = {
  background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1,
  borderRadius: 8, fontSize: '0.8125rem', padding: '6px 10px', outline: 'none',
};
const btnPrimary = (color = C.indigo): React.CSSProperties => ({
  background: color + '20', border: `1px solid ${color}55`, color,
  borderRadius: 7, fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px', cursor: 'pointer',
});
const btnGhost = (color = C.t2): React.CSSProperties => ({
  background: 'transparent', border: 'none', color, fontSize: '0.75rem',
  fontWeight: 500, padding: '4px 8px', cursor: 'pointer',
});
const cardSx: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    active:    [C.green,  C.greenDim],
    completed: [C.indigo, C.indigoDim],
    on_hold:   [C.amber,  C.amberDim],
    cancelled: [C.red,    C.redDim],
  };
  const [fg, bg] = map[status] ?? [C.t3, C.elev];
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${fg}33`,
      borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
      textTransform: 'capitalize' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── Type ──────────────────────────────────────────────────────────────────────
type AttendanceSessionInput = {
  employeeId: string;
  worksiteId: string;
  checkInTime: string;
  location: { lat: number; lng: number };
};

// ── Attendance Monitoring Tab ─────────────────────────────────────────────────
function AddAttendanceSessionForm({ onAdd, employees, worksites }: {
  onAdd: (s: AttendanceSessionInput) => void;
  employees: Employee[];
  worksites: Worksite[];
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [worksiteId, setWorksiteId] = useState(worksites[0]?.id || '');
  const [checkInTime, setCheckInTime] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  return (
    <form style={{ ...cardSx, padding: 16, marginBottom: 16 }}
      onSubmit={e => {
        e.preventDefault();
        onAdd({ employeeId, worksiteId, checkInTime, location: { lat: Number(lat), lng: Number(lng) } });
        setEmployeeId(employees[0]?.id || ''); setWorksiteId(worksites[0]?.id || '');
        setCheckInTime(''); setLat(''); setLng('');
      }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Session</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select style={inputSx} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <select style={inputSx} value={worksiteId} onChange={e => setWorksiteId(e.target.value)}>
          {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
        </select>
        <input style={inputSx} required type="datetime-local" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} />
        <input style={{ ...inputSx, width: 110 }} required placeholder="Lat" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} />
        <input style={{ ...inputSx, width: 110 }} required placeholder="Lng" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} />
        <button type="submit" style={btnPrimary(C.teal)}>Add Session</button>
      </div>
    </form>
  );
}

function EditAttendanceSessionForm({ session, onUpdate, employees, worksites }: {
  session: AttendanceSession;
  onUpdate: (id: string, s: Partial<AttendanceSessionInput> & { checkOutTime?: string }) => void;
  employees: Employee[];
  worksites: Worksite[];
}) {
  const [editing, setEditing] = useState(false);
  const [employeeId, setEmployeeId] = useState(session.employeeId);
  const [worksiteId, setWorksiteId] = useState(session.worksiteId);
  const [checkInTime, setCheckInTime] = useState(session.checkInTime ? new Date(session.checkInTime).toISOString().slice(0, 16) : '');
  const [lat, setLat] = useState(session.checkInLocation?.lat?.toString() || '');
  const [lng, setLng] = useState(session.checkInLocation?.lng?.toString() || '');

  if (!editing) return <button style={btnGhost(C.indigo)} onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      onSubmit={e => { e.preventDefault(); onUpdate(session.id, { employeeId, worksiteId, checkInTime, location: { lat: Number(lat), lng: Number(lng) } }); setEditing(false); }}>
      <select style={{ ...inputSx, fontSize: '0.7rem' }} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <select style={{ ...inputSx, fontSize: '0.7rem' }} value={worksiteId} onChange={e => setWorksiteId(e.target.value)}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 160 }} type="datetime-local" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 90 }} type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 90 }} type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} />
      <button type="submit" style={btnGhost(C.teal)}>Save</button>
      <button type="button" style={btnGhost(C.t3)} onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

function AttendanceMonitoringTab({ employees, worksites, sessions, addAttendanceSession, updateAttendanceSession, deleteSession }: {
  employees: Employee[];
  worksites: Worksite[];
  sessions: AttendanceSession[];
  addAttendanceSession: (s: AttendanceSessionInput) => void;
  updateAttendanceSession: (id: string, s: Partial<AttendanceSessionInput> & { checkOutTime?: string }) => void;
  deleteSession: (id: number) => void;
}) {
  return (
    <div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Attendance Monitoring</p>
      <AddAttendanceSessionForm onAdd={addAttendanceSession} employees={employees} worksites={worksites} />
      <div style={cardSx}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            All Sessions ({sessions.length})
          </p>
        </div>
        {sessions.length === 0
          ? <p style={{ padding: 20, fontSize: '0.8rem', color: C.t3, textAlign: 'center' }}>No sessions recorded.</p>
          : sessions.map((s, i) => (
            <div key={s.id} style={{ padding: '12px 16px', borderBottom: i < sessions.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.8rem', color: C.t2, minWidth: 0 }}>
                <span style={{ color: C.t1, fontWeight: 500 }}>{employees.find(e => e.id === s.employeeId)?.name || s.employeeId}</span>
                {' · '}{worksites.find(w => w.id === s.worksiteId)?.name || s.worksiteId}
                {' · '}In: {s.checkInTime ? new Date(s.checkInTime).toLocaleString() : '—'}
                {' · '}Out: {s.checkOutTime ? new Date(s.checkOutTime).toLocaleString() : <span style={{ color: C.amber }}>Active</span>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', shrink: 0 } as React.CSSProperties}>
                <EditAttendanceSessionForm session={s} onUpdate={updateAttendanceSession} employees={employees} worksites={worksites} />
                <button style={btnGhost(C.red)} onClick={() => deleteSession(Number(s.id))}>Delete</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Assignment Forms ──────────────────────────────────────────────────────────
function AddAssignmentForm({ onAdd, employees, worksites }: { onAdd: (a: Omit<Assignment, 'id'>) => void; employees: Employee[]; worksites: Worksite[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [date, setDate] = useState('');
  const [worksiteIds, setWorksiteIds] = useState<string[]>([]);
  return (
    <form style={{ ...cardSx, padding: 16, marginBottom: 16 }}
      onSubmit={e => { e.preventDefault(); onAdd({ employeeId, date, worksiteIds }); setEmployeeId(employees[0]?.id || ''); setDate(''); setWorksiteIds([]); }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Assignment</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select style={inputSx} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </select>
        <input style={inputSx} required type="date" value={date} onChange={e => setDate(e.target.value)} />
        <select style={{ ...inputSx, minWidth: 160 }} multiple value={worksiteIds} onChange={e => setWorksiteIds(Array.from(e.target.selectedOptions, o => o.value))}>
          {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
        </select>
        <button type="submit" style={btnPrimary(C.teal)}>Add</button>
      </div>
    </form>
  );
}

function EditAssignmentForm({ assignment, onUpdate, employees, worksites }: { assignment: Assignment; onUpdate: (id: number, a: Partial<Assignment>) => void; employees: Employee[]; worksites: Worksite[] }) {
  const [editing, setEditing] = useState(false);
  const [employeeId, setEmployeeId] = useState(assignment.employeeId);
  const [date, setDate] = useState(assignment.date);
  const [worksiteIds, setWorksiteIds] = useState<string[]>(assignment.worksiteIds || []);
  if (!editing) return <button style={btnGhost(C.indigo)} onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      onSubmit={e => { e.preventDefault(); onUpdate(Number(assignment.id), { employeeId, date, worksiteIds }); setEditing(false); }}>
      <select style={{ ...inputSx, fontSize: '0.7rem' }} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>
      <input style={{ ...inputSx, fontSize: '0.7rem' }} type="date" value={date} onChange={e => setDate(e.target.value)} />
      <select style={{ ...inputSx, fontSize: '0.7rem', minWidth: 140 }} multiple value={worksiteIds} onChange={e => setWorksiteIds(Array.from(e.target.selectedOptions, o => o.value))}>
        {worksites.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
      </select>
      <button type="submit" style={btnGhost(C.teal)}>Save</button>
      <button type="button" style={btnGhost(C.t3)} onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

// ── Employee Forms ────────────────────────────────────────────────────────────
function AddEmployeeForm({ onAdd }: { onAdd: (e: Omit<Employee, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <form style={{ ...cardSx, padding: 16, marginBottom: 16 }}
      onSubmit={e => { e.preventDefault(); onAdd({ name, email }); setName(''); setEmail(''); }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Employee</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input style={{ ...inputSx, flex: 1, minWidth: 160 }} required placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        <input style={{ ...inputSx, flex: 1, minWidth: 200 }} required type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
        <button type="submit" style={btnPrimary(C.teal)}>Add Employee</button>
      </div>
    </form>
  );
}

function EditEmployeeForm({ employee, onUpdate }: { employee: Employee; onUpdate: (id: number, e: Partial<Employee>) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name ?? '');
  const [email, setEmail] = useState(employee.email ?? '');
  if (!editing) return <button style={btnGhost(C.indigo)} onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      onSubmit={e => { e.preventDefault(); onUpdate(Number(employee.id), { name, email }); setEditing(false); }}>
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 140 }} value={name} onChange={e => setName(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 200 }} type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <button type="submit" style={btnGhost(C.teal)}>Save</button>
      <button type="button" style={btnGhost(C.t3)} onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────
function ProjectsTab({ employees }: { employees: Employee[] }) {
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [members, setMembers]       = useState<Record<number, EmployeeProject[]>>({});
  const [editingId, setEditingId]   = useState<number | null>(null);

  const [name, setName]         = useState('');
  const [description, setDesc]  = useState('');
  const [clientName, setClient] = useState('');
  const [status, setStatus]     = useState('active');
  const [startDate, setStart]   = useState('');
  const [endDate, setEnd]       = useState('');

  const [editName, setEditName]     = useState('');
  const [editDesc, setEditDesc]     = useState('');
  const [editClient, setEditClient] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editStart, setEditStart]   = useState('');
  const [editEnd, setEditEnd]       = useState('');

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

  const handleAdd = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, clientName, status, startDate, endDate }) });
    if (res.ok) { setName(''); setDesc(''); setClient(''); setStatus('active'); setStart(''); setEnd(''); loadProjects(); }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id); setEditName(p.name); setEditDesc(p.description ?? '');
    setEditClient(p.clientName ?? ''); setEditStatus(p.status);
    setEditStart(p.startDate ?? ''); setEditEnd(p.endDate ?? '');
  };

  const handleUpdate = async (id: number) => {
    await fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: editName, description: editDesc, clientName: editClient, status: editStatus, startDate: editStart, endDate: editEnd }) });
    setEditingId(null); loadProjects();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project? All employee assignments will also be removed.')) return;
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
    loadProjects();
  };

  const handleAssign = async (e: { preventDefault(): void }, projectId: number) => {
    e.preventDefault();
    if (!assignEmpId) return;
    await fetch('/api/projects/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: assignEmpId, projectId, role: assignRole }) });
    setAssignEmpId(''); setAssignRole('');
    loadMembers(projectId); loadProjects();
  };

  const handleRemoveMember = async (employeeId: string, projectId: number) => {
    await fetch(`/api/projects/members?employeeId=${employeeId}&projectId=${projectId}`, { method: 'DELETE' });
    loadMembers(projectId); loadProjects();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: C.t3, fontSize: '0.85rem' }}>
      <span style={{ width: 16, height: 16, border: `2px solid ${C.teal}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      Loading projects…
    </div>
  );

  const statusOpts = ['active', 'on_hold', 'completed', 'cancelled'];

  return (
    <div>
      <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Project Management</p>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ ...cardSx, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Project</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <input required placeholder="Project name *" value={name} onChange={e => setName(e.target.value)}
            style={{ ...inputSx, flex: 1, minWidth: 200 }} />
          <input placeholder="Client name" value={clientName} onChange={e => setClient(e.target.value)}
            style={{ ...inputSx, width: 160 }} />
          <select value={status} onChange={e => setStatus(e.target.value)} style={inputSx}>
            {statusOpts.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inputSx} />
          <input type="date" value={endDate} onChange={e => setEnd(e.target.value)} style={inputSx} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Description (optional)" value={description} onChange={e => setDesc(e.target.value)}
            style={{ ...inputSx, flex: 1 }} />
          <button type="submit" style={btnPrimary(C.indigo)}>Add Project</button>
        </div>
      </form>

      {/* Projects list */}
      {projects.length === 0
        ? <p style={{ color: C.t3, fontSize: '0.85rem', textAlign: 'center', padding: 32 }}>No projects yet.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map(p => (
              <div key={p.id} style={{ ...cardSx, overflow: 'hidden' }}>
                {/* Row */}
                {editingId === p.id ? (
                  <div style={{ padding: '12px 16px', background: C.elev, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inputSx, flex: 1, minWidth: 160 }} />
                    <input value={editClient} onChange={e => setEditClient(e.target.value)} placeholder="Client" style={{ ...inputSx, width: 140 }} />
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={inputSx}>
                      {statusOpts.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} style={inputSx} />
                    <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={inputSx} />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" style={{ ...inputSx, width: 200 }} />
                    <button onClick={() => handleUpdate(p.id)} style={btnGhost(C.teal)}>Save</button>
                    <button onClick={() => setEditingId(null)} style={btnGhost(C.t3)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <button onClick={() => toggleExpand(p.id)}
                        style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: '0.75rem', padding: '2px 4px', borderRadius: 4, width: 20, flexShrink: 0 }}>
                        {expandedId === p.id ? '▾' : '▸'}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                        <p style={{ fontSize: '0.75rem', color: C.t3, marginTop: 1 }}>
                          {p.clientName && <span style={{ marginRight: 8 }}>{p.clientName}</span>}
                          {p.startDate && <span>{p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</span>}
                          {p.description && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{p.description}</span>}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <StatusBadge status={p.status} />
                      <span style={{ background: C.elev, border: `1px solid ${C.border}`, color: C.t3, borderRadius: 5, fontSize: '0.7rem', padding: '2px 8px' }}>
                        {p.memberCount} {p.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <button onClick={() => startEdit(p)} style={btnGhost(C.indigo)}>Edit</button>
                      <button onClick={() => handleDelete(p.id)} style={btnGhost(C.red)}>Delete</button>
                    </div>
                  </div>
                )}

                {/* Expanded members */}
                {expandedId === p.id && (
                  <div style={{ borderTop: `1px solid ${C.border}`, background: C.elev, padding: 16 }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Team Members</p>

                    {(members[p.id] ?? []).length === 0
                      ? <p style={{ fontSize: '0.8rem', color: C.t3, marginBottom: 14 }}>No members assigned yet.</p>
                      : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              {['Employee', 'Email', 'Role', 'Assigned', ''].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '4px 12px 8px 0', fontSize: '0.7rem', fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(members[p.id] ?? []).map(m => (
                              <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '8px 12px 8px 0', fontSize: '0.8rem', fontWeight: 500, color: C.t1 }}>{m.employeeName}</td>
                                <td style={{ padding: '8px 12px 8px 0', fontSize: '0.8rem', color: C.t2 }}>{m.employeeEmail}</td>
                                <td style={{ padding: '8px 12px 8px 0', fontSize: '0.8rem', color: C.t2 }}>{m.role ?? '—'}</td>
                                <td style={{ padding: '8px 12px 8px 0', fontSize: '0.75rem', color: C.t3 }}>{m.assignedAt ? new Date(m.assignedAt).toLocaleDateString() : '—'}</td>
                                <td style={{ padding: '8px 0' }}>
                                  <button onClick={() => handleRemoveMember(m.employeeId, p.id)} style={btnGhost(C.red)}>Remove</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    }

                    {/* Assign form */}
                    <form onSubmit={e => handleAssign(e, p.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={assignEmpId} onChange={e => setAssignEmpId(e.target.value)}
                        style={{ ...inputSx, flex: 1, minWidth: 180 }}>
                        <option value="">— Select employee —</option>
                        {employees
                          .filter(emp => !(members[p.id] ?? []).some(m => m.employeeId === emp.id))
                          .map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>)
                        }
                      </select>
                      <input placeholder="Role (optional)" value={assignRole} onChange={e => setAssignRole(e.target.value)}
                        style={{ ...inputSx, width: 160 }} />
                      <button type="submit" disabled={!assignEmpId}
                        style={{ ...btnPrimary(C.indigo), opacity: assignEmpId ? 1 : 0.4 }}>
                        Assign
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Radius input with "m" badge ───────────────────────────────────────────────
function RadiusInput({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: C.input, border: `1px solid ${C.borderMd}`, borderRadius: 8, overflow: 'hidden' }}>
      <input
        required={required}
        type="number" min="1" step="1" placeholder={label}
        value={value} onChange={e => onChange(e.target.value)}
        style={{ ...inputSx, border: 'none', borderRadius: 0, width: 120, background: 'transparent' }}
      />
      <span style={{ padding: '0 10px', fontSize: '0.75rem', fontWeight: 600, color: C.teal, borderLeft: `1px solid ${C.borderMd}`, whiteSpace: 'nowrap' }}>m</span>
    </div>
  );
}

// ── Worksite Forms ────────────────────────────────────────────────────────────
function AddWorksiteForm({ onAdd }: { onAdd: (w: Omit<Worksite, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [entryRadius, setEntryRadius] = useState('');
  const [exitRadius, setExitRadius] = useState('');
  return (
    <form style={{ ...cardSx, padding: 16, marginBottom: 16 }}
      onSubmit={e => {
        e.preventDefault();
        onAdd({ name, address, latitude: parseFloat(latitude), longitude: parseFloat(longitude), entryRadius: parseFloat(entryRadius), exitRadius: parseFloat(exitRadius) });
        setName(''); setAddress(''); setLatitude(''); setLongitude(''); setEntryRadius(''); setExitRadius('');
      }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Worksite</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input style={{ ...inputSx, flex: 1, minWidth: 160 }} required placeholder="Worksite name" value={name} onChange={e => setName(e.target.value)} />
        <input style={{ ...inputSx, flex: 1, minWidth: 200 }} required placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
        <input style={{ ...inputSx, width: 120 }} required placeholder="Latitude" type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} />
        <input style={{ ...inputSx, width: 120 }} required placeholder="Longitude" type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} />
        <RadiusInput label="Entry radius" value={entryRadius} onChange={setEntryRadius} required />
        <RadiusInput label="Exit radius"  value={exitRadius}  onChange={setExitRadius}  required />
        <button type="submit" style={btnPrimary(C.teal)}>Add</button>
      </div>
    </form>
  );
}

function EditWorksiteForm({ worksite, onUpdate }: { worksite: Worksite; onUpdate: (id: number, w: Partial<Worksite>) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(worksite.name ?? '');
  const [address, setAddress] = useState(worksite.address ?? '');
  const [latitude, setLatitude] = useState(worksite.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(worksite.longitude?.toString() ?? '');
  const [entryRadius, setEntryRadius] = useState(worksite.entryRadius?.toString() ?? '');
  const [exitRadius, setExitRadius] = useState(worksite.exitRadius?.toString() ?? '');
  if (!editing) return <button style={btnGhost(C.indigo)} onClick={() => setEditing(true)}>Edit</button>;
  return (
    <form style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      onSubmit={e => {
        e.preventDefault();
        onUpdate(Number(worksite.id), { name, address, latitude: parseFloat(latitude), longitude: parseFloat(longitude), entryRadius: parseFloat(entryRadius), exitRadius: parseFloat(exitRadius) });
        setEditing(false);
      }}>
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 120 }} value={name} onChange={e => setName(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 160 }} value={address} onChange={e => setAddress(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 90 }} type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} />
      <input style={{ ...inputSx, fontSize: '0.7rem', width: 90 }} type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} />
      <RadiusInput label="Entry" value={entryRadius} onChange={setEntryRadius} />
      <RadiusInput label="Exit"  value={exitRadius}  onChange={setExitRadius} />
      <button type="submit" style={btnGhost(C.teal)}>Save</button>
      <button type="button" style={btnGhost(C.t3)} onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

// ── Admin Page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'worksites',   label: 'Worksites' },
  { id: 'employees',   label: 'Employees' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'monitoring',  label: 'Monitoring' },
  { id: 'projects',    label: 'Projects' },
  { id: 'reports',     label: 'Reports' },
];

export default function AdminPage() {
  useAuth();
  useRouter();
  const [activeTab, setActiveTab] = useState('worksites');
  const [worksites, setWorksites]   = useState<Worksite[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions]     = useState<AttendanceSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [wsRes, empRes, asgRes, sesRes] = await Promise.all([
        fetch('/api/worksites'),
        fetch('/api/employees'),
        fetch('/api/assignments'),
        fetch('/api/attendance'),
      ]);
      if (wsRes.ok) setWorksites(await wsRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (asgRes.ok) setAssignments(await asgRes.json());
      if (sesRes.ok) setSessions(await sesRes.json());
    } catch (err) { console.error('fetchData error', err); }
    setDataLoading(false);
  };

  // ── CRUD helpers ──
  const crud = async (url: string, method: string, body?: object, onDone?: () => void) => {
    setDataLoading(true);
    try {
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      fetchData(); onDone?.();
    } catch (err: any) { alert(err.message || 'Request failed'); setDataLoading(false); }
  };

  const addWorksite    = (w: Omit<Worksite, 'id'>)    => crud('/api/worksites', 'POST', w);
  const updateWorksite = (id: number, w: Partial<Worksite>) => crud(`/api/worksites/${id}`, 'PATCH', w);
  const deleteWorksite = (id: number) => crud(`/api/worksites/${id}`, 'DELETE');

  const addEmployee    = (e: Omit<Employee, 'id'>)    => crud('/api/employees', 'POST', e);
  const updateEmployee = (id: number, e: Partial<Employee>) => crud(`/api/employees/${id}`, 'PATCH', e);
  const deleteEmployee = (id: number) => crud(`/api/employees/${id}`, 'DELETE');

  const addAssignment    = (a: Omit<Assignment, 'id'>)   => crud('/api/assignments', 'POST', a);
  const updateAssignment = (id: number, a: Partial<Assignment>) => crud('/api/assignments', 'PATCH', { id, ...a });
  const deleteAssignment = (id: number) => crud(`/api/assignments?id=${id}`, 'DELETE');

  const addAttendanceSession = (s: AttendanceSessionInput) =>
    crud('/api/attendance', 'POST', { employeeId: s.employeeId, worksiteId: s.worksiteId, checkInTime: s.checkInTime, location: s.location });
  const updateAttendanceSession = (id: string, s: Partial<AttendanceSessionInput> & { checkOutTime?: string }) =>
    crud('/api/attendance', 'PATCH', { sessionId: id, checkInTime: s.checkInTime, checkOutTime: s.checkOutTime, location: s.location });
  const deleteSession = (id: number) => crud(`/api/attendance/${id}`, 'DELETE');

  // ── Render ──
  if (dataLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.base, gap: 12, color: C.t3, fontSize: '0.875rem' }}>
      <span style={{ width: 18, height: 18, border: `2px solid ${C.indigo}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      Loading…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.base }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Top bar */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 20, height: 54 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginRight: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>W</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: C.t1 }}>WorkTrack</span>
        </a>
        <span style={{ color: C.border, fontSize: '1.2rem' }}>|</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.t1 }}>Admin Dashboard</span>
        <span style={{ flex: 1 }} />
        <a href="/employee" style={{ fontSize: '0.75rem', color: C.t2, textDecoration: 'none', padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.borderMd}`, background: C.elev }}>Employee View</a>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.surface, borderRadius: 10, padding: 4, border: `1px solid ${C.border}`, width: 'fit-content' }}>
          {TABS.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                  background: active ? C.indigo + '22' : 'transparent',
                  color: active ? C.indigo : C.t2,
                  boxShadow: active ? `inset 0 0 0 1px ${C.indigo}44` : 'none',
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'worksites' && (
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Worksite Management</p>
            <AddWorksiteForm onAdd={addWorksite} />
            <div style={cardSx}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Worksites ({worksites.length})</p>
              </div>
              {worksites.length === 0
                ? <p style={{ padding: 20, color: C.t3, fontSize: '0.8rem', textAlign: 'center' }}>No worksites yet.</p>
                : worksites.map((w, i) => (
                  <div key={w.id} style={{ padding: '12px 16px', borderBottom: i < worksites.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: C.t1 }}>{w.name}</p>
                      <p style={{ fontSize: '0.75rem', color: C.t3, marginTop: 2 }}>{w.address} · {w.latitude}, {w.longitude} · entry <span style={{ color: C.teal }}>{w.entryRadius} m</span> / exit <span style={{ color: C.teal }}>{w.exitRadius} m</span></p>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <EditWorksiteForm worksite={w} onUpdate={updateWorksite} />
                      <button onClick={() => deleteWorksite(Number(w.id))} style={btnGhost(C.red)}>Delete</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Employee Management</p>
            <AddEmployeeForm onAdd={addEmployee} />
            <div style={cardSx}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Employees ({employees.length})</p>
              </div>
              {employees.length === 0
                ? <p style={{ padding: 20, color: C.t3, fontSize: '0.8rem', textAlign: 'center' }}>No employees yet.</p>
                : employees.map((e, i) => (
                  <div key={e.id} style={{ padding: '12px 16px', borderBottom: i < employees.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500, color: C.t1 }}>{e.name}</p>
                      <p style={{ fontSize: '0.75rem', color: C.t3, marginTop: 2 }}>{e.email}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <EditEmployeeForm employee={e} onUpdate={updateEmployee} />
                      <button onClick={() => deleteEmployee(Number(e.id))} style={btnGhost(C.red)}>Delete</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Assignment Management</p>
            <AddAssignmentForm onAdd={addAssignment} employees={employees} worksites={worksites} />
            <div style={cardSx}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Assignments ({assignments.length})</p>
              </div>
              {assignments.length === 0
                ? <p style={{ padding: 20, color: C.t3, fontSize: '0.8rem', textAlign: 'center' }}>No assignments yet.</p>
                : assignments.map((a, i) => (
                  <div key={a.id} style={{ padding: '12px 16px', borderBottom: i < assignments.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.85rem', color: C.t2 }}>
                      <span style={{ color: C.t1, fontWeight: 500 }}>{employees.find(e => e.id === a.employeeId)?.name || a.employeeId}</span>
                      {' · '}{a.date}
                      {' · '}{a.worksiteIds?.map(id => worksites.find(w => w.id === id)?.name || id).join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <EditAssignmentForm assignment={a} onUpdate={updateAssignment} employees={employees} worksites={worksites} />
                      <button onClick={() => deleteAssignment(Number(a.id))} style={btnGhost(C.red)}>Delete</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <AttendanceMonitoringTab
            employees={employees} worksites={worksites} sessions={sessions}
            addAttendanceSession={addAttendanceSession}
            updateAttendanceSession={updateAttendanceSession}
            deleteSession={deleteSession}
          />
        )}

        {activeTab === 'projects' && <ProjectsTab employees={employees} />}

        {activeTab === 'reports' && (
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: C.t1, marginBottom: 16 }}>Reports</p>
            <div style={{ ...cardSx, padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: 10 }}>📊</p>
              <p style={{ color: C.t2, fontSize: '0.875rem' }}>Report generation coming soon.</p>
              <p style={{ color: C.t3, fontSize: '0.8rem', marginTop: 6 }}>Timesheet exports, attendance summaries, and project hours breakdowns will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
