'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Match } from '../../lib/types';
import type { TaskBadge } from '../../lib/taskAssignment';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';

interface MyAvailabilityPanelProps {
  futureMatches: Match[];
  currentPlayerId: number;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  tasksByMatch: Record<number, TaskBadge[]>;
}

interface TaskRow {
  key: string;
  emoji: string;
  names: string;
  mine: boolean;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// Groepeert de gedeelde badges naar weergaverijen (vervoer samengevoegd, eigen taak gemarkeerd).
function toTaskRows(badges: TaskBadge[], currentPlayerId: number): TaskRow[] {
  const rows: TaskRow[] = [];
  const wash = badges.find(b => b.emoji === '🧺');
  const consumption = badges.find(b => b.emoji === '🥤');
  const drivers = badges.filter(b => b.emoji === '🚗' || b.emoji === '🚙');
  if (wash) rows.push({ key: 'was', emoji: '🧺', names: wash.name, mine: wash.playerIds.includes(currentPlayerId) });
  if (consumption) rows.push({ key: 'cons', emoji: '🥤', names: consumption.name, mine: consumption.playerIds.includes(currentPlayerId) });
  if (drivers.length > 0) rows.push({
    key: 'vervoer',
    emoji: '🚗',
    names: drivers.map(d => d.name).join(', '),
    mine: drivers.some(d => d.playerIds.includes(currentPlayerId)),
  });
  return rows;
}

const DEFAULT_VISIBLE = 3;

export default function MyAvailabilityPanel({
  futureMatches,
  currentPlayerId,
  onToggleAbsence,
  tasksByMatch,
}: MyAvailabilityPanelProps) {
  const { currentTeam } = useTeamContext();
  const teamColor = currentTeam?.color || '#f59e0b';

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
        const myMap: Record<number, boolean> = {};
        for (const id of matchIds) myMap[id] = false;
        for (const row of data ?? []) myMap[row.match_id] = true;
        setAbsencesByMatch(myMap);
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
      <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500 mb-3 border-l-2 pl-2" style={{ borderLeftColor: teamColor }}>
        Mijn beschikbaarheid
      </h3>

      <div className="space-y-2">
        {visibleMatches.map(match => {
          const isAbsent = absencesByMatch[match.id] ?? false;
          const isLoading = loadingMatchId === match.id;
          const isThuis = match.home_away === 'Thuis';
          const taskRows = isAbsent ? [] : toTaskRows(tasksByMatch[match.id] ?? [], currentPlayerId);

          return (
            <div
              key={match.id}
              className={`px-3 py-2.5 rounded-lg border-l-4 ${
                isAbsent
                  ? 'bg-red-900/10 border-red-500'
                  : 'bg-green-900/10 border-green-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">
                  {isAbsent ? '❌' : '✅'}
                </span>

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

              {taskRows.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 ml-8">
                  {taskRows.map(row => (
                    <span key={row.key} className="text-xs text-gray-400">
                      {row.emoji}{' '}
                      <span className={row.mine ? 'text-yellow-300 font-semibold' : 'text-gray-300'}>
                        {row.names}
                      </span>
                    </span>
                  ))}
                </div>
              )}
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
