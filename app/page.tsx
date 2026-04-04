"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay,
  MouseSensor, TouchSensor,
  useSensors, useSensor,
  closestCenter,
  type DragStartEvent, type DragEndEvent, type Modifier,
} from '@dnd-kit/core';

// Centreert de DragOverlay onder de vinger bij touch — alleen voor bankspelers
const snapBenchCenterToCursor: Modifier = ({ activatorEvent, active, activeNodeRect, overlayNodeRect, transform }) => {
  if (!activatorEvent || active?.data?.current?.type !== 'bench' || !activeNodeRect) return transform;
  if (typeof TouchEvent === 'undefined' || !(activatorEvent instanceof TouchEvent)) return transform;
  const touch = activatorEvent.touches[0] ?? activatorEvent.changedTouches[0];
  if (!touch) return transform;
  // Verschuif zodat het MIDDEN van de overlay (kleine cirkel) precies onder de vinger zit
  const overlayW = overlayNodeRect?.width ?? 48;
  const overlayH = overlayNodeRect?.height ?? 48;
  return {
    ...transform,
    x: transform.x + (touch.clientX - activeNodeRect.left - overlayW / 2),
    y: transform.y + (touch.clientY - activeNodeRect.top - overlayH / 2),
  };
};
import { formations, formationLabels, normalizeFormation, DEFAULT_GAME_FORMAT, DEFAULT_FORMATIONS, GAME_FORMATS, computeSubMomentMinutes, computeLineupForPeriod } from './lib/constants';
import { supabase } from './lib/supabase';
import { getCurrentUser, signOut } from './lib/auth';
import { useTeamContext } from './contexts/TeamContext';
import { useToast } from './contexts/ToastContext';
import type { Player, PositionInstruction, MatchPlayerStats, Substitution } from './lib/types';

// Hooks
import { usePlayers } from './hooks/usePlayers';
import { useMatches } from './hooks/useMatches';
import { useLineup } from './hooks/useLineup';
import { useSubstitutions } from './hooks/useSubstitutions';
import { useInstructions } from './hooks/useInstructions';
import { useSubstitutionSchemes } from './hooks/useSubstitutionSchemes';
import { useVoting } from './hooks/useVoting';
import { useStatCredits } from './hooks/useStatCredits';
import { usePeriodOverrides } from './hooks/usePeriodOverrides';
import { useMatchStats } from './hooks/useMatchStats';
import { useLineupPresence } from './hooks/useLineupPresence';
import { useActivityLog } from './hooks/useActivityLog';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useSeasons } from './hooks/useSeasons';

// Components
import Navbar from './components/Navbar';
import PitchView from './components/PitchView';
import BenchPanel from './components/BenchPanel';
import SubstitutionCards from './components/SubstitutionCards';
import TakenBlok from './components/TakenBlok';
import StatsView from './components/StatsView';
import InstructionsView from './components/InstructionsView';
import PlayersManageView from './components/PlayersManageView';
import PlayerCardsView from './components/PlayerCardsView';
import DashboardView from './components/DashboardView';
import UitslagenView from './components/UitslagenView';
import InvitesManageView from './components/InvitesManageView';
import MededelingenView from './components/MededelingenView';
import TeamSettingsView from './components/TeamSettingsView';
import SeasonSettingsView from './components/SeasonSettingsView';
import FeedbackView from './components/FeedbackView';
import LineupLockedView from './components/LineupLockedView';


// Modals
import MatchSelectionModal from './components/modals/MatchSelectionModal';
import TooltipModal from './components/modals/TooltipModal';
import InstructionEditModal from './components/modals/InstructionEditModal';

import GuestPlayerModal from './components/modals/GuestPlayerModal';
import SubstitutionModal from './components/modals/SubstitutionModal';
import PlayerCardModal from './components/modals/PlayerCardModal';
import PositionInfoModal from './components/modals/PositionInfoModal';
import FinalizeMatchModal from './components/modals/FinalizeMatchModal';
import PeriodSwapModal from './components/modals/PeriodSwapModal';
import ActivitySlideOver from './components/ActivitySlideOver';
import { logActivity } from './lib/logActivity';

export default function FootballApp() {
  const router = useRouter();
  const toast = useToast();
  const [authChecking, setAuthChecking] = useState(true);
  const { currentTeam, isManager, isLoading: teamLoading, currentPlayerId: teamPlayerId, hasPendingTeam, teamSettings, refreshTeamSettings } = useTeamContext();

  // ---- AUTH CHECK ----
  useEffect(() => {
    getCurrentUser().then(user => {
      if (!user) {
        router.push('/login');
      } else {
        setAuthChecking(false);
      }
    });
  }, [router]);

  // ---- UI STATE ----
  const [view, setView] = useState('dashboard');
  const [isDirty, setIsDirty] = useState(false);

  const handleSetView = useCallback((newView: string) => {
    if (isDirty) {
      if (!window.confirm('Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je deze pagina wilt verlaten?')) return;
      setIsDirty(false);
    }
    setView(newView);
  }, [isDirty]);
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [subMoments, setSubMoments] = useState<number>(1);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [swapTarget, setSwapTarget] = useState<{ player: import('./lib/types').Player; positionIndex: number } | null>(null);
  const [periodPositionPick, setPeriodPositionPick] = useState<{ player: import('./lib/types').Player; positionIndex: number } | null>(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [isEditingLineup, setIsEditingLineup] = useState(false);
  const wasPublishedBeforeEdit = useRef(false);
  const [isEditingMatchInstruction, setIsEditingMatchInstruction] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const [showTooltip, setShowTooltip] = useState<number | null>(null);
  const [instructionFormation, setInstructionFormation] = useState('4-3-3-aanvallend');
  const [showPlayerCard, setShowPlayerCard] = useState<Player | null>(null);
  const [showPositionInfo, setShowPositionInfo] = useState<{ player: Player; positionIndex: number } | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeCalcMinutes, setFinalizeCalcMinutes] = useState(true);
  const [finalizeGoalsFor, setFinalizeGoalsFor] = useState<string>('');
  const [finalizeGoalsAgainst, setFinalizeGoalsAgainst] = useState<string>('');
  const [recentStatsMap, setRecentStatsMap] = useState<Record<number, MatchPlayerStats[]>>({});
  const [showExtraSubModal, setShowExtraSubModal] = useState(false);
  const [showPrevLineupInfo, setShowPrevLineupInfo] = useState(false);
  const [extraSubMinute, setExtraSubMinute] = useState(45);
  const [extraSubOut, setExtraSubOut] = useState<Player | null>(null);
  const [extraSubIn, setExtraSubIn] = useState<Player | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null);

  // ---- HOOKS ----
  const {
    players, fetchPlayers,
    toggleInjury, guestPool, fetchGuestPool, addToPool, removeFromPool, addGuestPlayer, removeGuestPlayer, updateStat,
    addPlayer, updatePlayer, deletePlayer
  } = usePlayers();

  const {
    matches, setMatches, selectedMatch, setSelectedMatch,
    matchAbsences, loading, fetchMatches, fetchAbsences,
    toggleAbsence, isMatchEditable,
    addMatch, updateMatch, updateMatchScore, publishLineup, updateWasbeurtPlayer, updateConsumptiesPlayer, updateTransportPlayers, updateMatchReport, cancelMatch, deleteMatch
  } = useMatches();

  const { seasons, activeSeason, fetchSeasons } = useSeasons();

  const {
    fieldOccupants, setFieldOccupants,
    selectedPlayer, setSelectedPlayer,
    selectedPosition, setSelectedPosition,
    savingLineup, loadLineup, saveLineup,
    isPlayerOnField, getBenchPlayers, isPlayerAvailable, clearField,
    takeSnapshot, restoreSnapshot
  } = useLineup();

  const {
    substitutions, tempSubs, showSubModal, showSubModalMinute,
    fetchSubstitutions,
    getSubsForNumber, openSubModal, addTempSub,
    removeTempSub, updateTempSub, saveSubstitutions, saveQuickSwap, closeSubModal
  } = useSubstitutions();

  const {
    positionInstructions, matchInstructions, editingInstruction, setEditingInstruction,
    fetchInstructions, fetchMatchInstructions, clearMatchInstructions,
    getInstructionForPosition, saveInstruction, saveMatchInstruction
  } = useInstructions();

  const { schemes, fetchSchemes, getSchemeById } = useSubstitutionSchemes();
  const { votingMatches, isLoadingVotes, lastSpdwResult, fetchVotingMatches, submitVote } = useVoting();
  const { balance: creditBalance, fetchBalance, awardSpdwCredits, awardAttendanceCredits, spendCreditsForStats } = useStatCredits();
  const { fetchStatsForMatches, saveMatchStats } = useMatchStats();
  const { overrides: periodOverrides, periodFormations, fetchPeriodOverrides, applyAndSave: applyPeriodOverride, savePeriodFormation, clearOverrides: clearPeriodOverrides, clearFromPeriod: clearOverridesFromPeriod } = usePeriodOverrides();
  const { activities, unreadCount, loading: activityLoading, fetchActivities, markAsRead, markAllAsRead } = useActivityLog();
  const [showActivity, setShowActivity] = useState(false);
  const [upcomingAbsencesMap, setUpcomingAbsencesMap] = useState<Record<number, number[]>>({});

  const { activeEditor, claimEdit, releaseEdit } = useLineupPresence(selectedMatch?.id ?? null);
  const myName = players.find(p => p.id === teamPlayerId)?.name ?? 'Manager';

  const gameFormat = teamSettings?.game_format ?? DEFAULT_GAME_FORMAT;
  const matchDuration = teamSettings?.match_duration ?? 90;

  // ---- BEREKENDE WAARDEN ----
  // Alle aankomende concept-wedstrijden gesorteerd op datum (voor cumulatieve taakberekening)
  const upcomingConceptMatches = useMemo(
    () => matches.filter(m => m.match_status === 'concept')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [matches]
  );

  const editable = isMatchEditable(isManager);
  const isFinalized = selectedMatch?.match_status === 'afgerond' || selectedMatch?.match_status === 'geannuleerd';
  const isLineupPublished = selectedMatch?.lineup_published === true;
  const activelyEditing = editable && isEditingLineup;
  // Spelers mogen de opstelling alleen zien als: manager, opstelling gepubliceerd, of wedstrijd afgerond
  const canSeeLineup = isManager || isLineupPublished || isFinalized;

  // Wasbeurt berekening voor PitchView toolbar
  const wasbeurtEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => (a.wash_count - b.wash_count) || a.name.localeCompare(b.name)),
    [players, matchAbsences]
  );
  const wasbeurtOverrideId = selectedMatch?.wasbeurt_player_id ?? null;
  const wasbeurtOverridePlayer = wasbeurtOverrideId
    ? players.find((p: Player) => p.id === wasbeurtOverrideId) ?? null
    : null;
  const wasbeurtDisplayPlayer = wasbeurtOverridePlayer ?? wasbeurtEligible[0] ?? null;
  const wasbeurtIsUnavailable = wasbeurtOverridePlayer
    ? (wasbeurtOverridePlayer.injured || matchAbsences.includes(wasbeurtOverridePlayer.id))
    : false;
  const wasbeurtAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );

  // Consumpties berekening voor PitchView toolbar
  const consumptiesEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => (a.consumption_count - b.consumption_count) || a.name.localeCompare(b.name)),
    [players, matchAbsences]
  );
  const consumptiesOverrideId = selectedMatch?.consumpties_player_id ?? null;
  const consumptiesOverridePlayer = consumptiesOverrideId
    ? players.find((p: Player) => p.id === consumptiesOverrideId) ?? null
    : null;
  const consumptiesDisplayPlayer = consumptiesOverridePlayer ?? consumptiesEligible[0] ?? null;
  const consumptiesIsUnavailable = consumptiesOverridePlayer
    ? (consumptiesOverridePlayer.injured || matchAbsences.includes(consumptiesOverridePlayer.id))
    : false;
  const consumptiesAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );

  // Vervoer berekening voor PitchView toolbar
  const vervoerCount = teamSettings?.vervoer_count ?? 3;
  // Simuleer cumulatieve transport-count t/m de geselecteerde wedstrijd (zelfde logica als UitslagenView)
  // zodat de auto-selectie verandert wanneer je van wedstrijd wisselt.
  const vervoerEffectiveCounts = useMemo(() => {
    const counts = new Map<number, number>(players.filter((p: Player) => !p.is_guest).map((p: Player) => [p.id, p.transport_count]));
    if (!selectedMatch || !(teamSettings?.track_vervoer ?? true)) return counts;
    for (const match of upcomingConceptMatches) {
      if (match.id === selectedMatch.id) break;
      if (match.home_away === 'Thuis') continue;
      const absentIds = new Set(upcomingAbsencesMap[match.id] ?? []);
      const available = players.filter((p: Player) => !p.is_guest && !p.injured && !absentIds.has(p.id));
      const eligibleList = [...available].sort((a: Player, b: Player) => ((counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0)) || a.name.localeCompare(b.name));
      const usedIds = new Set<number>();
      const overrideIds: number[] = match.transport_player_ids ?? [];
      for (let i = 0; i < vervoerCount; i++) {
        const overrideId = overrideIds[i] ?? null;
        if (overrideId) {
          const op = available.find((p: Player) => p.id === overrideId && !usedIds.has(p.id)) ?? null;
          if (op) { counts.set(op.id, (counts.get(op.id) ?? 0) + 1); usedIds.add(op.id); continue; }
        }
        const auto = eligibleList.find((p: Player) => !usedIds.has(p.id)) ?? null;
        if (auto) { counts.set(auto.id, (counts.get(auto.id) ?? 0) + 1); usedIds.add(auto.id); }
      }
    }
    return counts;
  }, [selectedMatch?.id, upcomingConceptMatches, upcomingAbsencesMap, players, vervoerCount, teamSettings?.track_vervoer]);

  const vervoerEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => ((vervoerEffectiveCounts.get(a.id) ?? a.transport_count) - (vervoerEffectiveCounts.get(b.id) ?? b.transport_count)) || a.name.localeCompare(b.name)),
    [players, matchAbsences, vervoerEffectiveCounts]
  );
  const vervoerOverrideIds: number[] = selectedMatch?.transport_player_ids ?? [];
  const vervoerAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );
  // Bereken welke speler per slot daadwerkelijk getoond wordt (override → eligible)
  // Iteratief zodat auto-gekozen spelers uit eerdere slots worden overgeslagen
  const vervoerDisplayPlayers: (Player | null)[] = useMemo(() => {
    const result: (Player | null)[] = [];
    const usedIds = new Set<number>();
    for (let i = 0; i < vervoerCount; i++) {
      const overrideId = vervoerOverrideIds[i] ?? null;
      if (overrideId) {
        const op = players.find((p: Player) => p.id === overrideId) ?? null;
        if (op && !op.injured && !matchAbsences.includes(op.id)) {
          result.push(op);
          usedIds.add(op.id);
          continue;
        }
      }
      const auto = vervoerEligible.find(p => !usedIds.has(p.id)) ?? null;
      result.push(auto);
      if (auto) usedIds.add(auto.id);
    }
    return result;
  }, [vervoerCount, vervoerOverrideIds, vervoerEligible, players, matchAbsences]);

  const canFinalizeMatch = useCallback((): boolean => {
    if (!selectedMatch || !isManager) return false;
    if (selectedMatch.match_status !== 'concept') return false;
    const matchDate = new Date(selectedMatch.date);
    matchDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matchDate <= today;
  }, [selectedMatch, isManager]);

  const getMatchStatusBadge = useCallback((): string => {
    if (!selectedMatch) return '';
    if (selectedMatch.match_status === 'afgerond') return '✅ Afgerond';
    if (selectedMatch.match_status === 'geannuleerd') return '🚫 Geannuleerd';
    const matchDate = new Date(selectedMatch.date);
    matchDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (matchDate < today) return '⚠️ Nog afsluiten';
    if (matchDate.getTime() === today.getTime()) return '🏟️ Vandaag';
    return '📅 Binnenkort';
  }, [selectedMatch]);

  const isFreeSubstitution = subMoments === 0;
  const subMomentMinutes = useMemo(
    () => computeSubMomentMinutes(subMoments, matchDuration),
    [subMoments, matchDuration]
  );

  const benchPlayers = useMemo(() => {
    const raw = getBenchPlayers(players, matchAbsences);
    // Final dedup safety: by player id
    const seen = new Map<number, Player>();
    for (const p of raw) {
      if (!seen.has(p.id)) seen.set(p.id, p);
    }
    const result = Array.from(seen.values());
    if (result.length !== raw.length) {
      console.error(`[page] benchPlayers dedup removed ${raw.length - result.length} duplicates!`, raw.map(p => `${p.id}:${p.name}`));
    }
    return result;
  }, [getBenchPlayers, players, matchAbsences]);
  const unavailablePlayers = useMemo(() => ({
    injured: players.filter(p => p.injured),
    // Guest players are never in matchAbsences (different ID space from guest_players table)
    absent: players.filter(p => !p.is_guest && matchAbsences.includes(p.id))
  }), [players, matchAbsences]);

  // Opstelling voor de geselecteerde periode (period 1 = startopstelling, period N = na N-1 wisselmomenten)
  // Prioriteit: manager-override (alleen als spelers overeenkomen met wissels) > berekende opstelling > startopstelling
  const displayedOccupants = useMemo(() => {
    if (selectedPeriod <= 1) return fieldOccupants;
    const computedLineup = computeLineupForPeriod(fieldOccupants, substitutions, players, selectedPeriod);
    const override = periodOverrides[selectedPeriod];
    if (override) {
      // Gebruik de override alleen als dezelfde spelers op het veld staan als de berekende opstelling.
      // Als de override verouderd is (bijv. wissel na override aangemaakt), negeer hem.
      const playerKey = (p: import('./lib/types').Player | null) => p ? `${p.is_guest ? 'g' : 'r'}_${p.id}` : null;
      const computedIds = new Set(computedLineup.map(playerKey).filter(Boolean));
      const overrideIds = new Set(override.map(playerKey).filter(Boolean));
      const setsMatch = computedIds.size === overrideIds.size && Array.from(computedIds).every(id => overrideIds.has(id));
      if (setsMatch) return override;
    }
    return computedLineup;
  }, [selectedPeriod, fieldOccupants, substitutions, players, periodOverrides]);

  // Formatie voor de geselecteerde periode (periode 1 = wedstrijdformatie, periode N = periodieke override)
  const displayedFormation = selectedPeriod > 1 ? (periodFormations[selectedPeriod] ?? formation) : formation;

  // Bank voor de geselecteerde periode: wie staat NIET in de huidige periode op het veld?
  const benchPlayersForPeriod = useMemo(() => {
    if (selectedPeriod <= 1) return benchPlayers;
    const fieldKeys = new Set(
      displayedOccupants.filter(Boolean).map(p => `${p!.is_guest ? 'g' : 'r'}_${p!.id}`)
    );
    return players.filter(p => {
      const key = `${p.is_guest ? 'g' : 'r'}_${p.id}`;
      return !fieldKeys.has(key) && !p.injured && (p.is_guest || !matchAbsences.includes(p.id));
    });
  }, [selectedPeriod, displayedOccupants, players, benchPlayers, matchAbsences]);

  // Bank vóór het wisselmoment (voor de swap modal: wie kan er ingewisseld worden?)
  const benchPlayersForSwap = useMemo(() => {
    if (selectedPeriod <= 1) return benchPlayers;
    const lineupBeforeSwap = computeLineupForPeriod(fieldOccupants, substitutions, players, selectedPeriod - 1);
    const fieldKeys = new Set(lineupBeforeSwap.filter(Boolean).map(p => `${p!.is_guest ? 'g' : 'r'}_${p!.id}`));
    return players.filter(p => {
      const key = `${p.is_guest ? 'g' : 'r'}_${p.id}`;
      return !fieldKeys.has(key) && !p.injured && (p.is_guest || !matchAbsences.includes(p.id));
    });
  }, [selectedPeriod, fieldOccupants, substitutions, players, benchPlayers, matchAbsences]);

  // ---- DEBUG: track player changes ----
  useEffect(() => {
    const names = players.map(p => p.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      console.error('[page] DUPLICATE players in state:', dupes, players.map(p => `${p.id}:${p.name}`));
    }
  }, [players]);

  // ---- DATA LADEN ----
  useEffect(() => {
    fetchSeasons();
    fetchMatches();
    fetchSchemes(currentTeam?.id);
    fetchActivities();
  }, [fetchMatches, fetchSchemes, fetchActivities, fetchSeasons, currentTeam?.id]);


  useEffect(() => {
    if (selectedMatch) {
      setFormation(normalizeFormation(selectedMatch.formation, gameFormat));
      // Gebruik sub_moments als aanwezig, anders bereken default op basis van periods
      if (selectedMatch.sub_moments !== null && selectedMatch.sub_moments !== undefined) {
        setSubMoments(selectedMatch.sub_moments);
      } else {
        // Legacy match: geen sub_moments opgeslagen → herleid uit het oude schema
        const legacyScheme = getSchemeById(selectedMatch.substitution_scheme_id);
        const derivedMoments = legacyScheme != null
          ? legacyScheme.minutes.length   // 0 = vrij, 1/2/3 = vaste momenten
          : Math.max(0, (teamSettings?.periods ?? 2) - 1);
        setSubMoments(derivedMoments);
      }
      fetchAbsences(selectedMatch.id);
      fetchSubstitutions(selectedMatch.id);
      fetchPlayers(selectedMatch.id);
      setIsEditingLineup(false);
      setSelectedPeriod(1);
      setPeriodPositionPick(null);
      clearPeriodOverrides();
    } else {
      // No match selected yet, fetch players without match context
      fetchPlayers();
    }
  }, [selectedMatch?.id, fetchAbsences, fetchSubstitutions, fetchPlayers]);

  // Herbereken formatie wanneer gameFormat laadt (teamSettings kan na selectedMatch binnenkomen)
  useEffect(() => {
    if (selectedMatch) {
      setFormation(normalizeFormation(selectedMatch.formation, gameFormat));
    }
  }, [gameFormat]);

  const playerCount = GAME_FORMATS[gameFormat]?.players ?? 11;

  // Wedstrijden van het actieve seizoen (voor dashboard/pitch views)
  const activeSeasonMatches = useMemo(
    () => activeSeason ? matches.filter(m => m.season_id === activeSeason.id) : matches,
    [matches, activeSeason]
  );

  useRealtimeSync({
    currentTeam,
    selectedMatchId: selectedMatch?.id ?? null,
    isEditingLineup: isEditingLineup,
    players,
    playerCount,
    onPlayersChange: fetchPlayers,
    onMatchesChange: fetchMatches,
    onLineupChange: loadLineup,
    onSubstitutionsChange: fetchSubstitutions,
    onAbsencesChange: fetchAbsences,
    onPeriodOverridesChange: fetchPeriodOverrides,
  });

  useEffect(() => {
    if (selectedMatch && players.length > 0) {
      loadLineup(selectedMatch.id, players, playerCount);
      fetchPeriodOverrides(selectedMatch.id, players);
    }
  }, [players, selectedMatch?.id, loadLineup, playerCount]);

  useEffect(() => {
    fetchInstructions(gameFormat, formation);
    if (selectedMatch) {
      fetchMatchInstructions(selectedMatch.id, formation);
    } else {
      clearMatchInstructions();
    }
  }, [gameFormat, formation, selectedMatch?.id, fetchInstructions, fetchMatchInstructions, clearMatchInstructions]);

  // Re-fetch absences and reload lineup when navigating to pitch view, so changes
  // made on the dashboard (absence/injury toggle, name change) are immediately visible.
  useEffect(() => {
    if (view === 'pitch' && selectedMatch) {
      fetchAbsences(selectedMatch.id);
      if (players.length > 0) loadLineup(selectedMatch.id, players, playerCount);
    }
  }, [view, selectedMatch?.id, players, fetchAbsences, loadLineup, playerCount]);

  // Haal afwezigheid op voor alle aankomende concept-wedstrijden (nodig voor cumulatieve vervoer/wasbeurt/consumpties berekening)
  useEffect(() => {
    if (!currentTeam || upcomingConceptMatches.length === 0) return;
    const ids = upcomingConceptMatches.map(m => m.id);
    supabase.from('match_absences').select('match_id, player_id').in('match_id', ids)
      .then(({ data }: { data: { match_id: number; player_id: number }[] | null }) => {
        const map: Record<number, number[]> = {};
        for (const row of data ?? []) {
          if (!map[row.match_id]) map[row.match_id] = [];
          map[row.match_id].push(row.player_id);
        }
        setUpcomingAbsencesMap(map);
      });
  }, [upcomingConceptMatches.length, currentTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Houd de geselecteerde wedstrijd synchroon in upcomingAbsencesMap (bij toggling afwezigheid)
  useEffect(() => {
    if (selectedMatch) {
      setUpcomingAbsencesMap(prev => ({ ...prev, [selectedMatch.id]: matchAbsences }));
    }
  }, [matchAbsences, selectedMatch?.id]);

  useEffect(() => {
    if (view === 'instructions') {
      fetchInstructions(gameFormat, instructionFormation);
      if (selectedMatch) {
        fetchMatchInstructions(selectedMatch.id, instructionFormation);
      }
    }
  }, [view, gameFormat, instructionFormation, selectedMatch?.id, fetchInstructions, fetchMatchInstructions]);

  // Load voting data when matches are available and currentPlayer changes
  useEffect(() => {
    if (matches.length > 0) {
      fetchVotingMatches(matches, currentPlayerId);
    }
  }, [matches, currentPlayerId, fetchVotingMatches]);

  // Load credit balance when player identity is known
  useEffect(() => {
    if (teamPlayerId) {
      fetchBalance(teamPlayerId);
    }
  }, [teamPlayerId, fetchBalance]);

  // Award SPDW credits lazily when team data is loaded
  useEffect(() => {
    if (currentTeam) {
      awardSpdwCredits();
    }
  }, [currentTeam, awardSpdwCredits]);

  // Laad stats voor recente afgeronde wedstrijden (voor dashboard en uitslagen-view)
  useEffect(() => {
    const finished = matches.filter(m => m.match_status === 'afgerond');
    if (finished.length === 0) return;
    const ids = finished.map(m => m.id);
    fetchStatsForMatches(ids).then(data => setRecentStatsMap(data));
  }, [matches, fetchStatsForMatches]);

  // ---- DND-KIT SENSORS ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // ---- HANDLERS ----
  const handleSaveStatDraft = useCallback(async (
    targetPlayerId: number,
    finalStats: Record<string, number>,
    totalCost: number,
    actorName?: string,
    subjectName?: string,
    prevStats?: Record<string, number>
  ): Promise<{ success: boolean; errorMessage?: string }> => {
    if (!teamPlayerId) return { success: false, errorMessage: 'Je bent niet gekoppeld aan een speler.' };
    const result = await spendCreditsForStats(teamPlayerId, targetPlayerId, finalStats, totalCost, actorName, subjectName, prevStats);
    if (result.success) {
      if (selectedMatch) fetchPlayers(selectedMatch.id);
      else fetchPlayers();
      fetchActivities();
    }
    return result;
  }, [teamPlayerId, spendCreditsForStats, fetchPlayers, selectedMatch, fetchActivities]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Place a player at a specific field position
  const placePlayerAtPosition = useCallback((player: Player, positionIndex: number) => {
    if (!isPlayerAvailable(player, matchAbsences)) return;

    setFieldOccupants(prev => {
      // Use composite key (is_guest + id) to avoid false match between regular and guest players
      if (prev.some(p => p && p.id === player.id && Boolean(p.is_guest) === Boolean(player.is_guest))) return prev;
      const newField = [...prev];
      newField[positionIndex] = player;
      return newField;
    });
    setSelectedPlayer(null);
    setSelectedPosition(null);
  }, [matchAbsences, isPlayerAvailable, setFieldOccupants, setSelectedPlayer, setSelectedPosition]);

  const handlePositionClick = (index: number) => {
    if (!activelyEditing) {
      // In view-modus: tik op positie met speler → toon FIFA stats card (mobiel)
      const player = fieldOccupants[index];
      if (player) setShowPlayerCard(player);
      return;
    }

    if (selectedPlayer) {
      const targetOccupant = fieldOccupants[index];

      if (targetOccupant && selectedPosition !== null) {
        // Feature 2: echte swap — opgetilde veldspeler ↔ bezette doelpositie
        setFieldOccupants(prev => {
          const newField = [...prev];
          newField[index] = selectedPlayer;
          newField[selectedPosition] = targetOccupant;
          return newField;
        });
        setSelectedPlayer(null);
        setSelectedPosition(null);
      } else {
        // Normaal plaatsen: bankspeler → elke positie, of opgetilde speler → lege positie
        // Als de doelpositie bezet is (bench-speler erop): oude speler gaat automatisch terug naar bank
        placePlayerAtPosition(selectedPlayer, index);
      }
    } else if (fieldOccupants[index]) {
      // Feature 2: veldspeler "optillen" — verwijder tijdelijk van veld en selecteer
      const liftedPlayer = fieldOccupants[index]!;
      setFieldOccupants(prev => {
        const newField = [...prev];
        newField[index] = null;
        return newField;
      });
      setSelectedPlayer(liftedPlayer);
      setSelectedPosition(index); // onthoud bronpositie voor eventuele swap
    } else {
      // Mode B: lege positie highlighten, dan bankspeler kiezen
      setSelectedPosition(selectedPosition === index ? null : index);
    }
  };

  // When a player is selected (from sidebar or bench)
  const handleSelectPlayer = useCallback((player: Player | null) => {
    if (player && selectedPosition !== null && activelyEditing) {
      // A position was already selected → place player there directly
      placePlayerAtPosition(player, selectedPosition);
    } else {
      setSelectedPlayer(player);
      setSelectedPosition(null);
    }
  }, [selectedPosition, activelyEditing, placePlayerAtPosition, setSelectedPlayer, setSelectedPosition]);

  // Feature 3: drag & drop handlers
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const data = active.data.current as { player?: Player } | undefined;
    setActiveDragPlayer(data?.player ?? null);
    // Wis klik-selectie zodat drag en click niet conflicteren
    setSelectedPlayer(null);
    setSelectedPosition(null);
  }, [setSelectedPlayer, setSelectedPosition]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveDragPlayer(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeData = active.data.current as { type: 'field' | 'bench'; positionIndex?: number; player: Player };

    // Periode 2+: alleen veld-naar-veld positiewisseling, opgeslagen als override
    if (selectedPeriod > 1) {
      if (!activelyEditing || !isManager || isFinalized || isFreeSubstitution) return;
      if (overId.startsWith('pos-') && activeData.type === 'field') {
        const targetPos = parseInt(overId.replace('pos-', ''));
        const sourcePos = activeData.positionIndex!;
        if (sourcePos === targetPos) return;
        const newLineup = [...displayedOccupants];
        [newLineup[sourcePos], newLineup[targetPos]] = [newLineup[targetPos], newLineup[sourcePos]];
        if (selectedMatch && currentTeam) {
          applyPeriodOverride(selectedMatch.id, currentTeam.id, selectedPeriod, newLineup);
        }
      }
      return;
    }

    // Periode 1: normale drag-and-drop (vereist bewerkingsmode)
    if (!activelyEditing) return;

    if (overId.startsWith('pos-')) {
      const targetPos = parseInt(overId.replace('pos-', ''));
      if (activeData.type === 'field') {
        // Veldspeler → andere veldpositie: swap
        const sourcePos = activeData.positionIndex!;
        if (sourcePos === targetPos) return;
        setFieldOccupants(prev => {
          const newField = [...prev];
          const temp = newField[sourcePos];
          newField[sourcePos] = newField[targetPos];
          newField[targetPos] = temp;
          return newField;
        });
      } else if (activeData.type === 'bench') {
        // Bankspeler → veldpositie: plaatsen
        placePlayerAtPosition(activeData.player, targetPos);
      }
    } else if (overId === 'bench-zone' && activeData.type === 'field') {
      // Veldspeler → bank: terugzetten
      const sourcePos = activeData.positionIndex!;
      setFieldOccupants(prev => {
        const newField = [...prev];
        newField[sourcePos] = null;
        return newField;
      });
    }
  }, [selectedPeriod, isManager, isFinalized, isFreeSubstitution, displayedOccupants, selectedMatch, currentTeam, applyPeriodOverride, activelyEditing, setFieldOccupants, placePlayerAtPosition]);

  // Feature 5: laad opstelling van de vorige wedstrijd
  const handleLoadPreviousLineup = useCallback(async () => {
    if (!selectedMatch || !currentTeam) return;

    const previousMatches = [...matches]
      .filter(m => m.id !== selectedMatch.id && m.match_status === 'afgerond')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (previousMatches.length === 0) {
      toast.warning('Geen afgesloten wedstrijd gevonden');
      return;
    }

    // Bouw een map van player_id → Player voor snelle lookup (geen gastspelers)
    const playerMap = new Map(players.filter(p => !p.is_guest).map(p => [p.id, p]));

    for (const match of previousMatches) {
      const { data } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', match.id);

      if (data && data.length > 0) {
        // Kopieer alleen posities van spelers die ook nu aanwezig zijn
        const lineup: (Player | null)[] = Array(playerCount).fill(null);
        data.forEach((entry: { position: number; player_id: number }) => {
          if (entry.position >= 0 && entry.position < playerCount) {
            const player = playerMap.get(entry.player_id);
            if (player) {
              lineup[entry.position] = player;
            }
          }
        });

        setFieldOccupants(lineup);
        const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        toast.success(`📋 Opstelling van ${dateStr} - ${match.opponent} geladen`);
        return;
      }
    }

    toast.warning('Geen eerdere opstelling gevonden');
  }, [selectedMatch, matches, currentTeam, players, playerCount, setFieldOccupants]);

  const handleSaveLineup = async (): Promise<boolean> => {
    if (!selectedMatch) return false;
    const success = await saveLineup(selectedMatch, formation, subMoments, (updatedMatch) => {
      // Alleen formation en sub_moments bijwerken — lineup_published NIET aanraken
      // zodat een gelijktijdige publishLineup-update niet wordt overschreven.
      setSelectedMatch(prev => prev ? { ...prev, formation: updatedMatch.formation, sub_moments: updatedMatch.sub_moments } : prev);
      setMatches(prev => prev.map(m => m.id === updatedMatch.id
        ? { ...m, formation: updatedMatch.formation, sub_moments: updatedMatch.sub_moments }
        : m
      ));
    });
    if (!success) {
      toast.error('❌ Kon opstelling niet opslaan');
    }
    return success;
  };

  const handleAddGuest = async (name: string, position: string) => {
    if (!selectedMatch) return;
    const success = await addGuestPlayer(name, position, selectedMatch.id);
    if (success) {
      setShowGuestModal(false);
      await fetchPlayers(selectedMatch.id);
      toast.success(`✅ Gastspeler ${name} toegevoegd!`);
    } else {
      toast.error('❌ Kon gastspeler niet toevoegen');
    }
  };

  const handleSaveSubstitutions = async (customMinute?: number) => {
    if (!selectedMatch) return;
    const subMoment = showSubModal; // capture vóór save reset showSubModal naar null
    const success = await saveSubstitutions(selectedMatch.id, customMinute);
    if (success && subMoment) {
      // Fix A: stale periodOverrides voor periodes na dit wisselmoment wissen
      await clearOverridesFromPeriod(selectedMatch.id, subMoment + 1);
      toast.success('✅ Wissels opgeslagen!');
    }
  };

  const handleFinalizeMatch = async (params: {
    calcMinutes: boolean;
    goalsFor: number | null;
    goalsAgainst: number | null;
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>;
    matchReport: string | null;
  }) => {
    if (!selectedMatch || !canFinalizeMatch()) return;
    setShowFinalizeModal(false);

    try {
      // 1. Sluit de wedstrijd af (atomisch: minuten + status)
      const { data, error } = await supabase.rpc('finalize_match', {
        p_match_id:  selectedMatch.id,
        p_calc_min:  params.calcMinutes,
        p_goals_for: params.goalsFor,
        p_goals_ag:  params.goalsAgainst,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? 'Onbekende fout');

      // 2. Ken 1 aanwezigheidscredit toe aan elke speler in de opstelling (alleen bij competitive)
      if (currentTeam && (teamSettings?.player_card_mode ?? 'competitive') === 'competitive') {
        const { data: lineupRows } = await supabase
          .from('lineups')
          .select('player_id')
          .eq('match_id', selectedMatch.id);

        if (lineupRows && lineupRows.length > 0) {
          const lineupPlayerIds = lineupRows.map((r: { player_id: number }) => r.player_id);
          const regularPlayers = players.filter(
            p => lineupPlayerIds.includes(p.id) && !p.is_guest
          );
          if (regularPlayers.length > 0) {
            await awardAttendanceCredits(regularPlayers.map(p => p.id), selectedMatch.id);
          }
        }
      }

      // 3. Sla spelerstatistieken op (goals, assists, kaarten)
      if (params.stats.length > 0 && currentTeam) {
        await saveMatchStats(selectedMatch.id, params.stats);
      }

      // 4. Sla wedstrijdverslag op (indien ingevuld)
      if (params.matchReport) {
        await updateMatchReport(selectedMatch.id, params.matchReport);
      }

      // 5. Taaktellers ophogen (wasbeurt, consumpties, vervoer)
      const trackWas  = teamSettings?.track_wasbeurt   ?? true;
      const trackCons = teamSettings?.track_consumpties ?? true;
      const trackVerv = (teamSettings?.track_vervoer   ?? true) && selectedMatch.home_away !== 'Thuis';

      if (trackWas && wasbeurtDisplayPlayer && !wasbeurtDisplayPlayer.is_guest) {
        await supabase.from('players')
          .update({ wash_count: wasbeurtDisplayPlayer.wash_count + 1 })
          .eq('id', wasbeurtDisplayPlayer.id);
      }
      if (trackCons && consumptiesDisplayPlayer && !consumptiesDisplayPlayer.is_guest) {
        await supabase.from('players')
          .update({ consumption_count: consumptiesDisplayPlayer.consumption_count + 1 })
          .eq('id', consumptiesDisplayPlayer.id);
      }
      if (trackVerv) {
        for (const p of vervoerDisplayPlayers) {
          if (p && !p.is_guest) {
            await supabase.from('players')
              .update({ transport_count: p.transport_count + 1 })
              .eq('id', p.id);
          }
        }
      }

      // Update lokale state
      const updatedMatchFields = {
        match_status: 'afgerond' as const,
        ...(params.goalsFor != null ? { goals_for: params.goalsFor } : {}),
        ...(params.goalsAgainst != null ? { goals_against: params.goalsAgainst } : {}),
        ...(params.matchReport != null ? { match_report: params.matchReport } : {}),
      };
      setIsEditingLineup(false);
      setFinalizeGoalsFor('');
      setFinalizeGoalsAgainst('');
      setSelectedMatch({ ...selectedMatch, ...updatedMatchFields });
      const updatedMatches = matches.map(m =>
        m.id === selectedMatch.id ? { ...m, ...updatedMatchFields } : m
      );
      setMatches(updatedMatches);

      // Herlaad spelers (wisselminuten + career stats bijgewerkt)
      await fetchPlayers();

      // Refresh stats cache voor dashboard
      const finishedIds = updatedMatches.filter(m => m.match_status === 'afgerond').map(m => m.id);
      if (finishedIds.length > 0) {
        fetchStatsForMatches(finishedIds).then(data => setRecentStatsMap(data));
      }

      // Log match_result en voting_opened
      if (currentTeam) {
        logActivity({
          teamId: currentTeam.id,
          type: 'match_result',
          matchId: selectedMatch.id,
          payload: {
            opponent: selectedMatch.opponent,
            home_away: selectedMatch.home_away,
            goals_for: params.goalsFor,
            goals_against: params.goalsAgainst,
          },
        });
        logActivity({
          teamId: currentTeam.id,
          type: 'voting_opened',
          matchId: selectedMatch.id,
          payload: {
            opponent: selectedMatch.opponent,
            home_away: selectedMatch.home_away,
          },
        });
      }

      // Refresh voting (nieuwe afgeronde wedstrijd kan stembaar zijn)
      await fetchVotingMatches(updatedMatches, currentPlayerId);

      // Refresh activiteitenfeed
      fetchActivities();

      toast.success(params.calcMinutes
        ? '✅ Wedstrijd afgesloten! Wisselminuten zijn bijgewerkt.'
        : '✅ Wedstrijd afgesloten! Speelminuten zijn niet berekend.'
      );

    } catch (error) {
      console.error('Error finalizing match:', error);
      toast.error('❌ Fout bij afsluiten: ' + (error as Error).message);
    }
  };

  const handleEditSub = useCallback((subNumber: number, minute?: number) => {
    openSubModal(subNumber, players, minute);
  }, [openSubModal, players]);

  const handleVote = useCallback(async (matchId: number, votedForPlayerId: number) => {
    // Staff members have no player_id — submitVote handles auth via voter_user_id
    await submitVote(matchId, currentPlayerId, votedForPlayerId, matches);
  }, [currentPlayerId, submitVote, matches]);

  const addExtraSubstitution = useCallback(async (minute: number, playerOutId: number, playerInId: number) => {
    if (!selectedMatch) return;
    try {
      const { error } = await supabase
        .from('substitutions')
        .insert({
          match_id: selectedMatch.id,
          substitution_number: 0,
          minute: 0,
          custom_minute: minute,
          player_out_id: playerOutId,
          player_in_id: playerInId,
          is_extra: true
        });

      if (error) throw error;

      await fetchSubstitutions(selectedMatch.id);
      setShowExtraSubModal(false);
      setExtraSubMinute(Math.floor(matchDuration / 2));
      setExtraSubOut(null);
      setExtraSubIn(null);
      toast.success('✅ Extra wissel toegevoegd!');
    } catch (error) {
      console.error('Error adding extra sub:', error);
      toast.error('❌ Kon wissel niet toevoegen');
    }
  }, [selectedMatch, fetchSubstitutions]);

  const deleteExtraSubstitution = useCallback(async (subId: number) => {
    if (!confirm('Weet je zeker dat je deze extra wissel wilt verwijderen?')) return;
    try {
      const { error } = await supabase
        .from('substitutions')
        .delete()
        .eq('id', subId);

      if (error) throw error;

      if (selectedMatch) {
        await fetchSubstitutions(selectedMatch.id);
      }
      toast.success('✅ Extra wissel verwijderd');
    } catch (error) {
      console.error('Error deleting extra sub:', error);
      toast.error('❌ Kon wissel niet verwijderen');
    }
  }, [selectedMatch, fetchSubstitutions]);

  // ---- LOADING ----
  // Één gecombineerde loading-gate voorkomt dat React twee identieke schermen
  // afwisselend mount/unmount (authChecking → teamLoading → matchLoading).
  // Alleen `loading` meenemen als er een team is — anders blijft het scherm hangen
  // voor gebruikers zonder team (fetchMatches wordt dan nooit aangeroepen).
  if (authChecking || teamLoading || (!!currentTeam && loading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white screen-fade-in">
        <div className="text-center">
          <img src="/logo-full.png" alt="Team Manager" className="h-16 mb-4 mx-auto" />
          <div>Laden...</div>
        </div>
      </div>
    );
  }

  if (!currentTeam) {
    const pendingInvite = typeof window !== 'undefined' ? localStorage.getItem('inviteToken') : null;
    if (pendingInvite) {
      router.replace(`/join/${pendingInvite}`);
      return null;
    }

    if (hasPendingTeam) {
      return <PendingApprovalScreen onLogout={handleLogout} />;
    }

    return <WelcomeScreen onLogout={handleLogout} onNavigateToNew={() => router.push('/team/new')} />;
  }

  // ---- RENDER ----
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white screen-fade-in">
      <Navbar
        view={view}
        setView={handleSetView}
        isAdmin={isManager}
        onLogout={handleLogout}
        onPlayerUpdated={fetchPlayers}
        unreadCount={unreadCount}
        onBellClick={() => { setShowActivity(true); fetchActivities(); }}
      />

      <ActivitySlideOver
        open={showActivity}
        onClose={() => setShowActivity(false)}
        activities={activities}
        loading={activityLoading}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        unreadCount={unreadCount}
      />

      {/* === MODALS === */}
      {showTooltip !== null && (
        <TooltipModal
          instruction={getInstructionForPosition(showTooltip)}
          onClose={() => setShowTooltip(null)}
        />
      )}

      {editingInstruction && (
        <InstructionEditModal
          instruction={editingInstruction}
          onChange={setEditingInstruction}
          onSave={async () => {
            if (isEditingMatchInstruction && selectedMatch) {
              const success = await saveMatchInstruction(editingInstruction, selectedMatch.id, formation);
              if (success) toast.success('✅ Wedstrijdinstructie opgeslagen!');
              else toast.error('❌ Kon instructie niet opslaan');
            } else {
              const success = await saveInstruction(editingInstruction, gameFormat, instructionFormation);
              if (success) toast.success('✅ Instructie opgeslagen!');
              else toast.error('❌ Kon instructie niet opslaan');
            }
            setIsEditingMatchInstruction(false);
          }}
          onClose={() => { setEditingInstruction(null); setIsEditingMatchInstruction(false); }}
        />
      )}

      {showGuestModal && isManager && (
        <GuestPlayerModal guestPool={guestPool} onAdd={handleAddGuest} onClose={() => setShowGuestModal(false)} />
      )}

      {showSelectionModal && (
        <MatchSelectionModal
          players={players}
          matchAbsences={matchAbsences}
          fieldOccupants={fieldOccupants}
          selectedMatch={selectedMatch}
          isManager={isManager}
          substitutions={substitutions}
          onToggleInjury={async (playerId) => {
            const success = await toggleInjury(playerId);
            if (success) {
              const p = players.find((pl: Player) => pl.id === playerId);
              toast.info(p?.injured ? '✅ Speler hersteld' : '🏥 Speler geblesseerd');
            }
          }}
          onToggleAbsence={async (playerId) => {
            if (selectedMatch) await toggleAbsence(playerId, selectedMatch.id);
          }}
          onRemoveGuest={async (playerId) => {
            const success = await removeGuestPlayer(playerId);
            if (success) {
              if (selectedMatch) await fetchPlayers(selectedMatch.id);
              toast.success('✅ Gastspeler verwijderd');
            } else {
              toast.error('❌ Kon gastspeler niet verwijderen');
            }
          }}
          onAddGuest={() => { setShowSelectionModal(false); fetchGuestPool(); setShowGuestModal(true); }}
          onClose={() => setShowSelectionModal(false)}
        />
      )}

      {showPlayerCard && (
        <PlayerCardModal
          player={showPlayerCard}
          onClose={() => setShowPlayerCard(null)}
        />
      )}

      {showPositionInfo && (
        <PositionInfoModal
          player={showPositionInfo.player}
          instruction={getInstructionForPosition(showPositionInfo.positionIndex)}
          isManagerEdit={isManager && !!selectedMatch && !isFinalized}
          subMinuteOut={(() => {
            const s = substitutions.find((sub: Substitution) => sub.player_out_id === showPositionInfo.player.id);
            return s ? (s.custom_minute ?? s.minute) : null;
          })()}
          onEditInstruction={() => {
            const positionIndex = showPositionInfo.positionIndex;
            const matchInstr = matchInstructions.find((m: PositionInstruction) => m.position_index === positionIndex);
            const globalInstr = positionInstructions.find((p: PositionInstruction) => p.position_index === positionIndex);
            setEditingInstruction(matchInstr || globalInstr || {
              id: 0,
              formation,
              position_index: positionIndex,
              position_name: `Positie ${positionIndex + 1}`,
              title: `Positie ${positionIndex + 1}`,
              general_tips: [],
              with_ball: [],
              without_ball: []
            });
            setIsEditingMatchInstruction(true);
            setShowPositionInfo(null);
          }}
          onClose={() => setShowPositionInfo(null)}
        />
      )}

      {showSubModal && isManager && (
        <SubstitutionModal
          subNumber={showSubModal}
          minute={showSubModalMinute}
          isFreeSubstitution={!!isFreeSubstitution}
          matchDuration={matchDuration}
          tempSubs={tempSubs}
          fieldOccupants={fieldOccupants}
          benchPlayers={benchPlayers}
          players={players}
          allSubstitutions={substitutions}
          onAddSub={addTempSub}
          onRemoveSub={removeTempSub}
          onUpdateSub={updateTempSub}
          onSave={handleSaveSubstitutions}
          onClose={closeSubModal}
        />
      )}

      {showFinalizeModal && isManager && selectedMatch && (
        <FinalizeMatchModal
          match={selectedMatch}
          players={players}
          teamSettings={teamSettings}
          teamName={currentTeam?.name ?? 'Wij'}
          onFinalize={handleFinalizeMatch}
          onClose={() => setShowFinalizeModal(false)}
        />
      )}

      {swapTarget && selectedMatch && (
        <PeriodSwapModal
          playerOut={swapTarget.player}
          periodIndex={selectedPeriod}
          subMomentMinute={subMomentMinutes[selectedPeriod - 2] ?? 0}
          benchPlayers={benchPlayersForSwap}
          onConfirm={async (playerIn) => {
            const subNumber = selectedPeriod - 1;
            const minute = subMomentMinutes[subNumber - 1] ?? 0;
            await saveQuickSwap(selectedMatch.id, subNumber, minute, swapTarget.player.id, playerIn.id, Boolean(swapTarget.player.is_guest), Boolean(playerIn.is_guest));
            setSwapTarget(null);
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {showExtraSubModal && isManager && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowExtraSubModal(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">➕ Extra wissel toevoegen</h3>
              <button
                onClick={() => setShowExtraSubModal(false)}
                className="text-2xl hover:text-red-500 p-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Minuut</label>
                <input
                  type="number"
                  min="1"
                  max={matchDuration}
                  value={extraSubMinute}
                  onChange={(e) => setExtraSubMinute(Math.max(1, Math.min(matchDuration, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-lg font-bold text-center"
                  placeholder={`bijv. ${Math.floor(matchDuration / 2)}`}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-red-400">⬇️ Eruit</label>
                <select
                  value={extraSubOut?.id || ''}
                  onChange={(e) => {
                    const player = players.find(p => p.id === parseInt(e.target.value));
                    setExtraSubOut(player || null);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="">Selecteer...</option>
                  {players.filter(p => isPlayerAvailable(p, matchAbsences)).map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-green-400">⬆️ Erin</label>
                <select
                  value={extraSubIn?.id || ''}
                  onChange={(e) => {
                    const player = players.find(p => p.id === parseInt(e.target.value));
                    setExtraSubIn(player || null);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="">Selecteer...</option>
                  {players.filter(p => isPlayerAvailable(p, matchAbsences)).map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (extraSubMinute && extraSubOut && extraSubIn) {
                    addExtraSubstitution(extraSubMinute, extraSubOut.id, extraSubIn.id);
                  } else {
                    toast.warning('⚠️ Vul alle velden in');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold touch-manipulation active:scale-95"
              >
                ✅ Toevoegen
              </button>
              <button
                onClick={() => {
                  setShowExtraSubModal(false);
                  setExtraSubMinute(Math.floor(matchDuration / 2));
                  setExtraSubOut(null);
                  setExtraSubIn(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold touch-manipulation active:scale-95"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === VIEWS === */}
      <div key={view} className="flex-1 overflow-hidden flex flex-col screen-fade-in">
      {view === 'instructions' && isManager ? (
        <InstructionsView
          gameFormat={gameFormat}
          instructionFormation={instructionFormation}
          setInstructionFormation={setInstructionFormation}
          positionInstructions={positionInstructions}
          onEditInstruction={(instruction) => {
            setIsEditingMatchInstruction(false);
            setEditingInstruction(instruction);
          }}
        />
      ) : view === 'players-manage' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <PlayersManageView
            players={players}
            onAddPlayer={addPlayer}
            onUpdatePlayer={updatePlayer}
            onDeletePlayer={deletePlayer}
            onRefresh={() => selectedMatch ? fetchPlayers(selectedMatch.id) : fetchPlayers()}
            guestPool={guestPool}
            onAddToPool={addToPool}
            onRemoveFromPool={removeFromPool}
            onRefreshPool={fetchGuestPool}
          />
        </div>
      ) : view === 'invites' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <InvitesManageView />
        </div>
      ) : view === 'mededelingen' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <MededelingenView onDirtyChange={setIsDirty} />
        </div>
      ) : view === 'feedback' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <FeedbackView isManager={isManager} />
        </div>
      ) : view === 'team-settings' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <TeamSettingsView onSettingsSaved={refreshTeamSettings} onDirtyChange={setIsDirty} />
        </div>
      ) : view === 'season-settings' && isManager ? (
        <div className="flex-1 overflow-y-auto">
          <SeasonSettingsView />
        </div>
      ) : view === 'cards' && (teamSettings?.player_card_mode ?? 'competitive') !== 'none' ? (
        <div className="flex-1 overflow-y-auto">
          <PlayerCardsView
            players={players}
            isAdmin={isManager}
            onUpdateStat={updateStat}
            currentPlayerId={teamPlayerId}
            creditBalance={creditBalance}
            onSaveStatDraft={handleSaveStatDraft}
            spdwWinnerPlayerIds={lastSpdwResult?.podium.filter(e => e.rank === 1).map(e => e.player_id) ?? []}
          />
        </div>
      ) : view === 'uitslagen' ? (
        <div className="flex-1 overflow-y-auto">
          <UitslagenView
            matches={activeSeasonMatches}
            players={players}
            teamSettings={teamSettings}
            seasons={seasons}
            activeSeasonId={activeSeason?.id ?? null}
            gameFormat={gameFormat}
            defaultFormation={teamSettings?.default_formation ?? '4-3-3-aanvallend'}
            onRefreshPlayers={() => {
              selectedMatch ? fetchPlayers(selectedMatch.id) : fetchPlayers();
              const finishedIds = matches.filter(m => m.match_status === 'afgerond').map(m => m.id);
              if (finishedIds.length > 0) {
                fetchStatsForMatches(finishedIds).then(data => setRecentStatsMap(data));
              }
            }}
            onRefreshMatches={fetchMatches}
            onUpdateMatchReport={updateMatchReport}
            onUpdateMatchScore={updateMatchScore}
            onAddMatch={(data) => addMatch({ ...data, season_id: activeSeason?.id ?? null })}
            onUpdateMatch={updateMatch}
            onCancelMatch={cancelMatch}
            onDeleteMatch={deleteMatch}
            currentPlayerId={teamPlayerId}
            onToggleAbsence={toggleAbsence}
          />
        </div>
      ) : view === 'dashboard' ? (
        <DashboardView
          players={players}
          matches={activeSeasonMatches}
          gameFormat={gameFormat}
          onToggleAbsence={toggleAbsence}
          onToggleInjury={toggleInjury}
          onNavigateToWedstrijd={(match) => { setSelectedMatch(match); setView('pitch'); }}
          onNavigateToMatches={() => setView('uitslagen')}
          onNavigateToUitslagen={() => setView('uitslagen')}
          onNavigateToPlayers={() => setView('players-manage')}
          onNavigateToInvites={() => setView('invites')}
          votingMatches={votingMatches}
          isLoadingVotes={isLoadingVotes}
          votingCurrentPlayerId={currentPlayerId}
          onSelectVotingPlayer={setCurrentPlayerId}
          onVote={handleVote}
          creditBalance={creditBalance}
          lastSpdwResult={lastSpdwResult}
          recentStatsMap={recentStatsMap}
          trackResults={teamSettings?.track_results ?? true}
          matchDuration={matchDuration}
          trackWasbeurt={teamSettings?.track_wasbeurt ?? true}
          trackConsumpties={teamSettings?.track_consumpties ?? true}
          trackVervoer={teamSettings?.track_vervoer ?? true}
          vervoerCount={teamSettings?.vervoer_count ?? 3}
          trackAssemblyTime={teamSettings?.track_assembly_time ?? false}
          trackMatchTime={teamSettings?.track_match_time ?? false}
          trackLocationDetails={teamSettings?.track_location_details ?? false}
          trackSpdw={
            (teamSettings?.track_spdw ?? true) &&
            (teamSettings?.player_card_mode ?? 'competitive') === 'competitive' &&
            (teamSettings?.spdw_enabled ?? true)
          }
          activities={activities}
          onActivityRead={markAsRead}
          onOpenActivity={() => { setShowActivity(true); fetchActivities(); }}
        />
      ) : view === 'pitch' ? (
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex-1 flex flex-col p-2 sm:p-4 lg:p-8 overflow-y-auto">
            {/* Wedstrijd status badge */}
            {selectedMatch && canFinalizeMatch() ? (
              <div className="mb-4 p-4 rounded-xl border-2 border-orange-600 bg-orange-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-base font-black text-orange-300">⚠️ Wedstrijd nog afsluiten</div>
                  <div className="text-sm text-orange-400/80 mt-0.5">
                    {selectedMatch.opponent} · {new Date(selectedMatch.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <button
                  onClick={() => { setFinalizeCalcMinutes(true); setShowFinalizeModal(true); }}
                  className="px-4 py-2 rounded-lg font-bold bg-orange-600 hover:bg-orange-500 text-white text-sm flex-shrink-0 touch-manipulation active:scale-95"
                >
                  🏁 Nu afsluiten
                </button>
              </div>
            ) : selectedMatch ? (
              <div className={`mb-4 p-3 rounded-lg text-sm font-bold text-center ${
                selectedMatch.match_status === 'afgerond'
                  ? 'bg-green-900/30 border border-green-700'
                  : isLineupPublished && !isEditingLineup
                  ? 'bg-green-900/30 border border-green-700'
                  : 'bg-blue-900/30 border border-blue-700'
              }`}>
                {isLineupPublished && !isFinalized && !isEditingLineup
                  ? '✅ Opstelling definitief'
                  : getMatchStatusBadge()}
              </div>
            ) : null}

            {/* Wedstrijdselectie knop — prominent boven de toolbar */}
            {isManager && selectedMatch && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => setShowSelectionModal(true)}
                  className="px-5 py-2.5 rounded-xl font-display font-bold bg-yellow-500 hover:bg-yellow-400 text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2"
                >
                  👥 Wedstrijdselectie
                </button>
              </div>
            )}

            {/* Wedstrijd & formatie selectors */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 justify-center">
              <MatchDropdown
                matches={matches}
                selectedMatch={selectedMatch}
                onSelect={(match) => {
                  setSelectedMatch(match);
                  clearField(playerCount);
                }}
              />

              <select
                value={displayedFormation}
                onChange={(e) => {
                  if (isFinalized) return;
                  if (selectedPeriod > 1) {
                    if (isManager && selectedMatch && currentTeam) {
                      savePeriodFormation(selectedMatch.id, currentTeam.id, selectedPeriod, e.target.value);
                    }
                  } else if (activelyEditing) {
                    setFormation(e.target.value);
                  }
                }}
                disabled={isFinalized || (selectedPeriod === 1 ? !activelyEditing : !isManager)}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 disabled:opacity-50 text-white text-sm sm:text-base"
              >
                {Object.entries(formations[gameFormat] ?? formations['11v11']).map(([f]) => (
                  <option key={f} value={f}>{formationLabels[gameFormat]?.[f] ?? f}</option>
                ))}
              </select>

              {/* Periode-dropdown: toon wie er op dat moment speelt (alleen bij vaste wisselmomenten) */}
              {selectedMatch && !isFreeSubstitution && subMoments > 0 && (
                <select
                  value={selectedPeriod}
                  onChange={e => { setSelectedPeriod(Number(e.target.value)); setPeriodPositionPick(null); }}
                  className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm sm:text-base"
                >
                  <option value={1}>1e periode (Startopstelling)</option>
                  {Array.from({ length: subMoments }, (_, i) => {
                    const periodNum = i + 2;
                    const minute = subMomentMinutes[i];
                    return (
                      <option key={periodNum} value={periodNum}>
                        {periodNum}e periode ({minute}&apos;)
                      </option>
                    );
                  })}
                </select>
              )}

              {activelyEditing && (
                <div className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-2 py-1">
                  <span className="text-xs text-gray-400 mr-1"># periodes:</span>
                  {/* 2-5 = aantal periodes (= n-1 wisselmomenten); vrij wisselen is altijd mogelijk */}
                  {([2, 3, 4, 5] as const).map((val) => {
                    const n = val - 1; // aantal wisselmomenten opgeslagen in subMoments
                    const isActive = subMoments === n;
                    const preview = `${val} periodes — wisselmoment${n > 1 ? 'en' : ''}: ${computeSubMomentMinutes(n, matchDuration).join("', ")}' `;
                    return (
                      <button
                        key={n}
                        onClick={() => { setSubMoments(n); setSelectedPeriod(1); setPeriodPositionPick(null); }}
                        title={preview}
                        className={`px-2 py-0.5 rounded text-sm font-bold transition ${
                          isActive
                            ? 'bg-yellow-500 text-black'
                            : 'text-gray-300 hover:text-white hover:bg-gray-600'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                  <PeriodesInfoButton />
                </div>
              )}

              {activeEditor && !isEditingLineup && (
                <span className="text-xs text-yellow-400 flex items-center gap-1 px-2">
                  ✏️ {activeEditor.name} is de opstelling aan het bewerken
                </span>
              )}

              {editable && !isFinalized && !isEditingLineup && (
                <button
                  onClick={() => {
                    wasPublishedBeforeEdit.current = isLineupPublished;
                    takeSnapshot();
                    setIsEditingLineup(true);
                    claimEdit(myName);
                    if (isLineupPublished && selectedMatch) {
                      publishLineup(selectedMatch.id, false);
                    }
                  }}
                  disabled={!!activeEditor}
                  className="px-3 sm:px-4 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {isLineupPublished ? '✏️ Herzien' : '✏️ Aanpassen'}
                </button>
              )}

              {editable && !isFinalized && isEditingLineup && (
                <>
                  <button
                    onClick={() => {
                      restoreSnapshot();
                      if (wasPublishedBeforeEdit.current && selectedMatch) {
                        publishLineup(selectedMatch.id, true);
                      }
                      releaseEdit();
                      setIsEditingLineup(false);
                    }}
                    disabled={savingLineup}
                    className="px-3 sm:px-4 py-2 rounded font-bold bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-sm sm:text-base"
                  >
                    Annuleer
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await handleSaveLineup();
                      if (!ok) return;
                      if (wasPublishedBeforeEdit.current && selectedMatch) {
                        const published = await publishLineup(selectedMatch.id, true);
                        if (!published) {
                          toast.error('❌ Kon opstelling niet definitief maken. Controleer de console voor details.');
                          return;
                        }
                      }
                      releaseEdit();
                      toast.success('💾 Opstelling opgeslagen!');
                      setIsEditingLineup(false);
                    }}
                    disabled={savingLineup}
                    className="px-3 sm:px-4 py-2 rounded font-display font-bold bg-yellow-500 hover:bg-yellow-400 text-gray-900 disabled:opacity-50 text-sm sm:text-base uppercase tracking-wide"
                  >
                    {savingLineup ? 'Bezig...' : 'Opslaan'}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await handleSaveLineup();
                      if (!ok) return;
                      if (selectedMatch) {
                        const published = await publishLineup(selectedMatch.id, true, {
                          opponent: selectedMatch.opponent,
                          home_away: selectedMatch.home_away,
                        });
                        if (!published) {
                          toast.error('❌ Kon opstelling niet definitief maken. Controleer de console voor details.');
                          return;
                        }
                        fetchActivities();
                      }
                      releaseEdit();
                      toast.success('✅ Opstelling definitief gemaakt!');
                      setIsEditingLineup(false);
                    }}
                    disabled={savingLineup}
                    className="px-3 sm:px-4 py-2 rounded font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-sm sm:text-base"
                  >
                    ✅ Opstelling definitief
                  </button>
                </>
              )}

              {canFinalizeMatch() && (
                <button
                  onClick={() => { setFinalizeCalcMinutes(true); setShowFinalizeModal(true); }}
                  className="px-3 sm:px-4 py-2 rounded font-bold bg-purple-600 hover:bg-purple-700 text-sm sm:text-base"
                >
                  🏁 Wedstrijd afsluiten
                </button>
              )}

              {activelyEditing && (
                <button
                  onClick={handleLoadPreviousLineup}
                  className="relative w-full px-3 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Kopieer opstelling vorige wedstrijd
                  <span
                    onClick={e => { e.stopPropagation(); setShowPrevLineupInfo(true); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors touch-manipulation"
                    aria-label="Uitleg kopieer opstelling"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>
              )}
              {showPrevLineupInfo && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPrevLineupInfo(false)}>
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 max-w-sm w-full text-sm text-gray-300 shadow-xl" onClick={e => e.stopPropagation()}>
                    <h3 className="font-bold text-white mb-2">Kopieer opstelling vorige wedstrijd</h3>
                    <p className="mb-2">Vult de opstelling in met de meest recente <strong className="text-white">afgesloten wedstrijd</strong> waarvoor een opstelling is opgeslagen.</p>
                    <p className="mb-3 text-gray-400">Alleen vaste spelers worden meegenomen. Gastspelers worden niet gekopieerd.</p>
                    <button onClick={() => setShowPrevLineupInfo(false)} className="text-blue-400 hover:text-blue-200 text-xs font-medium">Sluiten</button>
                  </div>
                </div>
              )}

            </div>

            {/* Veld + Bank + Wissels */}
            {!canSeeLineup ? (
              <LineupLockedView match={selectedMatch} />
            ) : <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[snapBenchCenterToCursor]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-start justify-center mb-4 lg:mb-6">
              <div className="flex-shrink-0 w-full lg:w-[580px]">
              <PitchView
                gameFormat={gameFormat}
                formation={displayedFormation}
                fieldOccupants={displayedOccupants}
                selectedPosition={selectedPeriod === 1 ? selectedPosition : (periodPositionPick?.positionIndex ?? null)}
                selectedPlayer={selectedPeriod === 1 ? selectedPlayer : null}
                isEditable={activelyEditing && selectedPeriod === 1}
                isManagerEdit={isManager && !!selectedMatch && !isFinalized && selectedPeriod === 1}
                matchAbsences={matchAbsences}
                isPlayerAvailable={isPlayerAvailable}
                getInstructionForPosition={getInstructionForPosition}
                onPositionClick={handlePositionClick}
                onSwapPlayer={
                  activelyEditing && selectedPeriod > 1 && isManager && !isFinalized && !isFreeSubstitution
                    ? (posIdx) => {
                        const p = displayedOccupants[posIdx];
                        if (!p) { setPeriodPositionPick(null); return; }
                        if (periodPositionPick) {
                          if (periodPositionPick.positionIndex === posIdx) {
                            // Zelfde speler opnieuw getikt → wisselmodal openen
                            setSwapTarget({ player: p, positionIndex: posIdx });
                            setPeriodPositionPick(null);
                          } else {
                            // Andere veldspeler getikt → posities omwisselen
                            const newLineup = [...displayedOccupants];
                            [newLineup[periodPositionPick.positionIndex], newLineup[posIdx]] =
                              [newLineup[posIdx], newLineup[periodPositionPick.positionIndex]];
                            if (selectedMatch && currentTeam) {
                              applyPeriodOverride(selectedMatch.id, currentTeam.id, selectedPeriod, newLineup);
                            }
                            setPeriodPositionPick(null);
                          }
                        } else {
                          // Eerste klik → speler selecteren (geen modal)
                          setPeriodPositionPick({ player: p, positionIndex: posIdx });
                        }
                      }
                    : undefined
                }
                isPeriodPositionEdit={activelyEditing && selectedPeriod > 1 && isManager && !isFinalized && !isFreeSubstitution}
                onShowTooltip={(positionIndex: number) => {
                  if (isManager && selectedMatch && !isFinalized) {
                    const matchInstr = matchInstructions.find((m: PositionInstruction) => m.position_index === positionIndex);
                    const globalInstr = positionInstructions.find((p: PositionInstruction) => p.position_index === positionIndex);
                    setEditingInstruction(matchInstr || globalInstr || {
                      id: 0,
                      formation,
                      position_index: positionIndex,
                      position_name: `Positie ${positionIndex + 1}`,
                      title: `Positie ${positionIndex + 1}`,
                      general_tips: [],
                      with_ball: [],
                      without_ball: []
                    });
                    setIsEditingMatchInstruction(true);
                  } else {
                    setShowTooltip(positionIndex);
                  }
                }}
                onShowPositionInfo={(player: Player, positionIndex: number) => {
                  setShowPositionInfo({ player, positionIndex });
                }}
              />
              </div>

              <div className="flex flex-col gap-4 w-full lg:w-[580px] flex-shrink-0">
                <BenchPanel
                  benchPlayers={benchPlayersForPeriod}
                  unavailablePlayers={unavailablePlayers}
                  selectedPlayer={selectedPeriod === 1 ? selectedPlayer : null}
                  isEditable={activelyEditing && selectedPeriod === 1}
                  periodLocked={selectedPeriod > 1}
                  onSelectPlayer={handleSelectPlayer}
                  onShowPlayerCard={setShowPlayerCard}
                />
                <SubstitutionCards
                  subMoments={subMoments}
                  subMomentMinutes={subMomentMinutes}
                  substitutions={substitutions}
                  players={players}
                  isAdmin={isManager}
                  isEditable={activelyEditing}
                  isFinalized={!!isFinalized}
                  matchDuration={matchDuration}
                  onEditSub={handleEditSub}
                  onAddExtraSub={() => setShowExtraSubModal(true)}
                  onDeleteExtraSub={deleteExtraSubstitution}
                />
              </div>
            </div>

              {/* Feature 3: DragOverlay — zwevend icoontje tijdens slepen */}
              <DragOverlay dropAnimation={null}>
                {activeDragPlayer ? (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-yellow-500 border-2 border-white flex items-center justify-center font-bold text-sm text-black shadow-xl opacity-90 cursor-grabbing">
                    {activeDragPlayer.avatar_url ? (
                      <img
                        src={activeDragPlayer.avatar_url}
                        alt={activeDragPlayer.name}
                        className="w-full h-full object-cover rounded-full"
                        draggable={false}
                        onDragStart={e => e.preventDefault()}
                      />
                    ) : (
                      activeDragPlayer.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>}

            {/* Taken: wasbeurt + consumpties */}
            {canSeeLineup && selectedMatch && !isFinalized && (
              <div className="max-w-4xl mx-auto w-full">
              <TakenBlok
                trackWasbeurt={teamSettings?.track_wasbeurt ?? true}
                wasbeurtPlayer={wasbeurtIsUnavailable ? (wasbeurtEligible[0] ?? null) : wasbeurtDisplayPlayer}
                wasbeurtOverridePlayer={wasbeurtOverridePlayer}
                wasbeurtIsUnavailable={wasbeurtIsUnavailable}
                wasbeurtEligibleFirst={wasbeurtEligible[0] ?? null}
                wasbeurtAllPlayers={wasbeurtAllPlayers}
                wasbeurtOverrideId={wasbeurtOverrideId}
                onWasbeurtChange={(id) => updateWasbeurtPlayer(selectedMatch.id, id)}
                trackConsumpties={teamSettings?.track_consumpties ?? true}
                consumptiesPlayer={consumptiesIsUnavailable ? (consumptiesEligible[0] ?? null) : consumptiesDisplayPlayer}
                consumptiesOverridePlayer={consumptiesOverridePlayer}
                consumptiesIsUnavailable={consumptiesIsUnavailable}
                consumptiesEligibleFirst={consumptiesEligible[0] ?? null}
                consumptiesAllPlayers={consumptiesAllPlayers}
                consumptiesOverrideId={consumptiesOverrideId}
                onConsumptiesChange={(id) => updateConsumptiesPlayer(selectedMatch.id, id)}
                trackVervoer={(teamSettings?.track_vervoer ?? true) && selectedMatch.home_away !== 'Thuis'}
                vervoerCount={vervoerCount}
                vervoerEligible={vervoerEligible}
                vervoerAllPlayers={vervoerAllPlayers}
                vervoerOverrideIds={vervoerOverrideIds}
                vervoerDisplayPlayers={vervoerDisplayPlayers}
                onVervoerChange={(ids) => updateTransportPlayers(selectedMatch.id, ids)}
                match={selectedMatch}
                trackAssemblyTime={teamSettings?.track_assembly_time ?? false}
                trackMatchTime={teamSettings?.track_match_time ?? false}
                trackLocationDetails={teamSettings?.track_location_details ?? false}
                isEditing={activelyEditing && isManager}
              />
              </div>
            )}

            {/* Geselecteerde speler/positie indicator */}
            {activelyEditing && !isFinalized && (selectedPlayer || selectedPosition !== null) && (
              <div className="mt-4 sm:mt-6 text-yellow-500 text-center text-sm sm:text-base px-4 select-none">
                {selectedPosition !== null && !selectedPlayer ? (
                  <>👆 Positie {selectedPosition + 1} geselecteerd — kies een speler uit de selectie of bank</>
                ) : selectedPlayer && isPlayerAvailable(selectedPlayer, matchAbsences) && !isPlayerOnField(selectedPlayer) ? (
                  <>👆 Klik op het veld om <strong>{selectedPlayer.name}</strong> te plaatsen</>
                ) : selectedPlayer && isPlayerOnField(selectedPlayer) ? (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> staat al op het veld</>
                ) : selectedPlayer ? (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> is niet beschikbaar</>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <StatsView players={players} isAdmin={isManager} onUpdateStat={updateStat} teamSettings={teamSettings} />
        </div>
      )}
      </div>{/* end key={view} views wrapper */}


    </div>
  );
}

function MatchDropdown({
  matches,
  selectedMatch,
  onSelect,
}: {
  matches: import('./lib/types').Match[];
  selectedMatch: import('./lib/types').Match | null;
  onSelect: (match: import('./lib/types').Match) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const getLabel = (match: import('./lib/types').Match) => {
    const isPast = new Date(match.date) < new Date();
    const done = match.match_status === 'afgerond';
    const cancelled = match.match_status === 'geannuleerd';
    const date = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const suffix = done ? ' ✅' : cancelled ? ' 🚫' : isPast ? ' ✓' : '';
    return `${date} - ${match.opponent}${suffix}`;
  };

  return (
    <div className="relative flex-1 sm:flex-initial" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white font-bold text-sm sm:text-base flex items-center gap-2 text-left"
      >
        <span className="flex-1 truncate">
          {selectedMatch ? getLabel(selectedMatch) : 'Selecteer wedstrijd'}
        </span>
        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto min-w-full">
          {matches.map(match => {
            const isSelected = match.id === selectedMatch?.id;
            return (
              <button
                key={match.id}
                onClick={() => { onSelect(match); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-700 transition whitespace-nowrap ${
                  isSelected ? 'bg-gray-700' : ''
                }`}
              >
                <span className="w-4 flex-shrink-0 text-yellow-400">{isSelected ? '✓' : ''}</span>
                <span>{getLabel(match)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodesInfoButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="ml-1 w-4 h-4 rounded-full bg-gray-600 text-gray-300 hover:bg-gray-500 hover:text-white text-xs flex items-center justify-center leading-none"
        title="Uitleg periodes"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-xs text-gray-300 space-y-2">
            <p className="font-semibold text-white">Wat doen periodes?</p>
            <p>Het aantal periodes bepaalt hoe de wedstrijd wordt opgedeeld. Bij 2 periodes speelt iedereen de eerste helft in dezelfde opstelling, bij 3 periodes zijn er drie blokken, enzovoort.</p>
            <p>Per periode kun je een aparte opstelling instellen én krijg je automatisch een wisselmoment aan het begin van elk nieuw blok. Zo kun je voor de tweede helft een andere speler op een positie zetten en worden de wissels op het juiste moment gesignaleerd.</p>
            <p className="text-gray-400">Vrije wissels zijn altijd mogelijk — je kunt op elk willekeurig moment een wissel doorvoeren, ongeacht het aantal periodes.</p>
          </div>
        </>
      )}
    </div>
  );
}

function PendingApprovalScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6">⏳</div>
        <h1 className="text-2xl font-black mb-4">Aanvraag in behandeling</h1>
        <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-xl text-sm text-blue-200 leading-relaxed text-left mb-8">
          Je teamaanvraag is ingediend bij de beheerder van de app. Op dit moment beperken we nog het aantal teams omdat de app nog in ontwikkeling is. Zodra je verzoek is goedgekeurd, kun je aan de slag.
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          Uitloggen
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({ onLogout, onNavigateToNew }: { onLogout: () => void; onNavigateToNew: () => void }) {
  const [showInviteInfo, setShowInviteInfo] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-6xl mb-6">🏆</div>
        <h1 className="text-2xl font-black mb-2">Welkom bij Team Manager</h1>
        <p className="text-gray-400 mb-8">Je bent nog geen lid van een team. Maak je eigen team aan of doe mee via een uitnodiging.</p>

        <div className="space-y-3">
          <button
            onClick={onNavigateToNew}
            className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-base transition active:scale-95"
          >
            ⚽ Maak een team aan
          </button>

          <button
            onClick={() => setShowInviteInfo(v => !v)}
            className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-base transition"
          >
            📨 Meedoen via uitnodiging
          </button>

          {showInviteInfo && (
            <div className="mt-2 p-4 bg-gray-800 rounded-xl text-sm text-gray-300 text-left">
              <p className="font-bold text-white mb-1">Hoe werkt het?</p>
              <p>Vraag de manager van het team om een uitnodigingslink. Klik op die link en je wordt automatisch lid.</p>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="mt-8 text-sm text-gray-500 hover:text-gray-300 transition"
        >
          Uitloggen
        </button>
      </div>
    </div>
  );
}
