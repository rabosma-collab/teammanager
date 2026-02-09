import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { positionOrder } from '../lib/constants';
import type { Player } from '../lib/types';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);

  const fetchPlayers = useCallback(async (matchId?: number) => {
    try {
      const { data: regularPlayers, error: regularError } = await supabase
        .from('players')
        .select('*');

      if (regularError) throw regularError;

      // Deduplicate regular players by name (keep lowest id = original record)
      const seen = new Map<string, Player>();
      for (const p of (regularPlayers || []) as Player[]) {
        const existing = seen.get(p.name);
        if (!existing || p.id < existing.id) {
          seen.set(p.name, p);
        }
      }
      let allPlayers: Player[] = Array.from(seen.values());

      if (matchId) {
        const { data: guestPlayers, error: guestError } = await supabase
          .from('guest_players')
          .select('*')
          .eq('match_id', matchId);

        if (!guestError && guestPlayers) {
          allPlayers = [
            ...allPlayers,
            ...guestPlayers.map(g => ({
              ...g,
              is_guest: true,
              guest_match_id: g.match_id
            }))
          ];
        }
      }

      setPlayers(allPlayers);
      return allPlayers;
    } catch (error) {
      console.error('Error fetching players:', error);
      return [];
    }
  }, []);

  const getGroupedPlayers = useCallback((): Record<string, Player[]> => {
    const grouped: Record<string, Player[]> = {};
    positionOrder.forEach(pos => {
      grouped[pos] = players
        .filter(p => p.position === pos)
        .sort((a, b) => b.min - a.min);
    });
    return grouped;
  }, [players]);

  const toggleInjury = useCallback(async (playerId: number): Promise<boolean> => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.is_guest) return false;

    const newInjuredStatus = !player.injured;

    try {
      const { error } = await supabase
        .from('players')
        .update({ injured: newInjuredStatus })
        .eq('id', playerId);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === playerId ? { ...p, injured: newInjuredStatus } : p)
      );

      return true;
    } catch (error) {
      console.error('Error updating injury:', error);
      return false;
    }
  }, [players]);

  const addGuestPlayer = useCallback(async (
    name: string,
    position: string,
    matchId: number
  ): Promise<boolean> => {
    if (!name.trim()) return false;

    try {
      const { error } = await supabase
        .from('guest_players')
        .insert({
          name: name.trim(),
          position,
          match_id: matchId,
          goals: 0,
          assists: 0,
          was: 0,
          min: 0,
          injured: false
        })
        .select();

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding guest player:', error);
      return false;
    }
  }, []);

  const removeGuestPlayer = useCallback(async (playerId: number): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('guest_players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing guest player:', error);
      return false;
    }
  }, []);

  const updateStat = useCallback(async (
    id: number,
    field: string,
    value: string
  ) => {
    const player = players.find(p => p.id === id);
    if (!player) return;

    const table = player.is_guest ? 'guest_players' : 'players';
    const numValue = parseInt(value) || 0;

    try {
      const { error } = await supabase
        .from(table)
        .update({ [field]: numValue })
        .eq('id', id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === id ? { ...p, [field]: numValue } : p)
      );
    } catch (error) {
      console.error('Error updating player:', error);
    }
  }, [players]);

  return {
    players,
    setPlayers,
    fetchPlayers,
    getGroupedPlayers,
    toggleInjury,
    addGuestPlayer,
    removeGuestPlayer,
    updateStat
  };
}