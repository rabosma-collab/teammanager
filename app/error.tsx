'use client';

import React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-white">
      <div className="bg-gray-800 rounded-xl p-6 sm:p-8 max-w-md w-full text-center shadow-xl">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-400 mb-2">Er is iets misgegaan</h2>
        <p className="text-gray-400 text-sm mb-6">
          {error.message || 'Er is een onverwachte fout opgetreden.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg font-bold transition-colors"
        >
          Opnieuw proberen
        </button>
      </div>
    </div>
  );
}
