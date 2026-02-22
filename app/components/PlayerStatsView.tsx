import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import PlayerCard, { calcRating } from './PlayerCard';

interface PlayerStatsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
}

export default function PlayerStatsView({ players, isAdmin, onUpdateStat }: PlayerStatsViewProps) {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'rating'>('position');

  const regularPlayers = players.filter(p => !p.is_guest);

  const sortedPlayers = [...regularPlayers].sort((a, b) => {
    if (sortBy === 'rating') {
      return calcRating(b) - calcRating(a);
    }
    // By position group, then by rating within group
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setEditingPlayer(null)}>
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">✏️ Stats bewerken - {editingPlayer.name}</h3>
              <button onClick={() => setEditingPlayer(null)} className="text-xl hover:text-red-500 p-2">✕</button>
            </div>

            <div className="flex justify-center mb-4">
              <PlayerCard player={editingPlayer} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '⚽ Goals', field: 'goals', value: editingPlayer.goals },
                { label: '🎯 Assists', field: 'assists', value: editingPlayer.assists },
                { label: '⏱️ Minuten', field: 'min', value: editingPlayer.min },
              ].map(({ label, field, value }) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => {
                      onUpdateStat(editingPlayer.id, field, e.target.value);
                      setEditingPlayer(prev => prev ? { ...prev, [field]: parseInt(e.target.value) || 0 } : null);
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    min="0"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditingPlayer(null)}
              className="w-full mt-4 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
            >
              ✅ Klaar
            </button>
          </div>
        </div>
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
