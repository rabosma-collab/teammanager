'use client';

import React from 'react';
import type { Player } from '../lib/types';

interface TaakRijProps {
  emoji: string;
  label: string;
  player: Player | null;
  overridePlayer: Player | null;
  isUnavailable: boolean;
  eligibleFirst: Player | null;
  allPlayers: Player[];
  countField: 'wash_count' | 'consumption_count';
  countSuffix: string;
  isEditing: boolean;
  overrideId: number | null;
  onOverrideChange: (playerId: number | null) => void;
}

function TaakRij({
  emoji,
  label,
  player,
  overridePlayer,
  isUnavailable,
  eligibleFirst,
  allPlayers,
  countField,
  countSuffix,
  isEditing,
  overrideId,
  onOverrideChange,
}: TaakRijProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-400 text-sm flex-shrink-0">{emoji} {label}:</span>
      {isUnavailable && overridePlayer ? (
        <span className="text-yellow-400 bg-yellow-900/30 border border-yellow-700/40 rounded px-2 py-0.5 text-xs">
          ⚠️ {overridePlayer.name} is {overridePlayer.injured ? 'geblesseerd' : 'afwezig'}, automatisch gekozen
        </span>
      ) : player ? (
        <span className="font-bold text-white text-sm">{player.name}</span>
      ) : (
        <span className="text-gray-500 text-sm">Geen speler beschikbaar</span>
      )}
      {player && !isUnavailable && (
        <span className="text-gray-500 text-xs">({player[countField]}{countSuffix})</span>
      )}
      {isEditing && (
        <select
          value={overrideId ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const val = e.target.value;
            onOverrideChange(val ? Number(val) : null);
          }}
          className="text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 ml-auto"
        >
          <option value="">— automatisch ({eligibleFirst?.name ?? '?'})</option>
          {allPlayers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p[countField]}{countSuffix})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

interface TakenBlokProps {
  // Wasbeurt
  trackWasbeurt: boolean;
  wasbeurtPlayer: Player | null;
  wasbeurtOverridePlayer: Player | null;
  wasbeurtIsUnavailable: boolean;
  wasbeurtEligibleFirst: Player | null;
  wasbeurtAllPlayers: Player[];
  wasbeurtOverrideId: number | null;
  onWasbeurtChange: (playerId: number | null) => void;
  // Consumpties
  trackConsumpties: boolean;
  consumptiesPlayer: Player | null;
  consumptiesOverridePlayer: Player | null;
  consumptiesIsUnavailable: boolean;
  consumptiesEligibleFirst: Player | null;
  consumptiesAllPlayers: Player[];
  consumptiesOverrideId: number | null;
  onConsumptiesChange: (playerId: number | null) => void;
  // State
  isEditing: boolean;
}

export default function TakenBlok({
  trackWasbeurt,
  wasbeurtPlayer,
  wasbeurtOverridePlayer,
  wasbeurtIsUnavailable,
  wasbeurtEligibleFirst,
  wasbeurtAllPlayers,
  wasbeurtOverrideId,
  onWasbeurtChange,
  trackConsumpties,
  consumptiesPlayer,
  consumptiesOverridePlayer,
  consumptiesIsUnavailable,
  consumptiesEligibleFirst,
  consumptiesAllPlayers,
  consumptiesOverrideId,
  onConsumptiesChange,
  isEditing,
}: TakenBlokProps) {
  if (!trackWasbeurt && !trackConsumpties) return null;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 my-3 space-y-3">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taken</div>
      {trackWasbeurt && (
        <TaakRij
          emoji="🧺"
          label="Wasbeurt"
          player={wasbeurtPlayer}
          overridePlayer={wasbeurtOverridePlayer}
          isUnavailable={wasbeurtIsUnavailable}
          eligibleFirst={wasbeurtEligibleFirst}
          allPlayers={wasbeurtAllPlayers}
          countField="wash_count"
          countSuffix="x"
          isEditing={isEditing}
          overrideId={wasbeurtOverrideId}
          onOverrideChange={onWasbeurtChange}
        />
      )}
      {trackConsumpties && (
        <TaakRij
          emoji="🥤"
          label="Consumpties"
          player={consumptiesPlayer}
          overridePlayer={consumptiesOverridePlayer}
          isUnavailable={consumptiesIsUnavailable}
          eligibleFirst={consumptiesEligibleFirst}
          allPlayers={consumptiesAllPlayers}
          countField="consumption_count"
          countSuffix="x"
          isEditing={isEditing}
          overrideId={consumptiesOverrideId}
          onOverrideChange={onConsumptiesChange}
        />
      )}
    </div>
  );
}
