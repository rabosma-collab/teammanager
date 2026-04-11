'use client';

import React, { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ParsedMatch {
  date: string;
  opponent: string;
  home_away: 'Thuis' | 'Uit';
  error?: string;
}

const HOME_ALIASES: Record<string, 'Thuis' | 'Uit'> = {
  'thuis': 'Thuis', 'home': 'Thuis', 'h': 'Thuis', 't': 'Thuis',
  'uit': 'Uit', 'away': 'Uit', 'a': 'Uit', 'u': 'Uit',
};

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function parseCsvMatches(text: string): ParsedMatch[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const dataLines =
    lines[0]?.toLowerCase().includes('datum') || lines[0]?.toLowerCase().includes('tegen')
      ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const cols = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());
    const rawDate = cols[0] ?? '';
    const opponent = cols[1]?.trim() ?? '';
    const rawHA = (cols[2] ?? 'thuis').trim().toLowerCase();
    const date = parseDate(rawDate);
    const home_away = HOME_ALIASES[rawHA] ?? 'Thuis';
    if (!date) return { date: rawDate, opponent, home_away, error: `Ongeldige datum: "${rawDate}"` };
    if (!opponent) return { date: date, opponent: '(leeg)', home_away, error: 'Tegenstander ontbreekt' };
    return { date, opponent, home_away };
  });
}

interface ImportMatchesModalProps {
  teamId: string;
  defaultFormation: string;
  seasonId: number | null;
  onImported: () => void;
  onClose: () => void;
}

export default function ImportMatchesModal({ teamId, defaultFormation, seasonId, onImported, onClose }: ImportMatchesModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const suppressCloseRef = useRef(false);
  const [parsed, setParsed] = useState<ParsedMatch[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const validMatches = parsed?.filter(m => !m.error) ?? [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value so the same file can be re-selected
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      setParsed(parseCsvMatches(ev.target?.result as string));
      setImported(false);
      setImportError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!validMatches.length) return;
    setImporting(true);
    setImportError(null);
    const rows = validMatches.map(m => ({
      team_id: teamId,
      date: m.date,
      opponent: m.opponent,
      home_away: m.home_away,
      formation: defaultFormation,
      match_status: 'concept',
      season_id: seasonId,
    }));
    const { error } = await supabase.from('matches').insert(rows);
    setImporting(false);
    if (error) {
      setImportError('Fout bij importeren: ' + error.message);
      return;
    }
    setImported(true);
    onImported();
  };

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { if (!suppressCloseRef.current) onClose(); }}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">📂 Wedstrijden importeren</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-lg leading-none">✕</button>
        </div>

        {!imported ? (
          <div className="space-y-4">
            {/* Drop zone — label wraps input for mobile-safe file picking */}
            <label
              className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition block"
              onMouseDown={() => { suppressCloseRef.current = true; setTimeout(() => { suppressCloseRef.current = false; }, 2000); }}
              onTouchStart={() => { suppressCloseRef.current = true; setTimeout(() => { suppressCloseRef.current = false; }, 2000); }}
            >
              <div className="text-3xl mb-2">📂</div>
              <div className="font-medium text-gray-300">Klik om een CSV-bestand te kiezen</div>
              <div className="text-xs text-gray-500 mt-1">Kolommen: datum, tegenstander, thuis/uit</div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="sr-only" />
            </label>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">Voorbeeld CSV bekijken</summary>
              <pre className="mt-2 p-3 bg-gray-900 rounded-lg text-gray-400 overflow-x-auto">{`datum,tegenstander,thuis_uit\n2025-03-15,FC Amsterdam,thuis\n2025-03-22,SC Zwolle,uit\n15-04-2025,Ajax,thuis`}</pre>
            </details>

            {parsed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400 font-bold">{validMatches.length} geldig</span>
                  {parsed.filter(m => m.error).length > 0 && (
                    <span className="text-red-400 font-bold">· {parsed.filter(m => m.error).length} met fout</span>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {parsed.map((m, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${m.error ? 'bg-red-900/20 border border-red-700/50' : 'bg-gray-700/50'}`}>
                      <div>
                        <span className={m.error ? 'text-red-300' : 'text-white'}>{m.opponent}</span>
                        {!m.error && <span className="text-gray-400 ml-2">{formatDate(m.date)}</span>}
                      </div>
                      <span className={m.error ? 'text-red-400 text-xs' : 'text-gray-500 text-xs'}>
                        {m.error ?? (m.home_away === 'Thuis' ? '🏠' : '✈️')}
                      </span>
                    </div>
                  ))}
                </div>

                {importError && (
                  <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{importError}</div>
                )}

                {validMatches.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                  >
                    {importing ? 'Bezig…' : `Importeer ${validMatches.length} wedstrijd${validMatches.length !== 1 ? 'en' : ''}`}
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
              ✅ {validMatches.length} wedstrijd{validMatches.length !== 1 ? 'en' : ''} geïmporteerd!
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
