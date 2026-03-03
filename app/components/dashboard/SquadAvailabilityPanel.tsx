'use client';

import React, { useState } from 'react';
import type { Match, Player } from '../../lib/types';
import { positionEmojis, positionOrder } from '../../lib/constants';

interface PlayerRowProps {
  player: Player;
  isAbsent: boolean;
}

function PlayerRow({ player, isAbsent }: PlayerRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-700/40 last:border-0">
      <span className="text-sm flex-shrink-0">{positionEmojis[player.position] || '⚽'}</span>
      <span className="flex-1 text-sm font-medium truncate">{player.name}</span>
      {player.injured && (
        <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded flex-shrink-0">🏥 Geblesseerd</span>
      )}
      {!player.injured && isAbsent && (
        <span className="text-xs px-1.5 py-0.5 bg-orange-900/50 text-orange-300 rounded flex-shrink-0">❌ Afwezig</span>
      )}
      {!player.injured && !isAbsent && (
        <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded flex-shrink-0">✅</span>
      )}
    </div>
  );
}

interface SquadAvailabilityPanelProps {
  players: Player[];
  matchAbsences: number[];
  match: Match;
  isManager: boolean;
  onNavigateToWedstrijd: (match: Match) => void;
}

export default function SquadAvailabilityPanel({
  players,
  matchAbsences,
  match,
  isManager,
  onNavigateToWedstrijd,
}: SquadAvailabilityPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const regularPlayers = players.filter(p => !p.is_guest);

  if (regularPlayers.length === 0) return null;

  const injuredCount = regularPlayers.filter(p => p.injured).length;
  const absentCount = matchAbsences.filter(id => {
    const p = regularPlayers.find(pl => pl.id === id);
    return p && !p.injured;
  }).length;
  const availableCount = regularPlayers.length - injuredCount - absentCount;

  const byPosition = positionOrder.map(pos => ({
    pos,
    group: regularPlayers.filter(p => p.position === pos),
  })).filter(({ group }) => group.length > 0);

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      {/* Header — klikbaar om uit te klappen */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3 text-left"
      >
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selectie aanwezigheid</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {match.opponent} · {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
          <span className={`text-gray-400 text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* Totalen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-2 bg-green-900/30 rounded-lg border border-green-700/30">
          <span className="text-lg font-black text-green-300">{availableCount}</span>
          <span className="text-xs text-green-400 font-medium">✅ Beschikbaar</span>
        </div>
        <div className="flex flex-col items-center p-2 bg-orange-900/30 rounded-lg border border-orange-700/30">
          <span className="text-lg font-black text-orange-300">{absentCount}</span>
          <span className="text-xs text-orange-400 font-medium">❌ Afwezig</span>
        </div>
        <div className="flex flex-col items-center p-2 bg-red-900/30 rounded-lg border border-red-700/30">
          <span className="text-lg font-black text-red-300">{injuredCount}</span>
          <span className="text-xs text-red-400 font-medium">🏥 Geblesseerd</span>
        </div>
      </div>

      {/* Uitklapbaar: spelerlijst per positie */}
      {expanded && (
        <>
          <div className="mt-4 space-y-3">
            {byPosition.map(({ pos, group }) => (
              <div key={pos}>
                <div className="text-xs font-bold text-gray-400 mb-1">
                  {positionEmojis[pos]} {pos} ({group.length})
                </div>
                {group.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    isAbsent={matchAbsences.includes(p.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Manager: knop naar wedstrijdscherm */}
          {isManager && (
            <button
              onClick={() => onNavigateToWedstrijd(match)}
              className="mt-4 w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 flex items-center justify-center gap-2"
            >
              <span>✏️</span>
              <span>Wedstrijdselectie bewerken</span>
              <span className="text-gray-400">→</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
