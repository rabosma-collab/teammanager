'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmail, signInWithGoogle } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      // Redirect back to pending invite if one exists
      const pendingToken = localStorage.getItem('pending_invite_token');
      if (pendingToken) {
        localStorage.removeItem('pending_invite_token');
        router.push(`/join/${pendingToken}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">Team Manager</h1>
          <p className="text-gray-400 mt-2">Log in om verder te gaan</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Je wachtwoord"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold text-base transition active:scale-[0.98]"
            >
              {loading ? 'Inloggen...' : 'Inloggen'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-600" />
            <span className="px-4 text-sm text-gray-400">of</span>
            <div className="flex-1 border-t border-gray-600" />
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white font-medium text-base transition flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Inloggen met Google
          </button>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-gray-400">
            Nog geen account?{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Registreer hier
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
