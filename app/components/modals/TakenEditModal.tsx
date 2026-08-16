'use client';

import React, { useMemo, useState } from 'react';
import type { Match, Player, TeamSettings } from '../../lib/types';
import { isSelectablePlayer } from '../../lib/constants';
import { computeEffectiveCountsBefore } from '../../lib/taskAssignment';
import TakenBlok from '../TakenBlok';

interface TakenEditModalProps {
  match: Match;
  precedingMatches: Match[];
  laterMatches: Match[];
  players: Player[];
  absencesMap: Record<number, number[]>;
  teamSettings: TeamSettings | null;
  onUpdateWasbeurt: (matchId: number, playerId: number | null) => Promise<boolean>;
  onUpdateConsumpties: (matchId: number, playerId: number | null) => Promise<boolean>;
  onUpdateVervoer: (matchId: number, playerIds: number[]) => Promise<boolean>;
  onClose: () => void;
}

export default function TakenEditModal({
  match,
  precedingMatches,
  laterMatches,
  players,
  absencesMap,
  teamSettings,
  onUpdateWasbeurt,
  onUpdateConsumpties,
  onUpdateVervoer,
  onClose,
}: TakenEditModalProps) {
  const [recalcTask, setRecalcTask] = useState<null | 'wasbeurt' | 'consumpties'>(null);

  const matchAbsences = absencesMap[match.id] ?? [];

  const before = useMemo(
    () => computeEffectiveCountsBefore(precedingMatches, players, absencesMap, teamSettings),
    [precedingMatches, players, absencesMap, teamSettings]
  );

  const available = useMemo(
    () => players.filter(p => !p.is_guest && isSelectablePlayer(p) && !p.injured && !matchAbsences.includes(p.id)),
    [players, matchAbsences]
  );
  const allPlayers = useMemo(
    () => players.filter(p => !p.is_guest && isSelectablePlayer(p)).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // ── Wasbeurt ──
  const wasbeurtEligible = useMemo(
    () => [...available].sort((a, b) => ((before.wash.get(a.id) ?? 0) - (before.wash.get(b.id) ?? 0)) || a.name.localeCompare(b.name)),
    [available, before]
  );
  const wasbeurtOverrideId = match.wasbeurt_player_id ?? null;
  const wasbeurtOverridePlayer = wasbeurtOverrideId ? players.find(p => p.id === wasbeurtOverrideId) ?? null : null;
  const wasbeurtDisplayPlayer = wasbeurtOverridePlayer ?? wasbeurtEligible[0] ?? null;
  const wasbeurtIsUnavailable = wasbeurtOverridePlayer
    ? (wasbeurtOverridePlayer.injured || matchAbsences.includes(wasbeurtOverridePlayer.id))
    : false;

  // ── Consumpties ──
  const consumptiesEligible = useMemo(
    () => [...available].sort((a, b) => ((before.consumption.get(a.id) ?? 0) - (before.consumption.get(b.id) ?? 0)) || a.name.localeCompare(b.name)),
    [available, before]
  );
  const consumptiesOverrideId = match.consumpties_player_id ?? null;
  const consumptiesOverridePlayer = consumptiesOverrideId ? players.find(p => p.id === consumptiesOverrideId) ?? null : null;
  const consumptiesDisplayPlayer = consumptiesOverridePlayer ?? consumptiesEligible[0] ?? null;
  const consumptiesIsUnavailable = consumptiesOverridePlayer
    ? (consumptiesOverridePlayer.injured || matchAbsences.includes(consumptiesOverridePlayer.id))
    : false;

  // ── Vervoer ──
  const vervoerCount = teamSettings?.vervoer_count ?? 3;
  const vervoerEligible = useMemo(
    () => [...available].sort((a, b) => ((before.transport.get(a.id) ?? 0) - (before.transport.get(b.id) ?? 0)) || a.name.localeCompare(b.name)),
    [available, before]
  );
  const vervoerOverrideIds = match.transport_player_ids ?? [];
  const vervoerDisplayPlayers = useMemo(() => {
    const result: (Player | null)[] = [];
    const usedIds = new Set<number>();
    for (let i = 0; i < vervoerCount; i++) {
      const overrideId = vervoerOverrideIds[i] ?? null;
      if (overrideId) {
        const op = players.find(p => p.id === overrideId) ?? null;
        if (op && !op.injured && !matchAbsences.includes(op.id) && !usedIds.has(op.id)) {
          result.push(op); usedIds.add(op.id); continue;
        }
      }
      const auto = vervoerEligible.find(p => !usedIds.has(p.id)) ?? null;
      if (auto) { result.push(auto); usedIds.add(auto.id); } else result.push(null);
    }
    return result;
  }, [vervoerCount, vervoerOverrideIds, players, matchAbsences, vervoerEligible]);

  const laterWithOverride = (col: 'wasbeurt_player_id' | 'consumpties_player_id') =>
    laterMatches.filter(m => (m[col] ?? null) !== null);

  const handleWasbeurt = async (id: number | null) => {
    await onUpdateWasbeurt(match.id, id);
    if (laterWithOverride('wasbeurt_player_id').length > 0) setRecalcTask('wasbeurt');
  };
  const handleConsumpties = async (id: number | null) => {
    await onUpdateConsumpties(match.id, id);
    if (laterWithOverride('consumpties_player_id').length > 0) setRecalcTask('consumpties');
  };
  const handleVervoer = async (ids: number[]) => {
    await onUpdateVervoer(match.id, ids);
  };

  const applyRecalc = async () => {
    if (!recalcTask) return;
    const col = recalcTask === 'wasbeurt' ? 'wasbeurt_player_id' : 'consumpties_player_id';
    const update = recalcTask === 'wasbeurt' ? onUpdateWasbeurt : onUpdateConsumpties;
    await Promise.all(laterWithOverride(col).map(m => update(m.id, null)));
    setRecalcTask(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-white text-base">🧺 Taken — {match.opponent}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none" aria-label="Sluiten">✕</button>
        </div>

        <TakenBlok
          trackWasbeurt={teamSettings?.track_wasbeurt ?? true}
          wasbeurtPlayer={wasbeurtIsUnavailable ? (wasbeurtEligible[0] ?? null) : wasbeurtDisplayPlayer}
          wasbeurtOverridePlayer={wasbeurtOverridePlayer}
          wasbeurtIsUnavailable={wasbeurtIsUnavailable}
          wasbeurtEligibleFirst={wasbeurtEligible[0] ?? null}
          wasbeurtAllPlayers={allPlayers}
          wasbeurtOverrideId={wasbeurtOverrideId}
          onWasbeurtChange={handleWasbeurt}
          trackConsumpties={teamSettings?.track_consumpties ?? true}
          consumptiesPlayer={consumptiesIsUnavailable ? (consumptiesEligible[0] ?? null) : consumptiesDisplayPlayer}
          consumptiesOverridePlayer={consumptiesOverridePlayer}
          consumptiesIsUnavailable={consumptiesIsUnavailable}
          consumptiesEligibleFirst={consumptiesEligible[0] ?? null}
          consumptiesAllPlayers={allPlayers}
          consumptiesOverrideId={consumptiesOverrideId}
          onConsumptiesChange={handleConsumpties}
          trackVervoer={(teamSettings?.track_vervoer ?? true) && match.home_away !== 'Thuis'}
          vervoerCount={vervoerCount}
          vervoerEligible={vervoerEligible}
          vervoerAllPlayers={allPlayers}
          vervoerOverrideIds={vervoerOverrideIds}
          vervoerDisplayPlayers={vervoerDisplayPlayers}
          onVervoerChange={handleVervoer}
          isEditing={true}
        />

        {recalcTask && (
          <div className="mt-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-sm">
            <p className="text-yellow-200 mb-2">
              Er staan handmatige keuzes voor {recalcTask === 'wasbeurt' ? 'wasbeurt' : 'consumpties'} op latere wedstrijden.
              Wil je die vrijgeven zodat het zich weer eerlijk verdeelt?
            </p>
            <div className="flex gap-2">
              <button onClick={applyRecalc} className="px-3 py-1.5 bg-yellow-500 text-black rounded font-bold text-xs">Vrijgeven</button>
              <button onClick={() => setRecalcTask(null)} className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded font-bold text-xs">Laten staan</button>
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold">Klaar</button>
        </div>
      </div>
    </div>
  );
}
