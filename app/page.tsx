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
import { formations, formationLabels, normalizeFormation, DEFAULT_GAME_FORMAT, DEFAULT_FORMATIONS, GAME_FORMATS, computeSubMomentMinutes } from './lib/constants';
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
import { useTeamSettings } from './hooks/useTeamSettings';
import { useMatchStats } from './hooks/useMatchStats';
import { useActivityLog } from './hooks/useActivityLog';

// Components
import Navbar from './components/Navbar';
import PitchView from './components/PitchView';
import BenchPanel from './components/BenchPanel';
import SubstitutionCards from './components/SubstitutionCards';
import TakenBlok from './components/TakenBlok';
import StatsView from './components/StatsView';
import InstructionsView from './components/InstructionsView';
import PlayersManageView from './components/PlayersManageView';
import MatchesManageView from './components/MatchesManageView';
import PlayerCardsView from './components/PlayerCardsView';
import DashboardView from './components/DashboardView';
import UitslagenView from './components/UitslagenView';
import InvitesManageView from './components/InvitesManageView';
import MededelingenView from './components/MededelingenView';
import TeamSettingsView from './components/TeamSettingsView';

// PDF
import { generateMatchPdf } from './utils/generateMatchPdf';

// Modals
import MatchSelectionModal from './components/modals/MatchSelectionModal';
import TooltipModal from './components/modals/TooltipModal';
import InstructionEditModal from './components/modals/InstructionEditModal';

import GuestPlayerModal from './components/modals/GuestPlayerModal';
import SubstitutionModal from './components/modals/SubstitutionModal';
import PlayerCardModal from './components/modals/PlayerCardModal';
import PositionInfoModal from './components/modals/PositionInfoModal';
import FinalizeMatchModal from './components/modals/FinalizeMatchModal';
import ActivitySlideOver from './components/ActivitySlideOver';
import { logActivity } from './lib/logActivity';

export default function FootballApp() {
  const router = useRouter();
  const toast = useToast();
  const [authChecking, setAuthChecking] = useState(true);
  const { currentTeam, isManager, isLoading: teamLoading, currentPlayerId: teamPlayerId } = useTeamContext();

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
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [subMoments, setSubMoments] = useState<number>(1);
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
  const [extraSubMinute, setExtraSubMinute] = useState(45);
  const [extraSubOut, setExtraSubOut] = useState<Player | null>(null);
  const [extraSubIn, setExtraSubIn] = useState<Player | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null);

  // ---- HOOKS ----
  const {
    players, fetchPlayers,
    toggleInjury, addGuestPlayer, removeGuestPlayer, updateStat,
    addPlayer, updatePlayer, deletePlayer
  } = usePlayers();

  const {
    matches, setMatches, selectedMatch, setSelectedMatch,
    matchAbsences, loading, fetchMatches, fetchAbsences,
    toggleAbsence, isMatchEditable,
    addMatch, updateMatch, updateMatchScore, publishLineup, updateWasbeurtPlayer, updateConsumptiesPlayer, deleteMatch
  } = useMatches();

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
    removeTempSub, updateTempSub, saveSubstitutions, closeSubModal
  } = useSubstitutions();

  const {
    positionInstructions, matchInstructions, editingInstruction, setEditingInstruction,
    fetchInstructions, fetchMatchInstructions, clearMatchInstructions,
    getInstructionForPosition, saveInstruction, saveMatchInstruction
  } = useInstructions();

  const { schemes, fetchSchemes, getSchemeById } = useSubstitutionSchemes();
  const { votingMatches, isLoadingVotes, lastSpdwResult, fetchVotingMatches, submitVote } = useVoting();
  const { balance: creditBalance, fetchBalance, awardSpdwCredits, spendCreditsForStats } = useStatCredits();
  const { settings: teamSettings, fetchSettings: fetchTeamSettings } = useTeamSettings();
  const { fetchStatsForMatches, saveMatchStats } = useMatchStats();
  const { activities, unreadCount, loading: activityLoading, fetchActivities, markAsRead, markAllAsRead } = useActivityLog();
  const [showActivity, setShowActivity] = useState(false);

  const gameFormat = teamSettings?.game_format ?? DEFAULT_GAME_FORMAT;
  const matchDuration = teamSettings?.match_duration ?? 90;

  // ---- BEREKENDE WAARDEN ----
  const editable = isMatchEditable(isManager);
  const isFinalized = selectedMatch?.match_status === 'afgerond';
  const isLineupPublished = selectedMatch?.lineup_published === true;
  const activelyEditing = editable && isEditingLineup;

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
    fetchMatches();
    fetchSchemes(currentTeam?.id);
    fetchActivities();
  }, [fetchMatches, fetchSchemes, fetchActivities, currentTeam?.id]);

  useEffect(() => {
    if (currentTeam?.id) {
      fetchTeamSettings(currentTeam.id);
    }
  }, [currentTeam?.id, fetchTeamSettings]);

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

  useEffect(() => {
    if (selectedMatch && players.length > 0) {
      loadLineup(selectedMatch.id, players, playerCount);
    }
  }, [players.length, selectedMatch?.id, loadLineup, playerCount]);

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
  }, [view, selectedMatch?.id, players.length, fetchAbsences, loadLineup, playerCount]);

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
  }, [matches.filter(m => m.match_status === 'afgerond').length, fetchStatsForMatches]); // eslint-disable-line react-hooks/exhaustive-deps

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
  ): Promise<boolean> => {
    if (!teamPlayerId) return false;
    const success = await spendCreditsForStats(teamPlayerId, targetPlayerId, finalStats, totalCost, actorName, subjectName, prevStats);
    if (success) {
      if (selectedMatch) fetchPlayers(selectedMatch.id);
      else fetchPlayers();
      fetchActivities();
    }
    return success;
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
    if (!over || !activelyEditing) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeData = active.data.current as { type: 'field' | 'bench'; positionIndex?: number; player: Player };

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
  }, [activelyEditing, setFieldOccupants, placePlayerAtPosition]);

  // Feature 5: laad opstelling van de vorige wedstrijd
  const handleLoadPreviousLineup = useCallback(async () => {
    if (!selectedMatch || !currentTeam) return;

    const previousMatches = [...matches]
      .filter(m => m.id !== selectedMatch.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (previousMatches.length === 0) {
      toast.warning('Geen eerdere wedstrijd gevonden');
      return;
    }

    for (const match of previousMatches) {
      const { data } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', match.id)
        .limit(1);

      if (data && data.length > 0) {
        await loadLineup(match.id, players, playerCount);
        const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        toast.success(`📋 Opstelling van ${dateStr} - ${match.opponent} geladen`);
        return;
      }
    }

    toast.warning('Geen eerdere opstelling gevonden');
  }, [selectedMatch, matches, currentTeam, players, playerCount, loadLineup]);

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
    const success = await saveSubstitutions(selectedMatch.id, customMinute);
    if (success) {
      toast.success('✅ Wissels opgeslagen!');
    }
  };

  const handleFinalizeMatch = async (params: {
    calcMinutes: boolean;
    goalsFor: number | null;
    goalsAgainst: number | null;
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>;
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

      // 2. Sla spelerstatistieken op (goals, assists, kaarten)
      if (params.stats.length > 0 && currentTeam) {
        await saveMatchStats(selectedMatch.id, params.stats);
      }

      // Update lokale state
      const updatedMatchFields = {
        match_status: 'afgerond' as const,
        ...(params.goalsFor != null ? { goals_for: params.goalsFor } : {}),
        ...(params.goalsAgainst != null ? { goals_against: params.goalsAgainst } : {}),
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
  if (authChecking || teamLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
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

    return <WelcomeScreen onLogout={handleLogout} onNavigateToNew={() => router.push('/team/new')} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <img src="/logo-full.png" alt="Team Manager" className="h-16 mb-4 mx-auto" />
          <div>Laden...</div>
        </div>
      </div>
    );
  }

  // ---- RENDER ----
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Navbar
        view={view}
        setView={setView}
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
        <GuestPlayerModal onAdd={handleAddGuest} onClose={() => setShowGuestModal(false)} />
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
          onAddGuest={() => { setShowSelectionModal(false); setShowGuestModal(true); }}
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
        <PlayersManageView
          players={players}
          onAddPlayer={addPlayer}
          onUpdatePlayer={updatePlayer}
          onDeletePlayer={deletePlayer}
          onRefresh={() => selectedMatch ? fetchPlayers(selectedMatch.id) : fetchPlayers()}
        />
      ) : view === 'matches-manage' && isManager ? (
        <MatchesManageView
          matches={matches}
          gameFormat={gameFormat}
          defaultFormation={teamSettings?.default_formation}
          onAddMatch={addMatch}
          onUpdateMatch={updateMatch}
          onUpdateScore={updateMatchScore}
          onDeleteMatch={deleteMatch}
          onRefresh={fetchMatches}
        />
      ) : view === 'invites' && isManager ? (
        <InvitesManageView />
      ) : view === 'mededelingen' && isManager ? (
        <MededelingenView />
      ) : view === 'team-settings' && isManager ? (
        <TeamSettingsView onSettingsSaved={() => currentTeam && fetchTeamSettings(currentTeam.id)} />
      ) : view === 'cards' ? (
        <PlayerCardsView
          players={players}
          isAdmin={isManager}
          onUpdateStat={updateStat}
          currentPlayerId={teamPlayerId}
          creditBalance={creditBalance}
          onSaveStatDraft={handleSaveStatDraft}
        />
      ) : view === 'uitslagen' ? (
        <UitslagenView
          matches={matches}
          players={players}
          teamSettings={teamSettings}
          onRefreshPlayers={() => {
            selectedMatch ? fetchPlayers(selectedMatch.id) : fetchPlayers();
            const finishedIds = matches.filter(m => m.match_status === 'afgerond').map(m => m.id);
            if (finishedIds.length > 0) {
              fetchStatsForMatches(finishedIds).then(data => setRecentStatsMap(data));
            }
          }}
        />
      ) : view === 'dashboard' ? (
        <DashboardView
          players={players}
          matches={matches}
          fieldOccupants={fieldOccupants}
          gameFormat={gameFormat}
          onToggleAbsence={toggleAbsence}
          onToggleInjury={toggleInjury}
          onNavigateToWedstrijd={(match) => { setSelectedMatch(match); setView('pitch'); }}
          onNavigateToMatches={() => setView('matches-manage')}
          onNavigateToUitslagen={() => setView('uitslagen')}
          votingMatches={votingMatches}
          isLoadingVotes={isLoadingVotes}
          votingCurrentPlayerId={currentPlayerId}
          onSelectVotingPlayer={setCurrentPlayerId}
          onVote={handleVote}
          creditBalance={creditBalance}
          lastSpdwResult={lastSpdwResult}
          recentStatsMap={recentStatsMap}
          trackResults={teamSettings?.track_results ?? true}
          trackWasbeurt={teamSettings?.track_wasbeurt ?? true}
          trackConsumpties={teamSettings?.track_consumpties ?? true}
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
              <select
                value={selectedMatch?.id || ''}
                onChange={(e) => {
                  const match = matches.find(m => m.id === parseInt(e.target.value));
                  setSelectedMatch(match || null);
                  clearField(playerCount);
                }}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white font-bold text-sm sm:text-base flex-1 sm:flex-initial"
              >
                {matches.map(match => {
                  const isPast = new Date(match.date) < new Date();
                  const done = match.match_status === 'afgerond';
                  return (
                    <option key={match.id} value={match.id}>
                      {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {match.opponent}
                      {done ? ' ✅' : isPast ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>

              <select
                value={formation}
                onChange={(e) => activelyEditing && setFormation(e.target.value)}
                disabled={!activelyEditing || isFinalized}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 disabled:opacity-50 text-white text-sm sm:text-base"
              >
                {Object.entries(formations[gameFormat] ?? formations['11v11']).map(([f]) => (
                  <option key={f} value={f}>{formationLabels[gameFormat]?.[f] ?? f}</option>
                ))}
              </select>

              {activelyEditing && (
                <div className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-2 py-1">
                  <span className="text-xs text-gray-400 mr-1"># wisselmomenten:</span>
                  {(['Vrij', 1, 2, 3, 4] as const).map((val) => {
                    const n = val === 'Vrij' ? 0 : val as number;
                    const isActive = subMoments === n;
                    const preview = n === 0
                      ? 'Vrije wissels (kies zelf de minuut)'
                      : `${n} wissel${n > 1 ? 'momenten' : 'moment'}: ${computeSubMomentMinutes(n, matchDuration).join("', ")}' `;
                    return (
                      <button
                        key={n}
                        onClick={() => setSubMoments(n)}
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
                </div>
              )}

              {editable && !isFinalized && !isEditingLineup && (
                <button
                  onClick={() => {
                    wasPublishedBeforeEdit.current = isLineupPublished;
                    takeSnapshot();
                    setIsEditingLineup(true);
                    if (isLineupPublished && selectedMatch) {
                      publishLineup(selectedMatch.id, false);
                    }
                  }}
                  className="px-3 sm:px-4 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600 text-sm sm:text-base"
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
                  title="Laad de opstelling van de vorige wedstrijd"
                  className="px-3 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600 text-sm flex items-center gap-1.5"
                >
                  📋 Vorige opstelling
                </button>
              )}

              {isManager && activelyEditing && (
                <button
                  onClick={() => {
                    if (!selectedMatch) return;
                    generateMatchPdf({
                      match: selectedMatch,
                      players,
                      fieldOccupants,
                      substitutions,
                      matchAbsences,
                      positionInstructions: matchInstructions.length > 0 ? matchInstructions : positionInstructions,
                      subMoments,
                      subMomentMinutes,
                      teamName: currentTeam?.name,
                      teamColor: currentTeam?.color,
                      gameFormat,
                      trackWasbeurt: teamSettings?.track_wasbeurt ?? true,
                      trackConsumpties: teamSettings?.track_consumpties ?? true,
                    });
                  }}
                  title="Wedstrijdrapport als PDF"
                  className="px-3 py-2 rounded font-bold bg-gray-700 hover:bg-gray-600 text-sm flex items-center gap-1.5"
                >
                  📄 Exporteer PDF
                </button>
              )}
            </div>

            {/* Veld + Bank + Wissels */}
            <DndContext
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
                formation={formation}
                fieldOccupants={fieldOccupants}
                selectedPosition={selectedPosition}
                selectedPlayer={selectedPlayer}
                isEditable={activelyEditing}
                isManagerEdit={isManager && !!selectedMatch && !isFinalized}
                matchAbsences={matchAbsences}
                isPlayerAvailable={isPlayerAvailable}
                getInstructionForPosition={getInstructionForPosition}
                onPositionClick={handlePositionClick}
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
                  benchPlayers={benchPlayers}
                  unavailablePlayers={unavailablePlayers}
                  selectedPlayer={selectedPlayer}
                  isEditable={activelyEditing}
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
            </DndContext>

            {/* Taken: wasbeurt + consumpties */}
            {selectedMatch && !isFinalized && (
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
          <StatsView players={players} isAdmin={isManager} onUpdateStat={updateStat} />
        </div>
      )}


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
