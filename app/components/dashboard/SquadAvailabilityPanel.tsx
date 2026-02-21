'use client';

import React, { useState } from 'react';
import type { Match, Player } from '../../lib/types';
import { positionEmojis } from '../../lib/constants';
import { getLineupStatus } from './LineupStatusBadge';

interface PlayerRowProps {
  player: Player;
  isAbsent: boolean;
  isFinalized: boolean;
  isToggling: boolean;
  onToggle: (playerId: number) => void;
}

function PlayerRow({ player, isAbsent, isFinalized, isToggling, onToggle }: PlayerRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-700/40 last:border-0">
      <span className="text-sm flex-shrink-0">{positionEmojis[player.position] || '⚽'}</span>
      <span className="flex-1 text-sm font-medium truncate">{player.name}</span>
      {player.injured && (
        <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded flex-shrink-0">🏥</span>
      )}
      {!player.injured && !isFinalized && (
        <button
          onClick={() => onToggle(player.id)}
          disabled={isToggling}
          className={`text-xs px-2 py-1 rounded font-bold transition flex-shrink-0 disabled:opacity-50 ${
            isAbsent
              ? 'bg-orange-900/50 text-orange-300 hover:bg-orange-800/60 border border-orange-700/50'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
          }`}
        >
          {isToggling ? '...' : isAbsent ? '❌ Afwezig' : '✓ Aanwezig'}
        </button>
      )}
      {isFinalized && isAbsent && (
        <span className="text-xs text-orange-400 flex-shrink-0">❌</span>
      )}
    </div>
  );
}

interface SquadAvailabilityPanelProps {
  players: Player[];
  matchAbsences: number[];
  match: Match;
  fieldOccupants: (Player | null)[];
  isFinalized: boolean;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
}

export default function SquadAvailabilityPanel({
  players,
  matchAbsences,
  match,
  fieldOccupants,
  isFinalized,
  onToggleAbsence,
}: SquadAvailabilityPanelProps) {
  const matchId = match.id;
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const regularPlayers = players.filter(p => !p.is_guest);

  const handleToggle = async (playerId: number) => {
    const player = regularPlayers.find(p => p.id === playerId);
    if (!player || player.injured || isFinalized) return;
    setTogglingId(playerId);
    try {
      await onToggleAbsence(playerId, matchId);
    } finally {
      setTogglingId(null);
    }
  };

  const basisspelers = regularPlayers.filter(p =>
    getLineupStatus(p.id, fieldOccupants, matchAbsences, players) === 'basisspeler'
  );
  const wisselspelers = regularPlayers.filter(p => {
    const s = getLineupStatus(p.id, fieldOccupants, matchAbsences, players);
    return s === 'wisselspeler' || s === 'opstelling-onbekend';
  });
  const unavailable = regularPlayers.filter(p => {
    const s = getLineupStatus(p.id, fieldOccupants, matchAbsences, players);
    return s === 'afwezig' || s === 'geblesseerd';
  });

  if (regularPlayers.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selectie aanwezigheid</h3>
        <span className="text-xs text-gray-500">
          {match.opponent} · {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <div className="space-y-3">
        {basisspelers.length > 0 && (
          <div>
            <div className="text-xs font-bold text-green-400 mb-1">✅ Basisspelers ({basisspelers.length})</div>
            {basisspelers.map(p => (
              <PlayerRow
                key={p.id}
                player={p}
                isAbsent={matchAbsences.includes(p.id)}
                isFinalized={isFinalized}
                isToggling={togglingId === p.id}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
        {wisselspelers.length > 0 && (
          <div>
            <div className="text-xs font-bold text-yellow-400 mb-1">🪑 Bank ({wisselspelers.length})</div>
            {wisselspelers.map(p => (
              <PlayerRow
                key={p.id}
                player={p}
                isAbsent={matchAbsences.includes(p.id)}
                isFinalized={isFinalized}
                isToggling={togglingId === p.id}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
        {unavailable.length > 0 && (
          <div>
            <div className="text-xs font-bold text-red-400 mb-1">Niet beschikbaar ({unavailable.length})</div>
            {unavailable.map(p => (
              <PlayerRow
                key={p.id}
                player={p}
                isAbsent={matchAbsences.includes(p.id)}
                isFinalized={isFinalized}
                isToggling={togglingId === p.id}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
