'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { EmployeeProject, TimeEntry } from '../../types';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordModal from '../../components/ChangePasswordModal';

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

// ── Haversine distance (metres) ────────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface WS { id: string | number; name: string; latitude: number; longitude: number; entry_radius?: number; exit_radius?: number; entryRadius?: number; exitRadius?: number; }
interface ActiveSession { id: string; worksiteId: string | number; checkInTime: string; }

function GeofenceModal({ employeeId, onClose, initialLat, initialLng, autoCheck }:
  { employeeId: string; onClose: () => void; initialLat?: string; initialLng?: string; autoCheck?: boolean }) {
  const [lat, setLat]           = useState(initialLat ?? '');
  const [lng, setLng]           = useState(initialLng ?? '');
  const [gpsLoading, setGps]    = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [matches, setMatches]   = useState<{ ws: WS; distance: number; activeSession: ActiveSession | null; action: 'checkin' | 'checkout' | 'inside' }[]>([]);
  const [checked, setChecked]   = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const checkLocationWithCoords = useCallback(async (latN: number, lngN: number) => {
    setChecking(true); setMatches([]); setChecked(false); setToast(null);
    try {
      const [wsRes, sesRes] = await Promise.all([
        fetch('/api/worksites'),
        fetch(`/api/attendance?employeeId=${employeeId}`),
      ]);
      const worksites: WS[]           = wsRes.ok  ? await wsRes.json()  : [];
      const sessions: ActiveSession[] = sesRes.ok ? await sesRes.json() : [];
      const openSessions = sessions.filter((s: any) => !s.checkOutTime);

      const found = worksites
        .map(ws => {
          const dist     = haversineM(latN, lngN, Number(ws.latitude), Number(ws.longitude));
          const entryR   = Number(ws.entry_radius  ?? ws.entryRadius ?? 100);
          const exitR    = Number(ws.exit_radius   ?? ws.exitRadius  ?? 150);
          const active   = openSessions.find((s: any) => String(s.worksiteId) === String(ws.id)) ?? null;

          if (active && dist > exitR) {
            // Checked in but now outside exit radius → offer check-out
            return { ws, distance: Math.round(dist), activeSession: active, action: 'checkout' as const };
          }
          if (!active && dist <= entryR) {
            // Not checked in and within entry radius → offer check-in
            return { ws, distance: Math.round(dist), activeSession: null, action: 'checkin' as const };
          }
          if (active && dist <= exitR) {
            // Still inside exit radius — show info only, no action yet
            return { ws, distance: Math.round(dist), activeSession: active, action: 'inside' as const };
          }
          return null;
        })
        .filter(Boolean) as { ws: WS; distance: number; activeSession: ActiveSession | null; action: 'checkin' | 'checkout' | 'inside' }[];

      setMatches(found);
      setChecked(true);
      if (found.length === 0) setToast({ msg: 'No actionable worksites at this location', ok: false });
    } catch { setToast({ msg: 'Failed to check location', ok: false }); }
    finally { setChecking(false); }
  }, [employeeId]);

  // Auto-run on mount if initial coords provided
  useEffect(() => {
    if (autoCheck && initialLat && initialLng) {
      const latN = parseFloat(initialLat); const lngN = parseFloat(initialLng);
      if (!isNaN(latN) && !isNaN(lngN)) checkLocationWithCoords(latN, lngN);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const useGPS = () => {
    if (!navigator.geolocation) { setToast({ msg: 'Geolocation not supported', ok: false }); return; }
    setGps(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(7)); setLng(pos.coords.longitude.toFixed(7)); setGps(false); setChecked(false); setMatches([]); },
      () => { setToast({ msg: 'Could not get location', ok: false }); setGps(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const checkLocation = async () => {
    const latN = parseFloat(lat); const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) { setToast({ msg: 'Enter valid coordinates', ok: false }); return; }
    await checkLocationWithCoords(latN, lngN);
  };

  const doCheckIn = async (ws: WS) => {
    setSaving(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, worksiteId: ws.id, checkInTime: new Date().toISOString(), location: { lat: parseFloat(lat), lng: parseFloat(lng) } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const session = await res.json();
      setToast({ msg: `Checked in at ${ws.name}`, ok: true });
      setMatches(prev => prev.map(m => m.ws.id === ws.id
        ? { ...m, activeSession: { id: String(session.id), worksiteId: ws.id, checkInTime: session.checkInTime } }
        : m));
      setTimeout(() => onClose(), 1500);
    } catch (e: any) { setToast({ msg: e.message ?? 'Check-in failed', ok: false }); }
    finally { setSaving(false); }
  };

  const doCheckOut = async (ws: WS, session: ActiveSession) => {
    setSaving(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, checkOutTime: new Date().toISOString(), location: { lat: parseFloat(lat), lng: parseFloat(lng) } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setToast({ msg: `Checked out from ${ws.name}`, ok: true });
      setMatches(prev => prev.map(m => m.ws.id === ws.id ? { ...m, activeSession: null } : m));
      setTimeout(() => onClose(), 1500);
    } catch (e: any) { setToast({ msg: e.message ?? 'Check-out failed', ok: false }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: 14, width: '100%', maxWidth: 420, padding: 24 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: C.t1, margin: 0 }}>Attendance Check-In / Out</p>
            <p style={{ fontSize: '0.75rem', color: C.t3, margin: '3px 0 0' }}>Enter or detect your location to verify geofence</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* lat / lng inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: C.t3, fontWeight: 600, display: 'block', marginBottom: 4 }}>Latitude</label>
            <input value={lat} onChange={e => { setLat(e.target.value); setChecked(false); setMatches([]); }} placeholder="e.g. 28.6139"
              style={{ width: '100%', background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1, borderRadius: 8, fontSize: '0.8rem', padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: C.t3, fontWeight: 600, display: 'block', marginBottom: 4 }}>Longitude</label>
            <input value={lng} onChange={e => { setLng(e.target.value); setChecked(false); setMatches([]); }} placeholder="e.g. 77.2090"
              style={{ width: '100%', background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1, borderRadius: 8, fontSize: '0.8rem', padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* action row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={useGPS} disabled={gpsLoading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.elev, border: `1px solid ${C.borderMd}`, color: C.t2, borderRadius: 8, fontSize: '0.75rem', padding: '8px', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
            {gpsLoading ? 'Detecting…' : 'Use My Location'}
          </button>
          <button onClick={checkLocation} disabled={checking || !lat || !lng}
            style={{ flex: 1, background: C.teal, border: 'none', color: '#fff', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, padding: '8px', cursor: 'pointer', opacity: (!lat || !lng) ? 0.5 : 1 }}>
            {checking ? 'Checking…' : 'Check Location'}
          </button>
        </div>

        {/* toast */}
        {toast && (
          <div style={{
            background: toast.ok ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            border: `1px solid ${toast.ok ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.25)'}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 12
          }}>
            <p style={{ fontSize: '0.75rem', color: toast.ok ? '#4ade80' : '#f87171', margin: 0 }}>{toast.msg}</p>
          </div>
        )}

        {/* results */}
        {checked && matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matches.map(({ ws, distance, activeSession, action }) => {
              const entryR = Number(ws.entry_radius ?? ws.entryRadius ?? 100);
              const exitR  = Number(ws.exit_radius  ?? ws.exitRadius  ?? 150);
              const borderColor = action === 'checkout' ? 'rgba(217,119,6,0.45)' : action === 'checkin' ? 'rgba(99,102,241,0.35)' : 'rgba(13,148,136,0.4)';
              const badgeBg    = action === 'inside'   ? 'rgba(13,148,136,0.15)' : action === 'checkout' ? 'rgba(217,119,6,0.15)' : 'rgba(99,102,241,0.12)';
              const badgeColor = action === 'inside'   ? C.teal : action === 'checkout' ? C.amber : C.indigo;
              const badgeLabel = action === 'inside'   ? 'CHECKED IN' : action === 'checkout' ? 'LEFT ZONE' : 'NOT CHECKED IN';
              return (
              <div key={String(ws.id)} style={{ background: C.elev, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: C.t1, margin: 0 }}>{ws.name}</p>
                    <p style={{ fontSize: '0.72rem', color: C.t3, margin: '2px 0 0' }}>
                      {distance}m away · entry {entryR}m · exit {exitR}m
                    </p>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: badgeBg, color: badgeColor }}>
                    {badgeLabel}
                  </span>
                </div>
                {action === 'checkin' && (
                  <button onClick={() => doCheckIn(ws)} disabled={saving}
                    style={{ width: '100%', background: C.indigo, border: 'none', color: '#fff', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, padding: '8px', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : `Check In at ${ws.name}`}
                  </button>
                )}
                {action === 'checkout' && activeSession && (
                  <button onClick={() => doCheckOut(ws, activeSession)} disabled={saving}
                    style={{ width: '100%', background: C.amber, border: 'none', color: '#fff', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, padding: '8px', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : `Check Out from ${ws.name}`}
                  </button>
                )}
                {action === 'inside' && (
                  <p style={{ fontSize: '0.75rem', color: C.teal, margin: 0, textAlign: 'center', padding: '4px 0' }}>
                    Still within exit radius ({exitR}m) — move away to check out
                  </p>
                )}
              </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

// ── component ──────────────────────────────────────────────────────────────────
function EmployeePageInner() {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const viewEmployeeId = searchParams.get('employeeId'); // set when admin navigates here
  const isAdminView    = !!viewEmployeeId;

  useEffect(() => {
    if (!authLoading && !authUser) router.replace('/login');
  }, [authUser, authLoading, router]);

  const [employeeRecord, setEmployeeRecord] = useState<{ id: string; name: string; email: string } | null>(null);

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
  const [showChangePwd, setShowChangePwd]   = useState(false);
  const [showGeofence, setShowGeofence]     = useState(false);
  const [autoLat, setAutoLat]               = useState('');
  const [autoLng, setAutoLng]               = useState('');
  const [autoNotif, setAutoNotif]           = useState<{ msg: string; ok: boolean } | null>(null);
  const cellInputRef                        = useRef<HTMLInputElement>(null);

  const days    = useMemo(() => weekDaysOf(weekStart), [weekStart]);
  const weekEnd = useMemo(() => { const d = new Date(days[6]); d.setHours(23,59,59,999); return d; }, [days]);

  useEffect(() => {
    (async () => {
      try {
        let employee: { id: string; name: string; email: string };
        if (viewEmployeeId) {
          // Admin viewing a specific employee
          const res = await fetch(`/api/employees/${viewEmployeeId}`);
          if (!res.ok) { router.replace('/admin'); return; }
          employee = await res.json();
        } else {
          // Normal employee self-view — upsert by email
          const email = authUser?.email ?? '';
          const name  = authUser?.displayName ?? email;
          const res   = await fetch('/api/employees', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name }),
          });
          employee = await res.json();
        }
        setEmployeeRecord(employee);
        const projRes = await fetch(`/api/projects/members?employeeId=${employee.id}`);
        if (projRes.ok) setMyProjects(await projRes.json());
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [viewEmployeeId, authUser]);

  const fetchEntries = useCallback(async () => {
    if (!employeeRecord) return;
    const res = await fetch(
      `/api/time-entries?employeeId=${employeeRecord.id}&startDate=${toDateStr(weekStart)}&endDate=${toDateStr(days[6])}`
    );
    if (res.ok) setTimeEntries(await res.json());
  }, [employeeRecord, weekStart, days]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { if (editCell) cellInputRef.current?.focus(); }, [editCell]);

  // Auto-open attendance popup on load if within entry radius OR outside exit radius with active session
  useEffect(() => {
    if (isAdminView || !employeeRecord || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const latN = pos.coords.latitude;
      const lngN = pos.coords.longitude;
      try {
        const [wsRes, sesRes] = await Promise.all([
          fetch('/api/worksites'),
          fetch(`/api/attendance?employeeId=${employeeRecord.id}`),
        ]);
        if (!wsRes.ok) return;
        const worksites: WS[] = await wsRes.json();
        const sessions: any[] = sesRes.ok ? await sesRes.json() : [];
        const openSessions = sessions.filter((s: any) => !s.checkOutTime);

        const shouldOpen = worksites.some(ws => {
          const dist   = haversineM(latN, lngN, Number(ws.latitude), Number(ws.longitude));
          const entryR = Number(ws.entry_radius ?? ws.entryRadius ?? 100);
          const exitR  = Number(ws.exit_radius  ?? ws.exitRadius  ?? 150);
          const active = openSessions.find((s: any) => String(s.worksiteId) === String(ws.id));
          // Open if: within entry radius (can check in) OR has active session and outside exit radius (should check out)
          return dist <= entryR || (active && dist > exitR);
        });

        if (shouldOpen) {
          setAutoLat(latN.toFixed(7));
          setAutoLng(lngN.toFixed(7));
          setShowGeofence(true);
        }
      } catch { /* silent */ }
    }, () => { /* permission denied — silent */ }, { enableHighAccuracy: true, timeout: 10000 });
  }, [employeeRecord, isAdminView]);

  useEffect(() => {
    if (isAdminView || !employeeRecord || !navigator.geolocation) return;
    // Track which sessions we've already auto-acted on to prevent rapid re-fires
    const actedIn  = new Set<string>(); // worksiteId strings we recently checked into
    const actedOut = new Set<string>(); // sessionIds we recently checked out

    const handlePosition = async (pos: GeolocationPosition) => {
      const latN = pos.coords.latitude;
      const lngN = pos.coords.longitude;
      try {
        const [wsRes, sesRes] = await Promise.all([
          fetch('/api/worksites'),
          fetch(`/api/attendance?employeeId=${employeeRecord.id}`),
        ]);
        if (!wsRes.ok || !sesRes.ok) return;
        const worksites: WS[] = await wsRes.json();
        const allSessions: any[] = await sesRes.json();
        const openSessions = allSessions.filter((s: any) => !s.checkOutTime);

        for (const ws of worksites) {
          const dist   = haversineM(latN, lngN, Number(ws.latitude), Number(ws.longitude));
          const entryR = Number(ws.entry_radius ?? ws.entryRadius ?? 100);
          const exitR  = Number(ws.exit_radius  ?? ws.exitRadius  ?? 150);
          const wsId   = String(ws.id);
          const active = openSessions.find((s: any) => String(s.worksiteId) === wsId);

          if (!active && dist <= entryR && !actedIn.has(wsId)) {
            actedIn.add(wsId);
            const res = await fetch('/api/attendance', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employeeId: employeeRecord.id, worksiteId: ws.id, checkInTime: new Date().toISOString(), location: { lat: latN, lng: lngN } }),
            });
            if (res.ok) setAutoNotif({ msg: `Auto checked in at ${ws.name}`, ok: true });
            setTimeout(() => actedIn.delete(wsId), 300000); // 5 min cooldown
          }

          if (active && dist > exitR && !actedOut.has(active.id)) {
            actedOut.add(active.id);
            const res = await fetch('/api/attendance', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: active.id, checkOutTime: new Date().toISOString(), location: { lat: latN, lng: lngN } }),
            });
            if (res.ok) {
              setAutoNotif({ msg: `Auto checked out from ${ws.name}`, ok: false });
              actedIn.delete(wsId); // allow re-entry
            }
          }
        }
      } catch { /* silent */ }
    };

    const watchId = navigator.geolocation.watchPosition(handlePosition, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [employeeRecord, isAdminView]);

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
          body: JSON.stringify({ employeeId: employeeRecord?.id, projectId:row.projectId,
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

  const canEdit = !isAdminView && status === 'Draft';
  const ss      = STATUS_STYLE[status];

  return (
    <>
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
          <div style={{width:'1px', height:'16px', background:C.border}}/>
          <span className="text-xs" style={{color:C.t3}}>{authUser?.email}</span>
          {!isAdminView && (
            <button onClick={() => setShowGeofence(true)}
              className="px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors"
              style={{background:'rgba(13,148,136,0.15)', color:C.teal, border:`1px solid rgba(13,148,136,0.35)`}}>
              📍 Attendance
            </button>
          )}
          <button onClick={() => setShowChangePwd(true)}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{background:C.elev, color:C.t2, border:`1px solid ${C.border}`}}>
            Change Password
          </button>
          <button onClick={async () => { await signOut(); router.replace('/login'); }}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{background:C.elev, color:C.t2, border:`1px solid ${C.border}`}}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── auto-tracking notification ── */}
      {autoNotif && !isAdminView && (
        <div style={{ background: autoNotif.ok ? 'rgba(13,148,136,0.12)' : 'rgba(217,119,6,0.12)', borderBottom: `1px solid ${autoNotif.ok ? 'rgba(13,148,136,0.3)' : 'rgba(217,119,6,0.3)'}`, padding: '7px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: autoNotif.ok ? C.teal : C.amber }}>
            📍 {autoNotif.msg}
          </span>
          <button onClick={() => setAutoNotif(null)} style={{ background: 'none', border: 'none', color: autoNotif.ok ? C.teal : C.amber, cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
        </div>
      )}

      {/* ── admin view banner ── */}
      {isAdminView && (
        <div style={{ background: 'rgba(99,102,241,0.1)', borderBottom: `1px solid rgba(99,102,241,0.25)`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>
            Viewing as admin — <strong>{employeeRecord?.name}</strong> ({employeeRecord?.email}) · Read-only
          </span>
          <button onClick={() => router.replace('/admin')}
            style={{ fontSize: '0.72rem', color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            ← Back to Admin
          </button>
        </div>
      )}

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
                <p className="text-sm font-medium" style={{color:C.t1}}>{employeeRecord?.name ?? '—'}</p>
                <p className="text-xs mt-0.5" style={{color:C.t2}}>{employeeRecord?.email ?? '—'}</p>
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

    {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    {showGeofence && employeeRecord && (
      <GeofenceModal
        employeeId={employeeRecord.id}
        onClose={() => { setShowGeofence(false); setAutoLat(''); setAutoLng(''); }}
        initialLat={autoLat || undefined}
        initialLng={autoLng || undefined}
        autoCheck={!!(autoLat && autoLng)}
      />
    )}
    </>
  );
}

export default function EmployeePage() {
  return (
    <Suspense>
      <EmployeePageInner />
    </Suspense>
  );
}
