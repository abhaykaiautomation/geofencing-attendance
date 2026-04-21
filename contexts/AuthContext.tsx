"use client";
import { createContext, useContext } from 'react';
import { User } from 'firebase/auth';

export type UserRole = 'admin' | 'employee' | null;

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
