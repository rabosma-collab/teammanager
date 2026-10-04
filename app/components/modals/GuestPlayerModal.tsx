import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import DraggableModal from './DraggableModal';
import Button from '../ui/Button';
import type { GuestPoolEntry } from '../../hooks/usePlayers';
import type { Player } from '../../lib/types';

interface GuestPlayerModalProps {
  guestPool: GuestPoolEntry[];
  rosterGuests: Player[];
  onAdd: (name: string, position: string) => void;
  onSelectRosterGuest: (player: Player) => void;
  onClose: () => void;
}

export default function GuestPlayerModal({ guestPool, rosterGuests, onAdd, onSelectRosterGuest, onClose }: GuestPlayerModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [position, setPosition] = useState('Verdediger');

  const handleAdd = () => {
    if (!name.trim()) {
      toast.warning('⚠️ Vul een naam in voor de gastspeler');
      return;
    }
    onAdd(name, position);
  };

  const handlePoolSelect = (entry: GuestPoolEntry) => {
    setName(entry.name);
  };

  // Oude pool-namen die nog niet als gastspeler bestaan (na migratie meestal leeg)
  const poolSuggestions = guestPool.filter(
    e => !rosterGuests.some(g => g.name.toLowerCase().trim() === e.name.toLowerCase().trim())
  );

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">👤 Gastspeler toevoegen</h2>
          <button onClick={onClose} aria-label="Sluiten" className="text-2xl hover:text-red-500">✕</button>
        </div>

        {rosterGuests.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 text-gray-300">Eerder meegedaan</label>
            <p className="text-xs text-gray-500 mb-2">Kies een bestaande gastspeler; zijn statistieken lopen door.</p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {rosterGuests.map(player => (
                <button
                  key={player.id}
                  onClick={() => onSelectRosterGuest(player)}
                  className="flex items-center justify-between px-3 py-2 rounded text-left text-sm bg-gray-700 hover:bg-gray-600 text-gray-200"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{player.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{positionEmojis[player.position]} {player.position}</span>
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-purple-900/40 border border-purple-700/50 rounded-full text-purple-300 font-medium flex-shrink-0 ml-2">gast</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {poolSuggestions.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 text-gray-300">Oude namen</label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {poolSuggestions.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handlePoolSelect(entry)}
                  className={`flex items-center justify-between px-3 py-2 rounded text-left text-sm transition-colors ${
                    name === entry.name
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  <span>{entry.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{entry.times_played}×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voer naam in..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              autoFocus={poolSuggestions.length === 0 && rosterGuests.length === 0}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Positie</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              {positionOrder.map(pos => (
                <option key={pos} value={pos}>{positionEmojis[pos]} {pos}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleAdd} variant="primary" className="flex-1">
              ✅ Toevoegen
            </Button>
            <Button onClick={onClose} variant="secondary">
              Annuleren
            </Button>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
}
