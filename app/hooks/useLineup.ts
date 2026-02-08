import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player, Match } from '../lib/types';

export function useLineup() {
  const [fieldOccupants, setFieldOccupants] = useState<(Player | null)[]>(Array(11).fill(null));
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);

  const loadLineup = useCallback(async (matchId: number, players: Player[]) => {
    if (players.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', matchId);

      if (error) throw error;

      const lineup: (Player | null)[] = Array(11).fill(null);

      if (data && data.length > 0) {
        data.forEach(entry => {
          if (entry.position >= 0 && entry.position < 11 && entry.player_id) {
            const player = players.find(p => p.id === entry.player_id);
            if (player) {
              lineup[entry.position] = player;
            }
          }
        });
      }

      setFieldOccupants(lineup);
    } catch (error) {
      console.error('Error loading lineup:', error);
      setFieldOccupants(Array(11).fill(null));
    }
  }, []);

  const saveLineup = useCallback(async (
    match: Match,
    formation: string,
    onMatchUpdate: (updatedMatch: Match) => void
  ): Promise<boolean> => {
    setSavingLineup(true);

    try {
      const { error: formationError } = await supabase
        .from('matches')
        .update({ formation })
        .eq('id', match.id);

      if (formationError) throw formationError;

      const { error: deleteError } = await supabase
        .from('lineups')
        .delete()
        .eq('match_id', match.id);

      if (deleteError) throw deleteError;

      const lineupData = fieldOccupants
        .map((player, position) => ({
          match_id: match.id,
          position,
          player_id: player?.id || null
        }))
        .filter(item => item.player_id !== null);

      if (lineupData.length > 0) {
        const { error: insertError } = await supabase
          .from('lineups')
          .insert(lineupData);

        if (insertError) throw insertError;
      }

      const updatedMatch = { ...match, formation };
      onMatchUpdate(updatedMatch);

      return true;
    } catch (error) {
      console.error('Error saving lineup:', error);
      return false;
    } finally {
      setSavingLineup(false);
    }
  }, [fieldOccupants]);

  const isPlayerOnField = useCallback((playerId: number): boolean => {
    return fieldOccupants.some(p => p && p.id === playerId);
  }, [fieldOccupants]);

  const getBenchPlayers = useCallback((
    players: Player[],
    matchAbsences: number[]
  ): Player[] => {
    const fieldIds = fieldOccupants
      .filter((p): p is Player => p !== null)
      .map(p => p.id);

    return players.filter(p =>
      !fieldIds.includes(p.id) &&
      !p.injured &&
      !matchAbsences.includes(p.id)
    );
  }, [fieldOccupants]);

  const isPlayerAvailable = useCallback((
    player: Player | null,
    matchAbsences: number[]
  ): boolean => {
    if (!player) return false;
    return !player.injured && !matchAbsences.includes(player.id);
  }, []);

  const clearField = useCallback(() => {
    setFieldOccupants(Array(11).fill(null));
  }, []);

  return {
    fieldOccupants,
    setFieldOccupants,
    selectedPlayer,
    setSelectedPlayer,
    savingLineup,
    loadLineup,
    saveLineup,
    isPlayerOnField,
    getBenchPlayers,
    isPlayerAvailable,
    clearField
  };
}