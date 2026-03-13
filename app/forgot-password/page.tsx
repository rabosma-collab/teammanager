'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { resetPasswordForEmail } from '../lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPasswordForEmail(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-white mb-3">Controleer je e-mail</h2>
            <p className="text-gray-300 mb-2">We hebben een resetlink gestuurd naar:</p>
            <p className="text-blue-400 font-medium mb-6 break-all">{email}</p>
            <p className="text-gray-400 text-sm mb-8">
              Klik op de link in de e-mail om een nieuw wachtwoord in te stellen.
              Controleer ook je spam-map.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-gray-900 font-display font-bold text-base uppercase tracking-wide transition active:scale-[0.98]"
            >
              Terug naar inloggen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">Wachtwoord vergeten</h1>
          <p className="text-gray-400 mt-2">Vul je e-mailadres in om een resetlink te ontvangen</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-gray-900 font-display font-bold text-base uppercase tracking-wide transition active:scale-[0.98]"
            >
              {loading ? 'Versturen...' : 'Resetlink versturen'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Wachtwoord nog weten?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Terug naar inloggen
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
