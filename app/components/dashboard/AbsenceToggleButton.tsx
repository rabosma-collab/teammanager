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
    <button
      onClick={handleClick}
      disabled={loading}
      className={`w-full px-4 py-3 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        isAbsent
          ? 'bg-green-700 hover:bg-green-600 text-white'
          : 'bg-orange-700 hover:bg-orange-600 text-white'
      }`}
    >
      {loading ? 'Even geduld...' : isAbsent ? '✅ Ik ben er toch bij!' : '❌ Ik kan niet komen'}
    </button>
  );
}
