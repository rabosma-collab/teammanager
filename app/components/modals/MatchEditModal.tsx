import React, { useState } from 'react';
import { formations, formationLabels } from '../../lib/constants';
import type { Match } from '../../lib/types';

interface MatchEditModalProps {
  match: Match | null; // null = new match
  onSave: (data: { date: string; opponent: string; home_away: string; formation: string }) => void;
  onClose: () => void;
}

export default function MatchEditModal({ match, onSave, onClose }: MatchEditModalProps) {
  const [date, setDate] = useState(match?.date || '');
  const [opponent, setOpponent] = useState(match?.opponent || '');
  const [homeAway, setHomeAway] = useState(match?.home_away || 'Thuis');
  const [formation, setFormation] = useState(match?.formation || '4-3-3-aanvallend');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !opponent.trim()) return;
    onSave({ date, opponent: opponent.trim(), home_away: homeAway, formation });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold">
            {match ? '✏️ Wedstrijd bewerken' : '➕ Nieuwe wedstrijd'}
          </h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500 p-2">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Datum *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Tegenstander *</label>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="Naam van de tegenstander"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Uit / Thuis</label>
            <select
              value={homeAway}
              onChange={(e) => setHomeAway(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="Thuis">Thuis</option>
              <option value="Uit">Uit</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Formatie</label>
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              {Object.keys(formations).map(f => (
                <option key={f} value={f}>{formationLabels[f]}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
            >
              {match ? '💾 Opslaan' : '➕ Toevoegen'}
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
