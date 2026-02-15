'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { signUpWithEmail } from '../lib/auth';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validate = (): string | null => {
    if (fullName.trim().length < 2) return 'Vul je volledige naam in (minimaal 2 tekens)';
    if (password.length < 6) return 'Wachtwoord moet minimaal 6 tekens bevatten';
    if (password !== confirmPassword) return 'Wachtwoorden komen niet overeen';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await signUpWithEmail(email, password, fullName.trim());
      setEmailSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Email verification success screen
  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-white mb-3">Controleer je e-mail</h2>
            <p className="text-gray-300 mb-2">
              We hebben een verificatielink gestuurd naar:
            </p>
            <p className="text-blue-400 font-medium mb-6 break-all">{email}</p>
            <p className="text-gray-400 text-sm mb-8">
              Klik op de link in de e-mail om je account te activeren.
              Controleer ook je spam-map.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold text-base transition active:scale-[0.98]"
            >
              Naar inloggen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">Account aanmaken</h1>
          <p className="text-gray-400 mt-2">Registreer voor Team Manager</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1.5">
                Volledige naam
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jan de Vries"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimaal 6 tekens"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1.5">
                Wachtwoord bevestigen
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Herhaal je wachtwoord"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold text-base transition active:scale-[0.98]"
            >
              {loading ? 'Account aanmaken...' : 'Account aanmaken'}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-gray-400">
            Al een account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition">
              Log hier in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
