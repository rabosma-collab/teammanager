'use client';

import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'pwa-install-dismissed';

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const deferredPromptRef = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    // Al als PWA geïnstalleerd?
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Al eerder weggetipt?
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroid = /android/i.test(ua);

    if (isIos) {
      setPlatform('ios');
      setVisible(true);
      return;
    }

    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPromptRef.current = e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
        setPlatform('android');
        setVisible(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return;
    deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 bg-emerald-900/40 border border-emerald-700/60 rounded-xl p-3 sm:p-4">
      <span className="text-xl flex-shrink-0 mt-0.5">📲</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-emerald-100 mb-1">Installeer de app op je telefoon</p>
        {platform === 'ios' && (
          <p className="text-xs text-emerald-300 leading-relaxed">
            Tik op <span className="inline-block mx-0.5">⎋</span> Delen onderin Safari, scroll naar beneden en kies <strong>&ldquo;Zet op beginscherm&rdquo;</strong>.
          </p>
        )}
        {platform === 'android' && (
          <p className="text-xs text-emerald-300 leading-relaxed">
            Voeg de app toe aan je beginscherm voor snelle toegang zonder browser.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {platform === 'android' && (
          <button
            onClick={handleInstall}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Installeer
          </button>
        )}
        <button
          onClick={dismiss}
          className="text-emerald-400 hover:text-emerald-200 text-lg leading-none transition-colors p-1"
          aria-label="Sluiten"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
