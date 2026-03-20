'use client';

import React from 'react';
import { formationLabels } from '../../../lib/constants';

interface SummaryData {
  name: string;
  color: string;
  gameFormat: string;
  formation: string;
  playersImported: number;
  matchCreated: boolean;
  settingsDone: boolean;
}

interface Props {
  data: SummaryData;
  onFinish: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function StepSummary({ data, onFinish, onBack, isLoading }: Props) {
  const rows: Array<{ label: string; value: string; done: boolean }> = [
    {
      label: 'Team aangemaakt',
      value: data.name,
      done: true,
    },
    {
      label: 'Formatie ingesteld',
      value: data.formation ? (formationLabels[data.gameFormat]?.[data.formation] ?? data.formation) : '—',
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
        <h2 className="text-xl font-black mb-1">Aanvraag ingediend ⏳</h2>
      </div>

      {/* Team badge */}
      <div className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-xl">
        <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: data.color }} />
        <span className="font-black text-lg">{data.name}</span>
      </div>

      <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-xl text-sm text-blue-200 leading-relaxed">
        Je teamaanvraag is ingediend bij de beheerder van de app. Op dit moment beperken we nog het aantal teams omdat de app nog in ontwikkeling is. Zodra je verzoek is goedgekeurd, kun je direct aan de slag. Je hoort het zodra dit het geval is.
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition disabled:opacity-50"
        >
          ← Vorige
        </button>
        <button
          onClick={onFinish}
          disabled={isLoading}
          className="flex-1 py-3.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-black rounded-xl text-base transition active:scale-95"
        >
          {isLoading ? 'Laden...' : 'Begrepen'}
        </button>
      </div>
    </div>
  );
}
