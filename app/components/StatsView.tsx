import React from 'react';
import { positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';

interface StatsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
}

export default function StatsView({ players, isAdmin, onUpdateStat }: StatsViewProps) {
  const regularPlayers = players.filter(p => !p.is_guest);

  return (
    <div className="p-4 sm:p-8 overflow-x-auto">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">📊 Ranglijst</h2>

      <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[600px]">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr className="text-left">
              <th className="p-2 sm:p-4 text-sm sm:text-base">Speler</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Positie</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Status</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Goals</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Assists</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Was</th>
              <th className="p-2 sm:p-4 text-sm sm:text-base">Wissel</th>
            </tr>
          </thead>
          <tbody>
            {regularPlayers.map(player => (
              <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                <td className="p-2 sm:p-4 font-bold text-sm sm:text-base">{player.name}</td>
                <td className="p-2 sm:p-4">
                  <span className="text-xs">{positionEmojis[player.position]} {player.position}</span>
                </td>
                <td className="p-2 sm:p-4">
                  {player.injured
                    ? <span className="text-red-500" title="Geblesseerd">🏥</span>
                    : <span className="text-green-500">✓</span>
                  }
                </td>
                <StatCell isAdmin={isAdmin} value={player.goals} field="goals" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.assists} field="assists" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.was} field="was" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.min} field="min" id={player.id} onUpdate={onUpdateStat} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCell({ isAdmin, value, field, id, onUpdate }: {
  isAdmin: boolean;
  value: number;
  field: string;
  id: number;
  onUpdate: (id: number, field: string, value: string) => void;
}) {
  return (
    <td className="p-2 sm:p-4">
      {isAdmin ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onUpdate(id, field, e.target.value)}
          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm touch-manipulation"
        />
      ) : (
        value
      )}
    </td>
  );
}