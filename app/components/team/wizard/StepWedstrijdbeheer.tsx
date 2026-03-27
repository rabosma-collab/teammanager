'use client';

import React from 'react';
import type { TeamSettings } from '../../../lib/types';

type WedstrijdState = Pick<TeamSettings,
  'track_wasbeurt' | 'track_consumpties' | 'track_vervoer' | 'vervoer_count' |
  'track_assembly_time' | 'track_match_time' | 'track_location_details'
>;

interface Props {
  settings: WedstrijdState;
  onToggle: (key: keyof WedstrijdState) => void;
  onVervoerCountChange: (count: number) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const WEDSTRIJDINFO = [
  { key: 'track_assembly_time'    as keyof WedstrijdState, label: '🕐 Verzameltijd',        description: 'Noteer hoe laat spelers aanwezig moeten zijn' },
  { key: 'track_match_time'       as keyof WedstrijdState, label: '⚽ Speeltijd (aanvang)',  description: 'Noteer hoe laat de wedstrijd begint' },
  { key: 'track_location_details' as keyof WedstrijdState, label: '📍 Verzamellocatie', description: 'Noteer de verzamellocatie of kleedkamernummer' },
];

const WEDSTRIJDTAKEN = [
  { key: 'track_wasbeurt'    as keyof WedstrijdState, label: '🧺 Wasbeurt',    description: 'Wijs per wedstrijd een speler aan voor de was' },
  { key: 'track_consumpties' as keyof WedstrijdState, label: '🥤 Consumpties', description: 'Wijs per wedstrijd een speler aan voor de consumpties' },
  { key: 'track_vervoer'     as keyof WedstrijdState, label: '🚗 Vervoer',     description: 'Wijs per wedstrijd spelers aan die het vervoer regelen' },
];

function ToggleRow({ label, description, checked, onToggle }: {
  label: string; description: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-700 transition">
      <button
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors focus:outline-none ${checked ? 'bg-yellow-500' : 'bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-400">{description}</div>
      </div>
    </label>
  );
}

export default function StepWedstrijdbeheer({ settings, onToggle, onVervoerCountChange, onNext, onBack, onSkip }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Wedstrijdbeheer</h2>
        <p className="text-gray-400 text-sm">Kies welke extra informatie je per wedstrijd bijhoudt. Aanpasbaar via Teaminstellingen.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wedstrijdinfo</p>
          <p className="text-xs text-gray-500">Informatie die je vastlegt bij het aanmaken van een wedstrijd.</p>
          {WEDSTRIJDINFO.map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
              checked={settings[key] as boolean}
              onToggle={() => onToggle(key)}
            />
          ))}
        </div>

        <div className="border-t border-gray-700" />

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wedstrijdtaken</p>
          <p className="text-xs text-gray-500">Taken die je toewijst bij het maken van de opstelling.</p>
          {WEDSTRIJDTAKEN.map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
              checked={settings[key] as boolean}
              onToggle={() => onToggle(key)}
            />
          ))}
          {settings.track_vervoer && (
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-700/30 rounded-xl ml-2">
              <span className="text-sm text-gray-400 flex-1">Aantal chauffeurs</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onVervoerCountChange(Math.max(1, (settings.vervoer_count ?? 3) - 1))}
                  className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500 text-white font-bold text-sm flex items-center justify-center transition"
                >−</button>
                <span className="text-white font-bold text-sm w-4 text-center">{settings.vervoer_count ?? 3}</span>
                <button
                  onClick={() => onVervoerCountChange(Math.min(6, (settings.vervoer_count ?? 3) + 1))}
                  className="w-7 h-7 rounded bg-gray-600 hover:bg-gray-500 text-white font-bold text-sm flex items-center justify-center transition"
                >+</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
          ← Vorige
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95"
        >
          Opslaan & doorgaan →
        </button>
        <button onClick={onSkip} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
          Sla over
        </button>
      </div>
    </div>
  );
}
