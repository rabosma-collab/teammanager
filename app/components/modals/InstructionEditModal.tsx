import React from 'react';
import type { PositionInstruction } from '../../lib/types';

interface InstructionEditModalProps {
  instruction: PositionInstruction;
  onChange: (instruction: PositionInstruction) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function InstructionEditModal({
  instruction,
  onChange,
  onSave,
  onClose
}: InstructionEditModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full my-8">
        <h3 className="text-xl font-bold mb-4">✏️ Bewerk instructie: {instruction.title}</h3>

        <div className="space-y-4">
          <div>
            <label className="block font-bold text-sm mb-2">Titel</label>
            <input
              type="text"
              value={instruction.title}
              onChange={(e) => onChange({ ...instruction, title: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>

          <TipTextarea
            label="💡 Algemene tips"
            color="yellow"
            value={instruction.general_tips}
            onChange={(tips) => onChange({ ...instruction, general_tips: tips })}
          />

          <TipTextarea
            label="⚽ Bij balbezit"
            color="green"
            value={instruction.with_ball}
            onChange={(tips) => onChange({ ...instruction, with_ball: tips })}
          />

          <TipTextarea
            label="🛡️ Zonder bal"
            color="red"
            value={instruction.without_ball}
            onChange={(tips) => onChange({ ...instruction, without_ball: tips })}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold"
          >
            ✅ Opslaan
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-bold"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}

const labelColorClasses: Record<string, string> = {
  yellow: 'text-yellow-500',
  green: 'text-green-500',
  red: 'text-red-500',
};

function TipTextarea({ label, color, value, onChange }: {
  label: string;
  color: string;
  value: string[];
  onChange: (tips: string[]) => void;
}) {
  return (
    <div>
      <label className={`block font-bold text-sm mb-2 ${labelColorClasses[color] || ''}`}>{label} (één per regel)</label>
      <textarea
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').filter(t => t.trim()))}
        rows={4}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm"
      />
    </div>
  );
}