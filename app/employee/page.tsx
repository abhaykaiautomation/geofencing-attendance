'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EmployeeProject, TimeEntry } from '../../types';
import { useRouter } from 'next/navigation';

// ── helpers ────────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}
function weekDaysOf(mon: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }
function fmtSlash(d: Date): string {
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}
function fmtH(h: number): string { return h.toFixed(2); }

const DAY_NAMES  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MON_ABBREV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
type Status = 'Draft' | 'Submitted' | 'Approved' | 'Declined';

const BADGE: Record<Status, string> = {
  Draft:     'bg-gray-100 text-gray-600',
  Submitted: 'bg-teal-100 text-teal-700',
  Approved:  'bg-green-100 text-green-700',
  Declined:  'bg-red-100 text-red-700',
};

// ── component ──────────────────────────────────────────────────────────────────

export default function EmployeePage() {
  const user = { email: 'test@example.com', name: 'Test User', id: 'ded00872-16ce-43a1-a6d2-35476da36876' };
  const router = useRouter();

  // ── state ──
  const [weekStart, setWeekStart]     = useState<Date>(() => getMonday(new Date()));
  const [myProjects, setMyProjects]   = useState<EmployeeProject[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [infoOpen, setInfoOpen]       = useState(true);
  const [status, setStatus]           = useState<Status>('Draft');
  const [description, setDescription] = useState('');
  const [selected, setSelected]       = useState<Set<number>>(new Set());

  // inline cell editing
  const [editCell, setEditCell]     = useState<{ rowIdx: number; dateStr: string } | null>(null);
  const [pendingHours, setPending]  = useState('');
  const [saving, setSaving]         = useState(false);
  const cellInputRef                = useRef<HTMLInputElement>(null);

  const days    = useMemo(() => weekDaysOf(weekStart), [weekStart]);
  const weekEnd = useMemo(() => { const d = new Date(days[6]); d.setHours(23,59,59,999); return d; }, [days]);

  // ── initial load ──
  useEffect(() => {
    (async () => {
      try {
        const empRes  = await fetch('/api/employees', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.name }),
        });
        const employee = await empRes.json();
        const projRes = await fetch(`/api/projects/members?employeeId=${employee.id}`);
        if (projRes.ok) setMyProjects(await projRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── fetch time entries whenever week changes ──
  const fetchEntries = useCallback(async () => {
    const res = await fetch(
      `/api/time-entries?employeeId=${user.id}&startDate=${toDateStr(weekStart)}&endDate=${toDateStr(days[6])}`
    );
    if (res.ok) setTimeEntries(await res.json());
  }, [weekStart, days]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // focus cell input when edit starts
  useEffect(() => { if (editCell) cellInputRef.current?.focus(); }, [editCell]);

  // ── derived rows ──
  const tableRows = useMemo(() => myProjects.map((p, idx) => {
    const dayHours:  Record<string, number> = {};
    const entryById: Record<string, number> = {}; // dateStr -> entry id
    for (const e of timeEntries.filter(e => e.projectId === p.projectId)) {
      dayHours[e.workDate]  = (dayHours[e.workDate] ?? 0) + e.hours;
      entryById[e.workDate] = e.id;
    }
    return {
      idx,
      projectId:   p.projectId,
      projectName: p.projectName ?? `Project ${p.projectId}`,
      role:        p.role ?? '—',
      billable:    true,
      dayHours,
      entryById,
      totalHours:  Object.values(dayHours).reduce((a, b) => a + b, 0),
    };
  }), [myProjects, timeEntries]);

  const dayTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of tableRows) for (const [d, h] of Object.entries(r.dayHours)) t[d] = (t[d] ?? 0) + h;
    return t;
  }, [tableRows]);

  const totalHours    = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const billableHours = tableRows.filter(r => r.billable).reduce((a, r) => a + r.totalHours, 0);
  const nonBillHours  = totalHours - billableHours;

  // ── week nav ──
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); setSelected(new Set()); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); setSelected(new Set()); };

  // ── selection ──
  const allSel   = tableRows.length > 0 && selected.size === tableRows.length;
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(tableRows.map(r => r.idx)));
  const toggleRow = (idx: number) => { const s = new Set(selected); s.has(idx) ? s.delete(idx) : s.add(idx); setSelected(s); };

  // ── cell editing ──
  const startEdit = (rowIdx: number, dateStr: string) => {
    if (status !== 'Draft') return;
    const row = tableRows[rowIdx];
    setPending(row.dayHours[dateStr] > 0 ? fmtH(row.dayHours[dateStr]) : '');
    setEditCell({ rowIdx, dateStr });
  };

  const commitEdit = async () => {
    if (!editCell) return;
    const row   = tableRows[editCell.rowIdx];
    const hours = parseFloat(pendingHours);
    const existingId = row.entryById[editCell.dateStr];

    setSaving(true);
    try {
      if (!pendingHours.trim() || isNaN(hours) || hours <= 0) {
        // clear — delete if exists
        if (existingId) await fetch(`/api/time-entries?id=${existingId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: user.id,
            projectId:  row.projectId,
            workDate:   editCell.dateStr,
            hours,
            timeType:   'Regular Hours',
            billable:   true,
          }),
        });
      }
      await fetchEntries();
    } finally {
      setSaving(false);
      setEditCell(null);
      setPending('');
    }
  };

  const handleCellKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditCell(null); setPending(''); }
  };

  // ── render ──
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>;

  const canEdit = status === 'Draft';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h1 className="text-base font-semibold text-gray-900">My Timesheet</h1>
          {saving && <span className="text-xs text-teal-500 animate-pulse">Saving…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">◀ Prev</button>
          <button onClick={nextWeek} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Next ▶</button>
          {status === 'Draft' && (
            <button onClick={() => setStatus('Submitted')}
              className="px-4 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700">
              Submit
            </button>
          )}
          {status === 'Submitted' && (
            <button onClick={() => setStatus('Draft')}
              className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
              Recall
            </button>
          )}
          <button className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Print</button>
        </div>
      </div>

      {/* summary strip */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex flex-wrap items-center gap-8 text-sm">
        {[
          ['Begin date',         fmtSlash(weekStart)],
          ['End date',           fmtSlash(days[6])],
          ['Total hours',        fmtH(totalHours)],
          ['Billable hours',     fmtH(billableHours)],
          ['Non-billable hours', fmtH(nonBillHours)],
          ['GL post date',       fmtSlash(days[6])],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="font-semibold text-gray-800">{val}</p>
          </div>
        ))}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Timesheet status</p>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${BADGE[status]}`}>{status}</span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* Timesheet information */}
        <div className="bg-white border border-gray-200 rounded">
          <button onClick={() => setInfoOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none">
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${infoOpen ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"><path d="M6 4l8 6-8 6V4z"/></svg>
            Timesheet information
          </button>
          {infoOpen && (
            <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-1">Employee</p>
                <p className="text-gray-700">{user.name} <span className="text-gray-400">({user.email})</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="—"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"/>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Attachments (0)</p>
                <button className="px-3 py-1 text-xs border border-teal-600 text-teal-600 rounded hover:bg-teal-50 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                  Manage attachments
                </button>
              </div>
              {/* Assigned projects */}
              <div className="col-span-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">Assigned Projects</p>
                {myProjects.length === 0
                  ? <p className="text-xs text-gray-400">No projects assigned.</p>
                  : <div className="flex flex-wrap gap-2">
                      {myProjects.map(p => (
                        <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"/>
                          {p.projectName}
                          {p.role && <span className="text-indigo-400">· {p.role}</span>}
                        </span>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}
        </div>

        {/* Time entries table */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Time entries table</h2>
            {canEdit && (
              <p className="text-xs text-gray-400">Click any cell to enter hours · Enter to save · Esc to cancel</p>
            )}
          </div>

          {/* action row */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 text-xs">
            <span className="text-gray-500">{selected.size} selected</span>
            <button disabled={selected.size === 0}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 disabled:opacity-40 hover:enabled:bg-gray-50">
              Approve
            </button>
            <button disabled={selected.size === 0}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 disabled:opacity-40 hover:enabled:bg-gray-50">
              Decline
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-medium">
                  <th className="w-8 px-3 py-2 text-center">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}/>
                  </th>
                  <th className="text-left px-3 py-2 min-w-[180px]">Project</th>
                  <th className="text-left px-3 py-2 min-w-[120px]">Task</th>
                  <th className="text-left px-3 py-2 min-w-[120px]">Time type</th>
                  <th className="text-left px-3 py-2 w-16">Billable</th>
                  {days.map((d, i) => (
                    <th key={i} className="text-center px-2 py-2 w-[68px]">
                      <div>{DAY_NAMES[i]}</div>
                      <div className="font-normal text-gray-400">{MON_ABBREV[d.getMonth()]} {String(d.getDate()).padStart(2,'0')}</div>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 w-16">Totals</th>
                </tr>
                {/* filter row */}
                <tr className="border-b border-gray-100">
                  <th/><th className="px-2 py-1"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"/></th>
                  <th className="px-2 py-1"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"/></th>
                  <th className="px-2 py-1"><input className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none"/></th>
                  <th/>{days.map((_,i)=><th key={i}/>)}<th/>
                </tr>
              </thead>

              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-10 text-gray-400">No projects assigned. Ask your admin to assign you to a project.</td></tr>
                ) : tableRows.map(row => (
                  <tr key={row.idx} className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(row.idx) ? 'bg-teal-50' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selected.has(row.idx)} onChange={() => toggleRow(row.idx)}/>
                    </td>
                    <td className="px-3 py-2 text-teal-700 font-medium">{row.projectName}</td>
                    <td className="px-3 py-2 text-gray-600">1 – Regular Hours</td>
                    <td className="px-3 py-2 text-gray-600">Regular Hours</td>
                    <td className="px-3 py-2 text-gray-600">Yes</td>

                    {days.map((d, i) => {
                      const dateStr  = toDateStr(d);
                      const hours    = row.dayHours[dateStr] ?? 0;
                      const isEditing = editCell?.rowIdx === row.idx && editCell?.dateStr === dateStr;

                      return (
                        <td key={i}
                          onClick={() => !isEditing && startEdit(row.idx, dateStr)}
                          className={`px-1 py-1 text-center transition-colors
                            ${canEdit ? 'cursor-pointer hover:bg-teal-50' : ''}
                            ${isEditing ? 'bg-teal-50 ring-1 ring-inset ring-teal-400 rounded' : ''}`}
                        >
                          {isEditing ? (
                            <input
                              ref={cellInputRef}
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={pendingHours}
                              onChange={e => setPending(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleCellKey}
                              className="w-14 text-center border-0 bg-transparent text-teal-700 font-medium focus:outline-none text-xs"
                              placeholder="0"
                            />
                          ) : hours > 0 ? (
                            <span className="text-teal-700 font-semibold">{fmtH(hours)}</span>
                          ) : (
                            <span className={`${canEdit ? 'text-gray-200 group-hover:text-gray-300' : 'text-gray-200'}`}>—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-right font-semibold text-gray-700">
                      {row.totalHours > 0 ? fmtH(row.totalHours) : <span className="text-gray-300">0.00</span>}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                  <td/><td colSpan={4} className="px-3 py-2 text-xs">Totals</td>
                  {days.map((d, i) => {
                    const h = dayTotals[toDateStr(d)] ?? 0;
                    return (
                      <td key={i} className="px-2 py-2 text-center text-xs">
                        {h > 0 ? <span className="font-semibold">{fmtH(h)}</span> : <span className="text-gray-300">0.00</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-xs">{fmtH(totalHours)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
