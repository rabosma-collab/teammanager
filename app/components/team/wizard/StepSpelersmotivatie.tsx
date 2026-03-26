'use client';

import React from 'react';
import type { PlayerCardMode } from '../../../lib/types';

interface Props {
  playerCardMode: PlayerCardMode;
  spdwEnabled: boolean;
  onSelectMode: (mode: PlayerCardMode) => void;
  onToggleSpdw: () => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const MODES: Array<{
  mode: PlayerCardMode;
  icon: string;
  title: string;
  subtitle: string;
  features: string[];
  noFeatures: string[];
  preview: React.ReactNode;
}> = [
  {
    mode: 'competitive',
    icon: '🎮',
    title: 'Competitief',
    subtitle: 'Uitdagend & competitief',
    features: [
      '1 credit per gespeelde wedstrijd',
      'Speler van de Week stemming',
      'Spelersattributen upgraden met credits',
    ],
    noFeatures: [],
    preview: (
      <div className="bg-gray-900 rounded-xl p-3 w-28 mx-auto text-center border border-yellow-500/40">
        <div className="text-yellow-400 font-black text-xl leading-none">82</div>
        <div className="w-10 h-10 rounded-full bg-gray-700 mx-auto my-1 flex items-center justify-center text-lg">👤</div>
        <div className="text-[10px] font-bold text-white truncate">Robin</div>
        <div className="grid grid-cols-2 gap-x-1 mt-1">
          {[['PAC','78'],['SHO','71'],['PAS','80'],['DRI','75']].map(([k,v]) => (
            <div key={k} className="text-[9px] text-gray-300"><span className="text-yellow-400 font-bold">{v}</span> {k}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    mode: 'teamsterren',
    icon: '⭐',
    title: 'Teamsterren',
    subtitle: 'Positief & motiverend',
    features: [
      'Sterren verdienen per wedstrijd',
      'Kaart groeit van Rookie naar Legende',
      'Win = 3 sterren, Gelijk/Verlies = 1 ster',
    ],
    noFeatures: [
      'Geen ranglijst of stemming',
    ],
    preview: (
      <div className="bg-gradient-to-b from-blue-900 to-purple-900 rounded-xl p-3 w-28 mx-auto text-center border border-blue-400/40">
        <div className="text-xs font-bold text-blue-300">🥈 STER</div>
        <div className="w-10 h-10 rounded-full bg-gray-700 mx-auto my-1 flex items-center justify-center text-lg">👤</div>
        <div className="text-[10px] font-bold text-white truncate">Robin</div>
        <div className="flex justify-center gap-2 mt-1 text-[9px] text-gray-300">
          <span>⚽ 14</span>
          <span>🏆 8</span>
        </div>
        <div className="text-[9px] text-yellow-400 font-bold mt-0.5">⭐ 31</div>
        <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
          <div className="bg-yellow-400 h-1 rounded-full" style={{ width: '62%' }} />
        </div>
      </div>
    ),
  },
  {
    mode: 'none',
    icon: '○',
    title: 'Geen kaarten',
    subtitle: 'Simpel & overzichtelijk',
    features: [
      'Puur opstellingen en wedstrijden beheren',
    ],
    noFeatures: [
      'Geen spelerskaarten of beloningen',
    ],
    preview: (
      <div className="bg-gray-800 rounded-xl p-3 w-28 mx-auto border border-gray-600/40 space-y-1.5">
        {['Robin de Vries', 'Sander Bakker', 'Tim Jansen'].map(name => (
          <div key={name} className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <span className="text-base leading-none">👤</span>
            <span className="truncate">{name}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function StepSpelersmotivatie({
  playerCardMode,
  spdwEnabled,
  onSelectMode,
  onToggleSpdw,
  onNext,
  onBack,
  onSkip,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelersmotivatie</h2>
        <p className="text-gray-400 text-sm">Hoe wil je spelers betrekken en belonen? Je kunt dit later aanpassen via Teaminstellingen.</p>
      </div>

      <div className="space-y-3">
        {MODES.map(({ mode, icon, title, subtitle, features, noFeatures, preview }) => {
          const selected = playerCardMode === mode;
          return (
            <button
              key={mode}
              onClick={() => onSelectMode(mode)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                selected
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
              }`}
            >
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-lg">{icon}</span>
                    <span className="font-black text-base">{title}</span>
                    {selected && <span className="ml-auto text-yellow-400 text-sm">✓</span>}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">{subtitle}</div>
                  <div className="space-y-0.5">
                    {features.map(f => (
                      <div key={f} className="text-xs text-gray-300">✓ {f}</div>
                    ))}
                    {noFeatures.map(f => (
                      <div key={f} className="text-xs text-gray-500">✗ {f}</div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 pt-1">{preview}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* SPDW sub-toggle — alleen zichtbaar bij competitive */}
      {playerCardMode === 'competitive' && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <label className="flex items-center gap-3 cursor-pointer" onClick={onToggleSpdw}>
            <button
              role="switch"
              aria-checked={spdwEnabled}
              className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors focus:outline-none ${
                spdwEnabled ? 'bg-yellow-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  spdwEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div>
              <div className="text-sm font-medium">🏆 Speler van de Week</div>
              <div className="text-xs text-gray-400">Spelers stemmen na elke wedstrijd op hun beste teamgenoot. Top 3 ontvangt extra credits.</div>
            </div>
          </label>
        </div>
      )}

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
