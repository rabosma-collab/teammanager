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

  const loadLineup = useCallback(async (matchId: number, players: Player[]) => {
    if (!currentTeam || players.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', matchId);

      if (error) throw error;

      const lineup: (Player | null)[] = Array(11).fill(null);

      if (data && data.length > 0) {
        data.forEach((entry: { position: number; player_id: number }) => {
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
  }, [currentTeam]);

  const saveLineup = useCallback(async (
    match: Match,
    formation: string,
    onMatchUpdate: (updatedMatch: Match) => void
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    setSavingLineup(true);

    try {
      const { error: formationError } = await supabase
        .from('matches')
        .update({ formation })
        .eq('id', match.id)
        .eq('team_id', currentTeam.id);

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
  }, [fieldOccupants, currentTeam]);

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

    const bench = players.filter(p =>
      !fieldIds.includes(p.id) &&
      !p.injured &&
      !matchAbsences.includes(p.id)
    );

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
    return !player.injured && !matchAbsences.includes(player.id);
  }, []);

  const clearField = useCallback(() => {
    setFieldOccupants(Array(11).fill(null));
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
