import React from 'react';
import type { Player } from '../lib/types';

interface BenchPanelProps {
  benchPlayers: Player[];
  unavailablePlayers: {
    injured: Player[];
    absent: Player[];
  };
  selectedPlayer: Player | null;
  isEditable: boolean;
  onSelectPlayer: (player: Player | null) => void;
}

export default function BenchPanel({
  benchPlayers,
  unavailablePlayers,
  selectedPlayer,
  isEditable,
  onSelectPlayer
}: BenchPanelProps) {
  const hasUnavailable = unavailablePlayers.injured.length > 0 || unavailablePlayers.absent.length > 0;

  return (
    <div className="w-full max-w-[350px] sm:max-w-[400px] lg:w-[380px] flex-shrink-0">
      <div className="bg-gradient-to-b from-amber-900 to-amber-950 rounded-t-3xl p-3 sm:p-4 border-4 border-amber-800">
        <h3 className="text-center font-bold text-lg sm:text-xl mb-3 text-amber-200 select-none">🪑 Wissels</h3>

        {benchPlayers.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-400 text-sm select-none">
            Geen wisselspelers
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {benchPlayers.map(player => (
              <div
                key={player.id}
                onClick={() => {
                  if (!isEditable) return;
                  // Toggle: deselect if already selected
                  if (selectedPlayer?.id === player.id) {
                    onSelectPlayer(null);
                  } else {
                    onSelectPlayer(player);
                  }
                }}
                className={`bg-amber-950/50 border-2 ${
                  selectedPlayer?.id === player.id
                    ? 'border-yellow-400'
                    : 'border-amber-700'
                } rounded-lg p-2 sm:p-3 text-center cursor-pointer hover:bg-amber-900/50 transition active:scale-95 touch-manipulation select-none`}
              >
                <div className="font-bold text-xs sm:text-sm">
                  {player.name}
                  {player.is_guest && <div className="text-purple-400 text-xs">(Gast)</div>}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {player.goals}⚽ {player.assists}🎯
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasUnavailable && (
        <div className="bg-gray-800 rounded-b-xl p-3 sm:p-4 border-4 border-t-0 border-gray-700">
          <h4 className="font-bold text-xs sm:text-sm mb-2 text-gray-400 select-none">❌ Niet beschikbaar</h4>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {unavailablePlayers.injured.map(player => (
              <span key={player.id} className="px-2 py-1 bg-red-900/30 border border-red-700 rounded text-xs select-none">
                {player.name} 🏥
              </span>
            ))}
            {unavailablePlayers.absent.map(player => (
              <span key={player.id} className="px-2 py-1 bg-orange-900/30 border border-orange-700 rounded text-xs select-none">
                {player.name} ❌
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
