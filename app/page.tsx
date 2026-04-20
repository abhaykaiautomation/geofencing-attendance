'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

const NAV_CARDS = [
  {
    href: '/employee',
    label: 'Employee Portal',
    desc: 'Log hours, submit weekly timesheets, and track your project time.',
    accent: '#0d9488',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
  {
    href: '/admin',
    label: 'Admin Dashboard',
    desc: 'Manage projects, employees, worksites, and review attendance.',
    accent: '#6366f1',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
      </svg>
    ),
  },
  {
    href: '/login',
    label: 'Sign In',
    desc: 'Authenticate with your company account to access your workspace.',
    accent: '#9ca3af',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      </svg>
    ),
  },
];

const FEATURES = [
  { icon: '⏱', title: 'Time Tracking',  desc: 'Log hours per project with inline cell editing' },
  { icon: '📍', title: 'Geofencing',    desc: 'GPS-based worksite check-in and check-out' },
  { icon: '📋', title: 'Timesheets',   desc: 'Weekly submit & approval workflow' },
  { icon: '🏗',  title: 'Projects',     desc: 'Many-to-many employee–project assignments' },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user) router.replace(user.email?.includes('admin') ? '/admin' : '/employee');
  }, [user, loading, router]);

  // Show nothing while auth state resolves
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* subtle top gradient */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-30"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.35), transparent)' }}
      />

      {/* nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'var(--accent)' }}>W</span>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--text-1)' }}>WorkTrack</span>
        </div>
        <Link href="/login"
          className="text-xs px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-2)',
                   border: '1px solid var(--border-md)' }}>
          Sign in
        </Link>
      </header>

      {/* hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                   color: '#a5b4fc' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Attendance & Timesheet Platform
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-5 leading-tight"
          style={{ color: 'var(--text-1)' }}>
          Time tracking,<br/>
          <span style={{ color: 'var(--accent)' }}>done right.</span>
        </h1>

        <p className="max-w-md text-base leading-relaxed mb-12" style={{ color: 'var(--text-2)' }}>
          Geofenced check-ins, project-based timesheets, and streamlined approval workflows — all in one place.
        </p>

        {/* nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-16">
          {NAV_CARDS.map(c => (
            <Link key={c.href} href={c.href}
              className="group flex flex-col gap-3 p-5 rounded-xl text-left transition-all duration-200"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = c.accent + '55')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: c.accent + '18', color: c.accent }}>
                {c.icon}
              </span>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-1)' }}>{c.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{c.desc}</p>
              </div>
              <span className="text-xs mt-auto" style={{ color: c.accent }}>
                Open →
              </span>
            </Link>
          ))}
        </div>

        {/* features strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px w-full max-w-2xl rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="flex flex-col gap-1.5 p-4"
              style={{ background: 'var(--bg-surface)' }}>
              <span className="text-xl">{f.icon}</span>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 text-center py-6 text-xs" style={{ color: 'var(--text-3)' }}>
        WorkTrack — Geofencing Attendance System
      </footer>
    </div>
  );
}
