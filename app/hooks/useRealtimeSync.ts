import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Team, Player } from '../lib/types';

interface RealtimeSyncOptions {
  currentTeam: Team | null;
  selectedMatchId: number | null;
  isEditingLineup: boolean;
  players: Player[];
  playerCount: number;
  onPlayersChange: () => void;
  onMatchesChange: () => void;
  onLineupChange: (matchId: number, players: Player[], playerCount: number) => void;
  onSubstitutionsChange: (matchId: number) => void;
  onAbsencesChange: (matchId: number) => void;
  onPeriodOverridesChange: (matchId: number, players: Player[]) => void;
}

/**
 * Zet Supabase Realtime subscriptions op zodat wijzigingen van andere gebruikers
 * (bijv. medemanager die opstelling aanpast) direct zichtbaar zijn zonder herladen.
 *
 * Vereist: zet Realtime aan voor de relevante tabellen in het Supabase Dashboard
 * onder Database → Replication (of via de Table Editor → Realtime toggle).
 * Tabellen: players, matches, lineups, substitutions, match_absences, lineup_period_overrides
 */
export function useRealtimeSync({
  currentTeam,
  selectedMatchId,
  isEditingLineup,
  players,
  playerCount,
  onPlayersChange,
  onMatchesChange,
  onLineupChange,
  onSubstitutionsChange,
  onAbsencesChange,
  onPeriodOverridesChange,
}: RealtimeSyncOptions) {
  // Refs zodat callbacks altijd actueel zijn zonder re-subscriben
  const isEditingRef = useRef(isEditingLineup);
  const playersRef = useRef(players);
  const playerCountRef = useRef(playerCount);
  isEditingRef.current = isEditingLineup;
  playersRef.current = players;
  playerCountRef.current = playerCount;

  const callbacks = useRef({
    onPlayersChange,
    onMatchesChange,
    onLineupChange,
    onSubstitutionsChange,
    onAbsencesChange,
    onPeriodOverridesChange,
  });
  callbacks.current = {
    onPlayersChange,
    onMatchesChange,
    onLineupChange,
    onSubstitutionsChange,
    onAbsencesChange,
    onPeriodOverridesChange,
  };

  // Team-niveau: spelers en wedstrijden
  useEffect(() => {
    if (!currentTeam) return;
    const teamId = currentTeam.id;

    const channel = supabase
      .channel(`team-sync-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `team_id=eq.${teamId}` },
        () => callbacks.current.onPlayersChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `team_id=eq.${teamId}` },
        () => callbacks.current.onMatchesChange()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTeam?.id]);

  // Wedstrijd-niveau: opstelling, wissels, afwezigheid, periode-overrides
  useEffect(() => {
    if (!currentTeam || !selectedMatchId) return;
    const matchId = selectedMatchId;

    const channel = supabase
      .channel(`match-sync-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineups', filter: `match_id=eq.${matchId}` },
        () => {
          // Sla over als we zelf aan het bewerken zijn — voorkomt overschrijven van lopende edit
          if (isEditingRef.current) return;
          callbacks.current.onLineupChange(matchId, playersRef.current, playerCountRef.current);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'substitutions', filter: `match_id=eq.${matchId}` },
        () => callbacks.current.onSubstitutionsChange(matchId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_absences', filter: `match_id=eq.${matchId}` },
        () => callbacks.current.onAbsencesChange(matchId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lineup_period_overrides', filter: `match_id=eq.${matchId}` },
        () => callbacks.current.onPeriodOverridesChange(matchId, playersRef.current)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTeam?.id, selectedMatchId]);
}
