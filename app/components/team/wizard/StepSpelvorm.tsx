'use client';

import React from 'react';
import { GAME_FORMATS } from '../../../lib/constants';

interface Props {
  gameFormat: string;
  onChangeGameFormat: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function StepSpelvorm({ gameFormat, onChangeGameFormat, onNext, onSkip }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelvorm</h2>
        <p className="text-gray-400 text-sm">Hoeveel spelers spelen er per ploeg?</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.keys(GAME_FORMATS).map((fmt) => (
          <button
            key={fmt}
            onClick={() => onChangeGameFormat(fmt)}
            className={`px-5 py-3 rounded-xl border-2 font-bold text-sm transition ${
              gameFormat === fmt
                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 text-white'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      <div className="bg-gray-700/50 rounded-xl p-4 text-sm text-gray-300 space-y-1">
        <div><span className="text-gray-400">Spelers op veld:</span> {GAME_FORMATS[gameFormat].players}</div>
        <div><span className="text-gray-400">Periodes:</span> {GAME_FORMATS[gameFormat].periods}</div>
        <div><span className="text-gray-400">Standaard speeltijd:</span> {GAME_FORMATS[gameFormat].match_duration} min totaal</div>
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
