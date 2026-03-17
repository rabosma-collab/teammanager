import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { formations, getPositionCategory } from '../lib/constants';
import type { Player, PositionInstruction } from '../lib/types';
import InfoButton from './InfoButton';

interface PitchViewProps {
  gameFormat: string;
  formation: string;
  fieldOccupants: (Player | null)[];
  selectedPosition: number | null;
  selectedPlayer: Player | null;
  isEditable: boolean;
  isManagerEdit: boolean;
  matchAbsences: number[];
  isPlayerAvailable: (player: Player | null, absences: number[]) => boolean;
  getInstructionForPosition: (index: number) => PositionInstruction | null;
  onPositionClick: (index: number) => void;
  onShowTooltip: (index: number) => void;
  onShowPositionInfo: (player: Player, positionIndex: number) => void;
  /** Optioneel: als meegegeven, wordt dit aangeroepen i.p.v. onShowPositionInfo (bijv. bij periode-swap) */
  onSwapPlayer?: (positionIndex: number) => void;
  /**
   * Periode-sleepbewerking: drag-and-drop is actief voor positiewisseling op het veld,
   * maar klikgedrag volgt onSwapPlayer (geen volledige bewerkingsmode).
   */
  isPeriodPositionEdit?: boolean;
}

interface PositionSlotProps {
  index: number;
  pos: { t: number; l: number };
  player: Player | null;
  isEditable: boolean;
  isManagerEdit: boolean;
  isSelected: boolean;
  showWarning: boolean;
  instruction: PositionInstruction | null;
  showInstructionButton: boolean;
  positionCategory: string;
  selectedPlayer: Player | null;
  onPositionClick: (index: number) => void;
  onShowTooltip: (index: number) => void;
  onShowPositionInfo: (player: Player, positionIndex: number) => void;
  onSwapPlayer?: (positionIndex: number) => void;
  isPeriodPositionEdit?: boolean;
}

function PositionSlot({
  index, pos, player, isEditable, isManagerEdit, isSelected, showWarning,
  instruction, showInstructionButton, positionCategory, selectedPlayer,
  onPositionClick, onShowTooltip, onShowPositionInfo, onSwapPlayer, isPeriodPositionEdit,
}: PositionSlotProps) {
  const canDrag = isEditable || isPeriodPositionEdit;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `pos-${index}`,
    disabled: !canDrag,
  });

  const { setNodeRef: setDragRef, listeners, attributes, isDragging } = useDraggable({
    id: `field-${index}`,
    disabled: !player || !canDrag,
    data: { type: 'field', positionIndex: index, player },
  });

  // Combine drop + drag ref onto the same element
  const setRef = (node: HTMLDivElement | null) => {
    setDropRef(node);
    if (player && canDrag) setDragRef(node);
  };

  // Feature 1: Highlight lege posities die matchen met de positiecategorie van de geselecteerde speler
  const isMatchingPosition =
    isEditable &&
    selectedPlayer !== null &&
    !player &&
    positionCategory === selectedPlayer.position;

  const handleClick = () => {
    if (isEditable) {
      onPositionClick(index);
    } else if (player && onSwapPlayer) {
      onSwapPlayer(index);
    } else if (player) {
      onShowPositionInfo(player, index);
    }
  };

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 touch-manipulation select-none ${
        isEditable ? 'cursor-pointer' : player ? 'cursor-pointer' : 'cursor-default'
      } ${isDragging ? 'opacity-20 pointer-events-none' : ''}`}
      style={{
        top: `${pos.t}%`,
        left: `${pos.l}%`,
        // Feature 4: Formatie-animatie — posities bewegen vloeiend bij fortatiewisseling
        transition: 'top 0.35s ease, left 0.35s ease',
      }}
    >
      {player && (
        <div
          onClick={!isEditable ? handleClick : undefined}
          className={`font-display font-semibold text-xs text-center mb-1 text-white block ${!isEditable ? 'cursor-pointer hover:text-yellow-300' : ''}`}
          style={{ textShadow: '1px 1px 2px black' }}
        >
          {player.name}
        </div>
      )}
      <div
        ref={setRef}
        onClick={!isDragging ? handleClick : undefined}
        {...(player && canDrag ? listeners : {})}
        {...(player && canDrag ? attributes : {})}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center font-bold text-sm sm:text-base relative transition-all active:scale-95 ${
          showInstructionButton ? 'mb-6' : ''
        } ${isOver ? 'scale-110' : ''} ${
          player
            ? showWarning
              ? 'bg-yellow-500 text-black border-red-500'
              : isOver
              ? 'bg-yellow-400 text-black border-white'
              : 'bg-yellow-500 text-black border-white'
            : isSelected
            ? 'bg-yellow-500/40 text-white border-yellow-400 animate-pulse'
            : isOver
            ? 'bg-green-500/50 text-white border-green-300'
            : isMatchingPosition
            ? 'bg-green-500/20 text-white border-green-400 ring-1 ring-green-400/60'
            : 'bg-white/20 text-white border-white'
        }`}
      >
        {player ? (
          player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.name}
              className="w-full h-full object-cover rounded-full"
              draggable={false}
              onDragStart={e => e.preventDefault()}
            />
          ) : (
            player.name.substring(0, 2).toUpperCase()
          )
        ) : (
          isMatchingPosition ? '✓' : '+'
        )}
        {showWarning && (
          <span className="absolute -top-1 -right-1 text-red-500 text-base sm:text-lg">⚠️</span>
        )}
        {showInstructionButton && (
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onShowTooltip(index);
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
}

const PitchView = React.memo(function PitchView({
  gameFormat,
  formation,
  fieldOccupants,
  selectedPosition,
  selectedPlayer,
  isEditable,
  isManagerEdit,
  matchAbsences,
  isPlayerAvailable,
  getInstructionForPosition,
  onPositionClick,
  onShowTooltip,
  onShowPositionInfo,
  onSwapPlayer,
  isPeriodPositionEdit,
}: PitchViewProps) {
  const positionsList = formations[gameFormat]?.[formation] ?? [];

  return (
    <div className="flex flex-col items-center w-full">
      <div
        className="relative w-full max-w-[420px] sm:max-w-[500px] lg:w-[580px] aspect-[3/4] bg-green-700 border-4 border-white rounded-2xl overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #2d5f2e, #2d5f2e 40px, #246824 40px, #246824 80px)'
        }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <InfoButton align="right">
            Tik op een speler voor info &amp; instructies
          </InfoButton>
        </div>
        {positionsList.map((pos, i) => {
          const player = fieldOccupants[i];
          const showWarning = player && !isPlayerAvailable(player, matchAbsences);
          const instruction = getInstructionForPosition(i);
          const isSelected = selectedPosition === i;
          const showInstructionButton = !player && isManagerEdit;
          const positionCategory = getPositionCategory(gameFormat, formation, i);

          return (
            <PositionSlot
              key={i}
              index={i}
              pos={pos}
              player={player}
              isEditable={isEditable}
              isManagerEdit={isManagerEdit}
              isSelected={isSelected}
              showWarning={!!showWarning}
              instruction={instruction}
              showInstructionButton={showInstructionButton}
              positionCategory={positionCategory}
              selectedPlayer={selectedPlayer}
              onPositionClick={onPositionClick}
              onShowTooltip={onShowTooltip}
              onShowPositionInfo={onShowPositionInfo}
              onSwapPlayer={onSwapPlayer}
              isPeriodPositionEdit={isPeriodPositionEdit}
            />
          );
        })}
      </div>
    </div>
  );
});

export default PitchView;
