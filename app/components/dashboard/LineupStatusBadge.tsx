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
}

const statusConfig: Record<LineupStatus, { bg: string; border: string; text: string; label: string }> = {
  basisspeler: { bg: 'bg-green-900/50', border: 'border-green-600', text: 'text-green-300', label: '✅ Basisspeler' },
  wisselspeler: { bg: 'bg-yellow-900/50', border: 'border-yellow-600', text: 'text-yellow-300', label: '🪑 Wisselspeler' },
  afwezig: { bg: 'bg-orange-900/50', border: 'border-orange-600', text: 'text-orange-300', label: '❌ Afwezig gemeld' },
  geblesseerd: { bg: 'bg-red-900/50', border: 'border-red-600', text: 'text-red-300', label: '🏥 Geblesseerd' },
  'opstelling-onbekend': { bg: 'bg-gray-800/80', border: 'border-gray-600', text: 'text-gray-400', label: '❓ Opstelling nog niet ingesteld' },
};

export default function LineupStatusBadge({ currentPlayerId, fieldOccupants, matchAbsences, players }: LineupStatusBadgeProps) {
  const status = getLineupStatus(currentPlayerId, fieldOccupants, matchAbsences, players);
  if (!status) return null;

  const config = statusConfig[status];

  let label = config.label;
  if (status === 'basisspeler' && currentPlayerId) {
    const player = players.find(p => p.id === currentPlayerId && !p.is_guest);
    if (player) {
      const emoji = positionEmojis[player.position] || '⚽';
      label = `${emoji} ${player.position}`;
    }
  }

  return (
    <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${config.bg} ${config.border} ${config.text} font-bold text-sm`}>
      {label}
    </div>
  );
}
