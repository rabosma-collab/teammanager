import React, { useState, useCallback } from 'react';
import { formations } from '../lib/constants';
import type { Player, PositionInstruction } from '../lib/types';
import PlayerCard from './PlayerCard';

interface PitchViewProps {
  formation: string;
  fieldOccupants: (Player | null)[];
  selectedPlayer: Player | null;
  selectedPosition: number | null;
  isEditable: boolean;
  matchAbsences: number[];
  isPlayerAvailable: (player: Player | null, absences: number[]) => boolean;
  isPlayerOnField: (player: Player) => boolean;
  getInstructionForPosition: (index: number) => PositionInstruction | null;
  onPositionClick: (index: number) => void;
  onShowTooltip: (index: number) => void;
  onShowPlayerCard: (player: Player) => void;
}

const PitchView = React.memo(function PitchView({
  formation,
  fieldOccupants,
  selectedPlayer,
  selectedPosition,
  isEditable,
  matchAbsences,
  isPlayerAvailable,
  isPlayerOnField,
  getInstructionForPosition,
  onPositionClick,
  onShowTooltip,
  onShowPlayerCard
}: PitchViewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, index: number, player: Player | null) => {
    if (isEditable || !player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 148;
    const x = rect.right + 8 + popupWidth > window.innerWidth
      ? rect.left - popupWidth - 8
      : rect.right + 8;
    const y = Math.max(8, Math.min(rect.top - 40, window.innerHeight - 300));
    setHoveredIndex(index);
    setPopupPos({ x, y });
  }, [isEditable]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const hoveredPlayer = hoveredIndex !== null ? fieldOccupants[hoveredIndex] : null;

  return (
    <>
      <div
        className="relative w-full max-w-[350px] sm:max-w-[400px] lg:w-[450px] aspect-[3/4] bg-green-700 border-4 border-white rounded-2xl overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #2d5f2e, #2d5f2e 40px, #246824 40px, #246824 80px)'
        }}
        onMouseLeave={handleMouseLeave}
      >
        {formations[formation]?.map((pos, i) => {
          const player = fieldOccupants[i];
          const showWarning = player && !isPlayerAvailable(player, matchAbsences);
          const instruction = getInstructionForPosition(i);
          const isSelected = selectedPosition === i;

          return (
            <div
              key={i}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 touch-manipulation select-none ${
                isEditable ? 'cursor-pointer active:scale-95' : 'cursor-default'
              }`}
              style={{ top: `${pos.t}%`, left: `${pos.l}%` }}
              onMouseEnter={(e) => handleMouseEnter(e, i, player)}
              onMouseLeave={handleMouseLeave}
            >
              <div
                onClick={() => onPositionClick(i)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm relative transition-all ${instruction ? 'mb-6' : ''} ${
                  player
                    ? showWarning
                      ? 'bg-yellow-500 text-black border-red-500'
                      : 'bg-yellow-500 text-black border-white'
                    : isSelected
                    ? 'bg-yellow-500/40 text-white border-yellow-400 animate-pulse'
                    : 'bg-white/20 text-white border-white'
                }`}
              >
                {player ? player.name.substring(0, 2).toUpperCase() : '+'}
                {showWarning && (
                  <span className="absolute -top-1 -right-1 text-red-500 text-base sm:text-lg">⚠️</span>
                )}
                {instruction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowTooltip(i);
                    }}
                    className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold hover:bg-blue-600 shadow-lg"
                    style={{ zIndex: 10 }}
                  >
                    i
                  </button>
                )}
              </div>

              {player && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowPlayerCard(player);
                  }}
                  className="text-xs font-bold text-center mt-1 text-white hidden sm:block cursor-pointer hover:text-yellow-300"
                  style={{ textShadow: '1px 1px 2px black' }}
                >
                  {player.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover popup — fixed position om overflow-hidden te omzeilen */}
      {hoveredPlayer && !isEditable && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: popupPos.x, top: popupPos.y }}
        >
          <PlayerCard player={hoveredPlayer} size="sm" />
        </div>
      )}
    </>
  );
});

export default PitchView;
