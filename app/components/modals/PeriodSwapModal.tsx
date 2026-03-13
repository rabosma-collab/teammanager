import React from 'react';
import type { Player } from '../../lib/types';

interface PeriodSwapModalProps {
  playerOut: Player;
  periodIndex: number;       // bijv. 2 voor "2e periode"
  subMomentMinute: number;   // de minuut van het wisselmoment
  benchPlayers: Player[];    // beschikbare spelers om in te wisselen
  onConfirm: (playerIn: Player) => void;
  onClose: () => void;
}

const ORDINALS = ['', '1e', '2e', '3e', '4e', '5e'];

export default function PeriodSwapModal({
  playerOut,
  periodIndex,
  subMomentMinute,
  benchPlayers,
  onConfirm,
  onClose,
}: PeriodSwapModalProps) {
  const ordinal = ORDINALS[periodIndex] ?? `${periodIndex}e`;
  const prevOrdinal = ORDINALS[periodIndex - 1] ?? `${periodIndex - 1}e`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-sm border border-gray-600 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base">
              Wissel bij {subMomentMinute}&apos; — {prevOrdinal} → {ordinal} periode
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Wie komt er voor <span className="text-yellow-400 font-semibold">{playerOut.name}</span> in de plaats?
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none p-1"
          >
            ✕
          </button>
        </div>

        {benchPlayers.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">
            Geen wisselspelers beschikbaar
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {benchPlayers.map(player => (
              <button
                key={`${player.is_guest ? 'g' : 'r'}_${player.id}`}
                onClick={() => onConfirm(player)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-700 hover:bg-green-700 border border-gray-600 hover:border-green-500 text-left transition active:scale-95"
              >
                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-yellow-500 flex items-center justify-center font-bold text-black text-xs flex-shrink-0">
                    {player.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{player.name}</div>
                  <div className="text-xs text-gray-400">{player.position}</div>
                </div>
                <span className="ml-auto text-green-400 text-sm">⬆️</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-semibold"
        >
          Annuleer
        </button>
      </div>
    </div>
  );
}
