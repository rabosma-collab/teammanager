'use client';

import React from 'react';
import { GAME_FORMATS } from '../../../lib/constants';

interface Props {
  gameFormat: string;
  matchDuration: number;
  periods: number;
  onChangeGameFormat: (v: string) => void;
  onChangeMatchDuration: (v: number) => void;
  onChangePeriods: (v: number) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function StepSpelvorm({ gameFormat, matchDuration, periods, onChangeGameFormat, onChangeMatchDuration, onChangePeriods, onNext, onBack, onSkip }: Props) {
  const periodDuration = Math.round(matchDuration / periods);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelvorm</h2>
        <p className="text-gray-400 text-sm">Hoeveel spelers spelen er per ploeg? Dit bepaalt welke formaties beschikbaar zijn.</p>
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

      <div className="bg-gray-700/50 rounded-xl p-4 text-sm text-gray-300">
        <span className="text-gray-400">Spelers op veld:</span> {GAME_FORMATS[gameFormat].players}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Aantal periodes</label>
        <div className="flex gap-2">
          {[2, 3, 4].map((p) => (
            <button
              key={p}
              onClick={() => onChangePeriods(p)}
              className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-sm transition ${
                periods === p
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{periods} periodes van {periodDuration} minuten</p>
        <p className="text-xs text-gray-500 mt-1">Per periode kun je de opstelling en formatie aanpassen. De app stelt wisselstops voor op basis van dit aantal. Je kunt dit per wedstrijd aanpassen.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Speeltijd (minuten totaal)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={10}
            max={240}
            value={matchDuration}
            onChange={(e) => onChangeMatchDuration(Math.max(10, Math.min(240, Number(e.target.value))))}
            className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white text-center font-bold focus:outline-none focus:border-yellow-500"
          />
          {matchDuration !== GAME_FORMATS[gameFormat].match_duration && (
            <button
              onClick={() => onChangeMatchDuration(GAME_FORMATS[gameFormat].match_duration)}
              className="text-xs text-gray-400 hover:text-yellow-400 transition"
            >
              Reset naar standaard ({GAME_FORMATS[gameFormat].match_duration} min)
            </button>
          )}
          {matchDuration === GAME_FORMATS[gameFormat].match_duration && (
            <span className="text-xs text-gray-500">Standaard voor {gameFormat}</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition"
        >
          ← Vorige
        </button>
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
