import React, { useState } from 'react';
import type { Player, Substitution, TempSubstitution } from '../../lib/types';
import DraggableModal from './DraggableModal';

interface SubstitutionModalProps {
  subNumber: number;
  minute: number | null; // null = free substitution (user inputs minute)
  isFreeSubstitution: boolean;
  matchDuration: number;
  tempSubs: TempSubstitution[];
  fieldOccupants: (Player | null)[];
  benchPlayers: Player[];
  players: Player[];
  allSubstitutions: Substitution[];
  onAddSub: () => void;
  onRemoveSub: (index: number) => void;
  onUpdateSub: (index: number, field: 'out' | 'in', player: Player | null) => void;
  onSave: (customMinute?: number) => void;
  onClose: () => void;
}

export default function SubstitutionModal({
  subNumber,
  minute,
  isFreeSubstitution,
  matchDuration,
  tempSubs,
  fieldOccupants,
  benchPlayers,
  players,
  allSubstitutions,
  onAddSub,
  onRemoveSub,
  onUpdateSub,
  onSave,
  onClose
}: SubstitutionModalProps) {
  const [customMinute, setCustomMinute] = useState<number>(minute ?? Math.floor(matchDuration / 2));

  const getAvailablePlayers = (index: number) => {
    let availableOut: Player[] = [];
    let availableIn: Player[] = [];

    // Get all substitutions from earlier moments
    const earlierSubs = allSubstitutions.filter(s => s.substitution_number < subNumber);

    // Start from field occupants
    const currentField = fieldOccupants.filter((p): p is Player => p !== null);

    // IDs of players who went OUT / came IN during earlier substitution moments
    // These are regular player IDs from the substitutions table
    const outFromEarlierIds = new Set(earlierSubs.map(s => s.player_out_id));
    const inFromEarlierIds = new Set(earlierSubs.map(s => s.player_in_id));

    const inFromEarlier = earlierSubs
      .map(s => players.find(p => p.id === s.player_in_id && !p.is_guest))
      .filter((p): p is Player => p !== undefined);

    // availableOut = starters still on field + players who came in earlier
    // Guard guest players against ID collision: a guest with the same ID as a subbed-out
    // regular player must NOT be removed from the field list
    availableOut = [
      ...currentField.filter(p => p.is_guest || !outFromEarlierIds.has(p.id)),
      ...inFromEarlier
    ];

    const outFromEarlierPlayers = earlierSubs
      .map(s => {
        // Check if a guest player with this ID was in the starting lineup (field or bench).
        // This correctly handles guest/regular ID collisions: a guest on the field takes precedence.
        const guestStarter =
          fieldOccupants.find((p): p is Player => p !== null && !!p.is_guest && p.id === s.player_out_id) ??
          benchPlayers.find(p => p.is_guest && p.id === s.player_out_id);
        if (guestStarter) return guestStarter;
        return players.find(p => p.id === s.player_out_id && !p.is_guest);
      })
      .filter((p): p is Player => p !== undefined);

    // availableIn = bench players who haven't come in yet + players who went out earlier
    // Remove players already brought in at earlier moments (they're now on the field)
    availableIn = [
      ...benchPlayers.filter(p => p.is_guest || !inFromEarlierIds.has(p.id)),
      ...outFromEarlierPlayers
    ];

    // Remove players already used in other rows of THIS substitution
    // Use composite key (is_guest + id) to avoid ID collision between regular and guest players
    const playerKey = (p: Player) => `${p.is_guest ? 'g' : 'r'}_${p.id}`;
    const usedOutKeys = tempSubs
      .filter((_, i) => i !== index)
      .map(s => s.out ? playerKey(s.out) : null)
      .filter((k): k is string => k !== null);
    const usedInKeys = tempSubs
      .filter((_, i) => i !== index)
      .map(s => s.in ? playerKey(s.in) : null)
      .filter((k): k is string => k !== null);

    availableOut = availableOut.filter(p => !usedOutKeys.includes(playerKey(p)));
    availableIn = availableIn.filter(p => !usedInKeys.includes(playerKey(p)));

    // Deduplicate using composite key to avoid collisions between regular and guest player IDs
    availableOut = Array.from(new Map(availableOut.map(p => [playerKey(p), p])).values());
    availableIn = Array.from(new Map(availableIn.map(p => [playerKey(p), p])).values());

    return { availableOut, availableIn };
  };

  const displayMinute = isFreeSubstitution ? customMinute : minute;

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-1rem)] max-w-5xl">
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-2.5rem)]">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold">
            🔄 {isFreeSubstitution ? 'Vrije wissel' : `Wissel ${subNumber}`} - {displayMinute}&apos;
          </h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500 p-2">✕</button>
        </div>

        {isFreeSubstitution && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <label className="block text-sm font-bold text-yellow-400 mb-2">Minuut</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCustomMinute(v => Math.max(1, v - 1))}
                disabled={customMinute <= 1}
                className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
              >−</button>
              <span className="text-3xl font-black w-14 text-center tabular-nums">{customMinute}&apos;</span>
              <button
                onClick={() => setCustomMinute(v => Math.min(matchDuration, v + 1))}
                disabled={customMinute >= matchDuration}
                className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
              >+</button>
            </div>
          </div>
        )}

        <p className="text-xs sm:text-sm text-gray-400 mb-4">
          {isFreeSubstitution
            ? 'Stel de wissels in voor dit wisselmoment. Kies de minuut hierboven.'
            : `Stel alle wissels in voor wisselmoment ${subNumber} (${minute} minuten).`}
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
                      value={sub.out ? `${sub.out.is_guest ? 'g' : 'r'}_${sub.out.id}` : ''}
                      onChange={(e) => {
                        const player = availableOut.find(p => `${p.is_guest ? 'g' : 'r'}_${p.id}` === e.target.value) || null;
                        onUpdateSub(index, 'out', player);
                      }}
                      className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                    >
                      <option value="">Selecteer...</option>
                      {availableOut.map(player => (
                        <option key={`${player.is_guest ? 'g' : 'r'}_${player.id}`} value={`${player.is_guest ? 'g' : 'r'}_${player.id}`}>{player.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-green-400 mb-2">⬆️ Erin</label>
                    <select
                      value={sub.in ? `${sub.in.is_guest ? 'g' : 'r'}_${sub.in.id}` : ''}
                      onChange={(e) => {
                        const player = availableIn.find(p => `${p.is_guest ? 'g' : 'r'}_${p.id}` === e.target.value) || null;
                        onUpdateSub(index, 'in', player);
                      }}
                      className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                    >
                      <option value="">Selecteer...</option>
                      {availableIn.map(player => (
                        <option key={`${player.is_guest ? 'g' : 'r'}_${player.id}`} value={`${player.is_guest ? 'g' : 'r'}_${player.id}`}>{player.name}</option>
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
          className="w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded font-display font-bold mb-4 text-sm sm:text-base uppercase tracking-wide"
        >
          + Voeg wissel toe
        </button>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => onSave(isFreeSubstitution ? customMinute : undefined)}
            className="flex-1 px-4 sm:px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold text-sm sm:text-base"
          >
            {tempSubs.length === 0 ? '🗑️ Wissels wissen' : `✅ Opslaan (${tempSubs.length})`}
          </button>
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold text-sm sm:text-base"
          >
            Annuleren
          </button>
        </div>
      </div>
    </DraggableModal>
  );
}
