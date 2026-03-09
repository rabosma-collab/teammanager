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

const DEFAULT_VISIBLE = 3;

export default function MyAvailabilityPanel({
  futureMatches,
  currentPlayerId,
  onToggleAbsence,
}: MyAvailabilityPanelProps) {
  const [absencesByMatch, setAbsencesByMatch] = useState<Record<number, boolean>>({});
  const [loadingMatchId, setLoadingMatchId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

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

  const visibleMatches = expanded ? futureMatches : futureMatches.slice(0, DEFAULT_VISIBLE);
  const hasMore = futureMatches.length > DEFAULT_VISIBLE;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500 mb-3">
        Mijn beschikbaarheid
      </h3>

      <div className="space-y-2">
        {visibleMatches.map(match => {
          const isAbsent = absencesByMatch[match.id] ?? false;
          const isLoading = loadingMatchId === match.id;
          const isThuis = match.home_away === 'Thuis';

          return (
            <div
              key={match.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-4 ${
                isAbsent
                  ? 'bg-red-900/10 border-red-500'
                  : 'bg-green-900/10 border-green-500'
              }`}
            >
              {/* Status icoon */}
              <span className="text-base flex-shrink-0">
                {isAbsent ? '❌' : '✅'}
              </span>

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

              {/* Actieknop */}
              <button
                onClick={() => handleToggle(match.id)}
                disabled={isLoading}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isAbsent
                    ? 'bg-gray-700 hover:bg-green-800 text-gray-300 hover:text-white'
                    : 'bg-gray-700 hover:bg-red-900/60 text-gray-300 hover:text-white'
                }`}
              >
                {isLoading ? '...' : isAbsent ? 'Toch aanwezig' : 'Meld afwezig'}
              </button>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition touch-manipulation active:scale-95"
        >
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
          <span>{expanded ? 'Minder tonen' : `Nog ${futureMatches.length - DEFAULT_VISIBLE} wedstrijden`}</span>
        </button>
      )}
    </div>
  );
}
