import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { positionOrder } from '../lib/constants';
import type { Player } from '../lib/types';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const fetchIdRef = useRef(0);

  const fetchPlayers = useCallback(async (matchId?: number) => {
    // Increment fetch ID to cancel stale responses
    const currentFetchId = ++fetchIdRef.current;

    try {
      const { data: regularPlayers, error: regularError } = await supabase
        .from('players')
        .select('*');

      if (regularError) throw regularError;

      // If a newer fetch was started, discard this result
      if (currentFetchId !== fetchIdRef.current) return [];

      // Deduplicate regular players by id (primary key should be unique, but be safe)
      const byId = new Map<number, Player>();
      for (const p of (regularPlayers || []) as Player[]) {
        if (!byId.has(p.id)) {
          byId.set(p.id, p);
        }
      }
      let allPlayers: Player[] = Array.from(byId.values());
      const regularNames = new Set(allPlayers.map(p => p.name.toLowerCase().trim()));

      if (matchId) {
        const { data: guestPlayers, error: guestError } = await supabase
          .from('guest_players')
          .select('*')
          .eq('match_id', matchId);

        // If a newer fetch was started, discard this result
        if (currentFetchId !== fetchIdRef.current) return [];

        if (!guestError && guestPlayers) {
          const guestSeen = new Set<string>();
          const uniqueGuests = guestPlayers.filter(g => {
            const nameLower = g.name.toLowerCase().trim();
            if (regularNames.has(nameLower) || guestSeen.has(nameLower)) {
              return false;
            }
            guestSeen.add(nameLower);
            return true;
          });

          allPlayers = [
            ...allPlayers,
            ...uniqueGuests.map(g => ({
              ...g,
              is_guest: true,
              guest_match_id: g.match_id
            }))
          ];
        }
      }

      // Final safety: deduplicate by name (case-insensitive, trimmed)
      const finalSeen = new Set<string>();
      allPlayers = allPlayers.filter(p => {
        const key = p.name.toLowerCase().trim();
        if (finalSeen.has(key)) return false;
        finalSeen.add(key);
        return true;
      });

      // Debug: detect duplicates
      const nameCount = new Map<string, number>();
      allPlayers.forEach(p => {
        const key = p.name.toLowerCase().trim();
        nameCount.set(key, (nameCount.get(key) || 0) + 1);
      });
      nameCount.forEach((count, name) => {
        if (count > 1) console.error(`[usePlayers] DUPLICATE after dedup: "${name}" appears ${count}x`);
      });

      // Only set state if this is still the latest fetch
      if (currentFetchId === fetchIdRef.current) {
        setPlayers(allPlayers);
      }
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
    const trimmedName = name.trim();
    if (!trimmedName) return false;

    const nameLower = trimmedName.toLowerCase();
    if (players.some(p => p.name.toLowerCase().trim() === nameLower)) {
      alert(`⚠️ Er bestaat al een speler met de naam "${trimmedName}"`);
      return false;
    }

    try {
      const { error } = await supabase
        .from('guest_players')
        .insert({
          name: trimmedName,
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
  }, [players]);

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

  const addPlayer = useCallback(async (
    playerData: { name: string; position: string; injured: boolean; goals: number; assists: number; was: number; min: number }
  ): Promise<boolean> => {
    const trimmedName = playerData.name.trim();
    if (!trimmedName) return false;

    try {
      const { error } = await supabase
        .from('players')
        .insert({ ...playerData, name: trimmedName });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding player:', error);
      return false;
    }
  }, []);

  const updatePlayer = useCallback(async (
    id: number,
    playerData: { name: string; position: string; injured: boolean; goals: number; assists: number; was: number; min: number }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('players')
        .update(playerData)
        .eq('id', id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === id ? { ...p, ...playerData } : p)
      );
      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  }, []);

  const deletePlayer = useCallback(async (playerId: number): Promise<boolean> => {
    try {
      // Clean up related records first
      await supabase.from('lineups').delete().eq('player_id', playerId);
      await supabase.from('substitutions').delete().or(`player_out_id.eq.${playerId},player_in_id.eq.${playerId}`);
      await supabase.from('match_absences').delete().eq('player_id', playerId);

      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      setPlayers(prev => prev.filter(p => p.id !== playerId));
      return true;
    } catch (error) {
      console.error('Error deleting player:', error);
      return false;
    }
  }, []);

  return {
    players,
    setPlayers,
    fetchPlayers,
    getGroupedPlayers,
    toggleInjury,
    addGuestPlayer,
    removeGuestPlayer,
    updateStat,
    addPlayer,
    updatePlayer,
    deletePlayer
  };
}
