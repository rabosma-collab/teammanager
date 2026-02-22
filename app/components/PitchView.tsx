import React from 'react';
import { formations } from '../lib/constants';
import type { Player, PositionInstruction } from '../lib/types';

interface PitchViewProps {
  formation: string;
  fieldOccupants: (Player | null)[];
  selectedPosition: number | null;
  isEditable: boolean;
  isManagerEdit: boolean;
  matchAbsences: number[];
  isPlayerAvailable: (player: Player | null, absences: number[]) => boolean;
  getInstructionForPosition: (index: number) => PositionInstruction | null;
  onPositionClick: (index: number) => void;
  onShowTooltip: (index: number) => void;
  onShowPositionInfo: (player: Player, positionIndex: number) => void;
}

const PitchView = React.memo(function PitchView({
  formation,
  fieldOccupants,
  selectedPosition,
  isEditable,
  isManagerEdit,
  matchAbsences,
  isPlayerAvailable,
  getInstructionForPosition,
  onPositionClick,
  onShowTooltip,
  onShowPositionInfo,
}: PitchViewProps) {
  return (
    <>
      {/* Hint voor view mode */}
      {!isEditable && (
        <p className="text-center text-gray-500 text-xs mb-2">
          Tik op een speler voor info &amp; instructies
        </p>
      )}
      <div
        className="relative w-full max-w-[420px] sm:max-w-[500px] lg:w-[580px] aspect-[3/4] bg-green-700 border-4 border-white rounded-2xl overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #2d5f2e, #2d5f2e 40px, #246824 40px, #246824 80px)'
        }}
      >
        {formations[formation]?.map((pos, i) => {
          const player = fieldOccupants[i];
          const showWarning = player && !isPlayerAvailable(player, matchAbsences);
          const instruction = getInstructionForPosition(i);
          const isSelected = selectedPosition === i;

          // "i" knop alleen tonen voor lege posities in manager-edit modus
          const showInstructionButton = !player && isManagerEdit;

          const handleClick = () => {
            if (isEditable) {
              onPositionClick(i);
            } else if (player) {
              onShowPositionInfo(player, i);
            }
          };

          return (
            <div
              key={i}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 touch-manipulation select-none ${
                isEditable
                  ? 'cursor-pointer active:scale-95'
                  : player
                  ? 'cursor-pointer'
                  : 'cursor-default'
              }`}
              style={{ top: `${pos.t}%`, left: `${pos.l}%` }}
            >
              {player && (
                <div
                  onClick={!isEditable ? handleClick : undefined}
                  className={`text-xs font-bold text-center mb-1 text-white block ${!isEditable ? 'cursor-pointer hover:text-yellow-300' : ''}`}
                  style={{ textShadow: '1px 1px 2px black' }}
                >
                  {player.name}
                </div>
              )}
              <div
                onClick={handleClick}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-bold text-sm sm:text-base relative transition-all ${showInstructionButton ? 'mb-6' : ''} ${
                  player
                    ? showWarning
                      ? 'bg-yellow-500 text-black border-red-500'
                      : 'bg-yellow-500 text-black border-white'
                    : isSelected
                    ? 'bg-yellow-500/40 text-white border-yellow-400 animate-pulse'
                    : 'bg-white/20 text-white border-white'
                }`}
              >
                {player ? (
                  player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    player.name.substring(0, 2).toUpperCase()
                  )
                ) : '+'}
                {showWarning && (
                  <span className="absolute -top-1 -right-1 text-red-500 text-base sm:text-lg">⚠️</span>
                )}
                {/* "i" knop alleen voor lege posities in manager-edit */}
                {showInstructionButton && (
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onShowTooltip(i);
                    }}
                    className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                      instruction ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-500 hover:bg-gray-400'
                    }`}
                    style={{ zIndex: 10 }}
                    title={instruction ? 'Wedstrijdinstructie bewerken' : 'Wedstrijdinstructie toevoegen'}
                  >
                    i
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </>
  );
});

export default PitchView;
