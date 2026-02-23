'use client';

import React from 'react';
import type { TeamSettings } from '../../../lib/types';

const SETTINGS_ITEMS: Array<{ key: keyof TeamSettings; label: string; description: string }> = [
  { key: 'track_goals',        label: '⚽ Doelpunten',           description: 'Bijhouden hoeveel goals elke speler scoort' },
  { key: 'track_assists',      label: '🎯 Assists',              description: 'Bijhouden hoeveel assists elke speler geeft' },
  { key: 'track_minutes',      label: '⏱️ Speeltijd',            description: 'Bankminuten berekenen bij afsluiten wedstrijd' },
  { key: 'track_spdw',         label: '🏆 SPDW',                 description: 'Speler van de week stemmen en bijhouden' },
  { key: 'track_results',      label: '📊 Uitslagen',            description: 'Wedstrijdscores bijhouden en tonen' },
  { key: 'track_cards',        label: '🟨 Kaarten',              description: 'Gele en rode kaarten bijhouden' },
  { key: 'track_clean_sheets', label: '🧤 Clean sheets',         description: 'Bijhouden wanneer de keeper geen goal slikt' },
];

type SettingsState = Pick<TeamSettings,
  'track_goals' | 'track_assists' | 'track_minutes' | 'track_spdw' |
  'track_results' | 'track_cards' | 'track_clean_sheets'
>;

interface Props {
  settings: SettingsState;
  onToggle: (key: keyof SettingsState) => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function StepSettings({ settings, onToggle, onNext, onSkip }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Statistieken bijhouden</h2>
        <p className="text-gray-400 text-sm">Kies wat je wil bijhouden. Alles kan je later aanpassen via Teaminstellingen.</p>
      </div>

      <div className="space-y-2">
        {SETTINGS_ITEMS.map(({ key, label, description }) => (
          <label
            key={key}
            className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-700 transition"
          >
            <button
              role="switch"
              aria-checked={settings[key as keyof SettingsState] as boolean}
              onClick={() => onToggle(key as keyof SettingsState)}
              className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors focus:outline-none ${
                settings[key as keyof SettingsState] ? 'bg-yellow-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings[key as keyof SettingsState] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-gray-400">{description}</div>
            </div>
          </label>
        ))}
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
