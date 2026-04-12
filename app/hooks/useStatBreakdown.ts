import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import type { Match, MatchPlayerStats } from '../lib/types';

export interface StatBreakdownEntry {
  matchId: number;
  date: string;
  opponent: string;
  homeAway: 'Thuis' | 'Uit';
  goalsFor: number | null;
  goalsAgainst: number | null;
  value: number;
}

export interface StatBreakdownData {
  playerId: number;
  playerName: string;
  stat: string;
  total: number;
  entries: StatBreakdownEntry[];
}

type AssignmentStat = 'wash_count' | 'consumption_count' | 'transport_count';

const MATCH_STAT_FIELDS: Record<string, keyof MatchPlayerStats> = {
  goals: 'goals',
  assists: 'assists',
  yellow_cards: 'yellow_cards',
  red_cards: 'red_cards',
};

const ASSIGNMENT_STAT_MATCH_FIELD: Record<AssignmentStat, string> = {
  wash_count: 'wasbeurt_player_id',
  consumption_count: 'consumpties_player_id',
  transport_count: 'transport_player_ids',
};

export function useStatBreakdown() {
  const { currentTeam } = useTeamContext();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatBreakdownData | null>(null);

  const fetchBreakdown = useCallback(async (
    playerId: number,
    playerName: string,
    stat: string,
    matches: Match[],
  ) => {
    if (!currentTeam) return;

    setLoading(true);
    setData(null);

    try {
      const finishedMatches = matches.filter(m => m.match_status === 'afgerond');

      // Stats that come from match_player_stats table
      if (stat in MATCH_STAT_FIELDS) {
        const field = MATCH_STAT_FIELDS[stat];
        const matchIds = finishedMatches.map(m => m.id);

        if (matchIds.length === 0) {
          setData({ playerId, playerName, stat, total: 0, entries: [] });
          return;
        }

        const { data: rows, error } = await supabase
          .from('match_player_stats')
          .select('match_id, goals, assists, yellow_cards, red_cards')
          .eq('team_id', currentTeam.id)
          .eq('player_id', playerId)
          .in('match_id', matchIds);

        if (error) throw error;

        const matchMap = new Map(finishedMatches.map(m => [m.id, m]));
        const entries: StatBreakdownEntry[] = [];

        for (const row of rows || []) {
          const val = (row as Record<string, number>)[field as string] ?? 0;
          if (val <= 0) continue;
          const match = matchMap.get(row.match_id);
          if (!match) continue;
          entries.push({
            matchId: match.id,
            date: match.date,
            opponent: match.opponent,
            homeAway: match.home_away,
            goalsFor: match.goals_for ?? null,
            goalsAgainst: match.goals_against ?? null,
            value: val,
          });
        }

        entries.sort((a, b) => b.date.localeCompare(a.date));
        const total = entries.reduce((sum, e) => sum + e.value, 0);
        setData({ playerId, playerName, stat, total, entries });
        return;
      }

      // Assignment-based stats (wasbeurt, consumpties, vervoer)
      if (stat in ASSIGNMENT_STAT_MATCH_FIELD) {
        const entries: StatBreakdownEntry[] = [];

        for (const match of finishedMatches) {
          let contributed = false;
          if (stat === 'wash_count') {
            contributed = match.wasbeurt_player_id === playerId;
          } else if (stat === 'consumption_count') {
            contributed = match.consumpties_player_id === playerId;
          } else if (stat === 'transport_count') {
            contributed = (match.transport_player_ids ?? []).includes(playerId);
          }

          if (contributed) {
            entries.push({
              matchId: match.id,
              date: match.date,
              opponent: match.opponent,
              homeAway: match.home_away,
              goalsFor: match.goals_for ?? null,
              goalsAgainst: match.goals_against ?? null,
              value: 1,
            });
          }
        }

        entries.sort((a, b) => b.date.localeCompare(a.date));
        const total = entries.reduce((sum, e) => sum + e.value, 0);
        setData({ playerId, playerName, stat, total, entries });
        return;
      }

      // Substitution-based stats (min = wissels, played_min = gespeelde minuten)
      if (stat === 'min' || stat === 'played_min') {
        const matchIds = finishedMatches.map(m => m.id);

        if (matchIds.length === 0) {
          setData({ playerId, playerName, stat, total: 0, entries: [] });
          return;
        }

        const { data: subs, error } = await supabase
          .from('substitutions')
          .select('match_id, minute, player_out_id, player_in_id')
          .in('match_id', matchIds)
          .or(`player_out_id.eq.${playerId},player_in_id.eq.${playerId}`);

        if (error) throw error;

        const matchMap = new Map(finishedMatches.map(m => [m.id, m]));

        if (stat === 'min') {
          // Count substitutions per match (times subbed in or out)
          const subsByMatch = new Map<number, number>();
          for (const sub of subs || []) {
            const count = subsByMatch.get(sub.match_id) ?? 0;
            subsByMatch.set(sub.match_id, count + 1);
          }

          const entries: StatBreakdownEntry[] = [];
          for (const [matchId, count] of subsByMatch) {
            const match = matchMap.get(matchId);
            if (!match) continue;
            entries.push({
              matchId: match.id,
              date: match.date,
              opponent: match.opponent,
              homeAway: match.home_away,
              goalsFor: match.goals_for ?? null,
              goalsAgainst: match.goals_against ?? null,
              value: count,
            });
          }

          entries.sort((a, b) => b.date.localeCompare(a.date));
          const total = entries.reduce((sum, e) => sum + e.value, 0);
          setData({ playerId, playerName, stat, total, entries });
        } else {
          // played_min: calculate minutes played per match from substitution data
          // This is complex — for now we aggregate from the substitutions
          const minutesByMatch = new Map<number, number>();

          // Group subs by match
          const subsByMatch = new Map<number, typeof subs>();
          for (const sub of subs || []) {
            const arr = subsByMatch.get(sub.match_id) ?? [];
            arr.push(sub);
            subsByMatch.set(sub.match_id, arr);
          }

          for (const match of finishedMatches) {
            const matchSubs = subsByMatch.get(match.id) ?? [];
            // Simple heuristic: use the substitution minutes
            // player_in = came on at minute X, player_out = came off at minute X
            let minsPlayed = 0;
            const inEvents = matchSubs
              .filter(s => s.player_in_id === playerId)
              .map(s => s.minute)
              .sort((a, b) => a - b);
            const outEvents = matchSubs
              .filter(s => s.player_out_id === playerId)
              .map(s => s.minute)
              .sort((a, b) => a - b);

            if (inEvents.length === 0 && outEvents.length === 0) continue;

            // If player was subbed in but never out → played until end
            // If player was subbed out but never in → started and was removed
            // Pair up events chronologically
            const totalMinutes = match.match_time ? parseInt(match.match_time) || 0 : 0;

            if (outEvents.length > 0 && inEvents.length === 0) {
              // Started, was subbed off
              minsPlayed = outEvents[0];
            } else if (inEvents.length > 0 && outEvents.length === 0) {
              // Subbed on, played until end
              minsPlayed = totalMinutes > 0 ? totalMinutes - inEvents[0] : 0;
            } else {
              // Multiple subs — pair in/out events
              for (let i = 0; i < inEvents.length; i++) {
                const start = inEvents[i];
                const end = i < outEvents.length ? outEvents[i] : (totalMinutes || start);
                minsPlayed += Math.max(0, end - start);
              }
            }

            if (minsPlayed > 0) {
              minutesByMatch.set(match.id, minsPlayed);
            }
          }

          const entries: StatBreakdownEntry[] = [];
          for (const [matchId, mins] of minutesByMatch) {
            const match = matchMap.get(matchId);
            if (!match) continue;
            entries.push({
              matchId: match.id,
              date: match.date,
              opponent: match.opponent,
              homeAway: match.home_away,
              goalsFor: match.goals_for ?? null,
              goalsAgainst: match.goals_against ?? null,
              value: mins,
            });
          }

          entries.sort((a, b) => b.date.localeCompare(a.date));
          const total = entries.reduce((sum, e) => sum + e.value, 0);
          setData({ playerId, playerName, stat, total, entries });
        }
        return;
      }

      // Fallback: no breakdown available
      setData({ playerId, playerName, stat, total: 0, entries: [] });
    } catch (error) {
      console.error('Error fetching stat breakdown:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentTeam]);

  const close = useCallback(() => {
    setData(null);
  }, []);

  return { data, loading, fetchBreakdown, close };
}
