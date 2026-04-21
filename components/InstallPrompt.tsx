'use client';

import { useState, useEffect } from 'react';

// Shows an "Add to Home Screen" banner on iOS Safari when the app isn't installed
export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not when already running as standalone PWA
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const wasDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === '1';

    if (isIos && !isStandalone && !wasDismissed) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setShow(false);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  };

  if (!show || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: 16,
      right: 16,
      zIndex: 9999,
      background: '#1a1a25',
      border: '1px solid rgba(13,148,136,0.4)',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      {/* icon */}
      <img src="/icon-192.png" alt="app icon" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#eeeef5', margin: 0 }}>
          Install Attendance App
        </p>
        <p style={{ fontSize: '0.75rem', color: 'rgba(238,238,245,0.55)', margin: '4px 0 8px' }}>
          Tap{' '}
          <svg style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 2 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
          </svg>
          {' '}then <strong style={{ color: '#eeeef5' }}>"Add to Home Screen"</strong> to install
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block' }}/>
          <span style={{ fontSize: '0.7rem', color: 'rgba(238,238,245,0.4)' }}>Works offline · GPS attendance · No App Store needed</span>
        </div>
      </div>

      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'rgba(238,238,245,0.4)',
        cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, padding: 0
      }}>✕</button>
    </div>
  );
}
