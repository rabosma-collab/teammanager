import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Season, PlayerSeasonStats } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

export function useSeasons() {
  const { currentTeam } = useTeamContext();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSeasons = useCallback(async () => {
    if (!currentTeam) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSeasons(data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTeam]);

  const activeSeason = seasons.find(s => s.is_active) ?? null;

  const startNewSeason = useCallback(async (name: string): Promise<number | null> => {
    if (!currentTeam) return null;
    try {
      const { data, error } = await supabase
        .rpc('start_new_season', {
          p_team_id: currentTeam.id,
          p_name: name,
        });

      if (error) throw error;

      await fetchSeasons();
      return data as number;
    } catch (error) {
      console.error('Error starting new season:', error);
      return null;
    }
  }, [currentTeam, fetchSeasons]);

  const fetchPlayerSeasonStats = useCallback(async (seasonId: number): Promise<PlayerSeasonStats[]> => {
    if (!currentTeam) return [];
    try {
      const { data, error } = await supabase
        .from('player_season_stats')
        .select('*')
        .eq('season_id', seasonId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching player season stats:', error);
      return [];
    }
  }, [currentTeam]);

  return {
    seasons,
    activeSeason,
    loading,
    fetchSeasons,
    startNewSeason,
    fetchPlayerSeasonStats,
  };
}
