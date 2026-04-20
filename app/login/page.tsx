'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

const C = {
  base: '#09090f', surface: '#111118', elev: '#1a1a25', input: '#16161f',
  border: 'rgba(255,255,255,0.07)', borderMd: 'rgba(255,255,255,0.11)',
  t1: '#eeeef5', t2: 'rgba(238,238,245,0.55)', t3: 'rgba(238,238,245,0.28)',
  indigo: '#6366f1', red: '#dc2626', green: '#16a34a',
};

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  if (user) {
    router.replace(user.email?.includes('admin') ? '/admin' : '/employee');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      router.replace(cred.user.email?.includes('admin') ? '/admin' : '/employee');
    } catch (err: any) {
      const codes: Record<string, string> = {
        'auth/user-not-found':    'No account found with this email.',
        'auth/wrong-password':    'Incorrect password.',
        'auth/invalid-credential':'Invalid email or password.',
        'auth/user-disabled':     'This account has been disabled.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-email':     'Please enter a valid email address.',
      };
      setError(codes[err.code] ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.base, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>

      {/* background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.18), transparent)' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>W</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.t1, margin: 0 }}>WorkTrack</h1>
          <p style={{ fontSize: '0.8rem', color: C.t3, marginTop: 4 }}>Sign in to continue</p>
        </div>

        {/* Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2 }}>Email address</label>
              <input
                type="email" required autoComplete="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1,
                  borderRadius: 8, fontSize: '0.875rem', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: C.t2 }}>Password</label>
              <input
                type="password" required autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ background: C.input, border: `1px solid ${C.borderMd}`, color: C.t1,
                  borderRadius: 8, fontSize: '0.875rem', padding: '10px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{ marginTop: 4, background: loading ? C.elev : C.indigo, color: '#fff', border: 'none',
                borderRadius: 9, fontSize: '0.875rem', fontWeight: 600, padding: '11px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

          </form>

          <p style={{ fontSize: '0.75rem', color: C.t3, textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
            Contact your administrator to get access.
          </p>
        </div>
      </div>
    </div>
  );
}
