'use client';

import React from 'react';
import { formations, formationLabels } from '../../../lib/constants';

interface Props {
  gameFormat: string;
  formation: string;
  onChangeFormation: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function StepFormation({ gameFormat, formation, onChangeFormation, onNext, onSkip }: Props) {
  const availableFormations = formationLabels[gameFormat] ?? formationLabels['11v11'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Standaard formatie</h2>
        <p className="text-gray-400 text-sm">Kies de formatie die je team het meest speelt. Je kan dit altijd aanpassen.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(availableFormations).map(([key, label]) => {
          const posCount = formations[gameFormat]?.[key]?.length ?? 0;
          return (
            <button
              key={key}
              onClick={() => onChangeFormation(key)}
              className={`p-4 rounded-xl border-2 text-left transition ${
                formation === key
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
              }`}
            >
              <div className={`font-bold text-sm ${formation === key ? 'text-yellow-400' : 'text-white'}`}>
                {label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {key.includes('aanvallend') && 'Offensief ingesteld'}
                {key.includes('verdedigend') && 'Defensief ingesteld'}
                {key === '4-4-2-plat' && 'Klassiek 4-4-2'}
                {key === '4-4-2-ruit' && 'Ruit-opbouw'}
                {key === '3-4-3' && 'Aanvallend met 3 achterin'}
                {key === '5-3-2' && 'Defensief met 5 achterin'}
                {gameFormat !== '11v11' && `${posCount} posities`}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95"
        >
          Opslaan & doorgaan →
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition"
        >
          Sla over
        </button>
      </div>
    </div>
  );
}
