import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, Substitution } from '../lib/types';

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchAbsences, setMatchAbsences] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setMatches(data || []);

      if (data && data.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = data
          .filter(m => new Date(m.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setSelectedMatch(upcoming.length > 0 ? upcoming[0] : data[0]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAbsences = useCallback(async (matchId: number) => {
    try {
      const { data, error } = await supabase
        .from('match_absences')
        .select('player_id')
        .eq('match_id', matchId);

      if (error) throw error;
      setMatchAbsences(data?.map(a => a.player_id) || []);
    } catch (error) {
      console.error('Error fetching absences:', error);
    }
  }, []);

  const toggleAbsence = useCallback(async (
    playerId: number,
    matchId: number
  ): Promise<boolean> => {
    const isAbsent = matchAbsences.includes(playerId);

    try {
      if (isAbsent) {
        const { error } = await supabase
          .from('match_absences')
          .delete()
          .eq('match_id', matchId)
          .eq('player_id', playerId);

        if (error) throw error;
        setMatchAbsences(prev => prev.filter(id => id !== playerId));
      } else {
        const { error } = await supabase
          .from('match_absences')
          .insert({
            match_id: matchId,
            player_id: playerId,
            reason: 'Afwezig'
          });

        if (error) throw error;
        setMatchAbsences(prev => [...prev, playerId]);
      }
      return true;
    } catch (error) {
      console.error('Error toggling absence:', error);
      return false;
    }
  }, [matchAbsences]);

  const isMatchEditable = useCallback((isAdmin: boolean): boolean => {
    if (!selectedMatch || !isAdmin) return false;
    // Afgesloten wedstrijden = nooit editable
    if (selectedMatch.match_status === 'afgerond') return false;
    // Concept wedstrijden = altijd editable (ook oude)
    return true;
  }, [selectedMatch]);

  const addMatch = useCallback(async (
    matchData: { date: string; opponent: string; home_away: string; formation: string; substitution_scheme_id: number }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('matches')
        .insert(matchData);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding match:', error);
      return false;
    }
  }, []);

  const updateMatch = useCallback(async (
    id: number,
    matchData: { date: string; opponent: string; home_away: string; formation: string; substitution_scheme_id: number }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('matches')
        .update(matchData)
        .eq('id', id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === id ? { ...m, ...matchData } : m)
      );
      if (selectedMatch?.id === id) {
        setSelectedMatch(prev => prev ? { ...prev, ...matchData } : prev);
      }
      return true;
    } catch (error) {
      console.error('Error updating match:', error);
      return false;
    }
  }, [selectedMatch?.id]);

  const deleteMatch = useCallback(async (matchId: number): Promise<boolean> => {
    try {
      // Clean up related records first
      await supabase.from('lineups').delete().eq('match_id', matchId);
      await supabase.from('substitutions').delete().eq('match_id', matchId);
      await supabase.from('match_absences').delete().eq('match_id', matchId);
      await supabase.from('guest_players').delete().eq('match_id', matchId);

      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(null);
      }
      return true;
    } catch (error) {
      console.error('Error deleting match:', error);
      return false;
    }
  }, [selectedMatch?.id]);

  const finalizeMatch = useCallback(async (matchId: number): Promise<boolean> => {
    try {
      // Fetch lineup for this match to know who started
      const { data: lineupData, error: lineupError } = await supabase
        .from('lineups')
        .select('player_id')
        .eq('match_id', matchId);

      if (lineupError) throw lineupError;

      const starterIds = new Set((lineupData || []).map(l => l.player_id));

      // Fetch substitutions for this match
      const { data: subsData, error: subsError } = await supabase
        .from('substitutions')
        .select('*')
        .eq('match_id', matchId);

      if (subsError) throw subsError;

      const subs = (subsData || []) as Substitution[];

      // Calculate minutes per player
      const minutesMap = new Map<number, number>();

      // Starters get 90 minutes by default
      const starterArray = Array.from(starterIds);
      starterArray.forEach(playerId => {
        minutesMap.set(playerId, 90);
      });

      // Sort subs by minute
      const sortedSubs = [...subs].sort((a, b) => {
        const minA = a.custom_minute ?? a.minute;
        const minB = b.custom_minute ?? b.minute;
        return minA - minB;
      });

      // Adjust for substitutions
      for (const sub of sortedSubs) {
        const subMinute = sub.custom_minute ?? sub.minute;

        // Player out: played from start (or from when they came in) to sub minute
        if (starterIds.has(sub.player_out_id)) {
          // Starter subbed out: gets subMinute instead of 90
          minutesMap.set(sub.player_out_id, subMinute);
        }

        // Player in: played from sub minute to 90 (or until they get subbed out)
        minutesMap.set(sub.player_in_id, (minutesMap.get(sub.player_in_id) || 0) + (90 - subMinute));
      }

      // Check if a player who came in was later subbed out
      for (const sub of sortedSubs) {
        const subMinute = sub.custom_minute ?? sub.minute;
        // If player_out was previously subbed in, adjust their minutes
        if (!starterIds.has(sub.player_out_id)) {
          // This player was a sub who's now being subbed out
          // Find when they came in
          const cameInSub = sortedSubs.find(s => s.player_in_id === sub.player_out_id);
          if (cameInSub) {
            const cameInMinute = cameInSub.custom_minute ?? cameInSub.minute;
            minutesMap.set(sub.player_out_id, subMinute - cameInMinute);
          }
        }
      }

      // Update each player's minutes and appearances
      const minuteEntries = Array.from(minutesMap.entries());
      for (let i = 0; i < minuteEntries.length; i++) {
        const [playerId, minutes] = minuteEntries[i];
        // Get current player stats
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('min, was')
          .eq('id', playerId)
          .single();

        if (playerError) {
          // Might be a guest player, skip
          continue;
        }

        const newMin = (playerData.min || 0) + minutes;
        const newWas = (playerData.was || 0) + 1;
        await supabase
          .from('players')
          .update({ min: newMin, was: newWas })
          .eq('id', playerId);
      }

      // Set match_status to 'afgerond'
      const { error: statusError } = await supabase
        .from('matches')
        .update({ match_status: 'afgerond' })
        .eq('id', matchId);

      if (statusError) throw statusError;

      // Update local state
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, match_status: 'afgerond' as const } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, match_status: 'afgerond' as const } : prev);
      }

      return true;
    } catch (error) {
      console.error('Error finalizing match:', error);
      return false;
    }
  }, [selectedMatch?.id]);

  return {
    matches,
    setMatches,
    selectedMatch,
    setSelectedMatch,
    matchAbsences,
    loading,
    fetchMatches,
    fetchAbsences,
    toggleAbsence,
    isMatchEditable,
    addMatch,
    updateMatch,
    deleteMatch,
    finalizeMatch
  };
}