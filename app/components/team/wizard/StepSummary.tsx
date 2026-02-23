'use client';

import React from 'react';
import { formationLabels } from '../../../lib/constants';

interface SummaryData {
  name: string;
  color: string;
  formation: string;
  playersImported: number;
  matchCreated: boolean;
  settingsDone: boolean;
}

interface Props {
  data: SummaryData;
  onFinish: () => void;
  isLoading: boolean;
}

export default function StepSummary({ data, onFinish, isLoading }: Props) {
  const rows: Array<{ label: string; value: string; done: boolean }> = [
    {
      label: 'Team aangemaakt',
      value: data.name,
      done: true,
    },
    {
      label: 'Formatie ingesteld',
      value: data.formation ? (formationLabels[data.formation] ?? data.formation) : '—',
      done: !!data.formation,
    },
    {
      label: 'Statistieken geconfigureerd',
      value: data.settingsDone ? 'Ingesteld' : 'Overgeslagen',
      done: data.settingsDone,
    },
    {
      label: 'Spelers geïmporteerd',
      value: data.playersImported > 0 ? `${data.playersImported} speler${data.playersImported !== 1 ? 's' : ''}` : 'Geen',
      done: data.playersImported > 0,
    },
    {
      label: 'Eerste wedstrijd',
      value: data.matchCreated ? 'Ingepland' : 'Overgeslagen',
      done: data.matchCreated,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Klaar! 🎉</h2>
        <p className="text-gray-400 text-sm">Je team is aangemaakt. Hier is een overzicht:</p>
      </div>

      {/* Team badge */}
      <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl">
        <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: data.color }} />
        <span className="font-black text-lg">{data.name}</span>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2.5 px-3 bg-gray-700/30 rounded-lg">
            <span className="text-sm text-gray-300">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{row.value}</span>
              <span className={row.done ? 'text-green-400' : 'text-gray-600'}>
                {row.done ? '✅' : '➖'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Je kan alles daarna wijzigen via Beheer → Teaminstellingen.
      </p>

      <button
        onClick={onFinish}
        disabled={isLoading}
        className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl text-base transition active:scale-95"
      >
        {isLoading ? 'Laden...' : '🏠 Open mijn team'}
      </button>
    </div>
  );
}
