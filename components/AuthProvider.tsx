'use client';

import { useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AuthContext, UserRole } from '../contexts/AuthContext';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [role, setRole]       = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser?.email) {
        try {
          const res = await fetch(`/api/employees?email=${encodeURIComponent(firebaseUser.email)}`);
          if (res.ok) {
            const emp = await res.json();
            setRole(emp.role === 'admin' ? 'admin' : 'employee');
          } else {
            setRole('employee');
          }
        } catch {
          setRole('employee');
        }
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = () => firebaseSignOut(auth).then(() => setRole(null));

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
