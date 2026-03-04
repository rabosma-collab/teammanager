'use client';

import React, { useState } from 'react';

interface AbsenceToggleButtonProps {
  currentPlayerId: number;
  matchId: number;
  matchAbsences: number[];
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
}

export default function AbsenceToggleButton({ currentPlayerId, matchId, matchAbsences, onToggleAbsence }: AbsenceToggleButtonProps) {
  const [loading, setLoading] = useState(false);
  const isAbsent = matchAbsences.includes(currentPlayerId);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onToggleAbsence(currentPlayerId, matchId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={isAbsent ? handleClick : undefined}
        disabled={loading || !isAbsent}
        className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 ${
          !isAbsent
            ? 'bg-green-600 text-white shadow-inner ring-2 ring-green-400'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
        } disabled:cursor-default`}
      >
        Aanwezig
      </button>
      <button
        onClick={!isAbsent ? handleClick : undefined}
        disabled={loading || isAbsent}
        className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 ${
          isAbsent
            ? 'bg-red-600 text-white shadow-inner ring-2 ring-red-400'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
        } disabled:cursor-default`}
      >
        Afwezig
      </button>
    </div>
  );
}
