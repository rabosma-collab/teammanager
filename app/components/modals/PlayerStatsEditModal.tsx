import React, { useState } from 'react';
import type { Player } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PlayerStatsEditModalProps {
  player: Player;
  onUpdateStat: (id: number, field: string, value: string) => void;
  onClose: () => void;
}

export default function PlayerStatsEditModal({ player, onUpdateStat, onClose }: PlayerStatsEditModalProps) {
  const [localPlayer, setLocalPlayer] = useState(player);

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const clamped = Math.max(0, Math.min(99, numValue));
    onUpdateStat(player.id, field, String(clamped));
    setLocalPlayer(prev => ({ ...prev, [field]: clamped }));
  };

  const statFields = [
    { label: 'PAC', field: 'pac', desc: 'Snelheid' },
    { label: 'SHO', field: 'sho', desc: 'Schieten' },
    { label: 'PAS', field: 'pas', desc: 'Passen' },
    { label: 'DRI', field: 'dri', desc: 'Dribbelen' },
    { label: 'DEF', field: 'def', desc: 'Verdedigen' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">✏️ Stats - {player.name}</h3>
          <button onClick={onClose} className="text-xl hover:text-red-500 p-2">✕</button>
        </div>

        <div className="flex justify-center mb-4">
          <PlayerCard player={localPlayer} size="sm" />
        </div>

        <div className="space-y-3">
          {statFields.map(({ label, field, desc }) => (
            <div key={field} className="flex items-center gap-3">
              <div className="w-16">
                <div className="text-sm font-bold text-yellow-400">{label}</div>
                <div className="text-[10px] text-gray-500">{desc}</div>
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={localPlayer[field as keyof Player] as number || 50}
                onChange={(e) => handleChange(field, e.target.value)}
                className="flex-1 h-2 accent-yellow-500"
              />
              <input
                type="number"
                value={localPlayer[field as keyof Player] as number || 0}
                onChange={(e) => handleChange(field, e.target.value)}
                className="w-14 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center font-bold"
                min="0"
                max="99"
              />
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
        >
          ✅ Klaar
        </button>
      </div>
    </div>
  );
}
