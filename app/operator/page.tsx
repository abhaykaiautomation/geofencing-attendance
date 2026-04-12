'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── types ──────────────────────────────────────────────────────────────────────

interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface VehicleRecord {
  id: number;
  vin: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  scannedBy: string | null;
  worksiteName: string | null;
  notes: string | null;
  scannedAt: string;
}

// ── VIN validation ─────────────────────────────────────────────────────────────

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

function isValidVin(v: string) {
  return VIN_RE.test(v.trim());
}

// ── component ──────────────────────────────────────────────────────────────────

export default function OperatorPage() {
  const router = useRouter();

  // ── GPS ──
  const [gps, setGps]           = useState<GpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState(true);

  // ── VIN input ──
  const [vin, setVin]             = useState('');
  const [vinError, setVinError]   = useState('');
  const vinInputRef               = useRef<HTMLInputElement>(null);

  // ── Camera scanner ──
  const [cameraOn, setCameraOn]         = useState(false);
  const [cameraError, setCameraError]   = useState('');
  const [scanning, setScanning]         = useState(false);
  const [barcodeSupported, setBarcodeSupported] = useState(false);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  // ── Submission ──
  const [submitting, setSubmitting]   = useState(false);
  const [lastScan, setLastScan]       = useState<VehicleRecord | null>(null);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // ── History ──
  const [history, setHistory]         = useState<VehicleRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [searchVin, setSearchVin]     = useState('');

  // ── operator meta ──
  const [operatorName, setOperatorName] = useState('Operator');
  const [notes, setNotes]               = useState('');

  // ── init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Check BarcodeDetector support
    if ('BarcodeDetector' in window) {
      setBarcodeSupported(true);
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: ['code_39', 'code_128', 'qr_code', 'data_matrix', 'pdf417'],
      });
    }

    // Acquire GPS immediately
    acquireGps();

    // Load history
    loadHistory();

    // Auto-focus VIN input
    vinInputRef.current?.focus();
  }, []);

  // Re-focus VIN input when camera is off
  useEffect(() => {
    if (!cameraOn) vinInputRef.current?.focus();
  }, [cameraOn]);

  // ── GPS ──────────────────────────────────────────────────────────────────

  const acquireGps = () => {
    setGpsLoading(true);
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by this browser.');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsLoading(false);
      },
      err => {
        setGpsError(`GPS error: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  // ── Camera scanner ────────────────────────────────────────────────────────

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setScanning(true);
      scanLoop();
    } catch (e: any) {
      setCameraError(`Camera error: ${e.message}`);
    }
  };

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  const scanLoop = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    try {
      const barcodes: any[] = await detectorRef.current.detect(videoRef.current);
      for (const b of barcodes) {
        const raw = b.rawValue?.trim() ?? '';
        if (isValidVin(raw)) {
          // Found a valid VIN — stop camera and populate input
          stopCamera();
          setVin(raw.toUpperCase());
          setVinError('');
          // Vibrate on mobile if supported
          if ('vibrate' in navigator) navigator.vibrate(200);
          showToast('VIN scanned — verify and submit', true);
          return;
        }
      }
    } catch {}
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [stopCamera]);

  // ── submission ────────────────────────────────────────────────────────────

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanVin = vin.trim().toUpperCase();

    if (!isValidVin(cleanVin)) {
      setVinError('VIN must be exactly 17 characters (A–Z excluding I, O, Q  and 0–9).');
      return;
    }
    if (!gps) {
      showToast('GPS location not yet available — please wait or retry.', false);
      return;
    }

    setVinError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin:       cleanVin,
          latitude:  gps.latitude,
          longitude: gps.longitude,
          accuracy:  gps.accuracy,
          scannedBy: operatorName || null,
          notes:     notes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Server error');
      }

      const record: VehicleRecord = await res.json();
      setLastScan(record);
      setHistory(prev => [record, ...prev]);
      setVin('');
      setNotes('');
      showToast(`✓ VIN ${record.vin} saved successfully`, true);
      vinInputRef.current?.focus();
      // Refresh GPS for next scan
      acquireGps();
    } catch (err: any) {
      showToast(`Error: ${err.message}`, false);
    } finally {
      setSubmitting(false);
    }
  };

  // ── history ───────────────────────────────────────────────────────────────

  const loadHistory = async (vinFilter = '') => {
    setHistoryLoading(true);
    try {
      const url = vinFilter ? `/api/vehicles?vin=${encodeURIComponent(vinFilter)}` : '/api/vehicles?limit=30';
      const res = await fetch(url);
      if (res.ok) setHistory(await res.json());
    } catch {}
    setHistoryLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadHistory(searchVin.trim());
  };

  // ── toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── helpers ───────────────────────────────────────────────────────────────

  const fmtCoord  = (n: number) => n.toFixed(6);
  const fmtTime   = (iso: string) => new Date(iso).toLocaleString();
  const vinChunks = (v: string) => v.match(/.{1,3}/g)?.join(' ') ?? v;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all
          ${toast.ok ? 'bg-teal-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h1 className="text-base font-semibold text-gray-900">Operator — VIN Scanner</h1>
          </div>
        </div>
        {/* Operator name */}
        <input
          type="text"
          value={operatorName}
          onChange={e => setOperatorName(e.target.value)}
          placeholder="Operator name"
          className="text-sm border border-gray-300 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* GPS status bar */}
        <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm
          ${gps ? 'bg-teal-50 border border-teal-200' : gpsError ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${gps ? 'text-teal-600' : gpsError ? 'text-red-500' : 'text-yellow-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {gpsLoading && <span className="text-yellow-700">Acquiring GPS location…</span>}
            {!gpsLoading && gps && (
              <span className="text-teal-700">
                <strong>Location captured</strong> — {fmtCoord(gps.latitude)}, {fmtCoord(gps.longitude)}
                <span className="ml-2 text-teal-500 text-xs">±{gps.accuracy.toFixed(0)} m</span>
              </span>
            )}
            {!gpsLoading && gpsError && <span className="text-red-600">{gpsError}</span>}
          </div>
          <button onClick={acquireGps} className="text-xs text-gray-500 hover:text-gray-700 underline">
            Refresh
          </button>
        </div>

        {/* Scanner card */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Scan VIN</h2>
            {barcodeSupported && (
              <button
                onClick={cameraOn ? stopCamera : startCamera}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors
                  ${cameraOn
                    ? 'border-red-300 text-red-600 hover:bg-red-50'
                    : 'border-teal-600 text-teal-600 hover:bg-teal-50'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {cameraOn ? 'Stop Camera' : 'Use Camera'}
              </button>
            )}
          </div>

          {/* Camera view */}
          {cameraOn && (
            <div className="relative bg-black">
              <video ref={videoRef} className="w-full max-h-64 object-cover" muted playsInline />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-20 border-2 border-teal-400 rounded">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-teal-300 rounded-tl" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-teal-300 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-300 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-300 rounded-br" />
                </div>
              </div>
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {scanning ? 'Scanning for barcode…' : 'Initializing…'}
                </span>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="px-4 py-2 text-sm text-red-600 bg-red-50">{cameraError}</div>
          )}

          {/* VIN input form */}
          <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                VIN — 17 characters &nbsp;
                <span className="font-normal text-gray-400">(USB / Bluetooth scanner or manual entry)</span>
              </label>
              <div className="flex gap-2">
                <input
                  ref={vinInputRef}
                  type="text"
                  value={vin}
                  onChange={e => { setVin(e.target.value.toUpperCase()); setVinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="e.g. 1HGCM82633A004352"
                  maxLength={17}
                  className={`flex-1 border rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2
                    ${vinError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-teal-400'}`}
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className={`flex items-center text-xs px-2 font-mono ${vin.length === 17 ? 'text-teal-600' : 'text-gray-400'}`}>
                  {vin.length}/17
                </span>
              </div>
              {vinError && <p className="mt-1 text-xs text-red-500">{vinError}</p>}
            </div>

            {/* VIN preview chips */}
            {vin.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {vin.split('').map((ch, i) => (
                  <span key={i} className={`w-6 h-7 flex items-center justify-center text-xs font-mono rounded border
                    ${i < 3 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                      i < 9 ? 'bg-purple-50 border-purple-200 text-purple-700' :
                      'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    {ch}
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Condition, bay number, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !gps || vin.length !== 17}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting
                ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving…</>
                : <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Capture &amp; Save Location
                  </>
              }
            </button>
          </form>
        </div>

        {/* Last scan summary */}
        {lastScan && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm">
            <p className="text-xs text-teal-500 font-medium mb-1 uppercase tracking-wide">Last scan</p>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-mono font-semibold text-teal-800 text-base tracking-widest">{vinChunks(lastScan.vin)}</span>
              <span className="text-teal-600 text-xs">{fmtTime(lastScan.scannedAt)}</span>
            </div>
            <p className="text-teal-600 text-xs mt-1">
              {fmtCoord(lastScan.latitude)}, {fmtCoord(lastScan.longitude)}
              {lastScan.accuracy ? ` ±${lastScan.accuracy.toFixed(0)} m` : ''}
            </p>
          </div>
        )}

        {/* History */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700 shrink-0">Recent Scans</h2>
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-xs">
              <input
                type="text"
                value={searchVin}
                onChange={e => setSearchVin(e.target.value.toUpperCase())}
                placeholder="Search VIN…"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
              <button type="submit" className="px-3 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Search</button>
              {searchVin && (
                <button type="button" onClick={() => { setSearchVin(''); loadHistory(); }}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">✕</button>
              )}
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-medium">
                  <th className="text-left px-4 py-2">VIN</th>
                  <th className="text-left px-3 py-2">Latitude</th>
                  <th className="text-left px-3 py-2">Longitude</th>
                  <th className="text-left px-3 py-2">Accuracy</th>
                  <th className="text-left px-3 py-2">Scanned by</th>
                  <th className="text-left px-3 py-2">Notes</th>
                  <th className="text-left px-3 py-2">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400">Loading…</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400">No records found</td></tr>
                ) : history.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-semibold text-teal-700 tracking-wider">{r.vin}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{fmtCoord(r.latitude)}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{fmtCoord(r.longitude)}</td>
                    <td className="px-3 py-2 text-gray-500">{r.accuracy != null ? `±${r.accuracy.toFixed(0)} m` : '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.scannedBy ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{r.notes ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtTime(r.scannedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
