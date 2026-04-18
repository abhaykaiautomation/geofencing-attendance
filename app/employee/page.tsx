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
function toDateStr(d: Date)  { return d.toISOString().split('T')[0]; }
function fmtSlash(d: Date)   {
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}
function fmtH(h: number)     { return h.toFixed(2); }

const DAY_NAMES  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MON_ABBREV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
type Status = 'Draft' | 'Submitted' | 'Approved' | 'Declined';

// ── css vars shorthand ─────────────────────────────────────────────────────────
const C = {
  base:    '#09090f',
  surface: '#111118',
  elev:    '#1a1a25',
  input:   '#16161f',
  border:  'rgba(255,255,255,0.07)',
  borderMd:'rgba(255,255,255,0.11)',
  t1:      '#eeeef5',
  t2:      'rgba(238,238,245,0.55)',
  t3:      'rgba(238,238,245,0.28)',
  teal:    '#0d9488',
  tealDim: 'rgba(13,148,136,0.15)',
  indigo:  '#6366f1',
  indigoDim:'rgba(99,102,241,0.12)',
  green:   '#16a34a',
  red:     '#dc2626',
  amber:   '#d97706',
};

const STATUS_STYLE: Record<Status,{bg:string,color:string}> = {
  Draft:     { bg:'rgba(255,255,255,0.06)', color:'rgba(238,238,245,0.55)' },
  Submitted: { bg:'rgba(13,148,136,0.15)',  color:'#2dd4bf' },
  Approved:  { bg:'rgba(22,163,74,0.15)',   color:'#4ade80' },
  Declined:  { bg:'rgba(220,38,38,0.15)',   color:'#f87171' },
};

// ── component ──────────────────────────────────────────────────────────────────
export default function EmployeePage() {
  const user   = { email:'test@example.com', name:'Test User', id:'ded00872-16ce-43a1-a6d2-35476da36876' };
  const router = useRouter();

  const [weekStart, setWeekStart]     = useState<Date>(() => getMonday(new Date()));
  const [myProjects, setMyProjects]   = useState<EmployeeProject[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [infoOpen, setInfoOpen]       = useState(true);
  const [status, setStatus]           = useState<Status>('Draft');
  const [description, setDescription] = useState('');
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [editCell, setEditCell]       = useState<{rowIdx:number;dateStr:string}|null>(null);
  const [pendingHours, setPending]    = useState('');
  const [saving, setSaving]           = useState(false);
  const cellInputRef                  = useRef<HTMLInputElement>(null);

  const days    = useMemo(() => weekDaysOf(weekStart), [weekStart]);
  const weekEnd = useMemo(() => { const d = new Date(days[6]); d.setHours(23,59,59,999); return d; }, [days]);

  useEffect(() => {
    (async () => {
      try {
        const empRes   = await fetch('/api/employees', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email: user.email, name: user.name }),
        });
        const employee = await empRes.json();
        const projRes  = await fetch(`/api/projects/members?employeeId=${employee.id}`);
        if (projRes.ok) setMyProjects(await projRes.json());
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const fetchEntries = useCallback(async () => {
    const res = await fetch(
      `/api/time-entries?employeeId=${user.id}&startDate=${toDateStr(weekStart)}&endDate=${toDateStr(days[6])}`
    );
    if (res.ok) setTimeEntries(await res.json());
  }, [weekStart, days]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { if (editCell) cellInputRef.current?.focus(); }, [editCell]);

  const tableRows = useMemo(() => myProjects.map((p, idx) => {
    const dayHours: Record<string,number> = {};
    const entryById: Record<string,number> = {};
    for (const e of timeEntries.filter(e => e.projectId === p.projectId)) {
      dayHours[e.workDate]  = (dayHours[e.workDate] ?? 0) + e.hours;
      entryById[e.workDate] = e.id;
    }
    return { idx, projectId: p.projectId, projectName: p.projectName ?? `Project ${p.projectId}`,
             role: p.role ?? '—', billable: true, dayHours, entryById,
             totalHours: Object.values(dayHours).reduce((a,b) => a+b, 0) };
  }), [myProjects, timeEntries]);

  const dayTotals = useMemo(() => {
    const t: Record<string,number> = {};
    for (const r of tableRows) for (const [d,h] of Object.entries(r.dayHours)) t[d] = (t[d]??0)+h;
    return t;
  }, [tableRows]);

  const totalHours    = Object.values(dayTotals).reduce((a,b) => a+b, 0);
  const billableHours = tableRows.filter(r => r.billable).reduce((a,r) => a+r.totalHours, 0);
  const nonBillHours  = totalHours - billableHours;

  const prevWeek = () => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); setSelected(new Set()); };
  const nextWeek = () => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); setSelected(new Set()); };

  const allSel    = tableRows.length > 0 && selected.size === tableRows.length;
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(tableRows.map(r => r.idx)));
  const toggleRow = (idx: number) => { const s=new Set(selected); s.has(idx)?s.delete(idx):s.add(idx); setSelected(s); };

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
        if (existingId) await fetch(`/api/time-entries?id=${existingId}`, { method:'DELETE' });
      } else {
        await fetch('/api/time-entries', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ employeeId:user.id, projectId:row.projectId,
            workDate:editCell.dateStr, hours, timeType:'Regular Hours', billable:true }),
        });
      }
      await fetchEntries();
    } finally { setSaving(false); setEditCell(null); setPending(''); }
  };

  const handleCellKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter') { e.preventDefault(); commitEdit(); }
    if (e.key==='Escape') { setEditCell(null); setPending(''); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:C.base}}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:`${C.teal} transparent transparent transparent`}}/>
        <span className="text-sm" style={{color:C.t2}}>Loading timesheet…</span>
      </div>
    </div>
  );

  const canEdit = status === 'Draft';
  const ss      = STATUS_STYLE[status];

  return (
    <div className="min-h-screen" style={{background:C.base, color:C.t1}}>

      {/* ── top bar ── */}
      <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`}}
        className="sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
            style={{color:C.t2}}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div style={{width:'1px', height:'16px', background:C.border}}/>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:C.teal}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-sm font-semibold" style={{color:C.t1}}>My Timesheet</span>
          </div>
          {saving && <span className="text-xs animate-pulse" style={{color:C.teal}}>Saving…</span>}
        </div>

        <div className="flex items-center gap-2">
          {[{label:'◀ Prev', fn:prevWeek},{label:'Next ▶', fn:nextWeek}].map(b => (
            <button key={b.label} onClick={b.fn}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{background:C.elev, color:C.t2, border:`1px solid ${C.border}`}}
              onMouseEnter={e=>(e.currentTarget.style.background=C.elev)}
              onMouseLeave={e=>(e.currentTarget.style.background=C.elev)}>
              {b.label}
            </button>
          ))}
          {status === 'Draft' && (
            <button onClick={() => setStatus('Submitted')}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors"
              style={{background:C.teal, color:'#fff'}}>
              Submit
            </button>
          )}
          {status === 'Submitted' && (
            <button onClick={() => setStatus('Draft')}
              className="px-4 py-1.5 text-xs rounded-lg transition-colors"
              style={{background:C.elev, color:C.t2, border:`1px solid ${C.border}`}}>
              Recall
            </button>
          )}
          <button className="px-3 py-1.5 text-xs rounded-lg"
            style={{background:C.elev, color:C.t2, border:`1px solid ${C.border}`}}>
            Print
          </button>
        </div>
      </div>

      {/* ── summary strip ── */}
      <div className="px-6 py-4" style={{borderBottom:`1px solid ${C.border}`}}>
        <div className="flex flex-wrap gap-3">
          {[
            {label:'Begin date',         val:fmtSlash(weekStart)},
            {label:'End date',           val:fmtSlash(days[6])},
            {label:'Total hours',        val:fmtH(totalHours),    accent:true},
            {label:'Billable hours',     val:fmtH(billableHours), accent:true},
            {label:'Non-billable hours', val:fmtH(nonBillHours)},
            {label:'GL post date',       val:fmtSlash(days[6])},
          ].map(m => (
            <div key={m.label} className="flex flex-col gap-1 px-4 py-2.5 rounded-xl min-w-[110px]"
              style={{background:C.surface, border:`1px solid ${C.border}`}}>
              <span className="text-[11px] uppercase tracking-wider font-medium" style={{color:C.t3}}>{m.label}</span>
              <span className="text-sm font-bold tabular-nums"
                style={{color: m.accent ? C.teal : C.t1}}>{m.val}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 px-4 py-2.5 rounded-xl min-w-[110px]"
            style={{background:C.surface, border:`1px solid ${C.border}`}}>
            <span className="text-[11px] uppercase tracking-wider font-medium" style={{color:C.t3}}>Status</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md self-start"
              style={{background:ss.bg, color:ss.color}}>{status}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">

        {/* ── timesheet information ── */}
        <div className="rounded-xl overflow-hidden" style={{background:C.surface, border:`1px solid ${C.border}`}}>
          <button onClick={() => setInfoOpen(v=>!v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold select-none"
            style={{color:C.t1}}>
            <span className="flex items-center gap-2">
              <svg className={`w-3.5 h-3.5 transition-transform ${infoOpen?'rotate-90':''}`}
                fill="currentColor" viewBox="0 0 20 20" style={{color:C.t3}}>
                <path d="M6 4l8 6-8 6V4z"/>
              </svg>
              Timesheet information
            </span>
          </button>
          {infoOpen && (
            <div style={{borderTop:`1px solid ${C.border}`}} className="px-5 py-4 grid grid-cols-3 gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{color:C.t3}}>Employee</p>
                <p className="text-sm font-medium" style={{color:C.t1}}>{user.name}</p>
                <p className="text-xs mt-0.5" style={{color:C.t2}}>{user.email}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{color:C.t3}}>Description</p>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Add a note…"
                  className="w-full px-3 py-2 text-sm rounded-lg"
                  style={{background:C.input, border:`1px solid ${C.borderMd}`, color:C.t1}}/>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-1.5" style={{color:C.t3}}>Attachments</p>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
                  style={{background:C.elev, border:`1px solid ${C.teal}55`, color:C.teal}}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                  </svg>
                  Manage attachments
                </button>
              </div>

              {/* assigned projects */}
              <div className="col-span-3" style={{borderTop:`1px solid ${C.border}`, paddingTop:'1rem'}}>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{color:C.t3}}>Assigned Projects</p>
                {myProjects.length === 0
                  ? <p className="text-xs" style={{color:C.t3}}>No projects assigned.</p>
                  : <div className="flex flex-wrap gap-2">
                      {myProjects.map(p => (
                        <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                          style={{background:C.indigoDim, border:`1px solid ${C.indigo}33`, color:'#a5b4fc'}}>
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"/>
                          {p.projectName}
                          {p.role && <span style={{color:'rgba(165,180,252,0.55)'}}>· {p.role}</span>}
                        </span>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}
        </div>

        {/* ── time entries table ── */}
        <div className="rounded-xl overflow-hidden" style={{background:C.surface, border:`1px solid ${C.border}`}}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{borderBottom:`1px solid ${C.border}`}}>
            <span className="text-sm font-semibold" style={{color:C.t1}}>Time entries</span>
            <div className="flex items-center gap-3">
              {canEdit && (
                <span className="text-xs" style={{color:C.t3}}>Click any cell to enter hours</span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{color:C.t3}}>{selected.size} selected</span>
                {['Approve','Decline'].map(label => (
                  <button key={label} disabled={selected.size===0}
                    className="px-3 py-1 text-xs rounded-lg disabled:opacity-30"
                    style={{background:C.elev, border:`1px solid ${C.border}`, color:C.t2}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  <th className="w-10 px-4 py-3 text-center">
                    <input type="checkbox" checked={allSel} onChange={toggleAll}/>
                  </th>
                  <th className="text-left px-4 py-3 font-medium min-w-[180px]" style={{color:C.t3}}>Project</th>
                  <th className="text-left px-4 py-3 font-medium min-w-[130px]" style={{color:C.t3}}>Task</th>
                  <th className="text-left px-4 py-3 font-medium min-w-[120px]" style={{color:C.t3}}>Time type</th>
                  <th className="text-left px-4 py-3 font-medium w-20" style={{color:C.t3}}>Billable</th>
                  {days.map((d,i) => (
                    <th key={i} className="text-center px-2 py-3 font-medium w-[68px]" style={{color:C.t3}}>
                      <div>{DAY_NAMES[i]}</div>
                      <div className="font-normal text-[10px] mt-0.5" style={{color:C.t3}}>
                        {MON_ABBREV[d.getMonth()]} {String(d.getDate()).padStart(2,'0')}
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium w-20" style={{color:C.t3}}>Total</th>
                </tr>
              </thead>

              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-12 text-sm" style={{color:C.t3}}>
                      No projects assigned — ask your admin to assign you to a project.
                    </td>
                  </tr>
                ) : tableRows.map(row => (
                  <tr key={row.idx}
                    className="transition-colors"
                    style={{borderTop:`1px solid ${C.border}`,
                            background: selected.has(row.idx) ? 'rgba(99,102,241,0.07)' : 'transparent'}}
                    onMouseEnter={e => !selected.has(row.idx) && (e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e => !selected.has(row.idx) && (e.currentTarget.style.background='transparent')}>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={selected.has(row.idx)} onChange={() => toggleRow(row.idx)}/>
                    </td>
                    <td className="px-4 py-3 font-semibold text-xs" style={{color:C.teal}}>{row.projectName}</td>
                    <td className="px-4 py-3 text-xs" style={{color:C.t2}}>1 – Regular Hours</td>
                    <td className="px-4 py-3 text-xs" style={{color:C.t2}}>Regular Hours</td>
                    <td className="px-4 py-3 text-xs" style={{color:C.t2}}>Yes</td>

                    {days.map((d,i) => {
                      const dateStr   = toDateStr(d);
                      const hrs       = row.dayHours[dateStr] ?? 0;
                      const isEditing = editCell?.rowIdx===row.idx && editCell?.dateStr===dateStr;
                      return (
                        <td key={i}
                          onClick={() => !isEditing && startEdit(row.idx, dateStr)}
                          className="px-1 py-1 text-center transition-colors"
                          style={{cursor: canEdit ? 'pointer' : 'default',
                                  background: isEditing ? C.tealDim : undefined,
                                  outline: isEditing ? `1px solid ${C.teal}66` : undefined}}>
                          {isEditing ? (
                            <input ref={cellInputRef} type="number" min="0" max="24" step="0.5"
                              value={pendingHours} onChange={e => setPending(e.target.value)}
                              onBlur={commitEdit} onKeyDown={handleCellKey}
                              className="w-14 text-center text-xs font-semibold bg-transparent border-0"
                              style={{color:C.teal, outline:'none'}} placeholder="0"/>
                          ) : hrs > 0 ? (
                            <span className="font-semibold tabular-nums" style={{color:C.teal}}>{fmtH(hrs)}</span>
                          ) : (
                            <span style={{color:'rgba(255,255,255,0.1)'}}>—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-right font-bold tabular-nums text-xs"
                      style={{color: row.totalHours>0 ? C.t1 : C.t3}}>
                      {row.totalHours>0 ? fmtH(row.totalHours) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr style={{borderTop:`2px solid ${C.border}`, background:C.elev}}>
                  <td/><td colSpan={4} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{color:C.t3}}>Totals</td>
                  {days.map((d,i) => {
                    const h = dayTotals[toDateStr(d)] ?? 0;
                    return (
                      <td key={i} className="px-2 py-3 text-center text-xs font-bold tabular-nums"
                        style={{color: h>0 ? C.t1 : C.t3}}>
                        {h>0 ? fmtH(h) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right text-xs font-bold tabular-nums"
                    style={{color:C.teal}}>{fmtH(totalHours)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
