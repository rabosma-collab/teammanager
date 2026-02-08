import React from 'react';
import type { Player } from '../../lib/types';

interface PlayerMenuModalProps {
  player: Player;
  matchAbsences: number[];
  onToggleInjury: () => void;
  onToggleAbsence: () => void;
  onRemoveGuest: () => void;
  onClose: () => void;
}

export default function PlayerMenuModal({
  player,
  matchAbsences,
  onToggleInjury,
  onToggleAbsence,
  onRemoveGuest,
  onClose
}: PlayerMenuModalProps) {
  const isAbsent = matchAbsences.includes(player.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-center">{player.name}</h3>

        <div className="space-y-2">
          {!player.is_guest && (
            <button
              onClick={onToggleInjury}
              className={`w-full p-3 rounded-lg font-bold text-left flex items-center gap-3 ${
                player.injured
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <span className="text-2xl">{player.injured ? '✅' : '🏥'}</span>
              <span>{player.injured ? 'Markeer als hersteld' : 'Markeer als geblesseerd'}</span>
            </button>
          )}

          {!player.is_guest && (
            <button
              onClick={onToggleAbsence}
              className={`w-full p-3 rounded-lg font-bold text-left flex items-center gap-3 ${
                isAbsent
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <span className="text-2xl">{isAbsent ? '✅' : '❌'}</span>
              <span>{isAbsent ? 'Beschikbaar maken' : 'Afwezig deze wedstrijd'}</span>
            </button>
          )}

          {player.is_guest && (
            <button
              onClick={onRemoveGuest}
              className="w-full p-3 rounded-lg font-bold text-left flex items-center gap-3 bg-red-600 hover:bg-red-700"
            >
              <span className="text-2xl">🗑️</span>
              <span>Verwijder gastspeler</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full p-3 rounded-lg font-bold bg-gray-600 hover:bg-gray-700"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}