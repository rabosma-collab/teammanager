import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player, Match } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

export function useLineup() {
  const { currentTeam } = useTeamContext();
  const [fieldOccupants, setFieldOccupants] = useState<(Player | null)[]>(Array(11).fill(null));
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);

  const loadLineup = useCallback(async (matchId: number, players: Player[], playerCount: number = 11) => {
    if (!currentTeam || players.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', matchId);

      if (error) throw error;

      const lineup: (Player | null)[] = Array(playerCount).fill(null);

      if (data && data.length > 0) {
        data.forEach((entry: { position: number; player_id: number }) => {
          if (entry.position >= 0 && entry.position < playerCount && entry.player_id) {
            // Only match non-guest players to avoid ID collision with guest_players table
            const player = players.find(p => p.id === entry.player_id && !p.is_guest);
            if (player) {
              lineup[entry.position] = player;
            }
          }
        });
      }

      // Also restore guest player positions from their lineup_position field
      // (stored in guest_players table, fetched via SELECT * in usePlayers)
      for (const player of players) {
        if (player.is_guest && player.lineup_position != null) {
          const pos = player.lineup_position;
          if (pos >= 0 && pos < playerCount) {
            lineup[pos] = player;
          }
        }
      }

      setFieldOccupants(lineup);
    } catch (error) {
      console.error('Error loading lineup:', error);
      setFieldOccupants(Array(playerCount).fill(null));
    }
  }, [currentTeam]);

  const saveLineup = useCallback(async (
    match: Match,
    formation: string,
    substitutionSchemeId: number,
    onMatchUpdate: (updatedMatch: Match) => void
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    setSavingLineup(true);

    try {
      const { error: formationError } = await supabase
        .from('matches')
        .update({ formation, substitution_scheme_id: substitutionSchemeId })
        .eq('id', match.id)
        .eq('team_id', currentTeam.id);

      if (formationError) throw formationError;

      const { error: deleteError } = await supabase
        .from('lineups')
        .delete()
        .eq('match_id', match.id);

      if (deleteError) throw deleteError;

      // Save regular players to lineups table (guest players excluded — FK constraint)
      const lineupData = fieldOccupants
        .map((player, position) => ({
          match_id: match.id,
          position,
          player_id: player && !player.is_guest ? player.id : null
        }))
        .filter(item => item.player_id !== null);

      if (lineupData.length > 0) {
        const { error: insertError } = await supabase
          .from('lineups')
          .insert(lineupData);

        if (insertError) throw insertError;
      }

      // Save guest player positions to guest_players.lineup_position
      // First reset all guests for this match to null
      await supabase
        .from('guest_players')
        .update({ lineup_position: null })
        .eq('match_id', match.id)
        .eq('team_id', currentTeam.id);

      // Then set the position for each guest currently on the field
      const guestOnField = fieldOccupants
        .map((player: Player | null, position: number) => ({ player, position }))
        .filter((item: { player: Player | null; position: number }): item is { player: Player; position: number } =>
          item.player !== null && Boolean(item.player.is_guest)
        );

      for (const { player, position } of guestOnField) {
        await supabase
          .from('guest_players')
          .update({ lineup_position: position })
          .eq('id', player.id)
          .eq('match_id', match.id)
          .eq('team_id', currentTeam.id);
      }

      const updatedMatch = { ...match, formation, substitution_scheme_id: substitutionSchemeId };
      onMatchUpdate(updatedMatch);

      return true;
    } catch (error) {
      console.error('Error saving lineup:', error);
      return false;
    } finally {
      setSavingLineup(false);
    }
  }, [fieldOccupants, currentTeam]);

  const isPlayerOnField = useCallback((player: Player): boolean => {
    return fieldOccupants.some(p =>
      p !== null &&
      p.id === player.id &&
      Boolean(p.is_guest) === Boolean(player.is_guest)
    );
  }, [fieldOccupants]);

  const getBenchPlayers = useCallback((
    players: Player[],
    matchAbsences: number[]
  ): Player[] => {
    // Use composite key (is_guest flag + id) to avoid ID collision between tables
    const fieldKeys = new Set<string>(
      fieldOccupants
        .filter((p: Player | null): p is Player => p !== null)
        .map((p: Player) => `${p.is_guest ? 'g' : 'r'}_${p.id}`)
    );

    const bench = players.filter(p => {
      const key = `${p.is_guest ? 'g' : 'r'}_${p.id}`;
      // Guest players are never in matchAbsences (different ID space)
      return !fieldKeys.has(key) &&
        !p.injured &&
        (p.is_guest || !matchAbsences.includes(p.id));
    });

    // Final deduplication safety net: deduplicate by name
    const seen = new Set<string>();
    return bench.filter(p => {
      const key = p.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fieldOccupants]);

  const isPlayerAvailable = useCallback((
    player: Player | null,
    matchAbsences: number[]
  ): boolean => {
    if (!player) return false;
    // Guest players are never in matchAbsences (different table, different ID space)
    if (player.is_guest) return !player.injured;
    return !player.injured && !matchAbsences.includes(player.id);
  }, []);

  const clearField = useCallback((playerCount: number = 11) => {
    setFieldOccupants(Array(playerCount).fill(null));
    setSelectedPlayer(null);
    setSelectedPosition(null);
  }, []);

  return {
    fieldOccupants,
    setFieldOccupants,
    selectedPlayer,
    setSelectedPlayer,
    selectedPosition,
    setSelectedPosition,
    savingLineup,
    loadLineup,
    saveLineup,
    isPlayerOnField,
    getBenchPlayers,
    isPlayerAvailable,
    clearField
  };
}
