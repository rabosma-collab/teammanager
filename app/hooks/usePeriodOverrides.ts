import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../lib/types';

/**
 * Beheert positie-overschrijvingen per periode voor een wedstrijd.
 * Wanneer een manager in periode 2+ spelers van positie wisselt via drag-and-drop,
 * worden die aanpassingen hier opgeslagen (boven op de berekende opstelling).
 */
export function usePeriodOverrides() {
  // period → volledige lineup-array (index = positie, waarde = Player | null)
  const [overrides, setOverrides] = useState<Record<number, (Player | null)[]>>({});

  const fetchPeriodOverrides = useCallback(async (matchId: number, players: Player[]) => {
    const { data, error } = await supabase
      .from('lineup_period_overrides')
      .select('period, position, player_id')
      .eq('match_id', matchId);

    if (error || !data || data.length === 0) {
      setOverrides({});
      return;
    }

    const grouped: Record<number, (Player | null)[]> = {};
    for (const row of data) {
      if (!grouped[row.period]) grouped[row.period] = [];
      grouped[row.period][row.position] = row.player_id
        ? (players.find(p => p.id === row.player_id) ?? null)
        : null;
    }
    setOverrides(grouped);
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

  const clearOverrides = useCallback(() => setOverrides({}), []);

  return { overrides, fetchPeriodOverrides, applyAndSave, clearOverrides };
}
