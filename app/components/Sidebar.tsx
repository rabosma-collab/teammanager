import React, { useRef, useCallback } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  groupedPlayers: Record<string, Player[]>;
  matchAbsences: number[];
  selectedPlayer: Player | null;
  isAdmin: boolean;
  isEditable: boolean;
  isPlayerOnField: (id: number) => boolean;
  isPlayerAvailable: (player: Player | null, absences: number[]) => boolean;
  onSelectPlayer: (player: Player | null) => void;
  onPlayerMenu: (playerId: number) => void;
  onAddGuest: () => void;
  onShowPlayerCard: (player: Player) => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  players,
  groupedPlayers,
  matchAbsences,
  selectedPlayer,
  isAdmin,
  isEditable,
  isPlayerOnField,
  isPlayerAvailable,
  onSelectPlayer,
  onPlayerMenu,
  onAddGuest,
  onShowPlayerCard
}: SidebarProps) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressFired = useRef(false);

  const handleTouchStart = useCallback((playerId: number) => {
    if (!isAdmin) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onPlayerMenu(playerId);
    }, 500);
  }, [isAdmin, onPlayerMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePlayerClick = useCallback((player: Player, available: boolean, onField: boolean) => {
    // Prevent click from firing after a long-press opened the menu
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }

    if (isEditable && available && !onField) {
      // Toggle: deselect if already selected, otherwise select
      if (selectedPlayer?.id === player.id) {
        onSelectPlayer(null);
      } else {
        onSelectPlayer(player);
        onClose();
      }
    } else if (!isEditable || onField) {
      // Show player card when not editable or player is already on field
      onShowPlayerCard(player);
    }
  }, [isEditable, selectedPlayer, onSelectPlayer, onClose]);

  const handleContextMenu = useCallback((e: React.MouseEvent, playerId: number) => {
    if (!isAdmin) return;
    e.preventDefault();
    onPlayerMenu(playerId);
  }, [isAdmin, onPlayerMenu]);

  return (
    <>
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-40
        w-80 lg:w-80
        bg-gray-800 border-r border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        overflow-y-auto
        pt-16 lg:pt-0
      `}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-yellow-500 font-bold text-xl select-none">Selectie ({players.length})</h3>
            {isAdmin && isEditable && (
              <button
                onClick={onAddGuest}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm select-none"
                title="Gastspeler toevoegen"
              >
                👤+
              </button>
            )}
          </div>

          {!isEditable && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm select-none">
              🔒 {isAdmin ? 'Wedstrijd in verleden' : 'Login als admin'}
            </div>
          )}

          {isAdmin && isEditable && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded text-xs select-none">
              💡 <strong>Tip:</strong> Druk lang op een speler voor opties (mobiel) of klik rechts (browser)
            </div>
          )}

          {positionOrder.map(position => (
            <div key={position} className="mb-6">
              <h4 className="font-bold text-sm text-gray-400 mb-2 flex items-center gap-2 select-none">
                <span>{positionEmojis[position]}</span>
                <span>{position}</span>
                <span className="text-xs opacity-70">({groupedPlayers[position]?.length || 0})</span>
              </h4>

              {groupedPlayers[position]?.map(player => {
                const isInjured = player.injured;
                const isAbsent = matchAbsences.includes(player.id);
                const available = isPlayerAvailable(player, matchAbsences);
                const onField = isPlayerOnField(player.id);

                return (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerClick(player, available, onField)}
                    onContextMenu={(e) => handleContextMenu(e, player.id)}
                    onTouchStart={() => handleTouchStart(player.id)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                    className={`p-3 mb-2 rounded-lg transition relative touch-manipulation select-none ${
                      (isEditable && available && !onField) ? 'cursor-pointer active:scale-95' : 'opacity-50'
                    } ${
                      selectedPlayer?.id === player.id
                        ? 'bg-gray-700 border-2 border-yellow-500'
                        : isAbsent
                        ? 'bg-red-900/30 border-2 border-red-700'
                        : onField
                        ? 'bg-green-900/30 border-2 border-green-700'
                        : player.is_guest
                        ? 'bg-purple-900/30 border-2 border-purple-700'
                        : 'bg-gray-700/50 hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-bold flex-1">
                        {player.name}
                        {player.is_guest && <span className="text-purple-400 text-xs ml-1">(Gast)</span>}
                      </div>
                      <div className="text-xs opacity-70">{player.min} min</div>
                      {onField && <span className="text-green-500" title="Op het veld">⚽</span>}
                      {isInjured && <span className="text-red-500" title="Geblesseerd">🏥</span>}
                      {isAbsent && <span className="text-orange-500" title="Afwezig">❌</span>}
                    </div>
                    <div className="text-xs flex gap-3 mt-1 opacity-70">
                      <span>⚽{player.goals}</span>
                      <span>🎯{player.assists}</span>
                      <span>✅{player.was}x</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
