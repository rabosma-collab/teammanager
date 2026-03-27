import React, { useState } from 'react';
import type { Player } from '../../lib/types';
import { TeamsterrenCard } from '../PlayerCard';
import DraggableModal from './DraggableModal';

interface TeamsterrenEditModalProps {
  player: Player;
  gamesPlayed: number;
  wins: number;
  onSave: (starOverride: number | null) => void;
  onClose: () => void;
}

export default function TeamsterrenEditModal({
  player,
  gamesPlayed,
  wins,
  onSave,
  onClose,
}: TeamsterrenEditModalProps) {
  const calculatedStars = wins * 2 + gamesPlayed;
  const hasOverride = player.star_override != null;

  const [useOverride, setUseOverride] = useState(hasOverride);
  const [overrideValue, setOverrideValue] = useState<number>(
    player.star_override ?? calculatedStars
  );

  const previewStars = useOverride ? overrideValue : calculatedStars;

  const handleSave = () => {
    onSave(useOverride ? overrideValue : null);
    onClose();
  };

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-sm">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">⭐ Sterren — {player.name}</h3>
          <button onClick={onClose} className="text-xl hover:text-red-500 p-2">✕</button>
        </div>

        <div className="flex justify-center mb-5">
          <TeamsterrenCard
            player={player}
            gamesPlayed={gamesPlayed}
            wins={wins}
            starOverride={useOverride ? overrideValue : null}
            size="sm"
          />
        </div>

        {/* Modus kiezen */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setUseOverride(false)}
            className={`flex-1 py-2 rounded text-sm font-bold transition ${
              !useOverride
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            Berekend
          </button>
          <button
            onClick={() => setUseOverride(true)}
            className={`flex-1 py-2 rounded text-sm font-bold transition ${
              useOverride
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            Handmatig
          </button>
        </div>

        {!useOverride && (
          <div className="text-sm text-gray-400 text-center mb-4 bg-gray-800 rounded-lg p-3">
            <div className="text-white font-bold text-lg mb-1">{calculatedStars} sterren</div>
            <div className="text-xs">{gamesPlayed} gespeeld · {wins} gewonnen</div>
            <div className="text-xs mt-1 text-gray-500">(winst = 3 ⭐, rest = 1 ⭐)</div>
          </div>
        )}

        {useOverride && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2 text-center">
              Totaal aantal sterren
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOverrideValue(v => Math.max(0, v - 1))}
                className="w-10 h-10 bg-red-800 hover:bg-red-700 rounded-lg text-lg font-black touch-manipulation"
              >
                −
              </button>
              <input
                type="range"
                min={0}
                max={200}
                value={overrideValue}
                onChange={e => setOverrideValue(Number(e.target.value))}
                className="flex-1 accent-yellow-400"
              />
              <button
                onClick={() => setOverrideValue(v => Math.min(200, v + 1))}
                className="w-10 h-10 bg-green-800 hover:bg-green-700 rounded-lg text-lg font-black touch-manipulation"
              >
                +
              </button>
            </div>
            <div className="text-center mt-2">
              <input
                type="number"
                min={0}
                max={200}
                value={overrideValue}
                onChange={e => setOverrideValue(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-lg font-black text-center"
              />
              <span className="ml-2 text-yellow-400 font-bold">⭐</span>
            </div>
            {hasOverride && (
              <div className="text-center text-xs text-gray-500 mt-1">
                Berekend zou zijn: {calculatedStars} ⭐
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
        >
          ✅ Opslaan
        </button>
      </div>
    </DraggableModal>
  );
}
