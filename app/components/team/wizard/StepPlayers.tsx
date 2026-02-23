'use client';

import React, { useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface ParsedPlayer {
  name: string;
  position: string;
  error?: string;
}

// Mapping van aliassen naar officiele positienamen
const POSITION_ALIASES: Record<string, string> = {
  'keeper': 'Keeper', 'gk': 'Keeper', 'goalkeeper': 'Keeper', 'doelman': 'Keeper', 'k': 'Keeper',
  'verdediger': 'Verdediger', 'def': 'Verdediger', 'defender': 'Verdediger', 'back': 'Verdediger', 'v': 'Verdediger',
  'middenvelder': 'Middenvelder', 'mid': 'Middenvelder', 'midfielder': 'Middenvelder', 'm': 'Middenvelder',
  'aanvaller': 'Aanvaller', 'fwd': 'Aanvaller', 'forward': 'Aanvaller', 'spits': 'Aanvaller', 'att': 'Aanvaller', 'a': 'Aanvaller',
};

function mapPosition(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return POSITION_ALIASES[lower] ?? '';
}

function parseCsv(text: string): ParsedPlayer[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Detecteer separator (komma of puntkomma)
  const sep = lines[0]?.includes(';') ? ';' : ',';

  // Sla header over als eerste rij lijkt op een header
  const dataLines = lines[0]?.toLowerCase().includes('naam') ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
    const name = cols[0] ?? '';
    const rawPos = cols[1] ?? '';
    const position = mapPosition(rawPos);

    if (!name) return { name: '(leeg)', position: '', error: 'Naam ontbreekt' };
    if (!position) return { name, position: rawPos, error: `Onbekende positie: "${rawPos}"` };
    return { name, position };
  });
}

interface Props {
  teamId: string;
  onNext: () => void;
  onSkip: () => void;
  onPlayersImported: (count: number) => void;
}

export default function StepPlayers({ teamId, onNext, onSkip, onPlayersImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPlayer[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParsed(parseCsv(text));
      setImported(false);
      setImportError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const validPlayers = parsed?.filter(p => !p.error) ?? [];
  const errorPlayers = parsed?.filter(p => p.error) ?? [];

  const handleImport = async () => {
    if (!validPlayers.length) return;
    setImporting(true);
    setImportError(null);

    const rows = validPlayers.map(p => ({
      team_id: teamId,
      name: p.name,
      position: p.position,
      goals: 0,
      assists: 0,
      min: 0,
      wash_count: 0,
      yellow_cards: 0,
      red_cards: 0,
      injured: false,
      pac: 70, sho: 70, pas: 70, dri: 70, def: 70,
    }));

    const { error } = await supabase.from('players').insert(rows);
    setImporting(false);

    if (error) {
      setImportError('Fout bij importeren: ' + error.message);
      return;
    }

    setImported(true);
    onPlayersImported(validPlayers.length);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelers toevoegen</h2>
        <p className="text-gray-400 text-sm">
          Importeer je selectie via CSV, of nodig spelers later uit via Beheer → Uitnodigingen.
        </p>
      </div>

      {/* CSV import */}
      <div className="space-y-3">
        <div
          className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition"
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-3xl mb-2">📂</div>
          <div className="font-medium text-gray-300">Klik om een CSV-bestand te kiezen</div>
          <div className="text-xs text-gray-500 mt-1">Formaat: naam, positie (per rij)</div>
          <div className="text-xs text-gray-500">Posities: Keeper, Verdediger, Middenvelder, Aanvaller</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="hidden"
        />

        {/* Voorbeeld */}
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-400">Voorbeeld CSV bekijken</summary>
          <pre className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-400 overflow-x-auto">
{`naam,positie
Jan Jansen,Verdediger
Piet Pietersen,Aanvaller
Klaas Klaassen,Middenvelder
Thomas Keeper,Keeper`}
          </pre>
        </details>
      </div>

      {/* Parse resultaat */}
      {parsed && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-400 font-bold">{validPlayers.length} geldig</span>
            {errorPlayers.length > 0 && (
              <span className="text-red-400 font-bold">· {errorPlayers.length} met fout</span>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {parsed.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  p.error ? 'bg-red-900/20 border border-red-700/50' : 'bg-gray-700/50'
                }`}
              >
                <span className={p.error ? 'text-red-300' : 'text-white'}>{p.name}</span>
                <span className={p.error ? 'text-red-400 text-xs' : 'text-gray-400'}>
                  {p.error ?? p.position}
                </span>
              </div>
            ))}
          </div>

          {importError && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {importError}
            </div>
          )}

          {!imported && validPlayers.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
            >
              {importing ? 'Bezig...' : `Importeer ${validPlayers.length} speler${validPlayers.length !== 1 ? 's' : ''}`}
            </button>
          )}

          {imported && (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm font-medium">
              ✅ {validPlayers.length} speler{validPlayers.length !== 1 ? 's' : ''} geïmporteerd!
            </div>
          )}
        </div>
      )}

      {/* Info uitnodigingen */}
      <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-xl text-sm text-blue-300">
        <p className="font-medium mb-0.5">📨 Spelers uitnodigen</p>
        <p className="text-blue-400 text-xs">Na het aanmaken van het team kan je via Beheer → Uitnodigingen persoonlijke uitnodigingslinks versturen.</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95"
        >
          Doorgaan →
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
