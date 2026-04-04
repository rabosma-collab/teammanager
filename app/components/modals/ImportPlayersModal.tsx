'use client';

import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ParsedPlayer {
  name: string;
  position: string;
  error?: string;
}

const POSITION_ALIASES: Record<string, string> = {
  'keeper': 'Keeper', 'gk': 'Keeper', 'goalkeeper': 'Keeper', 'doelman': 'Keeper', 'k': 'Keeper',
  'verdediger': 'Verdediger', 'def': 'Verdediger', 'defender': 'Verdediger', 'back': 'Verdediger', 'v': 'Verdediger',
  'middenvelder': 'Middenvelder', 'mid': 'Middenvelder', 'midfielder': 'Middenvelder', 'm': 'Middenvelder',
  'aanvaller': 'Aanvaller', 'fwd': 'Aanvaller', 'forward': 'Aanvaller', 'spits': 'Aanvaller', 'att': 'Aanvaller', 'a': 'Aanvaller',
};

function mapPosition(raw: string): string {
  return POSITION_ALIASES[raw.trim().toLowerCase()] ?? '';
}

function parseCsv(text: string): ParsedPlayer[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
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

interface ImportPlayersModalProps {
  teamId: string;
  onImported: () => void;
  onClose: () => void;
}

export default function ImportPlayersModal({ teamId, onImported, onClose }: ImportPlayersModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPlayer[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const validPlayers = parsed?.filter(p => !p.error) ?? [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      setParsed(parseCsv(ev.target?.result as string));
      setImported(false);
      setImportError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!validPlayers.length) return;
    setImporting(true);
    setImportError(null);
    const rows = validPlayers.map(p => ({
      team_id: teamId,
      name: p.name,
      position: p.position,
      goals: 0, assists: 0, min: 0, wash_count: 0,
      yellow_cards: 0, red_cards: 0, injured: false,
      pac: 70, sho: 70, pas: 70, dri: 70, def: 70,
    }));
    const { error } = await supabase.from('players').insert(rows);
    setImporting(false);
    if (error) {
      setImportError('Fout bij importeren: ' + error.message);
      return;
    }
    setImported(true);
    onImported();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">📂 Spelers importeren</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-lg leading-none">✕</button>
        </div>

        {!imported ? (
          <div className="space-y-4">
            <label className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition block">
              <div className="text-3xl mb-2">📂</div>
              <div className="font-medium text-gray-300">Klik om een CSV-bestand te kiezen</div>
              <div className="text-xs text-gray-500 mt-1">Kolommen: naam, positie</div>
              <div className="text-xs text-gray-500">Posities: Keeper, Verdediger, Middenvelder, Aanvaller</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="sr-only" />
            </label>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">Voorbeeld CSV bekijken</summary>
              <pre className="mt-2 p-3 bg-gray-900 rounded-lg text-gray-400 overflow-x-auto">{`naam,positie\nJan Jansen,Verdediger\nPiet Pietersen,Aanvaller\nKlaas Klaassen,Middenvelder\nThomas Keeper,Keeper`}</pre>
            </details>

            {parsed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 font-bold">{validPlayers.length} geldig</span>
                  {parsed.filter(p => p.error).length > 0 && (
                    <span className="text-red-400 font-bold">· {parsed.filter(p => p.error).length} met fout</span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {parsed.map((p, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${p.error ? 'bg-red-900/20 border border-red-700/50' : 'bg-gray-700/50'}`}>
                      <span className={p.error ? 'text-red-300' : 'text-white'}>{p.name}</span>
                      <span className={p.error ? 'text-red-400 text-xs' : 'text-gray-400'}>{p.error ?? p.position}</span>
                    </div>
                  ))}
                </div>

                {importError && (
                  <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{importError}</div>
                )}

                {validPlayers.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                  >
                    {importing ? 'Bezig…' : `Importeer ${validPlayers.length} speler${validPlayers.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-gray-200 text-sm transition"
            >
              Annuleren
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-xl text-green-300 text-sm font-medium text-center">
              ✅ {validPlayers.length} speler{validPlayers.length !== 1 ? 's' : ''} geïmporteerd!
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-sm transition"
            >
              Sluiten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
