'use client';

import React, { useState, useRef, useEffect } from 'react';

interface InfoButtonProps {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

export default function InfoButton({ children, align = 'left' }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Sluit panel bij klik buiten component
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        title="Meer informatie"
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          open
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
        }`}
      >
        i
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-72 p-3 bg-gray-800 border border-gray-600 rounded-xl shadow-xl text-xs text-gray-300 space-y-1.5 ${
            align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </span>
  );
}
