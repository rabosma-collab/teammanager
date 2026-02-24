'use client';

import React from 'react';
import type { Player } from '../../lib/types';
import { positionEmojis } from '../../lib/constants';

type LineupStatus = 'basisspeler' | 'wisselspeler' | 'afwezig' | 'geblesseerd' | 'opstelling-onbekend';

export function getLineupStatus(
  currentPlayerId: number | null,
  fieldOccupants: (Player | null)[],
  matchAbsences: number[],
  players: Player[]
): LineupStatus | null {
  if (!currentPlayerId) return null;

  const player = players.find(p => p.id === currentPlayerId && !p.is_guest);
  if (!player) return null;

  if (player.injured) return 'geblesseerd';
  if (matchAbsences.includes(currentPlayerId)) return 'afwezig';

  const isOnField = fieldOccupants.some(
    p => p !== null && p.id === currentPlayerId && !p.is_guest
  );
  if (isOnField) return 'basisspeler';

  const lineupHasAnyPlayer = fieldOccupants.some(p => p !== null);
  if (!lineupHasAnyPlayer) return 'opstelling-onbekend';

  return 'wisselspeler';
}

interface LineupStatusBadgeProps {
  currentPlayerId: number | null;
  fieldOccupants: (Player | null)[];
  matchAbsences: number[];
  players: Player[];
  lineupPublished?: boolean;
  positionName?: string;
}

const statusConfig: Record<LineupStatus, { bg: string; border: string; text: string; label: string }> = {
  basisspeler: { bg: 'bg-green-900/50', border: 'border-green-600', text: 'text-green-300', label: '✅ Basisspeler' },
  wisselspeler: { bg: 'bg-yellow-900/50', border: 'border-yellow-600', text: 'text-yellow-300', label: '🪑 Wisselspeler' },
  afwezig: { bg: 'bg-orange-900/50', border: 'border-orange-600', text: 'text-orange-300', label: '❌ Afwezig gemeld' },
  geblesseerd: { bg: 'bg-red-900/50', border: 'border-red-600', text: 'text-red-300', label: '🏥 Geblesseerd' },
  'opstelling-onbekend': { bg: 'bg-gray-800/80', border: 'border-gray-600', text: 'text-gray-400', label: '❓ Opstelling nog niet ingesteld' },
};

export default function LineupStatusBadge({ currentPlayerId, fieldOccupants, matchAbsences, players, lineupPublished, positionName }: LineupStatusBadgeProps) {
  const status = getLineupStatus(currentPlayerId, fieldOccupants, matchAbsences, players);
  if (!status) return null;

  // 'opstelling-onbekend' tonen als geen spelers op het veld staan
  if (status === 'opstelling-onbekend') {
    return (
      <div className="inline-flex items-center px-3 py-2 rounded-lg border bg-gray-800/80 border-gray-600 text-gray-400 font-bold text-sm">
        ❓ Opstelling nog niet ingesteld
      </div>
    );
  }

  const config = statusConfig[status];

  let label = config.label;
  if (status === 'basisspeler' && currentPlayerId) {
    const player = players.find(p => p.id === currentPlayerId && !p.is_guest);
    if (player) {
      const emoji = positionEmojis[player.position] || '⚽';
      // Gebruik specifieke positienaam uit instructies indien beschikbaar
      label = positionName ? `${emoji} ${positionName}` : `${emoji} ${player.position}`;
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${config.bg} ${config.border} ${config.text} font-bold text-sm`}>
        {label}
      </div>
      {!lineupPublished && status !== 'geblesseerd' && status !== 'afwezig' && (
        <div className="text-xs text-gray-500 pl-1">🔄 Concept — kan nog wijzigen</div>
      )}
    </div>
  );
}
