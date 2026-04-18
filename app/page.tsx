'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [initTimeout, setInitTimeout] = useState(false);

  useEffect(() => {
    // Fallback timeout in case Firebase doesn't respond
    const timer = setTimeout(() => setInitTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log('Home page: Auth state - loading:', loading, 'user:', user?.email || 'none');
    if (!loading && user) {
      const isAdmin = user.email?.includes('admin');
      console.log('Home page: Redirecting user - isAdmin:', isAdmin, 'to:', isAdmin ? '/admin' : '/employee');
      router.push(isAdmin ? '/admin' : '/employee');
    }
  }, [user, loading, router]);

  if (loading && !initTimeout) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Geofencing Attendance System
        </h1>
        <p className="text-gray-600 mb-8">
          Track employee attendance with location-based check-in/out
        </p>
        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/demo"
            className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Demo (Sample Data)
          </Link>
          <Link
            href="/test"
            className="block w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Test APIs
          </Link>
        </div>
      </div>
    </div>
  );
}
