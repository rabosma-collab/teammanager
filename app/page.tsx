"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formations, formationLabels, normalizeFormation } from './lib/constants';
import type { Player } from './lib/types';

// Hooks
import { usePlayers } from './hooks/usePlayers';
import { useMatches } from './hooks/useMatches';
import { useLineup } from './hooks/useLineup';
import { useSubstitutions } from './hooks/useSubstitutions';
import { useInstructions } from './hooks/useInstructions';

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

// Modals
import TooltipModal from './components/modals/TooltipModal';
import InstructionEditModal from './components/modals/InstructionEditModal';
import PlayerMenuModal from './components/modals/PlayerMenuModal';
import GuestPlayerModal from './components/modals/GuestPlayerModal';
import SubstitutionModal from './components/modals/SubstitutionModal';
import PlayerCardModal from './components/modals/PlayerCardModal';

export default function FootballApp() {
  // ---- UI STATE ----
  const [view, setView] = useState('pitch');
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState<number | null>(null);
  const [instructionFormation, setInstructionFormation] = useState('4-3-3-aanvallend');
  const [showPlayerCard, setShowPlayerCard] = useState<Player | null>(null);

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
    addMatch, updateMatch, deleteMatch
  } = useMatches();

  const {
    fieldOccupants, setFieldOccupants,
    selectedPlayer, setSelectedPlayer,
    selectedPosition, setSelectedPosition,
    savingLineup, loadLineup, saveLineup,
    isPlayerOnField, getBenchPlayers, isPlayerAvailable, clearField
  } = useLineup();

  const {
    tempSubs, showSubModal, fetchSubstitutions,
    getSubsForNumber, openSubModal, addTempSub,
    removeTempSub, updateTempSub, saveSubstitutions, closeSubModal
  } = useSubstitutions();

  const {
    positionInstructions, editingInstruction, setEditingInstruction,
    fetchInstructions, getInstructionForPosition, saveInstruction
  } = useInstructions();

  // ---- BEREKENDE WAARDEN ----
  const editable = isMatchEditable(isAdmin);
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
  const sub1 = useMemo(() => getSubsForNumber(1), [getSubsForNumber]);
  const sub2 = useMemo(() => getSubsForNumber(2), [getSubsForNumber]);
  const unavailablePlayers = useMemo(() => ({
    injured: players.filter(p => p.injured),
    absent: players.filter(p => matchAbsences.includes(p.id))
  }), [players, matchAbsences]);

  // ---- DEBUG: track player changes ----
  useEffect(() => {
    const names = players.map(p => p.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      console.error('[page] DUPLICATE players in state:', dupes, players.map(p => `${p.id}:${p.name}`));
    }
    console.log('[page] players state:', players.length, 'unique names:', new Set(names).size);
  }, [players]);

  // ---- DATA LADEN ----
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (selectedMatch) {
      setFormation(normalizeFormation(selectedMatch.formation));
      fetchAbsences(selectedMatch.id);
      fetchSubstitutions(selectedMatch.id);
      fetchPlayers(selectedMatch.id);
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
  }, [formation, fetchInstructions]);

  useEffect(() => {
    if (view === 'instructions') {
      fetchInstructions(instructionFormation);
    }
  }, [view, instructionFormation, fetchInstructions]);

  // ---- HANDLERS ----
  const login = () => {
    const password = prompt("Admin wachtwoord:");
    if (password === "swenenrobin") {
      setIsAdmin(true);
      alert("✅ Admin ingelogd!");
    } else if (password) {
      alert("❌ Verkeerd wachtwoord");
    }
  };

  // Place a player at a specific field position
  const placePlayerAtPosition = useCallback((player: Player, positionIndex: number) => {
    if (!isPlayerAvailable(player, matchAbsences)) return;

    setFieldOccupants(prev => {
      if (prev.some(p => p && p.id === player.id)) return prev;
      const newField = [...prev];
      newField[positionIndex] = player;
      return newField;
    });
    setSelectedPlayer(null);
    setSelectedPosition(null);
  }, [matchAbsences, isPlayerAvailable, setFieldOccupants, setSelectedPlayer, setSelectedPosition]);

  const handlePositionClick = (index: number) => {
    if (!editable) return;

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
    if (player && selectedPosition !== null && editable) {
      // A position was already selected → place player there directly
      placePlayerAtPosition(player, selectedPosition);
    } else {
      setSelectedPlayer(player);
      setSelectedPosition(null);
    }
  }, [selectedPosition, editable, placePlayerAtPosition, setSelectedPlayer, setSelectedPosition]);

  const handleSaveLineup = async () => {
    if (!selectedMatch) return;
    const success = await saveLineup(selectedMatch, formation, (updatedMatch) => {
      setSelectedMatch(updatedMatch);
      setMatches(prev => prev.map(m => m.id === updatedMatch.id ? updatedMatch : m));
    });
    if (success) {
      alert('✅ Opstelling en formatie opgeslagen!');
      await loadLineup(selectedMatch.id, players);
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

  const handleSaveSubstitutions = async () => {
    if (!selectedMatch) return;
    const success = await saveSubstitutions(selectedMatch.id);
    if (success) {
      alert('✅ Wissels opgeslagen!');
    }
  };

  // ---- LOADING ----
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
        isAdmin={isAdmin}
        onLogin={login}
        onLogout={() => setIsAdmin(false)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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
            const success = await saveInstruction(editingInstruction, instructionFormation);
            alert(success ? '✅ Instructie opgeslagen!' : '❌ Kon instructie niet opslaan');
          }}
          onClose={() => setEditingInstruction(null)}
        />
      )}

      {showPlayerMenu !== null && isAdmin && (() => {
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

      {showGuestModal && isAdmin && (
        <GuestPlayerModal onAdd={handleAddGuest} onClose={() => setShowGuestModal(false)} />
      )}

      {showPlayerCard && (
        <PlayerCardModal
          player={showPlayerCard}
          onClose={() => setShowPlayerCard(null)}
        />
      )}

      {showSubModal && isAdmin && (
        <SubstitutionModal
          subNumber={showSubModal}
          tempSubs={tempSubs}
          fieldOccupants={fieldOccupants}
          benchPlayers={benchPlayers}
          players={players}
          sub1Substitutions={getSubsForNumber(1)}
          onAddSub={addTempSub}
          onRemoveSub={removeTempSub}
          onUpdateSub={updateTempSub}
          onSave={handleSaveSubstitutions}
          onClose={closeSubModal}
        />
      )}

      {/* === VIEWS === */}
      {view === 'instructions' && isAdmin ? (
        <InstructionsView
          instructionFormation={instructionFormation}
          setInstructionFormation={setInstructionFormation}
          positionInstructions={positionInstructions}
          onEditInstruction={setEditingInstruction}
        />
      ) : view === 'players-manage' && isAdmin ? (
        <PlayersManageView
          players={players}
          onAddPlayer={addPlayer}
          onUpdatePlayer={updatePlayer}
          onDeletePlayer={deletePlayer}
          onRefresh={() => selectedMatch ? fetchPlayers(selectedMatch.id) : fetchPlayers()}
        />
      ) : view === 'matches-manage' && isAdmin ? (
        <MatchesManageView
          matches={matches}
          onAddMatch={addMatch}
          onUpdateMatch={updateMatch}
          onDeleteMatch={deleteMatch}
          onRefresh={fetchMatches}
        />
      ) : view === 'cards' ? (
        <PlayerCardsView
          players={players}
          isAdmin={isAdmin}
          onUpdateStat={updateStat}
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
            isAdmin={isAdmin}
            isEditable={editable}
            isPlayerOnField={isPlayerOnField}
            isPlayerAvailable={isPlayerAvailable}
            onSelectPlayer={handleSelectPlayer}
            onPlayerMenu={setShowPlayerMenu}
            onAddGuest={() => setShowGuestModal(true)}
            onShowPlayerCard={setShowPlayerCard}
          />

          <div className="flex-1 flex flex-col p-2 sm:p-4 lg:p-8 overflow-y-auto">
            {/* Wedstrijd & formatie selectors */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
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
                  return (
                    <option key={match.id} value={match.id}>
                      {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {match.opponent}
                      {isPast ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>

              <select
                value={formation}
                onChange={(e) => editable && setFormation(e.target.value)}
                disabled={!editable}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 disabled:opacity-50 text-white text-sm sm:text-base"
              >
                {Object.keys(formations).map(f => (
                  <option key={f} value={f}>{formationLabels[f]}</option>
                ))}
              </select>

              {editable && (
                <button
                  onClick={handleSaveLineup}
                  disabled={savingLineup}
                  className="px-3 sm:px-4 py-2 rounded font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-sm sm:text-base"
                >
                  {savingLineup ? '💾 Bezig...' : '💾 Opslaan'}
                </button>
              )}
            </div>

            {/* Veld + Bank */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-start justify-center mb-4 lg:mb-6">
              <PitchView
                formation={formation}
                fieldOccupants={fieldOccupants}
                selectedPlayer={selectedPlayer}
                selectedPosition={selectedPosition}
                isEditable={editable}
                matchAbsences={matchAbsences}
                isPlayerAvailable={isPlayerAvailable}
                isPlayerOnField={isPlayerOnField}
                getInstructionForPosition={getInstructionForPosition}
                onPositionClick={handlePositionClick}
                onShowTooltip={setShowTooltip}
                onShowPlayerCard={setShowPlayerCard}
              />

              <BenchPanel
                benchPlayers={benchPlayers}
                unavailablePlayers={unavailablePlayers}
                selectedPlayer={selectedPlayer}
                isEditable={editable}
                onSelectPlayer={handleSelectPlayer}
              />
            </div>

            {/* Wissels */}
            <SubstitutionCards
              sub1={sub1}
              sub2={sub2}
              players={players}
              isAdmin={isAdmin}
              isEditable={editable}
              onEditSub={(n) => openSubModal(n, players)}
            />

            {/* Geselecteerde speler/positie indicator */}
            {editable && (selectedPlayer || selectedPosition !== null) && (
              <div className="mt-4 sm:mt-6 text-yellow-500 text-center text-sm sm:text-base px-4 select-none">
                {selectedPosition !== null && !selectedPlayer ? (
                  <>👆 Positie {selectedPosition + 1} geselecteerd — kies een speler uit de selectie of bank</>
                ) : selectedPlayer && isPlayerAvailable(selectedPlayer, matchAbsences) && !isPlayerOnField(selectedPlayer.id) ? (
                  <>👆 Klik op het veld om <strong>{selectedPlayer.name}</strong> te plaatsen</>
                ) : selectedPlayer && isPlayerOnField(selectedPlayer.id) ? (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> staat al op het veld</>
                ) : selectedPlayer ? (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> is niet beschikbaar</>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <StatsView players={players} isAdmin={isAdmin} onUpdateStat={updateStat} />
      )}
    </div>
  );
}
