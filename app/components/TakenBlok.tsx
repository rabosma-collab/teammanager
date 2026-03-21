'use client';

import React, { useState } from 'react';
import type { Match, Player } from '../lib/types';

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

interface TaakRijProps {
  emoji: string;
  label: string;
  player: Player | null;
  overridePlayer: Player | null;
  isUnavailable: boolean;
  eligibleFirst: Player | null;
  allPlayers: Player[];
  countField: 'wash_count' | 'consumption_count' | 'transport_count';
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

interface VervoerRijProps {
  slotIndex: number;
  player: Player | null;
  eligiblePlayers: Player[];
  allPlayers: Player[];
  overrideIds: number[];
  isEditing: boolean;
  onOverrideChange: (slotIndex: number, playerId: number | null) => void;
}

function VervoerRij({
  slotIndex,
  player,
  eligiblePlayers,
  allPlayers,
  overrideIds,
  isEditing,
  onOverrideChange,
}: VervoerRijProps) {
  const overrideId = overrideIds[slotIndex] ?? null;
  const overridePlayer = overrideId ? allPlayers.find(p => p.id === overrideId) ?? null : null;
  const isUnavailable = overridePlayer
    ? (overridePlayer.injured || !eligiblePlayers.some(p => p.id === overridePlayer.id))
    : false;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-400 text-sm flex-shrink-0">
        {slotIndex === 0 ? '🚗' : '🚙'} Chauffeur {slotIndex + 1}:
      </span>
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
        <span className="text-gray-500 text-xs">({player.transport_count}x)</span>
      )}
      {isEditing && (
        <select
          value={overrideId ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const val = e.target.value;
            onOverrideChange(slotIndex, val ? Number(val) : null);
          }}
          className="text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 ml-auto"
        >
          <option value="">— automatisch ({eligiblePlayers[slotIndex]?.name ?? '?'})</option>
          {allPlayers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.transport_count}x)
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
  // Vervoer
  trackVervoer: boolean;
  vervoerCount: number;
  vervoerEligible: Player[];
  vervoerAllPlayers: Player[];
  vervoerOverrideIds: number[];
  vervoerDisplayPlayers: (Player | null)[];
  onVervoerChange: (playerIds: number[]) => void;
  // Match info
  match?: Match | null;
  trackAssemblyTime?: boolean;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
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
  trackVervoer,
  vervoerCount,
  vervoerEligible,
  vervoerAllPlayers,
  vervoerOverrideIds,
  vervoerDisplayPlayers,
  onVervoerChange,
  match,
  trackAssemblyTime = false,
  trackMatchTime = false,
  trackLocationDetails = false,
  isEditing,
}: TakenBlokProps) {
  const [showInfo, setShowInfo] = useState(false);

  const hasMatchInfo = !!(match && (
    (trackAssemblyTime && match.assembly_time) ||
    (trackMatchTime && match.match_time) ||
    (trackLocationDetails && match.location_details)
  ));
  if (!trackWasbeurt && !trackConsumpties && !trackVervoer && !hasMatchInfo) return null;

  const handleVervoerSlotChange = (slotIndex: number, playerId: number | null) => {
    const newIds = [...vervoerOverrideIds];
    if (playerId === null) {
      newIds.splice(slotIndex, 1);
    } else {
      newIds[slotIndex] = playerId;
    }
    // Verwijder duplicaten (zelfde speler 2x)
    const deduped = newIds.filter((id, idx) => newIds.indexOf(id) === idx);
    onVervoerChange(deduped);
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 my-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500">Taken</span>
        <button
          onClick={() => setShowInfo(v => !v)}
          className="text-gray-500 hover:text-gray-300 transition-colors touch-manipulation"
          aria-label="Uitleg taken"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {showInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInfo(false)}>
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 max-w-sm w-full text-sm text-gray-300 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-2">Taken</h3>
            <p className="mb-3 leading-relaxed">De speler met het minste aantal beurten is automatisch aan de beurt. Bij een gelijk aantal gaat het <span className="text-white font-medium">alfabetisch</span>. <span className="text-white font-medium">Wasbeurt</span>: deze speler regelt het wassen van de shirts na de wedstrijd. <span className="text-white font-medium">Consumpties</span>: deze speler zorgt voor de drank na afloop. <span className="text-white font-medium">Vervoer</span>: deze spelers regelen het vervoer naar de wedstrijd. De manager kan handmatig andere spelers aanwijzen.</p>
            <button onClick={() => setShowInfo(false)} className="text-blue-400 hover:text-blue-200 text-xs font-medium">Sluiten</button>
          </div>
        </div>
      )}
      {match && (trackAssemblyTime || trackMatchTime || trackLocationDetails) && (
        <div className="space-y-1">
          {trackAssemblyTime && match.assembly_time && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>🕐</span>
              <span className="text-gray-300">Verzamelen: <span className="font-bold text-white">{formatTime(match.assembly_time)}</span></span>
            </div>
          )}
          {trackMatchTime && match.match_time && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>⚽</span>
              <span className="text-gray-300">Aanvang: <span className="font-bold text-white">{formatTime(match.match_time)}</span></span>
            </div>
          )}
          {trackLocationDetails && match.location_details && (
            <div className="flex items-center gap-1.5 text-xs">
              <span>📍</span>
              <span className="text-gray-300">Kleedkamer: <span className="font-bold text-white">{match.location_details}</span></span>
            </div>
          )}
        </div>
      )}
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
      {trackVervoer && Array.from({ length: vervoerCount }).map((_, i) => (
        <VervoerRij
          key={i}
          slotIndex={i}
          player={vervoerDisplayPlayers[i] ?? null}
          eligiblePlayers={vervoerEligible}
          allPlayers={vervoerAllPlayers}
          overrideIds={vervoerOverrideIds}
          isEditing={isEditing}
          onOverrideChange={handleVervoerSlotChange}
        />
      ))}
    </div>
  );
}
