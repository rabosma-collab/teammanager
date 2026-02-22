import React from 'react';
import type { Player, PositionInstruction } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PositionInfoModalProps {
  player: Player;
  instruction: PositionInstruction | null;
  isManagerEdit: boolean;
  onEditInstruction: () => void;
  onClose: () => void;
}

export default function PositionInfoModal({
  player,
  instruction,
  isManagerEdit,
  onEditInstruction,
  onClose,
}: PositionInfoModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-800 rounded-xl max-w-sm w-full overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-gray-700 hover:bg-red-600 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition"
        >
          ✕
        </button>

        {/* Spelerskaart */}
        <div className="flex justify-center pt-8 pb-4 px-4">
          <PlayerCard player={player} />
        </div>

        {/* Instructie sectie */}
        {instruction ? (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-700 pt-4">
            <h3 className="text-base font-bold text-white">{instruction.title}</h3>
            <TipSection color="yellow" icon="💡" title="Algemene tips" tips={instruction.general_tips} />
            <TipSection color="green" icon="⚽" title="Bij balbezit" tips={instruction.with_ball} />
            <TipSection color="red" icon="🛡️" title="Zonder bal" tips={instruction.without_ball} />
          </div>
        ) : (
          isManagerEdit && (
            <div className="px-5 pb-2 border-t border-gray-700 pt-4">
              <p className="text-gray-400 text-sm">Geen instructie voor deze positie.</p>
            </div>
          )
        )}

        {/* Bewerk knop voor managers */}
        {isManagerEdit && (
          <div className="px-5 pb-5 pt-2">
            <button
              onClick={onEditInstruction}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-sm transition"
            >
              ✏️ {instruction ? 'Instructie bewerken' : 'Instructie toevoegen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const tipColorClasses: Record<string, string> = {
  yellow: 'text-yellow-500',
  green: 'text-green-500',
  red: 'text-red-500',
};

function TipSection({ color, icon, title, tips }: {
  color: string;
  icon: string;
  title: string;
  tips: string[];
}) {
  if (tips.length === 0) return null;
  return (
    <div>
      <h4 className={`font-bold ${tipColorClasses[color] || ''} mb-1 text-sm`}>{icon} {title}</h4>
      <ul className="space-y-1 text-sm text-gray-200">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-gray-500 flex-shrink-0">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
