'use client';

import React from 'react';
import type { Player } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PersonalCardProps {
  player: Player | null;
}

export default function PersonalCard({ player }: PersonalCardProps) {
  if (!player) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center justify-center min-h-[200px]">
        <div className="text-4xl mb-3">👤</div>
        <p className="text-gray-400 text-sm text-center">Geen spelerscijfers beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mijn profiel</h3>
      <div className="flex justify-center mb-4">
        <PlayerCard player={player} size="md" />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.goals}</div>
          <div className="text-xs text-gray-400 mt-0.5">⚽ Goals</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.assists}</div>
          <div className="text-xs text-gray-400 mt-0.5">🎯 Assists</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.was}</div>
          <div className="text-xs text-gray-400 mt-0.5">🏅 Gestart</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.min}</div>
          <div className="text-xs text-gray-400 mt-0.5">⏱ Wissel</div>
        </div>
      </div>
    </div>
  );
}
