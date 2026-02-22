"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formations, formationLabels, normalizeFormation } from './lib/constants';
import { supabase } from './lib/supabase';
import { getCurrentUser, signOut } from './lib/auth';
import { useTeamContext } from './contexts/TeamContext';
import type { Player, PositionInstruction } from './lib/types';

// Hooks
import { usePlayers } from './hooks/usePlayers';
import { useMatches } from './hooks/useMatches';
import { useLineup } from './hooks/useLineup';
import { useSubstitutions } from './hooks/useSubstitutions';
import { useInstructions } from './hooks/useInstructions';
import { useSubstitutionSchemes } from './hooks/useSubstitutionSchemes';
import { useVoting } from './hooks/useVoting';
import { useStatCredits } from './hooks/useStatCredits';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import PitchView from './components/PitchView';
import BenchPanel from './components/BenchPanel';
import SubstitutionCards from './components/SubstitutionCards';
import StatsView from './components/StatsView';
import InstructionsView from './components/InstructionsView';
import PlayersManageView from './components/PlayersManageView';
import MatchesManageView from './components/MatchesManageView';
import PlayerCardsView from './components/PlayerCardsView';
import DashboardView from './components/DashboardView';
import InvitesManageView from './components/InvitesManageView';
import MededelingenView from './components/MededelingenView';

// Modals
import TooltipModal from './components/modals/TooltipModal';
import InstructionEditModal from './components/modals/InstructionEditModal';
import PlayerMenuModal from './components/modals/PlayerMenuModal';
import GuestPlayerModal from './components/modals/GuestPlayerModal';
import SubstitutionModal from './components/modals/SubstitutionModal';
import PlayerCardModal from './components/modals/PlayerCardModal';
import PositionInfoModal from './components/modals/PositionInfoModal';

export default function FootballApp() {
  const router = useRouter();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditingLineup, setIsEditingLineup] = useState(false);
  const [isEditingMatchInstruction, setIsEditingMatchInstruction] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState<number | null>(null);
  const [instructionFormation, setInstructionFormation] = useState('4-3-3-aanvallend');
  const [showPlayerCard, setShowPlayerCard] = useState<Player | null>(null);
  const [showPositionInfo, setShowPositionInfo] = useState<{ player: Player; positionIndex: number } | null>(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeCalcMinutes, setFinalizeCalcMinutes] = useState(true);
  const [finalizeGoalsFor, setFinalizeGoalsFor] = useState<string>('');
  const [finalizeGoalsAgainst, setFinalizeGoalsAgainst] = useState<string>('');
  const [showExtraSubModal, setShowExtraSubModal] = useState(false);
  const [extraSubMinute, setExtraSubMinute] = useState(45);
  const [extraSubOut, setExtraSubOut] = useState<Player | null>(null);
  const [extraSubIn, setExtraSubIn] = useState<Player | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);

  // ---- HOOKS ----
  const {
    players, fetchPlayers, getGroupedPlayers,
    toggleInjury, addGuestPlayer, removeGuestPlayer, updateStat,
    addPlayer, updatePlayer, deletePlayer
  } = usePlayers();

  const {
    matches, setMatches, selectedMatch, setSelectedMatch,
    matchAbsences, loading, fetchMatches, fetchAbsences,
    toggleAbsence, isMatchEditable,
    addMatch, updateMatch, updateMatchScore, deleteMatch
  } = useMatches();

  const {
    fieldOccupants, setFieldOccupants,
    selectedPlayer, setSelectedPlayer,
    selectedPosition, setSelectedPosition,
    savingLineup, loadLineup, saveLineup,
    isPlayerOnField, getBenchPlayers, isPlayerAvailable, clearField
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
  const { votingMatches, isLoadingVotes, fetchVotingMatches, submitVote } = useVoting();
  const { balance: creditBalance, fetchBalance, awardSpdwCredits, spendCredit } = useStatCredits();

  // ---- BEREKENDE WAARDEN ----
  const editable = isMatchEditable(isManager);
  const isFinalized = selectedMatch?.match_status === 'afgerond';
  const activelyEditing = editable && isEditingLineup;

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

  const currentScheme = useMemo(
    () => selectedMatch ? getSchemeById(selectedMatch.substitution_scheme_id) : null,
    [selectedMatch, getSchemeById]
  );
  const isFreeSubstitution = currentScheme?.minutes.length === 0;

  const groupedPlayers = useMemo(() => getGroupedPlayers(), [getGroupedPlayers]);
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
    fetchSchemes();
  }, [fetchMatches, fetchSchemes]);

  useEffect(() => {
    if (selectedMatch) {
      setFormation(normalizeFormation(selectedMatch.formation));
      fetchAbsences(selectedMatch.id);
      fetchSubstitutions(selectedMatch.id);
      fetchPlayers(selectedMatch.id);
      setIsEditingLineup(false);
    } else {
      // No match selected yet, fetch players without match context
      fetchPlayers();
    }
  }, [selectedMatch?.id, fetchAbsences, fetchSubstitutions, fetchPlayers]);

  useEffect(() => {
    if (selectedMatch && players.length > 0) {
      loadLineup(selectedMatch.id, players);
    }
  }, [players.length, selectedMatch?.id, loadLineup]);

  useEffect(() => {
    fetchInstructions(formation);
    if (selectedMatch) {
      fetchMatchInstructions(selectedMatch.id, formation);
    } else {
      clearMatchInstructions();
    }
  }, [formation, selectedMatch?.id, fetchInstructions, fetchMatchInstructions, clearMatchInstructions]);

  useEffect(() => {
    if (view === 'instructions') {
      fetchInstructions(instructionFormation);
      if (selectedMatch) {
        fetchMatchInstructions(selectedMatch.id, instructionFormation);
      }
    }
  }, [view, instructionFormation, selectedMatch?.id, fetchInstructions, fetchMatchInstructions]);

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

  // ---- HANDLERS ----
  const handleSpendCredit = useCallback(async (
    targetPlayerId: number,
    stat: string,
    change: 1 | -1
  ): Promise<boolean> => {
    if (!teamPlayerId) return false;
    const success = await spendCredit(teamPlayerId, targetPlayerId, stat, change);
    if (success) {
      // Refresh players so the updated stat reflects everywhere
      if (selectedMatch) fetchPlayers(selectedMatch.id);
      else fetchPlayers();
    }
    return success;
  }, [teamPlayerId, spendCredit, fetchPlayers, selectedMatch]);

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
      // Mode A: player was selected first → place at this position
      placePlayerAtPosition(selectedPlayer, index);
    } else if (fieldOccupants[index]) {
      // Click occupied position → remove player
      const newField = [...fieldOccupants];
      newField[index] = null;
      setFieldOccupants(newField);
      setSelectedPosition(null);
    } else {
      // Mode B: click empty position first → highlight it, then pick a player
      if (selectedPosition === index) {
        setSelectedPosition(null); // toggle off
      } else {
        setSelectedPosition(index);
      }
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

  const handleSaveLineup = async () => {
    if (!selectedMatch) return;
    const success = await saveLineup(selectedMatch, formation, (updatedMatch) => {
      setSelectedMatch(updatedMatch);
      setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    });
    if (success) {
      alert('✅ Opstelling en formatie opgeslagen!');
      // Do NOT reload lineup from DB here — guest players are not stored in the lineups table
      // and would be removed from fieldOccupants if we reload. The current state is correct.
    } else {
      alert('❌ Kon opstelling niet opslaan');
    }
  };

  const handleAddGuest = async (name: string, position: string) => {
    if (!selectedMatch) return;
    const success = await addGuestPlayer(name, position, selectedMatch.id);
    if (success) {
      setShowGuestModal(false);
      await fetchPlayers(selectedMatch.id);
      alert(`✅ Gastspeler ${name} toegevoegd!`);
    } else {
      alert('❌ Kon gastspeler niet toevoegen');
    }
  };

  const handleSaveSubstitutions = async (customMinute?: number) => {
    if (!selectedMatch) return;
    const success = await saveSubstitutions(selectedMatch.id, customMinute);
    if (success) {
      alert('✅ Wissels opgeslagen!');
    }
  };

  const handleFinalizeMatch = async (calculateMinutes: boolean) => {
    if (!selectedMatch || !canFinalizeMatch()) return;
    setShowFinalizeModal(false);

    try {
      // Haal alle substitutions op
      const { data: subs, error: subsError } = await supabase
        .from('substitutions')
        .select('*')
        .eq('match_id', selectedMatch.id);

      if (subsError) throw subsError;

      // Track speeltijd per speler
      const playerPlayTime: Record<number, {
        periodsPlayed: Array<{start: number, end: number}>,
        wasInStartingEleven: boolean
      }> = {};

      // 1. Spelers in basis starten met 0-90
      fieldOccupants.forEach(player => {
        if (player) {
          playerPlayTime[player.id] = {
            periodsPlayed: [{start: 0, end: 90}],
            wasInStartingEleven: true
          };
        }
      });

      // 2. Verwerk alle substitutions
      subs?.forEach((sub: any) => {
        const minute = sub.custom_minute || sub.minute;

        // Speler ERUIT: speelde van 0 tot minute
        if (sub.player_out_id && playerPlayTime[sub.player_out_id]) {
          playerPlayTime[sub.player_out_id].periodsPlayed = [{
            start: 0,
            end: minute
          }];
        }

        // Speler ERIN: speelde van minute tot 90
        if (sub.player_in_id) {
          if (!playerPlayTime[sub.player_in_id]) {
            playerPlayTime[sub.player_in_id] = {
              periodsPlayed: [{start: minute, end: 90}],
              wasInStartingEleven: false
            };
          } else {
            playerPlayTime[sub.player_in_id].periodsPlayed.push({
              start: minute,
              end: 90
            });
          }
        }
      });

      // 3. Bereken statistieken per speler
      for (const [playerId, data] of Object.entries(playerPlayTime)) {
        const player = players.find(p => p.id === parseInt(playerId));
        if (!player) continue;

        const table = player.is_guest ? 'guest_players' : 'players';
        const updates: Record<string, number> = {};

        // Wisselminuten optioneel berekenen
        if (calculateMinutes) {
          const totalPlayedMinutes = data.periodsPlayed.reduce((sum, period) => {
            return sum + (period.end - period.start);
          }, 0);
          const benchMinutes = 90 - totalPlayedMinutes;
          if (benchMinutes > 0) {
            updates.min = player.min + benchMinutes;
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', parseInt(playerId));

          if (error) throw error;
        }
      }

      // 4. Update match status + score
      const matchUpdate: Record<string, unknown> = { match_status: 'afgerond' };
      if (finalizeGoalsFor !== '') matchUpdate.goals_for = parseInt(finalizeGoalsFor);
      if (finalizeGoalsAgainst !== '') matchUpdate.goals_against = parseInt(finalizeGoalsAgainst);

      const { error: matchError } = await supabase
        .from('matches')
        .update(matchUpdate)
        .eq('id', selectedMatch.id);

      if (matchError) throw matchError;

      // 5. Update local state
      const updatedMatchFields = {
        match_status: 'afgerond' as const,
        ...(finalizeGoalsFor !== '' ? { goals_for: parseInt(finalizeGoalsFor) } : {}),
        ...(finalizeGoalsAgainst !== '' ? { goals_against: parseInt(finalizeGoalsAgainst) } : {}),
      };
      setIsEditingLineup(false);
      setFinalizeGoalsFor('');
      setFinalizeGoalsAgainst('');
      setSelectedMatch({ ...selectedMatch, ...updatedMatchFields });
      setMatches(matches.map(m =>
        m.id === selectedMatch.id ? { ...m, ...updatedMatchFields } : m
      ));

      // 6. Reload players
      await fetchPlayers();

      // 7. Refresh voting (new finalized match may be eligible)
      await fetchVotingMatches(
        matches.map(m => m.id === selectedMatch.id ? { ...m, match_status: 'afgerond' as const } : m),
        currentPlayerId
      );

      alert(calculateMinutes
        ? '✅ Wedstrijd afgesloten! Wisselminuten zijn bijgewerkt.'
        : '✅ Wedstrijd afgesloten! Speelminuten zijn niet berekend.'
      );

    } catch (error) {
      console.error('Error finalizing match:', error);
      alert('❌ Fout bij afsluiten: ' + (error as Error).message);
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
      setExtraSubMinute(45);
      setExtraSubOut(null);
      setExtraSubIn(null);
      alert('✅ Extra wissel toegevoegd!');
    } catch (error) {
      console.error('Error adding extra sub:', error);
      alert('❌ Kon wissel niet toevoegen');
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
      alert('✅ Extra wissel verwijderd');
    } catch (error) {
      console.error('Error deleting extra sub:', error);
      alert('❌ Kon wissel niet verwijderen');
    }
  }, [selectedMatch, fetchSubstitutions]);

  // ---- LOADING ----
  if (authChecking || teamLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚽</div>
          <div>Laden...</div>
        </div>
      </div>
    );
  }

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚽</div>
          <h2 className="text-xl font-bold mb-2">Geen team gevonden</h2>
          <p className="text-gray-400 mb-4">Je bent nog niet lid van een team.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold"
          >
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚽</div>
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
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onPlayerUpdated={fetchPlayers}
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
              alert(success ? '✅ Wedstrijdinstructie opgeslagen!' : '❌ Kon instructie niet opslaan');
            } else {
              const success = await saveInstruction(editingInstruction, instructionFormation);
              alert(success ? '✅ Instructie opgeslagen!' : '❌ Kon instructie niet opslaan');
            }
            setIsEditingMatchInstruction(false);
          }}
          onClose={() => { setEditingInstruction(null); setIsEditingMatchInstruction(false); }}
        />
      )}

      {showPlayerMenu !== null && isManager && (() => {
        const player = players.find(p => p.id === showPlayerMenu);
        if (!player) return null;
        return (
          <PlayerMenuModal
            player={player}
            matchAbsences={matchAbsences}
            onToggleInjury={async () => {
              const success = await toggleInjury(showPlayerMenu);
              if (success) {
                const p = players.find(p => p.id === showPlayerMenu);
                alert(p?.injured ? '✅ Speler hersteld' : '🏥 Speler geblesseerd');
              }
              setShowPlayerMenu(null);
            }}
            onToggleAbsence={async () => {
              if (selectedMatch) {
                await toggleAbsence(showPlayerMenu, selectedMatch.id);
              }
              setShowPlayerMenu(null);
            }}
            onRemoveGuest={async () => {
              const success = await removeGuestPlayer(showPlayerMenu);
              if (success) {
                setShowPlayerMenu(null);
                if (selectedMatch) await fetchPlayers(selectedMatch.id);
                alert('✅ Gastspeler verwijderd');
              } else {
                alert('❌ Kon gastspeler niet verwijderen');
              }
            }}
            onClose={() => setShowPlayerMenu(null)}
          />
        );
      })()}

      {showGuestModal && isManager && (
        <GuestPlayerModal onAdd={handleAddGuest} onClose={() => setShowGuestModal(false)} />
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

      {showFinalizeModal && isManager && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowFinalizeModal(false)}>
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">🏁 Wedstrijd afsluiten</h3>
              <button onClick={() => setShowFinalizeModal(false)} className="text-2xl hover:text-red-500 p-2">✕</button>
            </div>

            <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700 rounded text-sm">
              <p className="font-bold mb-2">Dit doet het volgende:</p>
              <ul className="space-y-1 text-gray-300">
                <li>• Maakt wedstrijd read-only</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 mb-4">
              <input
                type="checkbox"
                checked={finalizeCalcMinutes}
                onChange={(e) => setFinalizeCalcMinutes(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-green-500 flex-shrink-0"
              />
              <div>
                <div className="font-bold text-sm">Speelminuten automatisch berekenen</div>
                <div className="text-xs text-gray-400 mt-0.5">Berekent wisselminuten (tijd op de bank) en telt deze op bij spelers. Schakel uit bij extra tijd, bijzondere situaties of handmatige invoer.</div>
              </div>
            </label>

            {/* Score invoer */}
            <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="text-sm font-bold mb-2">Uitslag (optioneel)</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-gray-400 mb-1">Eigen goals</div>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={finalizeGoalsFor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFinalizeGoalsFor(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-xl font-black text-center"
                    placeholder="–"
                  />
                </div>
                <div className="text-gray-400 font-bold text-lg">–</div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-gray-400 mb-1">Tegenstander</div>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={finalizeGoalsAgainst}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFinalizeGoalsAgainst(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-xl font-black text-center"
                    placeholder="–"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4 p-2 bg-red-900/30 border border-red-700 rounded text-xs text-center text-red-300">
              ⚠️ Dit kan NIET ongedaan gemaakt worden!
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleFinalizeMatch(finalizeCalcMinutes)}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold touch-manipulation active:scale-95"
              >
                🏁 Afsluiten
              </button>
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold touch-manipulation active:scale-95"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
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
                  max="90"
                  value={extraSubMinute}
                  onChange={(e) => setExtraSubMinute(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-lg font-bold text-center"
                  placeholder="bijv. 45"
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
                    alert('⚠️ Vul alle velden in');
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold touch-manipulation active:scale-95"
              >
                ✅ Toevoegen
              </button>
              <button
                onClick={() => {
                  setShowExtraSubModal(false);
                  setExtraSubMinute(45);
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
          schemes={schemes}
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
      ) : view === 'cards' ? (
        <PlayerCardsView
          players={players}
          isAdmin={isManager}
          onUpdateStat={updateStat}
          currentPlayerId={teamPlayerId}
          creditBalance={creditBalance}
          onSpendCredit={handleSpendCredit}
        />
      ) : view === 'dashboard' ? (
        <DashboardView
          players={players}
          matches={matches}
          fieldOccupants={fieldOccupants}
          onToggleAbsence={toggleAbsence}
          onToggleInjury={toggleInjury}
          onNavigateToWedstrijd={(match) => { setSelectedMatch(match); setView('pitch'); }}
          onNavigateToMatches={() => setView('matches-manage')}
          votingMatches={votingMatches}
          isLoadingVotes={isLoadingVotes}
          votingCurrentPlayerId={currentPlayerId}
          onSelectVotingPlayer={setCurrentPlayerId}
          onVote={handleVote}
          creditBalance={creditBalance}
        />
      ) : view === 'pitch' ? (
        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            players={players}
            groupedPlayers={groupedPlayers}
            matchAbsences={matchAbsences}
            selectedPlayer={selectedPlayer}
            isAdmin={isManager}
            canEdit={editable}
            isEditable={activelyEditing}
            isPlayerOnField={isPlayerOnField}
            isPlayerAvailable={isPlayerAvailable}
            onSelectPlayer={handleSelectPlayer}
            onPlayerMenu={setShowPlayerMenu}
            onAddGuest={() => setShowGuestModal(true)}
            onShowPlayerCard={setShowPlayerCard}
          />

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
                  : 'bg-blue-900/30 border border-blue-700'
              }`}>
                {getMatchStatusBadge()}
              </div>
            ) : null}

            {/* Wedstrijd & formatie selectors */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 justify-center">
              <select
                value={selectedMatch?.id || ''}
                onChange={(e) => {
                  const match = matches.find(m => m.id === parseInt(e.target.value));
                  setSelectedMatch(match || null);
                  clearField();
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
                {Object.keys(formations).map(f => (
                  <option key={f} value={f}>{formationLabels[f]}</option>
                ))}
              </select>

              {editable && !isFinalized && !isEditingLineup && (
                <button
                  onClick={() => setIsEditingLineup(true)}
                  className="px-3 sm:px-4 py-2 rounded font-bold bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
                >
                  ✏️ Aanpassen
                </button>
              )}

              {editable && !isFinalized && isEditingLineup && (
                <>
                  <button
                    onClick={handleSaveLineup}
                    disabled={savingLineup}
                    className="px-3 sm:px-4 py-2 rounded font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-sm sm:text-base"
                  >
                    {savingLineup ? '💾 Bezig...' : '💾 Opslaan'}
                  </button>
                  <button
                    onClick={() => setIsEditingLineup(false)}
                    className="px-3 sm:px-4 py-2 rounded font-bold bg-gray-600 hover:bg-gray-700 text-sm sm:text-base"
                  >
                    ✅ Klaar
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
            </div>

            {/* Veld + Bank */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-start justify-center mb-4 lg:mb-6">
              <PitchView
                formation={formation}
                fieldOccupants={fieldOccupants}
                selectedPosition={selectedPosition}
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

              <BenchPanel
                benchPlayers={benchPlayers}
                unavailablePlayers={unavailablePlayers}
                selectedPlayer={selectedPlayer}
                isEditable={activelyEditing}
                onSelectPlayer={handleSelectPlayer}
              />
            </div>

            {/* Wissels */}
            <SubstitutionCards
              scheme={currentScheme}
              substitutions={substitutions}
              players={players}
              isAdmin={isManager}
              isEditable={activelyEditing}
              isFinalized={!!isFinalized}
              onEditSub={handleEditSub}
              onAddExtraSub={() => setShowExtraSubModal(true)}
              onDeleteExtraSub={deleteExtraSubstitution}
            />

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
        <StatsView players={players} isAdmin={isManager} onUpdateStat={updateStat} />
      )}
    </div>
  );
}
