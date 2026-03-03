import React from 'react';
import { positionOrder, positionEmojis } from '../../lib/constants';
import type { Player, Match } from '../../lib/types';

interface MatchSelectionModalProps {
  players: Player[];
  matchAbsences: number[];
  fieldOccupants: (Player | null)[];
  selectedMatch: Match | null;
  isManager: boolean;
  onToggleInjury: (playerId: number) => Promise<void>;
  onToggleAbsence: (playerId: number) => Promise<void>;
  onRemoveGuest: (playerId: number) => Promise<void>;
  onAddGuest: () => void;
  onClose: () => void;
}

export default function MatchSelectionModal({
  players,
  matchAbsences,
  fieldOccupants,
  selectedMatch,
  isManager,
  onToggleInjury,
  onToggleAbsence,
  onRemoveGuest,
  onAddGuest,
  onClose,
}: MatchSelectionModalProps) {
  const onFieldIds = React.useMemo(() => {
    const ids = new Set<number>();
    for (const p of fieldOccupants) {
      if (p) ids.add(p.id);
    }
    return ids;
  }, [fieldOccupants]);

  const grouped = React.useMemo(() => {
    return positionOrder.map(pos => ({
      pos,
      players: players
        .filter(p => p.position === pos)
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(g => g.players.length > 0);
  }, [players]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-gray-700 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="font-bold text-lg text-white">
            👥 Wedstrijdselectie
          </h2>
          <div className="flex items-center gap-2">
            {isManager && selectedMatch && (
              <button
                onClick={() => { onAddGuest(); onClose(); }}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm font-bold"
              >
                👤+ Gast
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Spelerlijst */}
        <div className="overflow-y-auto flex-1 p-4">
          {!selectedMatch && (
            <p className="text-gray-400 text-sm text-center py-4">
              Selecteer eerst een wedstrijd.
            </p>
          )}
          {grouped.map(({ pos, players: posPlayers }) => (
            <div key={pos} className="mb-5">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
                <span>{positionEmojis[pos]}</span>
                <span>{pos}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {posPlayers.map(player => {
                  const isInjured = player.injured;
                  const isAbsent = matchAbsences.includes(player.id);
                  const isOnField = onFieldIds.has(player.id);
                  const unavailable = isInjured || isAbsent;

                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                        isInjured
                          ? 'bg-red-900/30 border border-red-800'
                          : isAbsent
                          ? 'bg-orange-900/30 border border-orange-800'
                          : isOnField
                          ? 'bg-green-900/20 border border-green-800/50'
                          : player.is_guest
                          ? 'bg-purple-900/20 border border-purple-800/50'
                          : 'bg-gray-700/40 border border-transparent'
                      }`}
                    >
                      {/* Naam + badges */}
                      <div className="flex-1 min-w-0">
                        <span className={`font-bold text-sm ${unavailable ? 'opacity-60' : ''}`}>
                          {player.name}
                        </span>
                        {player.is_guest && (
                          <span className="text-purple-400 text-xs ml-1">(Gast)</span>
                        )}
                      </div>

                      {/* Status icons */}
                      <div className="flex items-center gap-1 text-sm flex-shrink-0">
                        {isOnField && <span title="Op het veld">🟢</span>}
                        {isInjured && <span title="Geblesseerd">🏥</span>}
                        {isAbsent && <span title="Afwezig">❌</span>}
                      </div>

                      {/* Manager acties */}
                      {isManager && !player.is_guest && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => onToggleInjury(player.id)}
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isInjured
                                ? 'bg-green-700 hover:bg-green-600'
                                : 'bg-red-800/60 hover:bg-red-700'
                            }`}
                            title={isInjured ? 'Hersteld' : 'Geblesseerd'}
                          >
                            {isInjured ? '✅' : '🏥'}
                          </button>
                          {selectedMatch && (
                            <button
                              onClick={() => onToggleAbsence(player.id)}
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                isAbsent
                                  ? 'bg-green-700 hover:bg-green-600'
                                  : 'bg-orange-800/60 hover:bg-orange-700'
                              }`}
                              title={isAbsent ? 'Beschikbaar' : 'Afwezig'}
                            >
                              {isAbsent ? '✅' : '❌'}
                            </button>
                          )}
                        </div>
                      )}

                      {isManager && player.is_guest && (
                        <button
                          onClick={() => onRemoveGuest(player.id)}
                          className="px-2 py-1 rounded text-xs bg-red-800/60 hover:bg-red-700 flex-shrink-0"
                          title="Verwijder gastspeler"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 font-bold text-sm"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
