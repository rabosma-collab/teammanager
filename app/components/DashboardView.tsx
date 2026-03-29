'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Match, Player, PositionInstruction, VotingMatch, SpdwResult, MatchPlayerStats, Substitution } from '../lib/types';
import { getPositionCategory, GAME_FORMATS, computeSubMomentMinutes } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import { logActivity } from '../lib/logActivity';
import PersonalCard from './dashboard/PersonalCard';
import NextMatchCard from './dashboard/NextMatchCard';
import SquadAvailabilityPanel from './dashboard/SquadAvailabilityPanel';
import VotingSection from './VotingSection';
import SpdwResultCard from './dashboard/SpdwResultCard';
import AnnouncementBanner from './dashboard/AnnouncementBanner';
import InstallBanner from './dashboard/InstallBanner';
import SeasonChart from './dashboard/SeasonChart';
import RecentResults from './dashboard/RecentResults';
import MyAvailabilityPanel from './dashboard/MyAvailabilityPanel';
import ActivityItem from './ActivityItem';
import type { ActivityLogItem } from '../hooks/useActivityLog';

interface DashboardViewProps {
  players: Player[];
  matches: Match[];
  gameFormat: string;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  onToggleInjury: (playerId: number) => Promise<boolean>;
  onNavigateToWedstrijd: (match: Match) => void;
  onNavigateToMatches: () => void;
  onNavigateToUitslagen: () => void;
  onNavigateToPlayers?: () => void;
  onNavigateToInvites?: () => void;
  // Voting (page-level currentPlayerId for manual "Wie ben jij?" override)
  votingMatches: VotingMatch[];
  isLoadingVotes: boolean;
  votingCurrentPlayerId: number | null;
  onSelectVotingPlayer: (playerId: number) => void;
  onVote: (matchId: number, votedForPlayerId: number) => void;
  creditBalance?: number | null;
  lastSpdwResult?: SpdwResult | null;
  recentStatsMap?: Record<number, MatchPlayerStats[]>;
  trackResults?: boolean;
  matchDuration?: number;
  trackWasbeurt?: boolean;
  trackConsumpties?: boolean;
  trackVervoer?: boolean;
  vervoerCount?: number;
  trackAssemblyTime?: boolean;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
  trackSpdw?: boolean;
  activities?: ActivityLogItem[];
  onActivityRead?: (id: number) => void;
  onOpenActivity?: () => void;
}

export default function DashboardView({
  players,
  matches,
  gameFormat,
  onToggleAbsence,
  onToggleInjury,
  onNavigateToWedstrijd,
  onNavigateToMatches,
  onNavigateToUitslagen,
  onNavigateToPlayers,
  onNavigateToInvites,
  votingMatches,
  isLoadingVotes,
  votingCurrentPlayerId,
  onSelectVotingPlayer,
  onVote,
  creditBalance,
  lastSpdwResult,
  recentStatsMap = {},
  matchDuration = 90,
  trackResults = true,
  trackWasbeurt = true,
  trackConsumpties = true,
  trackVervoer = true,
  vervoerCount = 3,
  trackAssemblyTime = false,
  trackMatchTime = false,
  trackLocationDetails = false,
  trackSpdw = true,
  activities = [],
  onActivityRead,
  onOpenActivity,
}: DashboardViewProps) {
  // Use TeamContext for authoritative identity (not the voting override)
  const { currentTeam, currentPlayerId, isManager, isStaff } = useTeamContext();

  const currentPlayer = currentPlayerId
    ? players.find(p => p.id === currentPlayerId && !p.is_guest) ?? null
    : null;

  // Aan de slag: taken voor managers met een leeg team
  const realPlayers = useMemo(() => players.filter(p => !p.is_guest), [players]);
  const hasNoPlayers = isManager && realPlayers.length === 0;
  const hasNoMatches = isManager && matches.length === 0;
  const showGettingStarted = isManager && (hasNoPlayers || hasNoMatches);

  // Profile nudge: spelers zonder avatar (dismissible)
  const [profileNudgeDismissed, setProfileNudgeDismissed] = useState(false);
  const showProfileNudge = !isManager && !isStaff && currentPlayerId !== null && !currentPlayer?.avatar_url && !profileNudgeDismissed;

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

  // Alle toekomstige concept-wedstrijden na de dashboardMatch (voor beschikbaarheidspaneel)
  const futureMatches = useMemo((): Match[] => {
    if (!dashboardMatch) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matches
      .filter(m => m.match_status === 'concept' && new Date(m.date) >= today && m.id !== dashboardMatch.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, dashboardMatch]);

  // Lokale afwezigheidslijst voor de dashboardMatch (onafhankelijk van pitch-view)
  const [dashboardAbsences, setDashboardAbsences] = useState<number[]>([]);

  // Match-instructie voor de ingelogde speler
  const [matchInstructions, setMatchInstructions] = useState<PositionInstruction[]>([]);

  // POTW-overwinningen berekenen voor de ingelogde speler
  const [potwWins, setPotwWins] = useState(0);

  // Eigen opstelling-state voor het dashboard (onafhankelijk van pitch-tab selectedMatch)
  const [dashboardOccupants, setDashboardOccupants] = useState<(Player | null)[]>(Array(11).fill(null));
  const [dashboardSubstitutions, setDashboardSubstitutions] = useState<Substitution[]>([]);

  // Loading gates: wacht tot alle lokale fetches klaar zijn zodat alles tegelijk verschijnt
  const [absencesReady, setAbsencesReady] = useState(false);
  const [instructionsReady, setInstructionsReady] = useState(false);
  const [potwReady, setPotwReady] = useState(false);
  const [occupantsReady, setOccupantsReady] = useState(false);
  const isReady = absencesReady && instructionsReady && potwReady && occupantsReady;
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
    return dashboardOccupants.findIndex(p => p?.id === currentPlayerId);
  }, [currentPlayerId, dashboardOccupants]);

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

  // Laad de opstelling voor dashboardMatch onafhankelijk van de pitch-tab state
  useEffect(() => {
    setOccupantsReady(false);
    if (!dashboardMatch) {
      setDashboardOccupants(Array(11).fill(null));
      setOccupantsReady(true);
      return;
    }
    const playerCount = GAME_FORMATS[gameFormat]?.players ?? 11;
    (async () => {
      const [lineupResult, guestResult] = await Promise.all([
        supabase.from('lineups').select('position, player_id').eq('match_id', dashboardMatch.id),
        supabase.from('guest_players').select('id, lineup_position').eq('match_id', dashboardMatch.id).not('lineup_position', 'is', null),
      ]);
      const lineup: (Player | null)[] = Array(playerCount).fill(null);
      if (lineupResult.data) {
        for (const entry of lineupResult.data) {
          if (entry.position >= 0 && entry.position < playerCount && entry.player_id) {
            const player = players.find((p: Player) => p.id === entry.player_id && !p.is_guest);
            if (player) lineup[entry.position] = player;
          }
        }
      }
      if (guestResult.data) {
        for (const guest of guestResult.data) {
          if (guest.lineup_position >= 0 && guest.lineup_position < playerCount) {
            const player = players.find((p: Player) => p.id === guest.id && p.is_guest);
            if (player) lineup[guest.lineup_position] = player;
          }
        }
      }
      setDashboardOccupants(lineup);
      setOccupantsReady(true);
    })();
  }, [dashboardMatch?.id, players, gameFormat]);

  // Laad wissels voor dashboardMatch
  useEffect(() => {
    if (!dashboardMatch) { setDashboardSubstitutions([]); return; }
    supabase
      .from('substitutions')
      .select('*')
      .eq('match_id', dashboardMatch.id)
      .then(({ data }: { data: Substitution[] | null }) => {
        setDashboardSubstitutions(data || []);
      });
  }, [dashboardMatch?.id]);

  const dashboardSubMomentMinutes = useMemo(() => {
    const n = dashboardMatch?.sub_moments ?? 0;
    return computeSubMomentMinutes(n, matchDuration);
  }, [dashboardMatch?.sub_moments, matchDuration]);

  const refreshAbsences = useCallback(async (): Promise<number[]> => {
    if (!dashboardMatch) return [];
    const { data } = await supabase
      .from('match_absences')
      .select('player_id')
      .eq('match_id', dashboardMatch.id);
    const newAbsences = data?.map((a: { player_id: number }) => a.player_id) || [];
    setDashboardAbsences(newAbsences);
    return newAbsences;
  }, [dashboardMatch?.id]);

  const handleToggleAbsence = useCallback(async (playerId: number, matchId: number): Promise<boolean> => {
    const success = await onToggleAbsence(playerId, matchId);
    if (success) {
      const freshAbsences = await refreshAbsences();
      // Log alleen voor de dashboardMatch (alleen daar hebben we accurate afwezigheidsdata)
      if (currentTeam && dashboardMatch && matchId === dashboardMatch.id) {
        const player = players.find(p => p.id === playerId);
        const nowAbsent = freshAbsences.includes(playerId);
        logActivity({
          teamId: currentTeam.id,
          type: 'absence_changed',
          actorId: playerId,
          subjectId: playerId,
          matchId,
          payload: {
            actor_name: player?.name ?? 'Onbekend',
            available: !nowAbsent, // post-toggle staat bepaalt de melding correct
            opponent: dashboardMatch.opponent,
            home_away: dashboardMatch.home_away,
          },
        });
      }
    }
    return success;
  }, [onToggleAbsence, refreshAbsences, players, currentTeam, dashboardMatch]);


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

      const matchIds = Object.keys(matchVotes).map(Number);
      if (matchIds.length === 0) { setPotwWins(0); setPotwReady(true); return; }

      // Haal wedstrijddatums op om te bepalen of de stemperiode al voorbij is
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, date')
        .in('id', matchIds);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Bouw set van match_ids waarvan de stemperiode is afgesloten (datum + 4 dagen < vandaag)
      const closedMatchIds = new Set<number>();
      for (const m of (matchData || [])) {
        const matchDate = new Date(m.date);
        matchDate.setHours(0, 0, 0, 0);
        const deadline = new Date(matchDate);
        deadline.setDate(deadline.getDate() + 4);
        if (today > deadline) closedMatchIds.add(m.id);
      }

      // Tel alleen wins van afgesloten stemronden (niet lopende)
      let wins = 0;
      for (const [matchIdStr, votes] of Object.entries(matchVotes)) {
        if (!closedMatchIds.has(parseInt(matchIdStr))) continue;
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

        <InstallBanner />
        <AnnouncementBanner />

        {/* Aan de slag — alleen voor managers met een leeg team */}
        {showGettingStarted && (
          <div className="mb-4 bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-200 mb-3">Aan de slag met je team</p>
            <div className="space-y-2">
              {hasNoPlayers && (
                <button
                  onClick={onNavigateToInvites}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800/40 hover:bg-blue-800/70 transition text-left"
                >
                  <span className="text-lg">📨</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Nodig spelers uit</p>
                    <p className="text-xs text-blue-300">Stuur een uitnodigingslink naar je spelers</p>
                  </div>
                  <span className="ml-auto text-blue-400">›</span>
                </button>
              )}
              {hasNoMatches && (
                <button
                  onClick={onNavigateToMatches}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-800/40 hover:bg-blue-800/70 transition text-left"
                >
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Plan een wedstrijd</p>
                    <p className="text-xs text-blue-300">Voeg je eerste wedstrijd toe aan het schema</p>
                  </div>
                  <span className="ml-auto text-blue-400">›</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Profile nudge — voor spelers zonder profielfoto */}
        {showProfileNudge && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl">
            <span className="text-xl">👤</span>
            <p className="text-sm text-gray-300 flex-1">Voeg een profielfoto toe via het menu rechtsboven.</p>
            <button
              onClick={() => setProfileNudgeDismissed(true)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none transition"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
        )}

        {/* Top row: PersonalCard + NextMatchCard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <PersonalCard
            player={currentPlayer}
            potwWins={potwWins}
            isManager={isManager}
            isStaff={isStaff}
            creditBalance={creditBalance}
            matchInstruction={playerMatchInstruction}
          />
          <NextMatchCard
            match={dashboardMatch}
            matchAbsences={dashboardAbsences}
            fieldOccupants={dashboardOccupants}
            currentPlayerId={currentPlayerId}
            isManager={isManager}
            players={players}
            gameFormat={gameFormat}
            positionName={playerMatchInstruction?.position_name || lineupPositionName}
            teamName={currentTeam?.name}
            substitutions={dashboardSubstitutions}
            subMomentMinutes={dashboardSubMomentMinutes}
            trackWasbeurt={trackWasbeurt}
            trackConsumpties={trackConsumpties}
            trackVervoer={trackVervoer}
            vervoerCount={vervoerCount}
            trackAssemblyTime={trackAssemblyTime}
            trackMatchTime={trackMatchTime}
            trackLocationDetails={trackLocationDetails}
            onToggleAbsence={handleToggleAbsence}
            onToggleInjury={onToggleInjury}
            onNavigateToWedstrijd={onNavigateToWedstrijd}
            onNavigateToMatches={onNavigateToMatches}
          />
        </div>

        {/* Speler van de week — boven selectie aanwezigheid */}
        {trackSpdw && (votingMatches.length === 0 && lastSpdwResult ? (
          <SpdwResultCard result={lastSpdwResult} />
        ) : (
          <VotingSection
            votingMatches={votingMatches}
            isLoading={isLoadingVotes}
            players={players}
            currentPlayerId={votingCurrentPlayerId}
            isStaff={isStaff || isManager}
            onSelectCurrentPlayer={onSelectVotingPlayer}
            onVote={onVote}
          />
        ))}

        {/* Selectie aanwezigheid — zichtbaar voor iedereen */}
        {dashboardMatch && (
          <div className="mt-4">
            <SquadAvailabilityPanel
              players={players}
              matchAbsences={dashboardAbsences}
              match={dashboardMatch}
              isManager={isManager}
              onNavigateToWedstrijd={onNavigateToWedstrijd}
            />
          </div>
        )}

        {/* Beschikbaarheid voor toekomstige wedstrijden — alleen voor spelers */}
        {currentPlayerId && futureMatches.length > 0 && (
          <div className="mt-4">
            <MyAvailabilityPanel
              futureMatches={futureMatches}
              currentPlayerId={currentPlayerId}
              onToggleAbsence={handleToggleAbsence}
              players={players}
              trackWasbeurt={trackWasbeurt}
              trackConsumpties={trackConsumpties}
              trackVervoer={trackVervoer}
              vervoerCount={vervoerCount}
            />
          </div>
        )}

        {/* Seizoensgrafiek + recente uitslagen */}
        {trackResults && (
          <>
            <div className="mt-4">
              <SeasonChart
                matches={matches}
                onNavigateToUitslagen={onNavigateToUitslagen}
              />
            </div>
            <div className="mt-4">
              <RecentResults
                matches={matches}
                statsMap={recentStatsMap}
                onNavigateToUitslagen={onNavigateToUitslagen}
              />
            </div>
          </>
        )}

        {/* Activiteitenfeed (preview — max 5 items) */}
        {activities.filter(a => !a.is_read).length > 0 && (
          <div className="mt-4 bg-gray-800 rounded-xl overflow-hidden border border-gray-700/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
              <h3 className="font-bold text-sm text-gray-200">Recente activiteit</h3>
              {onOpenActivity && (
                <button
                  onClick={onOpenActivity}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Alles zien →
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-700/30">
              {activities.filter(a => !a.is_read).slice(0, 5).map((item) => (
                <ActivityItem
                  key={item.id}
                  item={item}
                  onRead={onActivityRead ?? (() => {})}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
