'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Setting up Firebase auth listener...');
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('AuthProvider: Auth state changed:', user ? `User: ${user.email} (${user.uid})` : 'No user');
        if (user) {
          console.log('AuthProvider: User details:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified
          });
        }
        setUser(user);
        setLoading(false);
      });

      // Add a timeout to force loading to false if Firebase doesn't respond
      const timeout = setTimeout(() => {
        if (loading) {
          console.log('AuthProvider: Firebase auth timeout, forcing loading to false');
          setLoading(false);
        }
      }, 5000);

      return () => {
        unsubscribe();
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('AuthProvider: Firebase auth setup error:', error);
      setLoading(false);
    }
  }, []);

  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};