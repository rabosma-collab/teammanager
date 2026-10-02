import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { positionOrder } from '../lib/constants';
import type { Player } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';
import { logActivity } from '../lib/logActivity';

export interface GuestPoolEntry {
  id: number;
  name: string;
  times_played: number;
  last_used: string;
}

export function usePlayers() {
  const { currentTeam } = useTeamContext();
  const toast = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [guestPool, setGuestPool] = useState<GuestPoolEntry[]>([]);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    setPlayers([]);
    setGuestPool([]);
  }, [currentTeam?.id]);

  const fetchGuestPool = useCallback(async (): Promise<GuestPoolEntry[]> => {
    if (!currentTeam) return [];
    try {
      const { data, error } = await supabase
        .from('guest_player_pool')
        .select('id, name, times_played, last_used')
        .eq('team_id', currentTeam.id)
        .order('last_used', { ascending: false });

      if (error) throw error;
      const pool = (data as GuestPoolEntry[]) || [];
      setGuestPool(pool);
      return pool;
    } catch (error) {
      console.error('Error fetching guest pool:', error);
      return [];
    }
  }, [currentTeam]);

  const fetchPlayers = useCallback(async (matchId?: number) => {
    if (!currentTeam) return [];

    // Increment fetch ID to cancel stale responses
    const currentFetchId = ++fetchIdRef.current;

    try {
      const { data: regularPlayers, error: regularError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', currentTeam.id);

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

      // Gastspelers zijn reguliere players-rijen met status='guest' (Model A);
      // ze worden per wedstrijd geselecteerd via match_guest_selections.

      // Final safety: deduplicate within same type (regular vs guest) by name.
      // A guest and a regular player with the same name are intentionally allowed to coexist.
      const finalSeen = new Set<string>();
      allPlayers = allPlayers.filter(p => {
        const key = `${p.is_guest ? 'g' : 'r'}_${p.name.toLowerCase().trim()}`;
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
  }, [currentTeam]);

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
    if (!currentTeam) return false;

    const player = players.find(p => p.id === playerId);
    if (!player || player.is_guest) return false;

    const newInjuredStatus = !player.injured;

    try {
      const { error } = await supabase
        .from('players')
        .update({ injured: newInjuredStatus })
        .eq('id', playerId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === playerId ? { ...p, injured: newInjuredStatus } : p)
      );

      return true;
    } catch (error) {
      console.error('Error updating injury:', error);
      return false;
    }
  }, [players, currentTeam]);

  const addGuestPlayer = useCallback(async (
    name: string,
    position: string,
    matchId: number
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const trimmedName = name.trim();
    if (!trimmedName) return false;

    const nameLower = trimmedName.toLowerCase();
    // Een gast is een players-rij met status='guest'. Bestaat die naam al, dan is het
    // dezelfde gast: die moet via de lijst "Eerder meegedaan" worden geselecteerd.
    if (players.some(p => p.status === 'guest' && p.name.toLowerCase().trim() === nameLower)) {
      toast.warning(`⚠️ Er bestaat al een gastspeler "${trimmedName}". Kies hem uit de lijst.`);
      return false;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({
          name: trimmedName,
          position,
          team_id: currentTeam.id,
          status: 'guest',
          injured: false,
          goals: 0, assists: 0, min: 0, wash_count: 0,
          pac: 0, sho: 0, pas: 0, dri: 0, def: 0,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Direct voor deze wedstrijd selecteren
      const { error: selError } = await supabase
        .from('match_guest_selections')
        .insert({ team_id: currentTeam.id, match_id: matchId, player_id: inserted.id });
      if (selError && selError.code !== '23505') throw selError; // 23505 = al geselecteerd

      return true;
    } catch (error) {
      console.error('Error adding guest player:', error);
      return false;
    }
  }, [players, currentTeam]);

  const removeGuestPlayer = useCallback(async (playerId: number): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('guest_players')
        .delete()
        .eq('id', playerId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing guest player:', error);
      return false;
    }
  }, [currentTeam]);

  const updateStat = useCallback(async (
    id: number,
    field: string,
    value: string
  ) => {
    if (!currentTeam) return;

    const player = players.find(p => p.id === id);
    if (!player) return;

    const table = player.is_guest ? 'guest_players' : 'players';
    const dbValue = value === 'null' ? null : (parseInt(value) || 0);

    try {
      const { error } = await supabase
        .from(table)
        .update({ [field]: dbValue })
        .eq('id', id)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === id ? { ...p, [field]: dbValue } : p)
      );
    } catch (error) {
      console.error('Error updating player:', error);
    }
  }, [players, currentTeam]);

  const addPlayer = useCallback(async (
    playerData: { name: string; position: string; injured: boolean; goals: number; assists: number; min: number; pac: number; sho: number; pas: number; dri: number; def: number; phy?: number; wash_count: number; div?: number; han?: number; kic?: number; ref?: number; spe?: number; pos?: number }
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const trimmedName = playerData.name.trim();
    if (!trimmedName) return false;

    try {
      const { error } = await supabase
        .from('players')
        .insert({ ...playerData, name: trimmedName, team_id: currentTeam.id });

      if (error) throw error;

      logActivity({
        teamId: currentTeam.id,
        type: 'player_added',
        payload: { player_name: trimmedName, position: playerData.position },
      });

      return true;
    } catch (error) {
      console.error('Error adding player:', error);
      return false;
    }
  }, [currentTeam]);

  const updatePlayer = useCallback(async (
    id: number,
    playerData: { name: string; position: string; injured: boolean; goals: number; assists: number; min: number; pac: number; sho: number; pas: number; dri: number; def: number; phy?: number; wash_count: number; div?: number; han?: number; kic?: number; ref?: number; spe?: number; pos?: number }
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('players')
        .update(playerData)
        .eq('id', id)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === id ? { ...p, ...playerData } : p)
      );
      return true;
    } catch (error) {
      console.error('Error updating player:', error);
      return false;
    }
  }, [currentTeam]);

  const setPlayerStatus = useCallback(async (
    playerId: number,
    status: 'active' | 'guest' | 'former'
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const player = players.find(p => p.id === playerId);
    if (!player || player.is_guest) return false;

    try {
      const { error } = await supabase
        .from('players')
        .update({ status })
        .eq('id', playerId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setPlayers(prev =>
        prev.map(p => p.id === playerId ? { ...p, status } : p)
      );
      return true;
    } catch (error) {
      console.error('Error updating player status:', error);
      return false;
    }
  }, [players, currentTeam]);

  const deletePlayer = useCallback(async (playerId: number): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      // Verwijder avatar uit Storage vóór de database-cascade
      const { data: playerData } = await supabase
        .from('players')
        .select('avatar_url')
        .eq('id', playerId)
        .single();

      if (playerData?.avatar_url) {
        const match = playerData.avatar_url.match(/\/avatars\/(.+?)(\?|$)/);
        if (match?.[1]) {
          await supabase.storage.from('avatars').remove([match[1]]);
        }
      }

      const { error } = await supabase.rpc('delete_player_cascade', {
        p_player_id: playerId,
        p_team_id: currentTeam.id,
      });

      if (error) throw error;

      setPlayers(prev => prev.filter(p => p.id !== playerId));
      return true;
    } catch (error) {
      console.error('Error deleting player:', error);
      return false;
    }
  }, [currentTeam]);

  const addToPool = useCallback(async (name: string): Promise<boolean> => {
    if (!currentTeam) return false;
    const trimmedName = name.trim();
    if (!trimmedName) return false;

    try {
      const { error } = await supabase
        .from('guest_player_pool')
        .insert({ team_id: currentTeam.id, name: trimmedName, times_played: 0, last_used: new Date().toISOString() });

      if (error) throw error;

      setGuestPool(prev => [
        { id: 0, name: trimmedName, times_played: 0, last_used: new Date().toISOString() },
        ...prev,
      ]);
      return true;
    } catch (error) {
      console.error('Error adding to guest pool:', error);
      return false;
    }
  }, [currentTeam]);

  const removeFromPool = useCallback(async (poolId: number): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('guest_player_pool')
        .delete()
        .eq('id', poolId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setGuestPool(prev => prev.filter(e => e.id !== poolId));
      return true;
    } catch (error) {
      console.error('Error removing from guest pool:', error);
      return false;
    }
  }, [currentTeam]);

  return {
    players,
    fetchPlayers,
    getGroupedPlayers,
    toggleInjury,
    guestPool,
    fetchGuestPool,
    addToPool,
    removeFromPool,
    addGuestPlayer,
    removeGuestPlayer,
    updateStat,
    addPlayer,
    updatePlayer,
    setPlayerStatus,
    deletePlayer
  };
}
