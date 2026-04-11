'use client';

import { useState, useEffect, useMemo } from 'react';
import { Worksite, AttendanceSession } from '../../types';
import { useRouter } from 'next/navigation';

// ── helpers ────────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekDaysOf(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtSlash(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function fmtHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

const DAY_NAMES  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON_ABBREV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Status = 'Draft' | 'Submitted' | 'Approved' | 'Declined';

// ── component ──────────────────────────────────────────────────────────────────

export default function EmployeePage() {
  const user = {
    email: 'test@example.com',
    name:  'Test User',
    id:    'ded00872-16ce-43a1-a6d2-35476da36876',
  };
  const router = useRouter();

  const [weekStart, setWeekStart]     = useState<Date>(() => getMonday(new Date()));
  const [sessions,  setSessions]      = useState<AttendanceSession[]>([]);
  const [worksites, setWorksites]     = useState<Worksite[]>([]);
  const [loading,   setLoading]       = useState(true);
  const [infoOpen,  setInfoOpen]      = useState(true);
  const [status,    setStatus]        = useState<Status>('Draft');
  const [description, setDescription] = useState('');
  const [selected,  setSelected]      = useState<Set<number>>(new Set());

  const days = useMemo(() => weekDaysOf(weekStart), [weekStart]);
  const weekEnd = useMemo(() => {
    const d = new Date(days[6]);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [days]);

  // ── data fetch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const empRes = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.name }),
        });
        const employee = await empRes.json();

        const [sessRes, wsRes] = await Promise.all([
          fetch(`/api/attendance?employeeId=${employee.id}`),
          fetch('/api/worksites'),
        ]);
        if (sessRes.ok) setSessions(await sessRes.json());
        if (wsRes.ok)   setWorksites(await wsRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── derived data ────────────────────────────────────────────────────────────

  const weekSessions = useMemo(() =>
    sessions.filter(s => {
      const d = new Date(s.checkInTime);
      return d >= weekStart && d <= weekEnd;
    }),
  [sessions, weekStart, weekEnd]);

  // Group by worksiteId → date → total minutes
  const tableRows = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const s of weekSessions) {
      const wsId   = Number(s.worksiteId);
      const dateStr = toDateStr(new Date(s.checkInTime));
      if (!map.has(wsId)) map.set(wsId, {});
      const entry = map.get(wsId)!;
      entry[dateStr] = (entry[dateStr] ?? 0) + (s.durationMinutes ?? 0);
    }
    return Array.from(map.entries()).map(([wsId, dayMins], idx) => {
      const ws = worksites.find(w => Number(w.id) === wsId);
      return {
        idx,
        worksiteId:   wsId,
        worksiteName: ws?.name ?? `Worksite ${wsId}`,
        task:         '1 – Regular Hours',
        timeType:     'Regular Hours',
        billable:     'Yes',
        dayMins,
        totalMins:    Object.values(dayMins).reduce((a, b) => a + b, 0),
      };
    });
  }, [weekSessions, worksites]);

  const dayTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of tableRows)
      for (const [d, m] of Object.entries(row.dayMins))
        t[d] = (t[d] ?? 0) + m;
    return t;
  }, [tableRows]);

  const totalMins      = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const billableMins   = tableRows.filter(r => r.billable === 'Yes').reduce((a, r) => a + r.totalMins, 0);
  const nonBillMins    = totalMins - billableMins;

  // ── week nav ────────────────────────────────────────────────────────────────

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };

  // ── selection ───────────────────────────────────────────────────────────────

  const allSelected = tableRows.length > 0 && selected.size === tableRows.length;
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(tableRows.map(r => r.idx)));
  const toggleRow   = (idx: number) => {
    const s = new Set(selected);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    setSelected(s);
  };

  // ── status badge ────────────────────────────────────────────────────────────

  const badgeClass: Record<Status, string> = {
    Draft:     'bg-gray-100 text-gray-600',
    Submitted: 'bg-teal-100 text-teal-700',
    Approved:  'bg-green-100 text-green-700',
    Declined:  'bg-red-100 text-red-700',
  };

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading)
    return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── top bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-base font-semibold text-gray-900">My Timesheet</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">◀ Prev week</button>
          <button onClick={nextWeek} className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Next week ▶</button>
          {status === 'Draft' && (
            <button
              onClick={() => setStatus('Submitted')}
              className="px-4 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              Submit
            </button>
          )}
          {status === 'Submitted' && (
            <button
              onClick={() => setStatus('Draft')}
              className="px-4 py-1.5 text-xs font-medium border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              Recall
            </button>
          )}
          <button className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Print</button>
        </div>
      </div>

      {/* ── summary strip ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-8 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Begin date</p>
          <p className="font-medium text-gray-700">{fmtSlash(weekStart)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">End date</p>
          <p className="font-medium text-gray-700">{fmtSlash(days[6])}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Total hours</p>
          <p className="font-semibold text-gray-900">{fmtHours(totalMins)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Billable hours</p>
          <p className="font-semibold text-gray-900">{fmtHours(billableMins)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Non-billable hours</p>
          <p className="font-semibold text-gray-900">{fmtHours(nonBillMins)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">GL post date</p>
          <p className="font-medium text-gray-700">{fmtSlash(days[6])}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Timesheet status</p>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass[status]}`}>
            {status}
          </span>
        </div>
      </div>

      {/* ── body ── */}
      <div className="px-6 py-4 space-y-4">

        {/* Timesheet information */}
        <div className="bg-white border border-gray-200 rounded">
          <button
            onClick={() => setInfoOpen(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none"
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform ${infoOpen ? 'rotate-90' : ''}`}
              fill="currentColor" viewBox="0 0 20 20"
            >
              <path d="M6 4l8 6-8 6V4z" />
            </svg>
            Timesheet information
          </button>

          {infoOpen && (
            <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-1">Employee</p>
                <p className="text-gray-700">{user.name} ({user.email})</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="—"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Attachments (0)</p>
                <button className="px-3 py-1 text-xs border border-teal-600 text-teal-600 rounded hover:bg-teal-50 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Manage attachments
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Time entries table */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Time entries table</h2>
          </div>

          {/* action row */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 text-xs">
            <span className="text-gray-500">{selected.size} selected</span>
            <button
              disabled={selected.size === 0}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 disabled:opacity-40 hover:enabled:bg-gray-50"
            >
              Approve
            </button>
            <button
              disabled={selected.size === 0}
              className="px-3 py-1 border border-gray-300 rounded text-gray-600 disabled:opacity-40 hover:enabled:bg-gray-50"
            >
              Decline
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                {/* column headers */}
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-medium">
                  <th className="w-8 px-3 py-2 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="text-left px-3 py-2 min-w-[180px]">
                    <span className="flex items-center gap-1">
                      Project
                      <svg className="w-3 h-3 opacity-40" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4h14v2H3V4zm2 4h10v2H5V8zm3 4h4v2H8v-2z" />
                      </svg>
                    </span>
                  </th>
                  <th className="text-left px-3 py-2 min-w-[150px]">Task</th>
                  <th className="text-left px-3 py-2 min-w-[120px]">Time type</th>
                  <th className="text-left px-3 py-2 w-16">Billable</th>
                  {days.map((d, i) => (
                    <th key={i} className="text-center px-2 py-2 w-[68px]">
                      <div>{DAY_NAMES[i]}</div>
                      <div className="font-normal text-gray-400">{MON_ABBREV[d.getMonth()]} {String(d.getDate()).padStart(2,'0')}</div>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 w-16">Totals</th>
                  <th className="w-6"></th>
                </tr>
                {/* filter inputs */}
                <tr className="border-b border-gray-100 bg-white">
                  <th></th>
                  <th className="px-2 py-1">
                    <input type="text" className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </th>
                  <th className="px-2 py-1">
                    <input type="text" className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </th>
                  <th className="px-2 py-1">
                    <input type="text" className="w-full border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400" />
                  </th>
                  <th></th>
                  {days.map((_, i) => <th key={i}></th>)}
                  <th></th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-10 text-gray-400">
                      No time entries for this week
                    </td>
                  </tr>
                ) : (
                  tableRows.map(row => (
                    <tr
                      key={row.idx}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(row.idx) ? 'bg-teal-50' : ''}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(row.idx)}
                          onChange={() => toggleRow(row.idx)}
                        />
                      </td>
                      <td className="px-3 py-2 text-teal-700 font-medium">{row.worksiteName}</td>
                      <td className="px-3 py-2 text-gray-600">{row.task}</td>
                      <td className="px-3 py-2 text-gray-600">{row.timeType}</td>
                      <td className="px-3 py-2 text-gray-600">{row.billable}</td>
                      {days.map((d, i) => {
                        const mins = row.dayMins[toDateStr(d)] ?? 0;
                        return (
                          <td key={i} className="px-2 py-2 text-center">
                            {mins > 0
                              ? <span className="text-teal-700 font-medium">{fmtHours(mins)}</span>
                              : <span className="text-gray-300">0.00</span>
                            }
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-semibold text-gray-700">
                        {fmtHours(row.totalMins)}
                      </td>
                      <td className="px-2 py-2 text-gray-400">
                        <button className="hover:text-gray-600">⋮</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                  <td></td>
                  <td colSpan={4} className="px-3 py-2">Totals</td>
                  {days.map((d, i) => {
                    const mins = dayTotals[toDateStr(d)] ?? 0;
                    return (
                      <td key={i} className="px-2 py-2 text-center">
                        {fmtHours(mins)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">{fmtHours(totalMins)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
