import React, { useState } from 'react';
import { positionOrder } from '../../lib/constants';
import type { Player } from '../../lib/types';

interface PlayerEditModalProps {
  player: Player | null; // null = new player
  onSave: (data: { name: string; position: string; injured: boolean; goals: number; assists: number; was: number; min: number }) => void;
  onClose: () => void;
}

export default function PlayerEditModal({ player, onSave, onClose }: PlayerEditModalProps) {
  const [name, setName] = useState(player?.name || '');
  const [position, setPosition] = useState(player?.position || 'Keeper');
  const [injured, setInjured] = useState(player?.injured || false);
  const [goals, setGoals] = useState(player?.goals || 0);
  const [assists, setAssists] = useState(player?.assists || 0);
  const [was, setWas] = useState(player?.was || 0);
  const [min, setMin] = useState(player?.min || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), position, injured, goals, assists, was, min });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold">
            {player ? '✏️ Speler bewerken' : '➕ Nieuwe speler'}
          </h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500 p-2">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Naam *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="Naam van de speler"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Positie</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              {positionOrder.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="injured"
              checked={injured}
              onChange={(e) => setInjured(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <label htmlFor="injured" className="text-sm font-bold text-gray-400">Geblesseerd</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Goals</label>
              <input type="number" value={goals} onChange={(e) => setGoals(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" min="0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Assists</label>
              <input type="number" value={assists} onChange={(e) => setAssists(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" min="0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Was (keren)</label>
              <input type="number" value={was} onChange={(e) => setWas(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" min="0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Minuten</label>
              <input type="number" value={min} onChange={(e) => setMin(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" min="0" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
            >
              {player ? '💾 Opslaan' : '➕ Toevoegen'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold text-sm"
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
