'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Match, Player, VotingMatch } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import PersonalCard from './dashboard/PersonalCard';
import NextMatchCard from './dashboard/NextMatchCard';
import SquadAvailabilityPanel from './dashboard/SquadAvailabilityPanel';
import VotingSection from './VotingSection';

interface DashboardViewProps {
  players: Player[];
  matches: Match[];
  fieldOccupants: (Player | null)[];
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  onToggleInjury: (playerId: number) => Promise<boolean>;
  onNavigateToWedstrijd: () => void;
  onNavigateToMatches: () => void;
  // Voting (page-level currentPlayerId for manual "Wie ben jij?" override)
  votingMatches: VotingMatch[];
  isLoadingVotes: boolean;
  votingCurrentPlayerId: number | null;
  onSelectVotingPlayer: (playerId: number) => void;
  onVote: (matchId: number, votedForPlayerId: number) => void;
}

export default function DashboardView({
  players,
  matches,
  fieldOccupants,
  onToggleAbsence,
  onToggleInjury,
  onNavigateToWedstrijd,
  onNavigateToMatches,
  votingMatches,
  isLoadingVotes,
  votingCurrentPlayerId,
  onSelectVotingPlayer,
  onVote,
}: DashboardViewProps) {
  // Use TeamContext for authoritative identity (not the voting override)
  const { currentTeam, currentPlayerId, isManager } = useTeamContext();

  const currentPlayer = currentPlayerId
    ? players.find(p => p.id === currentPlayerId && !p.is_guest) ?? null
    : null;

  // Eerstvolgende wedstrijd = eerste concept-wedstrijd met datum >= vandaag
  const dashboardMatch = useMemo((): Match | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = matches
      .filter(m => m.match_status === 'concept' && new Date(m.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] ?? null;
  }, [matches]);

  const isFinalized = dashboardMatch?.match_status === 'afgerond';

  // Lokale afwezigheidslijst voor de dashboardMatch (onafhankelijk van pitch-view)
  const [dashboardAbsences, setDashboardAbsences] = useState<number[]>([]);

  useEffect(() => {
    if (!dashboardMatch) {
      setDashboardAbsences([]);
      return;
    }
    supabase
      .from('match_absences')
      .select('player_id')
      .eq('match_id', dashboardMatch.id)
      .then(({ data }) => {
        setDashboardAbsences(data?.map((a: { player_id: number }) => a.player_id) || []);
      });
  }, [dashboardMatch?.id]);

  const refreshAbsences = useCallback(async () => {
    if (!dashboardMatch) return;
    const { data } = await supabase
      .from('match_absences')
      .select('player_id')
      .eq('match_id', dashboardMatch.id);
    setDashboardAbsences(data?.map((a: { player_id: number }) => a.player_id) || []);
  }, [dashboardMatch?.id]);

  const handleToggleAbsence = useCallback(async (playerId: number, matchId: number): Promise<boolean> => {
    const success = await onToggleAbsence(playerId, matchId);
    if (success) await refreshAbsences();
    return success;
  }, [onToggleAbsence, refreshAbsences]);

  const handleToggleInjury = useCallback(async (playerId: number): Promise<boolean> => {
    return onToggleInjury(playerId);
  }, [onToggleInjury]);

  // POTW-overwinningen berekenen voor de ingelogde speler
  const [potwWins, setPotwWins] = useState(0);

  useEffect(() => {
    if (!currentPlayerId || !currentTeam) {
      setPotwWins(0);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('player_of_week_votes')
        .select('match_id, voted_for_player_id')
        .eq('team_id', currentTeam.id);

      if (!data) return;

      // Groepeer stemmen per wedstrijd
      const matchVotes: Record<number, Record<number, number>> = {};
      for (const vote of data) {
        if (!matchVotes[vote.match_id]) matchVotes[vote.match_id] = {};
        matchVotes[vote.match_id][vote.voted_for_player_id] =
          (matchVotes[vote.match_id][vote.voted_for_player_id] || 0) + 1;
      }

      // Tel wedstrijden waarbij currentPlayerId de meeste stemmen had
      let wins = 0;
      for (const votes of Object.values(matchVotes)) {
        const values = Object.values(votes);
        if (values.length === 0) continue;
        const maxVotes = Math.max(...values);
        if (maxVotes > 0 && votes[currentPlayerId] === maxVotes) {
          wins++;
        }
      }
      setPotwWins(wins);
    })();
  }, [currentPlayerId, currentTeam?.id]);

  // Auto-koppel voting player aan de ingelogde gebruiker
  useEffect(() => {
    if (currentPlayerId && !votingCurrentPlayerId) {
      onSelectVotingPlayer(currentPlayerId);
    }
  }, [currentPlayerId, votingCurrentPlayerId, onSelectVotingPlayer]);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Top row: PersonalCard + NextMatchCard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PersonalCard player={currentPlayer} potwWins={potwWins} />
          <NextMatchCard
            match={dashboardMatch}
            matchAbsences={dashboardAbsences}
            fieldOccupants={fieldOccupants}
            currentPlayerId={currentPlayerId}
            isManager={isManager}
            players={players}
            onToggleAbsence={handleToggleAbsence}
            onToggleInjury={handleToggleInjury}
            onNavigateToWedstrijd={onNavigateToWedstrijd}
            onNavigateToMatches={onNavigateToMatches}
          />
        </div>

        {/* Speler van de week — boven selectie aanwezigheid */}
        <VotingSection
          votingMatches={votingMatches}
          isLoading={isLoadingVotes}
          players={players}
          currentPlayerId={votingCurrentPlayerId}
          onSelectCurrentPlayer={onSelectVotingPlayer}
          onVote={onVote}
        />

        {/* Manager: selectie aanwezigheid */}
        {isManager && dashboardMatch && (
          <div className="mt-4">
            <SquadAvailabilityPanel
              players={players}
              matchAbsences={dashboardAbsences}
              match={dashboardMatch}
              fieldOccupants={fieldOccupants}
              isFinalized={!!isFinalized}
              onToggleAbsence={handleToggleAbsence}
            />
          </div>
        )}
      </div>
    </div>
  );
}
