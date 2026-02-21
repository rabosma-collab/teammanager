import React from 'react';
import { formations, formationLabels } from '../lib/constants';
import type { PositionInstruction } from '../lib/types';

interface InstructionsViewProps {
  instructionFormation: string;
  setInstructionFormation: (f: string) => void;
  positionInstructions: PositionInstruction[];
  matchInstructions: PositionInstruction[];
  selectedMatchId?: number;
  onEditInstruction: (instruction: PositionInstruction) => void;
  onEditMatchInstruction: (instruction: PositionInstruction) => void;
  onDeleteMatchInstruction: (positionIndex: number) => void;
}

export default function InstructionsView({
  instructionFormation,
  setInstructionFormation,
  positionInstructions,
  matchInstructions,
  selectedMatchId,
  onEditInstruction,
  onEditMatchInstruction,
  onDeleteMatchInstruction
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
          const globalInstruction = positionInstructions.find(inst => inst.position_index === i);
          const matchOverride = matchInstructions.find(inst => inst.position_index === i);

          return (
            <div key={i} className={`bg-gray-800 rounded-lg p-4 border-2 ${matchOverride ? 'border-yellow-600' : 'border-gray-700'}`}>
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Positie {i + 1}</div>
                  <div className="font-bold">{matchOverride?.title || globalInstruction?.title || `Positie ${i + 1}`}</div>
                  {matchOverride && (
                    <div className="text-xs text-yellow-400 mt-0.5">⭐ Wedstrijd-afwijking actief</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (globalInstruction) {
                      onEditInstruction(globalInstruction);
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
                  {globalInstruction ? '✏️ Globaal' : '+ Globaal'}
                </button>
              </div>

              {/* Wedstrijd-afwijking knoppen (alleen als er een match geselecteerd is) */}
              {selectedMatchId && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      onEditMatchInstruction(matchOverride || {
                        id: 0,
                        formation: instructionFormation,
                        position_index: i,
                        position_name: globalInstruction?.position_name || `Positie ${i + 1}`,
                        title: globalInstruction?.title || `Positie ${i + 1}`,
                        general_tips: globalInstruction?.general_tips || [],
                        with_ball: globalInstruction?.with_ball || [],
                        without_ball: globalInstruction?.without_ball || []
                      });
                    }}
                    className={`flex-1 px-2 py-1 rounded text-xs font-bold ${
                      matchOverride
                        ? 'bg-yellow-700 hover:bg-yellow-600'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    {matchOverride ? '⭐ Bewerk afwijking' : '⭐ Afwijken voor wedstrijd'}
                  </button>
                  {matchOverride && (
                    <button
                      onClick={() => onDeleteMatchInstruction(i)}
                      className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs"
                      title="Verwijder wedstrijd-afwijking"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )}

              {/* Inhoud: match-afwijking of globaal */}
              {matchOverride ? (
                <div className="space-y-1 text-sm bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                  <div className="text-yellow-300 font-bold text-xs mb-1">⭐ Wedstrijd-afwijking:</div>
                  <div className="text-yellow-200">💡 Tips ({matchOverride.general_tips.length})</div>
                  <div className="text-green-300">⚽ Met bal ({matchOverride.with_ball.length})</div>
                  <div className="text-red-300">🛡️ Zonder bal ({matchOverride.without_ball.length})</div>
                </div>
              ) : globalInstruction ? (
                <div className="space-y-2 text-sm">
                  <div className="text-yellow-500 font-bold">💡 Tips ({globalInstruction.general_tips.length})</div>
                  <div className="text-green-500 font-bold">⚽ Met bal ({globalInstruction.with_ball.length})</div>
                  <div className="text-red-500 font-bold">🛡️ Zonder bal ({globalInstruction.without_ball.length})</div>
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
