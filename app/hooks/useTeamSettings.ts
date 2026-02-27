import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TeamSettings } from '../lib/types';

const DEFAULT_SETTINGS: Omit<TeamSettings, 'team_id'> = {
  game_format: '11v11',
  periods: 2,
  default_formation: '4-3-3-aanvallend',
  match_duration: 90,
  track_goals: true,
  track_assists: true,
  track_minutes: true,
  track_cards: false,
  track_clean_sheets: false,
  track_spdw: true,
  track_results: true,
};

export function useTeamSettings() {
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSettings = useCallback(async (teamId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('team_settings')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error || !data) {
      // Nog geen settings aangemaakt — gebruik defaults
      setSettings({ team_id: teamId, ...DEFAULT_SETTINGS });
    } else {
      setSettings(data as TeamSettings);
    }
    setIsLoading(false);
  }, []);

  const upsertSettings = useCallback(async (
    teamId: string,
    updates: Partial<Omit<TeamSettings, 'team_id'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('team_settings')
      .upsert({ team_id: teamId, ...DEFAULT_SETTINGS, ...updates }, { onConflict: 'team_id' });

    if (error) {
      console.error('Fout bij opslaan teaminstellingen:', error);
      return false;
    }

    setSettings(prev => prev ? { ...prev, ...updates } : { team_id: teamId, ...DEFAULT_SETTINGS, ...updates });
    return true;
  }, []);

  const updateTeamInfo = useCallback(async (
    teamId: string,
    updates: { name?: string; color?: string; team_size?: number }
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', teamId);

    if (error) {
      console.error('Fout bij updaten teaminfo:', error);
      return false;
    }
    return true;
  }, []);

  return { settings, isLoading, fetchSettings, upsertSettings, updateTeamInfo };
}
