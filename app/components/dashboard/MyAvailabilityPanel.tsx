'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Match } from '../../lib/types';
import { supabase } from '../../lib/supabase';

interface MyAvailabilityPanelProps {
  futureMatches: Match[];
  currentPlayerId: number;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function MyAvailabilityPanel({
  futureMatches,
  currentPlayerId,
  onToggleAbsence,
}: MyAvailabilityPanelProps) {
  const [absencesByMatch, setAbsencesByMatch] = useState<Record<number, boolean>>({});
  const [loadingMatchId, setLoadingMatchId] = useState<number | null>(null);

  useEffect(() => {
    if (futureMatches.length === 0) return;
    const matchIds = futureMatches.map(m => m.id);
    supabase
      .from('match_absences')
      .select('match_id, player_id')
      .in('match_id', matchIds)
      .eq('player_id', currentPlayerId)
      .then(({ data }: { data: { match_id: number; player_id: number }[] | null }) => {
        const map: Record<number, boolean> = {};
        for (const id of matchIds) map[id] = false;
        for (const row of data ?? []) map[row.match_id] = true;
        setAbsencesByMatch(map);
      });
  }, [futureMatches.map(m => m.id).join(','), currentPlayerId]);

  const handleToggle = useCallback(async (matchId: number) => {
    setLoadingMatchId(matchId);
    try {
      const success = await onToggleAbsence(currentPlayerId, matchId);
      if (success) {
        setAbsencesByMatch(prev => ({ ...prev, [matchId]: !prev[matchId] }));
      }
    } finally {
      setLoadingMatchId(null);
    }
  }, [currentPlayerId, onToggleAbsence]);

  if (futureMatches.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        Mijn beschikbaarheid
      </h3>

      <div className="space-y-2">
        {futureMatches.map(match => {
          const isAbsent = absencesByMatch[match.id] ?? false;
          const isLoading = loadingMatchId === match.id;
          const isThuis = match.home_away === 'Thuis';

          return (
            <div
              key={match.id}
              className="flex items-center gap-3 py-2 border-b border-gray-700/40 last:border-0"
            >
              {/* Datum + tegenstander */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 capitalize">{formatShortDate(match.date)}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{match.opponent}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                    isThuis
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-blue-900/50 text-blue-300'
                  }`}>
                    {isThuis ? '🏠' : '✈️'}
                  </span>
                </div>
              </div>

              {/* Toggle knop */}
              <button
                onClick={() => handleToggle(match.id)}
                disabled={isLoading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs transition touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isAbsent
                    ? 'bg-green-700 hover:bg-green-600 text-white'
                    : 'bg-orange-700 hover:bg-orange-600 text-white'
                }`}
              >
                {isLoading ? '...' : isAbsent ? '✅ Aanwezig' : '❌ Afwezig'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
