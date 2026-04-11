import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ANNOUNCEMENT_MAX_LENGTH } from '../lib/constants';
import type { Match } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';
import { logActivity } from '../lib/logActivity';

export function useMatches() {
  const { currentTeam } = useTeamContext();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchAbsences, setMatchAbsences] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchMatchesIdRef = useRef(0);
  const fetchAbsencesIdRef = useRef(0);

  useEffect(() => {
    setMatches([]);
    setSelectedMatch(null);
    setMatchAbsences([]);
    setLoading(true);
  }, [currentTeam?.id]);

  const fetchMatches = useCallback(async (seasonId?: number | null) => {
    if (!currentTeam) {
      setLoading(false);
      return;
    }

    const fetchId = ++fetchMatchesIdRef.current;

    try {
      let query = supabase
        .from('matches')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('date', { ascending: false });

      if (seasonId != null) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;

      if (fetchId !== fetchMatchesIdRef.current) return;
      if (error) throw error;

      const matchData = (data || []) as Match[];
      setMatches(matchData);

      if (matchData.length > 0) {
        setSelectedMatch(prev => {
          // Behoud de huidige selectie als die wedstrijd nog bestaat (bijv. na Realtime update)
          if (prev) {
            const stillExists = matchData.find(m => m.id === prev.id);
            if (stillExists) return stillExists;
          }

          // Anders: selecteer de eerstvolgende wedstrijd
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcoming = matchData
            .filter(m => new Date(m.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          return upcoming.length > 0 ? upcoming[0] : matchData[0];
        });
      }
    } catch {
      // state ongewijzigd laten bij fetch-fout
    } finally {
      setLoading(false);
    }
  }, [currentTeam]);

  const fetchAbsences = useCallback(async (matchId: number) => {
    if (!currentTeam) return;

    const fetchId = ++fetchAbsencesIdRef.current;

    try {
      const { data, error } = await supabase
        .from('match_absences')
        .select('player_id')
        .eq('match_id', matchId);

      if (fetchId !== fetchAbsencesIdRef.current) return;
      if (error) throw error;
      setMatchAbsences(data?.map((a: { player_id: number }) => a.player_id) || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, [currentTeam]);

  const toggleAbsence = useCallback(async (
    playerId: number,
    matchId: number,
    playerName?: string,
    matchOpponent?: string,
    matchHomeAway?: string
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    // Query the DB directly so this works for any match, not just the pitch-view's selected match
    const { data: existing } = await supabase
      .from('match_absences')
      .select('player_id')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .maybeSingle();
    const isAbsent = !!existing;

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

      if (playerName && matchOpponent) {
        logActivity({
          teamId: currentTeam.id,
          type: 'absence_changed',
          actorId: playerId,
          subjectId: playerId,
          matchId,
          payload: {
            actor_name: playerName,
            available: isAbsent, // was absent, now available
            opponent: matchOpponent,
            home_away: matchHomeAway ?? '',
          },
        });
      }

      return true;
    } catch {
      return false;
    }
  }, [currentTeam]);

  const isMatchEditable = useCallback((isAdmin: boolean): boolean => {
    if (!selectedMatch || !isAdmin) return false;
    // Afgesloten of geannuleerde wedstrijden = nooit editable
    if (selectedMatch.match_status === 'afgerond' || selectedMatch.match_status === 'geannuleerd') return false;
    // Concept wedstrijden = altijd editable (ook oude)
    return true;
  }, [selectedMatch]);

  const addMatch = useCallback(async (
    matchData: { date: string; opponent: string; home_away: string; formation: string; match_type?: 'competitie' | 'oefenwedstrijd'; assembly_time?: string | null; match_time?: string | null; location_details?: string | null; season_id?: number | null }
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .insert({ ...matchData, team_id: currentTeam.id });

      if (error) throw error;

      logActivity({
        teamId: currentTeam.id,
        type: 'match_created',
        payload: {
          opponent: matchData.opponent,
          home_away: matchData.home_away,
          date: matchData.date,
        },
      });

      return true;
    } catch {
      return false;
    }
  }, [currentTeam]);

  const updateMatch = useCallback(async (
    id: number,
    matchData: { date: string; opponent: string; home_away: 'Thuis' | 'Uit'; formation: string; match_type?: 'competitie' | 'oefenwedstrijd'; assembly_time?: string | null; match_time?: string | null; location_details?: string | null }
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const existingMatch = matches.find(m => m.id === id);
      const normalizedMatchData = matchData.home_away === 'Thuis'
        ? { ...matchData, transport_player_ids: [] }
        : matchData;

      const { error } = await supabase
        .from('matches')
        .update(normalizedMatchData)
        .eq('id', id)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      if (existingMatch && existingMatch.date !== matchData.date) {
        logActivity({
          teamId: currentTeam.id,
          type: 'match_rescheduled',
          matchId: id,
          payload: {
            opponent: matchData.opponent,
            home_away: matchData.home_away,
            old_date: existingMatch.date,
            new_date: matchData.date,
          },
        });
      }

      setMatches(prev =>
        prev.map(m => m.id === id ? { ...m, ...normalizedMatchData } : m)
      );
      if (selectedMatch?.id === id) {
        setSelectedMatch(prev => prev ? { ...prev, ...normalizedMatchData } : prev);
      }

      return true;
    } catch {
      return false;
    }
  }, [currentTeam, matches, selectedMatch?.id]);

  const updateMatchScore = useCallback(async (
    id: number,
    goalsFor: number | null,
    goalsAgainst: number | null
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ goals_for: goalsFor, goals_against: goalsAgainst })
        .eq('id', id)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === id ? { ...m, goals_for: goalsFor, goals_against: goalsAgainst } : m)
      );
      if (selectedMatch?.id === id) {
        setSelectedMatch(prev => prev ? { ...prev, goals_for: goalsFor, goals_against: goalsAgainst } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }, [selectedMatch?.id, currentTeam]);

  const publishLineup = useCallback(async (matchId: number, published: boolean, match?: Pick<Match, 'opponent' | 'home_away'>): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ lineup_published: published })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, lineup_published: published } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, lineup_published: published } : prev);
      }

      if (match) {
        logActivity({
          teamId: currentTeam.id,
          type: published ? 'lineup_published' : 'lineup_unpublished',
          matchId,
          payload: {
            opponent: match.opponent,
            home_away: match.home_away,
          },
        });
      }

      return true;
    } catch {
      return false;
    }
  }, [selectedMatch?.id, currentTeam]);

  const updateWasbeurtPlayer = useCallback(async (
    matchId: number,
    playerId: number | null
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ wasbeurt_player_id: playerId })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, wasbeurt_player_id: playerId } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, wasbeurt_player_id: playerId } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }, [selectedMatch?.id, currentTeam]);

  const updateConsumptiesPlayer = useCallback(async (
    matchId: number,
    playerId: number | null
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ consumpties_player_id: playerId })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, consumpties_player_id: playerId } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, consumpties_player_id: playerId } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }, [selectedMatch?.id, currentTeam]);

  const updateTransportPlayers = useCallback(async (
    matchId: number,
    playerIds: number[]
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const targetMatch = selectedMatch?.id === matchId
      ? selectedMatch
      : matches.find(m => m.id === matchId) ?? null;
    const normalizedPlayerIds = targetMatch?.home_away === 'Thuis' ? [] : playerIds;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ transport_player_ids: normalizedPlayerIds })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, transport_player_ids: normalizedPlayerIds } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, transport_player_ids: normalizedPlayerIds } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }, [selectedMatch, currentTeam, matches]);

  const updateMatchReport = useCallback(async (
    matchId: number,
    report: string | null
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const trimmed = report?.trim() || null;

    try {
      const { error } = await supabase
        .from('matches')
        .update({ match_report: trimmed })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, match_report: trimmed } : m)
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, match_report: trimmed } : prev);
      }

      // Automatisch mededeling plaatsen als verslag niet leeg is
      if (trimmed) {
        const match = matches.find(m => m.id === matchId)
          ?? (selectedMatch?.id === matchId ? selectedMatch : null);
        const opponent = match?.opponent ?? 'tegenstander';
        const prefix = `📋 Wedstrijdverslag vs ${opponent}:\n`;
        const fullMessage = prefix + trimmed;
        const message = fullMessage.length > ANNOUNCEMENT_MAX_LENGTH
          ? fullMessage.slice(0, ANNOUNCEMENT_MAX_LENGTH - 1) + '…'
          : fullMessage;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('announcements').delete().eq('team_id', currentTeam.id);
        await supabase.from('announcements').insert({
          team_id: currentTeam.id,
          message,
          expires_at: expiresAt.toISOString(),
          created_by: user?.id,
        });
      }

      return true;
    } catch {
      return false;
    }
  }, [selectedMatch?.id, currentTeam, matches]);

  const cancelMatch = useCallback(async (
    matchId: number,
    goalsFor: number | null,
    goalsAgainst: number | null
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const matchToCancel = matches.find(m => m.id === matchId);

      const { error } = await supabase
        .from('matches')
        .update({
          match_status: 'geannuleerd',
          goals_for: goalsFor,
          goals_against: goalsAgainst,
        })
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      if (matchToCancel) {
        logActivity({
          teamId: currentTeam.id,
          type: 'match_cancelled',
          matchId,
          payload: {
            opponent: matchToCancel.opponent,
            home_away: matchToCancel.home_away,
            date: matchToCancel.date,
            goals_for: goalsFor,
            goals_against: goalsAgainst,
          },
        });
      }

      setMatches(prev =>
        prev.map(m => m.id === matchId
          ? { ...m, match_status: 'geannuleerd', goals_for: goalsFor, goals_against: goalsAgainst }
          : m
        )
      );
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(prev => prev ? { ...prev, match_status: 'geannuleerd', goals_for: goalsFor, goals_against: goalsAgainst } : prev);
      }
      return true;
    } catch {
      return false;
    }
  }, [matches, selectedMatch?.id, currentTeam]);

  const deleteMatch = useCallback(async (matchId: number): Promise<boolean> => {
    if (!currentTeam) return false;

    try {
      const matchToDelete = matches.find(m => m.id === matchId);

      // Clean up related records first
      await supabase.from('lineups').delete().eq('match_id', matchId);
      await supabase.from('substitutions').delete().eq('match_id', matchId);
      await supabase.from('match_absences').delete().eq('match_id', matchId);
      await supabase.from('guest_players').delete().eq('match_id', matchId);

      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)
        .eq('team_id', currentTeam.id);

      if (error) throw error;

      if (matchToDelete) {
        logActivity({
          teamId: currentTeam.id,
          type: 'match_cancelled',
          payload: {
            opponent: matchToDelete.opponent,
            home_away: matchToDelete.home_away,
            date: matchToDelete.date,
          },
        });
      }

      setMatches(prev => prev.filter(m => m.id !== matchId));
      if (selectedMatch?.id === matchId) {
        setSelectedMatch(null);
      }
      return true;
    } catch {
      return false;
    }
  }, [matches, selectedMatch?.id, currentTeam]);

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
    updateMatchScore,
    publishLineup,
    updateWasbeurtPlayer,
    updateConsumptiesPlayer,
    updateTransportPlayers,
    updateMatchReport,
    cancelMatch,
    deleteMatch
  };
}
