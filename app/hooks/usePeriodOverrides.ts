import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../lib/types';

/**
 * Beheert positie-overschrijvingen en formaties per periode voor een wedstrijd.
 * Wanneer een manager in periode 2+ spelers van positie wisselt via drag-and-drop,
 * of de formatie wijzigt, worden die aanpassingen hier opgeslagen.
 */
export function usePeriodOverrides() {
  // period → volledige lineup-array (index = positie, waarde = Player | null)
  const [overrides, setOverrides] = useState<Record<number, (Player | null)[]>>({});
  // period → formatie (bijv. '4-3-3-aanvallend')
  const [periodFormations, setPeriodFormations] = useState<Record<number, string>>({});

  const fetchPeriodOverrides = useCallback(async (matchId: number, players: Player[]) => {
    const [overridesResult, formationsResult] = await Promise.all([
      supabase
        .from('lineup_period_overrides')
        .select('period, position, player_id')
        .eq('match_id', matchId),
      supabase
        .from('lineup_period_formations')
        .select('period, formation')
        .eq('match_id', matchId),
    ]);

    if (overridesResult.error || !overridesResult.data || overridesResult.data.length === 0) {
      setOverrides({});
    } else {
      const grouped: Record<number, (Player | null)[]> = {};
      for (const row of overridesResult.data) {
        if (!grouped[row.period]) grouped[row.period] = [];
        grouped[row.period][row.position] = row.player_id
          ? (players.find(p => p.id === row.player_id) ?? null)
          : null;
      }
      setOverrides(grouped);
    }

    if (!formationsResult.error && formationsResult.data && formationsResult.data.length > 0) {
      const fMap: Record<number, string> = {};
      for (const row of formationsResult.data) {
        fMap[row.period] = row.formation;
      }
      setPeriodFormations(fMap);
    } else {
      setPeriodFormations({});
    }
  }, []);

  /**
   * Sla een gewijzigde periodeopstelling op (lokaal + DB).
   * Vervangt altijd alle rijen voor deze match+periode.
   */
  const applyAndSave = useCallback(async (
    matchId: number,
    teamId: string,
    period: number,
    lineup: (Player | null)[]
  ) => {
    // Direct lokaal bijwerken (optimistic update)
    setOverrides(prev => ({ ...prev, [period]: lineup }));

    // Verwijder bestaande rijen voor dit match+periode
    await supabase
      .from('lineup_period_overrides')
      .delete()
      .eq('match_id', matchId)
      .eq('period', period);

    // Sla alle posities op (ook null = lege positie)
    const rows = lineup.map((player, position) => ({
      match_id: matchId,
      team_id: teamId,
      period,
      position,
      // Guest players worden niet opgeslagen in deze tabel (zij gebruiken guest_players tabel)
      player_id: player && !player.is_guest ? player.id : null,
    }));

    if (rows.length > 0) {
      await supabase.from('lineup_period_overrides').insert(rows);
    }
  }, []);

  /**
   * Sla een formatie voor een specifieke periode op (lokaal + DB).
   */
  const savePeriodFormation = useCallback(async (
    matchId: number,
    teamId: string,
    period: number,
    newFormation: string
  ) => {
    // Optimistic update
    setPeriodFormations(prev => ({ ...prev, [period]: newFormation }));

    await supabase
      .from('lineup_period_formations')
      .upsert({ match_id: matchId, team_id: teamId, period, formation: newFormation });
  }, []);

  const clearOverrides = useCallback(() => {
    setOverrides({});
    setPeriodFormations({});
  }, []);

  /**
   * Verwijder overrides voor alle periodes >= fromPeriod (lokaal + DB).
   * Aanroepen na het opslaan van een wissel om stale positie-overrides te wissen.
   */
  const clearFromPeriod = useCallback(async (matchId: number, fromPeriod: number) => {
    setOverrides(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (Number(key) >= fromPeriod) delete next[Number(key)];
      }
      return next;
    });
    await supabase
      .from('lineup_period_overrides')
      .delete()
      .eq('match_id', matchId)
      .gte('period', fromPeriod);
  }, []);

  return { overrides, periodFormations, fetchPeriodOverrides, applyAndSave, savePeriodFormation, clearOverrides, clearFromPeriod };
}
