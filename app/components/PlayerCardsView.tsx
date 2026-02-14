import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import PlayerCard, { calcRating } from './PlayerCard';
import PlayerStatsEditModal from './modals/PlayerStatsEditModal';

interface PlayerCardsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
}

export default function PlayerCardsView({ players, isAdmin, onUpdateStat }: PlayerCardsViewProps) {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'rating'>('position');

  const regularPlayers = players.filter(p => !p.is_guest);

  const sortedPlayers = [...regularPlayers].sort((a, b) => {
    if (sortBy === 'rating') {
      return calcRating(b) - calcRating(a);
    }
    const posOrder = positionOrder as readonly string[];
    const posA = posOrder.indexOf(a.position);
    const posB = posOrder.indexOf(b.position);
    if (posA !== posB) return posA - posB;
    return calcRating(b) - calcRating(a);
  });

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold">🃏 Spelerskaarten</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('position')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'position' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Per positie
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'rating' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Op rating
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingPlayer && isAdmin && (
        <PlayerStatsEditModal
          player={editingPlayer}
          onUpdateStat={(id, field, value) => {
            onUpdateStat(id, field, value);
            setEditingPlayer(prev => prev ? { ...prev, [field]: parseInt(value) || 0 } : null);
          }}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {/* Cards grid */}
      {sortBy === 'position' ? (
        <div className="space-y-6">
          {positionOrder.map(position => {
            const posPlayers = sortedPlayers.filter(p => p.position === position);
            if (posPlayers.length === 0) return null;

            return (
              <div key={position}>
                <h3 className="font-bold text-gray-400 mb-3 flex items-center gap-2 text-sm">
                  <span>{positionEmojis[position]}</span>
                  <span>{position}</span>
                </h3>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  {posPlayers.map(player => (
                    <div key={player.id} className="relative">
                      <PlayerCard player={player} size="sm" />
                      {isAdmin && (
                        <button
                          onClick={() => setEditingPlayer(player)}
                          className="absolute top-1 right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
          {sortedPlayers.map(player => (
            <div key={player.id} className="relative">
              <PlayerCard player={player} size="sm" />
              {isAdmin && (
                <button
                  onClick={() => setEditingPlayer(player)}
                  className="absolute top-1 right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
                >
                  ✏️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
