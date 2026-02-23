import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import DraggableModal from './DraggableModal';

interface GuestPlayerModalProps {
  onAdd: (name: string, position: string) => void;
  onClose: () => void;
}

export default function GuestPlayerModal({ onAdd, onClose }: GuestPlayerModalProps) {
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

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">👤 Gastspeler toevoegen</h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voer naam in..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              autoFocus
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
            <button
              onClick={handleAdd}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold"
            >
              ✅ Toevoegen
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
}