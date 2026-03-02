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

/**
 * Berekent de wisselmomenten voor een "wissel per periode" schema.
 * Geeft [dur/p, 2*dur/p, ..., (p-1)*dur/p] (afgerond, laatste periode niet).
 */
function calcPeriodicMinutes(periods: number, matchDuration: number): number[] {
  const minutes: number[] = [];
  for (let i = 1; i < periods; i++) {
    minutes.push(Math.round((matchDuration / periods) * i));
  }
  return minutes;
}

/**
 * Zorgt dat er een "wissel per periode" schema bestaat voor dit team.
 * Controleert eerst of er al een schema (globaal of team-eigen) met exact die minuten bestaat.
 */
async function ensurePeriodicScheme(periods: number, matchDuration: number, teamId: string): Promise<void> {
  if (periods < 2) return;
  const minutes = calcPeriodicMinutes(periods, matchDuration);

  const { data: existing } = await supabase
    .from('substitution_schemes')
    .select('id, minutes')
    .or(`team_id.is.null,team_id.eq.${teamId}`);

  if (existing) {
    const alreadyExists = existing.some((s: { minutes: number[] }) => {
      const m: number[] = s.minutes ?? [];
      return m.length === minutes.length && m.every((min: number, i: number) => min === minutes[i]);
    });
    if (alreadyExists) return;
  }

  const minuteLabels = minutes.map(m => `${m}'`).join(', ');
  const name = `Wissel per periode (${minuteLabels})`;

  await supabase.from('substitution_schemes').insert({
    name,
    minutes,
    is_system: false,
    team_id: teamId,
  });
}

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

    // Zorg dat er een "wissel per periode" schema bestaat voor dit team
    const periods = updates.periods ?? DEFAULT_SETTINGS.periods;
    const duration = updates.match_duration ?? DEFAULT_SETTINGS.match_duration;
    await ensurePeriodicScheme(periods, duration, teamId);

    return true;
  }, []);

  const updateTeamInfo = useCallback(async (
    teamId: string,
    updates: { name?: string; color?: string; team_size?: number }
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId);

    if (error) {
      console.error('Fout bij updaten teaminfo:', error);
      return false;
    }
    return true;
  }, []);

  return { settings, isLoading, fetchSettings, upsertSettings, updateTeamInfo };
}
