import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchPlayerStats } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

export function useMatchStats() {
  const { currentTeam } = useTeamContext();
  const [statsCache, setStatsCache] = useState<Record<number, MatchPlayerStats[]>>({});
  const fetchMatchStatsIdRef = useRef(0);
  const fetchStatsForMatchesIdRef = useRef(0);

  const fetchMatchStats = useCallback(async (matchId: number): Promise<MatchPlayerStats[]> => {
    if (!currentTeam) return [];

    const fetchId = ++fetchMatchStatsIdRef.current;

    try {
      const { data, error } = await supabase
        .from('match_player_stats')
        .select(`*, players!player_id (name)`)
        .eq('match_id', matchId)
        .eq('team_id', currentTeam.id);

      if (fetchId !== fetchMatchStatsIdRef.current) return [];
      if (error) throw error;

      type StatsRow = {
        id: number; match_id: number; team_id: string;
        player_id: number | null; guest_player_id: number | null;
        goals: number; assists: number; yellow_cards: number;
        red_cards: number; own_goals: number;
        players?: { name: string } | null;
      };

      const stats: MatchPlayerStats[] = (data || []).map((row: StatsRow) => ({
        id: row.id,
        match_id: row.match_id,
        team_id: row.team_id,
        player_id: row.player_id,
        guest_player_id: row.guest_player_id,
        goals: row.goals,
        assists: row.assists,
        yellow_cards: row.yellow_cards,
        red_cards: row.red_cards,
        own_goals: row.own_goals ?? 0,
        player_name: row.players?.name ?? undefined,
      }));

      setStatsCache(prev => ({ ...prev, [matchId]: stats }));
      return stats;
    } catch {
      return [];
    }
  }, [currentTeam]);

  // Fetch stats for multiple matches at once (for UitslagenView)
  const fetchStatsForMatches = useCallback(async (matchIds: number[]): Promise<Record<number, MatchPlayerStats[]>> => {
    if (!currentTeam || matchIds.length === 0) return {};

    const fetchId = ++fetchStatsForMatchesIdRef.current;

    try {
      const { data, error } = await supabase
        .from('match_player_stats')
        .select(`*, players!player_id (name)`)
        .in('match_id', matchIds)
        .eq('team_id', currentTeam.id);

      if (fetchId !== fetchStatsForMatchesIdRef.current) return {};
      if (error) throw error;

      const byMatch: Record<number, MatchPlayerStats[]> = {};
      for (const row of (data || [])) {
        const stat: MatchPlayerStats = {
          id: row.id,
          match_id: row.match_id,
          team_id: row.team_id,
          player_id: row.player_id,
          guest_player_id: row.guest_player_id,
          goals: row.goals,
          assists: row.assists,
          yellow_cards: row.yellow_cards,
          red_cards: row.red_cards,
          own_goals: row.own_goals ?? 0,
          player_name: row.players?.name ?? undefined,
        };
        if (!byMatch[row.match_id]) byMatch[row.match_id] = [];
        byMatch[row.match_id].push(stat);
      }

      setStatsCache(prev => ({ ...prev, ...byMatch }));
      return byMatch;
    } catch {
      return {};
    }
  }, [currentTeam]);

  // Sla statistieken op via de RPC (delta-safe, werkt ook voor edits achteraf)
  const saveMatchStats = useCallback(async (
    matchId: number,
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    // Filter rijen met alleen nullen eruit (geen data = niet opslaan)
    const nonEmpty = stats.filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0);

    try {
      const { data, error } = await supabase.rpc('save_match_stats', {
        p_match_id: matchId,
        p_team_id:  currentTeam.id,
        p_stats:    nonEmpty,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? 'Onbekende fout');

      // Invalideer cache voor deze wedstrijd
      setStatsCache(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });

      return true;
    } catch {
      return false;
    }
  }, [currentTeam]);

  return {
    statsCache,
    fetchMatchStats,
    fetchStatsForMatches,
    saveMatchStats,
  };
}
