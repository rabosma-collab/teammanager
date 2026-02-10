import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../lib/types';

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
    const matchDate = new Date(selectedMatch.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matchDate >= today;
  }, [selectedMatch]);

  const addMatch = useCallback(async (
    matchData: { date: string; opponent: string; home_away: string; formation: string }
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
    matchData: { date: string; opponent: string; home_away: string; formation: string }
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
    deleteMatch
  };
}