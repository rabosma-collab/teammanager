import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import PlayerEditModal, { type PlayerFormData } from './modals/PlayerEditModal';

interface PlayersManageViewProps {
  players: Player[];
  onAddPlayer: (data: PlayerFormData) => Promise<boolean>;
  onUpdatePlayer: (id: number, data: PlayerFormData) => Promise<boolean>;
  onDeletePlayer: (id: number) => Promise<boolean>;
  onRefresh: () => void;
}

export default function PlayersManageView({
  players,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onRefresh
}: PlayersManageViewProps) {
  const [editingPlayer, setEditingPlayer] = useState<Player | null | 'new'>(null);

  const regularPlayers = players.filter(p => !p.is_guest);

  const handleSave = async (data: PlayerFormData) => {
    let success: boolean;
    if (editingPlayer === 'new') {
      success = await onAddPlayer(data);
      if (success) {
        alert('✅ Speler toegevoegd!');
        onRefresh();
      } else {
        alert('❌ Kon speler niet toevoegen');
      }
    } else if (editingPlayer) {
      success = await onUpdatePlayer(editingPlayer.id, data);
      if (success) {
        alert('✅ Speler bijgewerkt!');
      } else {
        alert('❌ Kon speler niet bijwerken');
      }
    }
    setEditingPlayer(null);
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Weet je het zeker dat je ${player.name} wilt verwijderen? Dit verwijdert ook alle gerelateerde opstellingen, wissels en afwezigheden.`)) {
      return;
    }
    const success = await onDeletePlayer(player.id);
    if (success) {
      alert('✅ Speler verwijderd!');
    } else {
      alert('❌ Kon speler niet verwijderen');
    }
  };

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">👥 Spelersbeheer</h2>
        <button
          onClick={() => setEditingPlayer('new')}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm sm:text-base"
        >
          ➕ Nieuwe speler
        </button>
      </div>

      {editingPlayer !== null && (
        <PlayerEditModal
          player={editingPlayer === 'new' ? null : editingPlayer}
          onSave={handleSave}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      <div className="space-y-6">
        {positionOrder.map(position => {
          const posPlayers = regularPlayers
            .filter(p => p.position === position)
            .sort((a, b) => a.name.localeCompare(b.name));

          if (posPlayers.length === 0) return null;

          return (
            <div key={position}>
              <h3 className="font-bold text-gray-400 mb-2 flex items-center gap-2 text-sm sm:text-base">
                <span>{positionEmojis[position]}</span>
                <span>{position}</span>
                <span className="text-xs opacity-70">({posPlayers.length})</span>
              </h3>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                {posPlayers.map(player => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm sm:text-base truncate">{player.name}</div>
                      <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                        <span>⚽{player.goals}</span>
                        <span>🎯{player.assists}</span>
                        <span>✅{player.was}x</span>
                        <span>⏱️{player.min}min</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {player.injured && (
                        <span className="text-red-500 text-sm" title="Geblesseerd">🏥</span>
                      )}
                      <button
                        onClick={() => setEditingPlayer(player)}
                        className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm font-bold"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(player)}
                        className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm font-bold"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center text-gray-500 text-sm">
        Totaal: {regularPlayers.length} spelers
      </div>
    </div>
  );
}
