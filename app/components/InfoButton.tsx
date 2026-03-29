'use client';

import React, { useState } from 'react';

interface InfoButtonProps {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center'; // niet langer gebruikt, behouden voor backwards compat
}

export default function InfoButton({ children }: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        title="Meer informatie"
        className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
          open
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
        }`}
      >
        i
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => setOpen(false)}
          />

          {/* Gecentreerd paneel */}
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm p-4 bg-gray-800 border border-gray-600 rounded-xl shadow-xl text-xs text-gray-300 space-y-1.5">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-white text-base leading-none p-1"
            >
              ✕
            </button>
            {children}
          </div>
        </>
      )}
    </>
  );
}
