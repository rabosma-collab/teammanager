'use client';

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface MatchRow {
  date: string;
  opponent: string;
  home_away: 'Thuis' | 'Uit';
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

interface ParsedMatch extends MatchRow {
  error?: string;
}


function parseCsvMatches(text: string): ParsedMatch[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const dataLines = lines[0]?.toLowerCase().includes('datum') || lines[0]?.toLowerCase().includes('tegen')
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

type Mode = 'choice' | 'manual' | 'csv';

interface Props {
  teamId: string;
  defaultFormation: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onMatchCreated: () => void;
}

export default function StepMatch({ teamId, defaultFormation, onNext, onBack, onSkip, onMatchCreated }: Props) {
  const [mode, setMode] = useState<Mode>('choice');

  // ── Handmatig ─────────────────────────────────────────────
  const [date, setDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [homeAway, setHomeAway] = useState<'Thuis' | 'Uit'>('Thuis');
  const [matchList, setMatchList] = useState<MatchRow[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ── CSV ───────────────────────────────────────────────────
  const [csvParsed, setCsvParsed] = useState<ParsedMatch[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImported, setCsvImported] = useState(false);

  const validCsvMatches = csvParsed?.filter(m => !m.error) ?? [];

  const handleAddMatch = () => {
    if (!date) { setAddError('Kies een datum'); return; }
    if (!opponent.trim()) { setAddError('Vul een tegenstander in'); return; }
    setMatchList(prev => [...prev, { date, opponent: opponent.trim(), home_away: homeAway }]);
    setOpponent('');
    setDate('');
    setAddError(null);
  };

  const handleSaveMatches = async () => {
    if (!matchList.length) return;
    setSaving(true);
    setSaveError(null);
    const rows = matchList.map(m => ({
      team_id: teamId, date: m.date, opponent: m.opponent,
      home_away: m.home_away, formation: defaultFormation,
      match_status: 'concept', substitution_scheme_id: null,
    }));
    const { error } = await supabase.from('matches').insert(rows);
    setSaving(false);
    if (error) { setSaveError('Kon wedstrijden niet aanmaken: ' + error.message); return; }
    setSaved(true);
    onMatchCreated();
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      setCsvParsed(parseCsvMatches(ev.target?.result as string));
      setCsvImported(false);
      setCsvError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportCsv = async (): Promise<boolean> => {
    if (!validCsvMatches.length) return true;
    setCsvImporting(true);
    setCsvError(null);
    const rows = validCsvMatches.map(m => ({
      team_id: teamId, date: m.date, opponent: m.opponent,
      home_away: m.home_away, formation: defaultFormation,
      match_status: 'concept', substitution_scheme_id: null,
    }));
    const { error } = await supabase.from('matches').insert(rows);
    setCsvImporting(false);
    if (error) { setCsvError('Fout bij importeren: ' + error.message); return false; }
    setCsvImported(true);
    onMatchCreated();
    return true;
  };

  const handleNext = async (importFn?: () => Promise<boolean>) => {
    if (importFn) {
      const ok = await importFn();
      if (!ok) return;
    }
    onNext();
  };

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Wedstrijden inplannen</h2>
        <p className="text-gray-400 text-sm">Plan je eerste wedstrijd(en) in. Je kunt dit ook later toevoegen via Beheer → Wedstrijden.</p>
      </div>

      {/* ── Keuzescherm ── */}
      {mode === 'choice' && (
        <div className="space-y-3">
          <button
            onClick={() => setMode('manual')}
            className="w-full p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 rounded-xl text-left transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✍️</span>
              <div>
                <div className="font-bold">Handmatig invoeren</div>
                <div className="text-sm text-gray-400">Voeg één of meerdere wedstrijden toe via een formulier</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode('csv')}
            className="w-full p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 rounded-xl text-left transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📂</span>
              <div>
                <div className="font-bold">Importeren via CSV</div>
                <div className="text-sm text-gray-400">Upload een bestand met het volledige speelschema</div>
              </div>
            </div>
          </button>

          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
              ← Vorige
            </button>
            <button onClick={onNext} className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">
              Doorgaan →
            </button>
            <button onClick={onSkip} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
              Sla over
            </button>
          </div>
        </div>
      )}

      {/* ── Handmatig ── */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choice')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
            ← Terug
          </button>

          {!saved && (
            <div className="space-y-3 p-4 bg-gray-700/40 rounded-xl border border-gray-600">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Datum</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Thuis / Uit</label>
                  <div className="flex gap-1.5">
                    {(['Thuis', 'Uit'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setHomeAway(opt)}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                          homeAway === opt ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {opt === 'Thuis' ? '🏠' : '✈️'} {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tegenstander</label>
                <input
                  type="text"
                  value={opponent}
                  onChange={e => setOpponent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMatch()}
                  placeholder="bijv. FC Utrecht"
                  maxLength={60}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
              {addError && <p className="text-red-400 text-xs">{addError}</p>}
              <button onClick={handleAddMatch} className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg text-sm transition">
                + Toevoegen
              </button>
            </div>
          )}

          {matchList.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 font-medium">
                {matchList.length} wedstrijd{matchList.length !== 1 ? 'en' : ''} in de lijst
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {matchList.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{m.opponent}</span>
                      <span className="text-gray-400 ml-2">{formatDate(m.date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{m.home_away === 'Thuis' ? '🏠' : '✈️'}</span>
                      {!saved && (
                        <button onClick={() => setMatchList(prev => prev.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400 transition">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {saveError && <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{saveError}</div>}

          {saved ? (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-xl text-green-300 text-sm font-medium">
              ✅ {matchList.length} wedstrijd{matchList.length !== 1 ? 'en' : ''} aangemaakt!
            </div>
          ) : matchList.length > 0 && (
            <button
              onClick={handleSaveMatches}
              disabled={saving}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
            >
              {saving ? 'Opslaan...' : `Sla ${matchList.length} wedstrijd${matchList.length !== 1 ? 'en' : ''} op`}
            </button>
          )}

          <button onClick={onNext} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">
            Doorgaan →
          </button>
        </div>
      )}

      {/* ── CSV ── */}
      {mode === 'csv' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choice')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
            ← Terug
          </button>

          <label className="block border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition">
            <div className="text-3xl mb-2">📂</div>
            <div className="font-medium text-gray-300">Klik om een CSV-bestand te kiezen</div>
            <div className="text-xs text-gray-500 mt-1">Kolommen: datum, tegenstander, thuis/uit</div>
            <input type="file" accept=".csv,.txt" onChange={handleCsvFile} className="sr-only" />
          </label>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-400">Voorbeeld CSV bekijken</summary>
            <pre className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-400 overflow-x-auto">{`datum,tegenstander,thuis_uit\n2025-03-15,FC Amsterdam,thuis\n2025-03-22,SC Zwolle,uit\n15-04-2025,Ajax,thuis`}</pre>
          </details>

          {csvParsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold">{validCsvMatches.length} geldig</span>
                {csvParsed.filter(m => m.error).length > 0 && (
                  <span className="text-red-400 font-bold">· {csvParsed.filter(m => m.error).length} met fout</span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {csvParsed.map((m, i) => (
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
              {csvError && <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{csvError}</div>}
              {csvImported ? (
                <div className="p-3 bg-green-900/30 border border-green-700 rounded-xl text-green-300 text-sm font-medium">
                  ✅ {validCsvMatches.length} wedstrijd{validCsvMatches.length !== 1 ? 'en' : ''} geïmporteerd!
                </div>
              ) : validCsvMatches.length > 0 && (
                <button
                  onClick={handleImportCsv}
                  disabled={csvImporting}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                >
                  {csvImporting ? 'Bezig...' : `Importeer ${validCsvMatches.length} wedstrijd${validCsvMatches.length !== 1 ? 'en' : ''}`}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => handleNext(validCsvMatches.length > 0 && !csvImported ? handleImportCsv : undefined)}
            disabled={csvImporting}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl transition active:scale-95"
          >
            {csvImporting ? 'Bezig met importeren...' : 'Doorgaan →'}
          </button>
        </div>
      )}
    </div>
  );
}
