'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Match, Player } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';

interface MyAvailabilityPanelProps {
  futureMatches: Match[];
  currentPlayerId: number;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  players?: Player[];
  trackWasbeurt?: boolean;
  trackConsumpties?: boolean;
  trackVervoer?: boolean;
  vervoerCount?: number;
}

interface TaskItem {
  emoji: string;
  label: string;
  playerName: string;
  isCurrentPlayer: boolean;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Berekent taken voor alle wedstrijden sequentieel:
 * na elke wedstrijd worden de virtuele tellers opgehoogd,
 * zodat elke volgende wedstrijd de volgende speler in de rij toont.
 */
function computeAllMatchTasks(
  matches: Match[],
  players: Player[],
  currentPlayerId: number,
  allAbsencesByMatch: Record<number, Set<number>>,
  trackWasbeurt: boolean,
  trackConsumpties: boolean,
  trackVervoer: boolean,
  vervoerCount: number
): Record<number, TaskItem[]> {
  // Virtuele tellers starten vanuit de huidige waarden
  const washCounts = new Map<number, number>(
    players.filter(p => !p.is_guest).map(p => [p.id, p.wash_count])
  );
  const consumptionCounts = new Map<number, number>(
    players.filter(p => !p.is_guest).map(p => [p.id, p.consumption_count])
  );
  const transportCounts = new Map<number, number>(
    players.filter(p => !p.is_guest).map(p => [p.id, p.transport_count])
  );

  const result: Record<number, TaskItem[]> = {};

  for (const match of matches) {
    const absentIds = allAbsencesByMatch[match.id] ?? new Set<number>();
    const available = players.filter(p => !p.is_guest && !p.injured && !absentIds.has(p.id));
    const tasks: TaskItem[] = [];

    if (trackWasbeurt) {
      const overrideId = match.wasbeurt_player_id ?? null;
      let player: Player | null = null;
      if (overrideId) {
        player = available.find(p => p.id === overrideId) ?? null;
      }
      if (!player) {
        player = [...available]
          .sort((a, b) => ((washCounts.get(a.id) ?? 0) - (washCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
      }
      if (player) {
        tasks.push({ emoji: '🧺', label: 'Wasbeurt', playerName: player.name, isCurrentPlayer: player.id === currentPlayerId });
        washCounts.set(player.id, (washCounts.get(player.id) ?? 0) + 1);
      }
    }

    if (trackConsumpties) {
      const overrideId = match.consumpties_player_id ?? null;
      let player: Player | null = null;
      if (overrideId) {
        player = available.find(p => p.id === overrideId) ?? null;
      }
      if (!player) {
        player = [...available]
          .sort((a, b) => ((consumptionCounts.get(a.id) ?? 0) - (consumptionCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
      }
      if (player) {
        tasks.push({ emoji: '🥤', label: 'Consumpties', playerName: player.name, isCurrentPlayer: player.id === currentPlayerId });
        consumptionCounts.set(player.id, (consumptionCounts.get(player.id) ?? 0) + 1);
      }
    }

    if (trackVervoer && match.home_away !== 'Thuis') {
      const overrideIds = match.transport_player_ids ?? [];
      const usedIds = new Set<number>();
      const vervoerPlayers: Player[] = [];
      const eligibleList = [...available].sort(
        (a, b) => ((transportCounts.get(a.id) ?? 0) - (transportCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name)
      );

      for (let i = 0; i < vervoerCount; i++) {
        const overrideId = overrideIds[i] ?? null;
        if (overrideId) {
          const op = available.find(p => p.id === overrideId && !usedIds.has(p.id)) ?? null;
          if (op) { vervoerPlayers.push(op); usedIds.add(op.id); continue; }
        }
        const auto = eligibleList.find(p => !usedIds.has(p.id)) ?? null;
        if (auto) { vervoerPlayers.push(auto); usedIds.add(auto.id); }
      }

      if (vervoerPlayers.length > 0) {
        tasks.push({
          emoji: '🚗',
          label: 'Vervoer',
          playerName: vervoerPlayers.map(p => p.name).join(', '),
          isCurrentPlayer: vervoerPlayers.some(p => p.id === currentPlayerId),
        });
        for (const p of vervoerPlayers) {
          transportCounts.set(p.id, (transportCounts.get(p.id) ?? 0) + 1);
        }
      }
    }

    result[match.id] = tasks;
  }

  return result;
}

const DEFAULT_VISIBLE = 3;

export default function MyAvailabilityPanel({
  futureMatches,
  currentPlayerId,
  onToggleAbsence,
  players = [],
  trackWasbeurt = false,
  trackConsumpties = false,
  trackVervoer = false,
  vervoerCount = 3,
}: MyAvailabilityPanelProps) {
  const { currentTeam } = useTeamContext();
  const teamColor = currentTeam?.color || '#f59e0b';

  const [absencesByMatch, setAbsencesByMatch] = useState<Record<number, boolean>>({});
  const [allAbsencesByMatch, setAllAbsencesByMatch] = useState<Record<number, Set<number>>>({});
  const [loadingMatchId, setLoadingMatchId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (futureMatches.length === 0) return;
    const matchIds = futureMatches.map(m => m.id);
    supabase
      .from('match_absences')
      .select('match_id, player_id')
      .in('match_id', matchIds)
      .then(({ data }: { data: { match_id: number; player_id: number }[] | null }) => {
        const myMap: Record<number, boolean> = {};
        const allMap: Record<number, Set<number>> = {};
        for (const id of matchIds) {
          myMap[id] = false;
          allMap[id] = new Set();
        }
        for (const row of data ?? []) {
          allMap[row.match_id].add(row.player_id);
          if (row.player_id === currentPlayerId) myMap[row.match_id] = true;
        }
        setAbsencesByMatch(myMap);
        setAllAbsencesByMatch(allMap);
      });
  }, [futureMatches.map(m => m.id).join(','), currentPlayerId]);

  const handleToggle = useCallback(async (matchId: number) => {
    setLoadingMatchId(matchId);
    try {
      const success = await onToggleAbsence(currentPlayerId, matchId);
      if (success) {
        setAbsencesByMatch(prev => ({ ...prev, [matchId]: !prev[matchId] }));
        setAllAbsencesByMatch(prev => {
          const updated = new Set(prev[matchId] ?? []);
          if (updated.has(currentPlayerId)) {
            updated.delete(currentPlayerId);
          } else {
            updated.add(currentPlayerId);
          }
          return { ...prev, [matchId]: updated };
        });
      }
    } finally {
      setLoadingMatchId(null);
    }
  }, [currentPlayerId, onToggleAbsence]);

  // Sequentiële taakberekening voor alle wedstrijden tegelijk
  const hasTasks = trackWasbeurt || trackConsumpties || trackVervoer;
  const tasksByMatch = useMemo(() => {
    if (!hasTasks || players.length === 0) return {};
    return computeAllMatchTasks(
      futureMatches,
      players,
      currentPlayerId,
      allAbsencesByMatch,
      trackWasbeurt,
      trackConsumpties,
      trackVervoer,
      vervoerCount
    );
  }, [futureMatches, players, currentPlayerId, allAbsencesByMatch, trackWasbeurt, trackConsumpties, trackVervoer, vervoerCount, hasTasks]);

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
          const tasks = isAbsent ? [] : (tasksByMatch[match.id] ?? []);

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

              {tasks.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 ml-8">
                  {tasks.map(task => (
                    <span key={task.label} className="text-xs text-gray-400">
                      {task.emoji}{' '}
                      <span className={task.isCurrentPlayer ? 'text-yellow-300 font-semibold' : 'text-gray-300'}>
                        {task.playerName}
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
