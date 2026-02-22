'use client';

import React from 'react';

// Vangt fouten op in de root layout zelf (bijv. TeamProvider, ToastProvider crash).
// Moet eigen <html>/<body> tags bevatten — providers zijn hier niet beschikbaar.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body style={{ margin: 0, backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1f2937', borderRadius: '12px', padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#f87171', marginBottom: '0.5rem' }}>Kritieke fout</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {error.message || 'De applicatie kon niet laden.'}
            </p>
            <button
              onClick={reset}
              style={{ padding: '0.625rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
