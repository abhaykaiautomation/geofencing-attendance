'use client';
import { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

const C = {
  base: '#09090f', surface: '#111118', elev: '#1a1a25', input: '#16161f',
  border: 'rgba(255,255,255,0.07)', borderMd: 'rgba(255,255,255,0.11)',
  t1: '#eeeef5', t2: 'rgba(238,238,245,0.55)', t3: 'rgba(238,238,245,0.28)',
  indigo: '#6366f1', red: '#dc2626', green: '#16a34a',
};

const inputSx: React.CSSProperties = {
  background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1,
  borderRadius: 8, fontSize: '0.875rem', padding: '10px 12px',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 6)        return setError('New password must be at least 6 characters.');
    if (next !== confirm)        return setError('New passwords do not match.');
    if (next === current)        return setError('New password must differ from current password.');

    const user = auth.currentUser;
    if (!user?.email) return setError('No authenticated user found.');

    setLoading(true);
    try {
      // Re-authenticate before changing password (Firebase requirement)
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err: any) {
      const codes: Record<string, string> = {
        'auth/wrong-password':          'Current password is incorrect.',
        'auth/invalid-credential':      'Current password is incorrect.',
        'auth/too-many-requests':       'Too many attempts. Please try again later.',
        'auth/requires-recent-login':   'Session expired. Please sign out and sign back in.',
      };
      setError(codes[err.code] ?? 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.borderMd}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.t1 }}>Change Password</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>

        {success ? (
          <div style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#4ade80', fontSize: '0.875rem', fontWeight: 600 }}>Password updated successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Current password', value: current, set: setCurrent, auto: 'current-password' },
              { label: 'New password',     value: next,    set: setNext,    auto: 'new-password' },
              { label: 'Confirm new password', value: confirm, set: setConfirm, auto: 'new-password' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2 }}>{f.label}</label>
                <input type="password" required autoComplete={f.auto} placeholder="••••••••"
                  value={f.value} onChange={e => f.set(e.target.value)} style={inputSx} />
              </div>
            ))}

            {error && (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#f87171' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, background: C.elev, border: `1px solid ${C.border}`, color: C.t2, borderRadius: 9, fontSize: '0.875rem', fontWeight: 600, padding: '10px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading}
                style={{ flex: 1, background: C.indigo, border: 'none', color: '#fff', borderRadius: 9, fontSize: '0.875rem', fontWeight: 600, padding: '10px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
