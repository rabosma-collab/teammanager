import React from 'react';
import { formations, formationLabels } from '../lib/constants';
import type { PositionInstruction } from '../lib/types';

interface InstructionsViewProps {
  instructionFormation: string;
  setInstructionFormation: (f: string) => void;
  positionInstructions: PositionInstruction[];
  onEditInstruction: (instruction: PositionInstruction) => void;
}

export default function InstructionsView({
  instructionFormation,
  setInstructionFormation,
  positionInstructions,
  onEditInstruction,
}: InstructionsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6">📋 Positie Instructies</h2>

      <div className="mb-6">
        <label className="block font-bold mb-2">Selecteer formatie:</label>
        <select
          value={instructionFormation}
          onChange={(e) => setInstructionFormation(e.target.value)}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          {Object.keys(formations).map(f => (
            <option key={f} value={f}>{formationLabels[f]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 11 }).map((_, i) => {
          const instruction = positionInstructions.find(inst => inst.position_index === i);

          return (
            <div key={i} className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Positie {i + 1}</div>
                  <div className="font-bold">{instruction?.title || `Positie ${i + 1}`}</div>
                </div>
                <button
                  onClick={() => {
                    if (instruction) {
                      onEditInstruction(instruction);
                    } else {
                      onEditInstruction({
                        id: 0,
                        formation: instructionFormation,
                        position_index: i,
                        position_name: `Positie ${i + 1}`,
                        title: `Positie ${i + 1}`,
                        general_tips: [],
                        with_ball: [],
                        without_ball: []
                      });
                    }
                  }}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs flex-shrink-0"
                >
                  {instruction ? '✏️ Bewerken' : '+ Toevoegen'}
                </button>
              </div>

              {instruction ? (
                <div className="space-y-2 text-sm">
                  <div className="text-yellow-500 font-bold">💡 Tips ({instruction.general_tips.length})</div>
                  <div className="text-green-500 font-bold">⚽ Met bal ({instruction.with_ball.length})</div>
                  <div className="text-red-500 font-bold">🛡️ Zonder bal ({instruction.without_ball.length})</div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Nog geen instructies</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
