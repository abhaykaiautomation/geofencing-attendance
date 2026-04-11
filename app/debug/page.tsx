'use client';

import { useAuth } from '../../contexts/AuthContext';

export default function DebugPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Auth Debug</h1>
      <div className="bg-gray-100 p-4 rounded">
        <p><strong>Loading:</strong> {loading ? 'true' : 'false'}</p>
        <p><strong>User exists:</strong> {user ? 'true' : 'false'}</p>
        {user && (
          <div>
            <p><strong>Email:</strong> {user.email || 'null'}</p>
            <p><strong>Display Name:</strong> {user.displayName || 'null'}</p>
            <p><strong>UID:</strong> {user.uid}</p>
            <p><strong>Email Verified:</strong> {user.emailVerified ? 'true' : 'false'}</p>
          </div>
        )}
      </div>
    </div>
  );
}