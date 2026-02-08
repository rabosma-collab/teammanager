import React from 'react';
import type { PositionInstruction } from '../../lib/types';

interface TooltipModalProps {
  instruction: PositionInstruction | null;
  onClose: () => void;
}

export default function TooltipModal({ instruction, onClose }: TooltipModalProps) {
  if (!instruction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">{instruction.title}</h3>

        <div className="space-y-4">
          <TipSection color="yellow" icon="💡" title="Algemene tips" tips={instruction.general_tips} />
          <TipSection color="green" icon="⚽" title="Bij balbezit" tips={instruction.with_ball} />
          <TipSection color="red" icon="🛡️" title="Zonder bal" tips={instruction.without_ball} />
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}

function TipSection({ color, icon, title, tips }: {
  color: string;
  icon: string;
  title: string;
  tips: string[];
}) {
  return (
    <div>
      <h4 className={`font-bold text-${color}-500 mb-2`}>{icon} {title}</h4>
      <ul className="space-y-1 text-sm">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <span>•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}