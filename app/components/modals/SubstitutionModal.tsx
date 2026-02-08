import React from 'react';
import type { Player, Substitution, TempSubstitution } from '../../lib/types';

interface SubstitutionModalProps {
  subNumber: number;
  tempSubs: TempSubstitution[];
  fieldOccupants: (Player | null)[];
  benchPlayers: Player[];
  players: Player[];
  sub1Substitutions: Substitution[];
  onAddSub: () => void;
  onRemoveSub: (index: number) => void;
  onUpdateSub: (index: number, field: 'out' | 'in', player: Player | null) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function SubstitutionModal({
  subNumber,
  tempSubs,
  fieldOccupants,
  benchPlayers,
  players,
  sub1Substitutions,
  onAddSub,
  onRemoveSub,
  onUpdateSub,
  onSave,
  onClose
}: SubstitutionModalProps) {

  const getAvailablePlayers = (index: number) => {
    let availableOut: Player[] = [];
    let availableIn: Player[] = [];

    if (subNumber === 1) {
      availableOut = fieldOccupants.filter((p): p is Player => p !== null);
      availableIn = benchPlayers;
    } else {
      const outInSub1 = sub1Substitutions.map(s => s.player_out_id);
      const currentField = fieldOccupants.filter((p): p is Player =>
        p !== null && !outInSub1.includes(p.id)
      );

      const inFromSub1 = sub1Substitutions
        .map(s => players.find(p => p.id === s.player_in_id))
        .filter((p): p is Player => p !== undefined);

      availableOut = [...currentField, ...inFromSub1];

      const outFromSub1 = sub1Substitutions
        .map(s => players.find(p => p.id === s.player_out_id))
        .filter((p): p is Player => p !== undefined);

      availableIn = [...benchPlayers, ...outFromSub1];
    }

    availableOut = Array.from(new Map(availableOut.map(p => [p.id, p])).values());
    availableIn = Array.from(new Map(availableIn.map(p => [p.id, p])).values());

    return { availableOut, availableIn };
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-5xl my-8">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold">
            🔄 Wissel {subNumber} - {subNumber === 1 ? 30 : 60} min
          </h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500 p-2">✕</button>
        </div>

        <p className="text-xs sm:text-sm text-gray-400 mb-4">
          {subNumber === 1
            ? 'Stel alle wissels in voor het eerste wisselmoment (30 minuten).'
            : 'Stel alle wissels in voor het tweede wisselmoment (60 minuten).'}
        </p>

        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          {tempSubs.map((sub, index) => {
            const { availableOut, availableIn } = getAvailablePlayers(index);

            return (
              <div key={index} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-4 mb-2">
                  <span className="font-bold text-gray-400 text-sm sm:text-base">Wissel {index + 1}</span>
                  <button
                    onClick={() => onRemoveSub(index)}
                    className="ml-auto text-red-500 hover:text-red-400 text-sm p-2"
                  >
                    ✕ Verwijder
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-red-400 mb-2">⬇️ Eruit</label>
                    <select
                      value={sub.out?.id || ''}
                      onChange={(e) => {
                        const player = availableOut.find(p => p.id === parseInt(e.target.value)) || null;
                        onUpdateSub(index, 'out', player);
                      }}
                      className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                    >
                      <option value="">Selecteer...</option>
                      {availableOut.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-green-400 mb-2">⬆️ Erin</label>
                    <select
                      value={sub.in?.id || ''}
                      onChange={(e) => {
                        const player = availableIn.find(p => p.id === parseInt(e.target.value)) || null;
                        onUpdateSub(index, 'in', player);
                      }}
                      className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                    >
                      <option value="">Selecteer...</option>
                      {availableIn.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onAddSub}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold mb-4 text-sm sm:text-base"
        >
          + Voeg wissel toe
        </button>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onSave}
            disabled={tempSubs.length === 0}
            className="flex-1 px-4 sm:px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold text-sm sm:text-base"
          >
            ✅ Opslaan ({tempSubs.length})
          </button>
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold text-sm sm:text-base"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}