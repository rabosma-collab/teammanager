'use client';

import React from 'react';
import type { Match, Player, VotingMatch } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';
import PersonalCard from './dashboard/PersonalCard';
import NextMatchCard from './dashboard/NextMatchCard';
import SquadAvailabilityPanel from './dashboard/SquadAvailabilityPanel';
import VotingSection from './VotingSection';

interface DashboardViewProps {
  players: Player[];
  selectedMatch: Match | null;
  matchAbsences: number[];
  fieldOccupants: (Player | null)[];
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
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
  selectedMatch,
  matchAbsences,
  fieldOccupants,
  onToggleAbsence,
  onNavigateToWedstrijd,
  onNavigateToMatches,
  votingMatches,
  isLoadingVotes,
  votingCurrentPlayerId,
  onSelectVotingPlayer,
  onVote,
}: DashboardViewProps) {
  // Use TeamContext for authoritative identity (not the voting override)
  const { currentPlayerId, isManager } = useTeamContext();

  const currentPlayer = currentPlayerId
    ? players.find(p => p.id === currentPlayerId && !p.is_guest) ?? null
    : null;

  const isFinalized = selectedMatch?.match_status === 'afgerond';

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Top row: PersonalCard + NextMatchCard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PersonalCard player={currentPlayer} />
          <NextMatchCard
            match={selectedMatch}
            matchAbsences={matchAbsences}
            fieldOccupants={fieldOccupants}
            currentPlayerId={currentPlayerId}
            isManager={isManager}
            players={players}
            onToggleAbsence={onToggleAbsence}
            onNavigateToWedstrijd={onNavigateToWedstrijd}
            onNavigateToMatches={onNavigateToMatches}
          />
        </div>

        {/* Manager: selectie aanwezigheid */}
        {isManager && selectedMatch && (
          <div className="mb-4">
            <SquadAvailabilityPanel
              players={players}
              matchAbsences={matchAbsences}
              matchId={selectedMatch.id}
              fieldOccupants={fieldOccupants}
              isFinalized={!!isFinalized}
              onToggleAbsence={onToggleAbsence}
            />
          </div>
        )}

        {/* Speler van de week */}
        <VotingSection
          votingMatches={votingMatches}
          isLoading={isLoadingVotes}
          players={players}
          currentPlayerId={votingCurrentPlayerId}
          onSelectCurrentPlayer={onSelectVotingPlayer}
          onVote={onVote}
        />
      </div>
    </div>
  );
}
