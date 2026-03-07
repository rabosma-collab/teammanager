'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookiesAccepted')) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    localStorage.setItem('cookiesAccepted', '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 border-t border-gray-700 px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-xs text-gray-400 flex-1">
          Deze app gebruikt uitsluitend functionele cookies voor inloggen. Geen tracking of advertenties.{' '}
          <Link href="/privacy" className="text-blue-400 hover:underline">
            Meer info
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 px-4 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs font-semibold text-white transition-colors"
        >
          Begrepen
        </button>
      </div>
    </div>
  );
}
