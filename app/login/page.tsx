'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  if (user) {
    console.log('User already authenticated, redirecting to employee page');
    router.push('/employee'); // or check role
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    console.log('Attempting login for email:', email);

    try {
      console.log('Trying to sign in with existing account...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase sign in successful:', userCredential.user.email);

      // Determine role and redirect directly
      const isAdmin = userCredential.user.email?.includes('admin');
      console.log('User role check - isAdmin:', isAdmin);

      setSuccess(`Login successful! Redirecting to ${isAdmin ? 'Admin Dashboard' : 'Employee Dashboard'}...`);

      // Small delay to show success message, then redirect
      setTimeout(() => {
        router.push(isAdmin ? '/admin' : '/employee');
      }, 1000);

    } catch (signInError: any) {
      console.log('Sign in failed, trying to create new account...', signInError.code);

      // If sign in fails, try to create a new account
      if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
        try {
          console.log('Creating new user account...');
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          console.log('Firebase account creation successful:', userCredential.user.email);

          // Determine role and redirect directly
          const isAdmin = userCredential.user.email?.includes('admin');
          console.log('New user role check - isAdmin:', isAdmin);

          setSuccess(`Account created and login successful! Redirecting to ${isAdmin ? 'Admin Dashboard' : 'Employee Dashboard'}...`);

          // Small delay to show success message, then redirect
          setTimeout(() => {
            router.push(isAdmin ? '/admin' : '/employee');
          }, 1000);

        } catch (createError: any) {
          console.error('Account creation failed:', createError);

          // Provide specific error messages
          let errorMessage = 'Failed to create account. Please try again.';

          if (createError.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists. Please try logging in with the correct password.';
          } else if (createError.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
          } else if (createError.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
          } else if (createError.message) {
            errorMessage = createError.message;
          }

          setError(errorMessage);
        }
      } else {
        // Other sign in errors
        console.error('Sign in error:', signInError);

        let errorMessage = 'Login failed. Please try again.';

        if (signInError.code === 'auth/user-disabled') {
          errorMessage = 'This account has been disabled.';
        } else if (signInError.code === 'auth/too-many-requests') {
          errorMessage = 'Too many failed login attempts. Please try again later.';
        } else if (signInError.code === 'auth/network-request-failed') {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (signInError.message) {
          errorMessage = signInError.message;
        }

        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            New user? Just enter your email and password - we'll create your account automatically.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              <p className="text-sm mb-2">{success}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Wait a moment for auth state to propagate, then redirect
                    setTimeout(() => {
                      router.push('/');
                    }, 500);
                  }}
                  className="text-sm text-green-600 hover:text-green-800 underline"
                >
                  Go to Dashboard
                </button>
                <span className="text-sm text-gray-500">or wait for automatic redirect</span>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}