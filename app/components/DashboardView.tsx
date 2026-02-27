'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Match, Player, PositionInstruction, VotingMatch, SpdwResult } from '../lib/types';
import { getPositionCategory } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import PersonalCard from './dashboard/PersonalCard';
import NextMatchCard from './dashboard/NextMatchCard';
import SquadAvailabilityPanel from './dashboard/SquadAvailabilityPanel';
import VotingSection from './VotingSection';
import SpdwResultCard from './dashboard/SpdwResultCard';
import AnnouncementBanner from './dashboard/AnnouncementBanner';

interface DashboardViewProps {
  players: Player[];
  matches: Match[];
  fieldOccupants: (Player | null)[];
  gameFormat: string;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  onToggleInjury: (playerId: number) => Promise<boolean>;
  onNavigateToWedstrijd: (match: Match) => void;
  onNavigateToMatches: () => void;
  // Voting (page-level currentPlayerId for manual "Wie ben jij?" override)
  votingMatches: VotingMatch[];
  isLoadingVotes: boolean;
  votingCurrentPlayerId: number | null;
  onSelectVotingPlayer: (playerId: number) => void;
  onVote: (matchId: number, votedForPlayerId: number) => void;
  creditBalance?: number | null;
  lastSpdwResult?: SpdwResult | null;
}

export default function DashboardView({
  players,
  matches,
  fieldOccupants,
  gameFormat,
  onToggleAbsence,
  onToggleInjury,
  onNavigateToWedstrijd,
  onNavigateToMatches,
  votingMatches,
  isLoadingVotes,
  votingCurrentPlayerId,
  onSelectVotingPlayer,
  onVote,
  creditBalance,
  lastSpdwResult,
}: DashboardViewProps) {
  // Use TeamContext for authoritative identity (not the voting override)
  const { currentTeam, currentPlayerId, isManager, isStaff } = useTeamContext();

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

  // Match-instructie voor de ingelogde speler
  const [matchInstructions, setMatchInstructions] = useState<PositionInstruction[]>([]);

  // POTW-overwinningen berekenen voor de ingelogde speler
  const [potwWins, setPotwWins] = useState(0);

  // Loading gates: wacht tot alle lokale fetches klaar zijn zodat alles tegelijk verschijnt
  const [absencesReady, setAbsencesReady] = useState(false);
  const [instructionsReady, setInstructionsReady] = useState(false);
  const [potwReady, setPotwReady] = useState(false);
  const isReady = absencesReady && instructionsReady && potwReady;
  // Na de eerste volledige load nooit meer de skeleton tonen (voorkomt flits bij re-renders)
  const hasLoadedOnce = useRef(false);
  if (isReady) hasLoadedOnce.current = true;

  useEffect(() => {
    setInstructionsReady(false);
    if (!dashboardMatch) { setMatchInstructions([]); setInstructionsReady(true); return; }
    supabase
      .from('match_position_instructions')
      .select('*')
      .eq('match_id', dashboardMatch.id)
      .then(({ data }: { data: PositionInstruction[] | null }) => {
        setMatchInstructions(data || []);
        setInstructionsReady(true);
      });
  }, [dashboardMatch?.id]);

  const playerPositionIndex = useMemo(() => {
    if (!currentPlayerId) return -1;
    return fieldOccupants.findIndex(p => p?.id === currentPlayerId);
  }, [currentPlayerId, fieldOccupants]);

  const playerMatchInstruction = useMemo(() => {
    if (playerPositionIndex === -1) return null;
    return matchInstructions.find((i: PositionInstruction) => i.position_index === playerPositionIndex) ?? null;
  }, [playerPositionIndex, matchInstructions]);

  // Werkelijke positie-categorie o.b.v. spelvorm + formatie + slot-index
  const lineupPositionName = useMemo(() => {
    if (!dashboardMatch || playerPositionIndex === -1) return undefined;
    return getPositionCategory(gameFormat, dashboardMatch.formation, playerPositionIndex);
  }, [gameFormat, dashboardMatch?.formation, playerPositionIndex]);

  useEffect(() => {
    setAbsencesReady(false);
    if (!dashboardMatch) {
      setDashboardAbsences([]);
      setAbsencesReady(true);
      return;
    }
    supabase
      .from('match_absences')
      .select('player_id')
      .eq('match_id', dashboardMatch.id)
      .then(({ data }: { data: { player_id: number }[] | null }) => {
        setDashboardAbsences(data?.map((a) => a.player_id) || []);
        setAbsencesReady(true);
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

  useEffect(() => {
    setPotwReady(false);
    if (!currentPlayerId || !currentTeam) {
      setPotwWins(0);
      setPotwReady(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('player_of_week_votes')
        .select('match_id, voted_for_player_id')
        .eq('team_id', currentTeam.id);

      if (!data) { setPotwReady(true); return; }

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
      setPotwReady(true);
    })();
  }, [currentPlayerId, currentTeam?.id]);

  // Auto-koppel voting player aan de ingelogde gebruiker
  useEffect(() => {
    if (currentPlayerId && !votingCurrentPlayerId) {
      onSelectVotingPlayer(currentPlayerId);
    }
  }, [currentPlayerId, votingCurrentPlayerId, onSelectVotingPlayer]);

  // Team-overzicht stats voor manager-zonder-speler
  const regularPlayers = useMemo(() => players.filter((p: Player) => !p.is_guest), [players]);
  const injuredCount = useMemo(() => regularPlayers.filter((p: Player) => p.injured).length, [regularPlayers]);
  const absentCount = useMemo(() => dashboardAbsences.filter((id: number) => {
    const p = regularPlayers.find((pl: Player) => pl.id === id);
    return p && !p.injured;
  }).length, [dashboardAbsences, regularPlayers]);
  const availableCount = regularPlayers.length - injuredCount - absentCount;
  const lineupSet = useMemo(() => fieldOccupants.some(p => p !== null), [fieldOccupants]);

  // Skeleton alleen bij de eerste load, niet bij re-renders
  if (!isReady && !hasLoadedOnce.current) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-12 bg-gray-800/60 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-gray-800/60 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-800/60 rounded-xl animate-pulse" />
          </div>
          <div className="h-28 bg-gray-800/60 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">

        <AnnouncementBanner />

        {/* Top row: PersonalCard + NextMatchCard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PersonalCard
            player={currentPlayer}
            potwWins={potwWins}
            isManager={isManager}
            isStaff={isStaff}
            creditBalance={creditBalance}
            matchInstruction={playerMatchInstruction}
            totalPlayers={regularPlayers.length}
            availablePlayers={availableCount}
            absentPlayers={absentCount}
            injuredPlayers={injuredCount}
            lineupSet={lineupSet}
          />
          <NextMatchCard
            match={dashboardMatch}
            matchAbsences={dashboardAbsences}
            fieldOccupants={fieldOccupants}
            currentPlayerId={currentPlayerId}
            isManager={isManager}
            players={players}
            gameFormat={gameFormat}
            positionName={playerMatchInstruction?.position_name || lineupPositionName}
            onToggleAbsence={handleToggleAbsence}
            onToggleInjury={handleToggleInjury}
            onNavigateToWedstrijd={onNavigateToWedstrijd}
            onNavigateToMatches={onNavigateToMatches}
          />
        </div>

        {/* Speler van de week — boven selectie aanwezigheid */}
        {votingMatches.length === 0 && lastSpdwResult ? (
          <SpdwResultCard result={lastSpdwResult} />
        ) : (
          <VotingSection
            votingMatches={votingMatches}
            isLoading={isLoadingVotes}
            players={players}
            currentPlayerId={votingCurrentPlayerId}
            isStaff={isStaff}
            onSelectCurrentPlayer={onSelectVotingPlayer}
            onVote={onVote}
          />
        )}

        {/* Manager: selectie aanwezigheid */}
        {isManager && dashboardMatch && (
          <div className="mt-4">
            <SquadAvailabilityPanel
              players={players}
              matchAbsences={dashboardAbsences}
              match={dashboardMatch}
              isFinalized={!!isFinalized}
              onToggleAbsence={handleToggleAbsence}
            />
          </div>
        )}
      </div>
    </div>
  );
}
