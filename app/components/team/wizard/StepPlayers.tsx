'use client';

import React, { useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

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

const POSITIONS = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'] as const;

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

function buildRows(players: { name: string; position: string }[], teamId: string) {
  return players.map(p => ({
    team_id: teamId, name: p.name, position: p.position,
    goals: 0, assists: 0, min: 0, wash_count: 0,
    yellow_cards: 0, red_cards: 0, injured: false,
    pac: 70, sho: 70, pas: 70, dri: 70, def: 70,
  }));
}

type Mode = 'choice' | 'manual' | 'csv';

interface Props {
  teamId: string;
  onNext: () => void;
  onSkip: () => void;
  onPlayersImported: (count: number) => void;
}

export default function StepPlayers({ teamId, onNext, onSkip, onPlayersImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('choice');

  // ── Handmatig ─────────────────────────────────────────────
  const [manualName, setManualName] = useState('');
  const [manualPosition, setManualPosition] = useState<typeof POSITIONS[number]>('Aanvaller');
  const [manualList, setManualList] = useState<{ name: string; position: string }[]>([]);
  const [manualImporting, setManualImporting] = useState(false);
  const [manualImported, setManualImported] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ── CSV ───────────────────────────────────────────────────
  const [parsed, setParsed] = useState<ParsedPlayer[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImported, setCsvImported] = useState(false);

  const validCsvPlayers = parsed?.filter(p => !p.error) ?? [];

  const handleAddManual = () => {
    const trimmed = manualName.trim();
    if (!trimmed) { setManualError('Naam is verplicht'); return; }
    if (trimmed.length < 2) { setManualError('Naam moet minimaal 2 tekens zijn'); return; }
    setManualList(prev => [...prev, { name: trimmed, position: manualPosition }]);
    setManualName('');
    setManualError(null);
  };

  const handleImportManual = async () => {
    if (!manualList.length) return;
    setManualImporting(true);
    setManualError(null);
    const { error } = await supabase.from('players').insert(buildRows(manualList, teamId));
    setManualImporting(false);
    if (error) { setManualError('Fout bij opslaan: ' + error.message); return; }
    setManualImported(true);
    onPlayersImported(manualList.length);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setParsed(parseCsv(ev.target?.result as string));
      setCsvImported(false);
      setCsvImportError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportCsv = async () => {
    if (!validCsvPlayers.length) return;
    setCsvImporting(true);
    setCsvImportError(null);
    const { error } = await supabase.from('players').insert(buildRows(validCsvPlayers, teamId));
    setCsvImporting(false);
    if (error) { setCsvImportError('Fout bij importeren: ' + error.message); return; }
    setCsvImported(true);
    onPlayersImported(validCsvPlayers.length);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelers toevoegen</h2>
        <p className="text-gray-400 text-sm">Voeg je selectie toe via een formulier of importeer via CSV.</p>
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
                <div className="text-sm text-gray-400">Voeg spelers één voor één toe via een formulier</div>
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
                <div className="text-sm text-gray-400">Upload een bestand met alle spelers tegelijk</div>
              </div>
            </div>
          </button>

          <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-xl text-sm text-blue-300">
            <p className="font-medium mb-0.5">📨 Spelers uitnodigen</p>
            <p className="text-blue-400 text-xs">Na het aanmaken kan je via Beheer → Uitnodigingen persoonlijke uitnodigingslinks versturen.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={onNext} className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">
              Doorgaan →
            </button>
            <button onClick={onSkip} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
              Sla over
            </button>
          </div>
        </div>
      )}

      {/* ── Handmatig invoeren ── */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choice')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
            ← Terug
          </button>

          {!manualImported && (
            <div className="space-y-3 p-4 bg-gray-700/40 rounded-xl border border-gray-600">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Naam</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  placeholder="bijv. Jan Jansen"
                  maxLength={50}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Positie</label>
                <div className="flex gap-2 flex-wrap">
                  {POSITIONS.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setManualPosition(pos)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        manualPosition === pos
                          ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                          : 'border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              {manualError && <p className="text-red-400 text-xs">{manualError}</p>}
              <button
                onClick={handleAddManual}
                className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg text-sm transition"
              >
                + Toevoegen
              </button>
            </div>
          )}

          {manualList.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 font-medium">
                {manualList.length} speler{manualList.length !== 1 ? 's' : ''} in de lijst
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {manualList.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm">
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{p.position}</span>
                      {!manualImported && (
                        <button onClick={() => setManualList(prev => prev.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400 transition">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {manualImported ? (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm font-medium">
              ✅ {manualList.length} speler{manualList.length !== 1 ? 's' : ''} opgeslagen!
            </div>
          ) : manualList.length > 0 && (
            <button
              onClick={handleImportManual}
              disabled={manualImporting}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
            >
              {manualImporting ? 'Bezig...' : `Sla ${manualList.length} speler${manualList.length !== 1 ? 's' : ''} op`}
            </button>
          )}

          <button onClick={onNext} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">
            Doorgaan →
          </button>
        </div>
      )}

      {/* ── CSV import ── */}
      {mode === 'csv' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choice')} className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
            ← Terug
          </button>

          <div
            className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-2">📂</div>
            <div className="font-medium text-gray-300">Klik om een CSV-bestand te kiezen</div>
            <div className="text-xs text-gray-500 mt-1">Formaat: naam, positie (per rij)</div>
            <div className="text-xs text-gray-500">Posities: Keeper, Verdediger, Middenvelder, Aanvaller</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-400">Voorbeeld CSV bekijken</summary>
            <pre className="mt-2 p-3 bg-gray-800 rounded-lg text-gray-400 overflow-x-auto">{`naam,positie\nJan Jansen,Verdediger\nPiet Pietersen,Aanvaller\nKlaas Klaassen,Middenvelder\nThomas Keeper,Keeper`}</pre>
          </details>

          {parsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold">{validCsvPlayers.length} geldig</span>
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
              {csvImportError && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">{csvImportError}</div>
              )}
              {csvImported ? (
                <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm font-medium">
                  ✅ {validCsvPlayers.length} speler{validCsvPlayers.length !== 1 ? 's' : ''} geïmporteerd!
                </div>
              ) : validCsvPlayers.length > 0 && (
                <button
                  onClick={handleImportCsv}
                  disabled={csvImporting}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                >
                  {csvImporting ? 'Bezig...' : `Importeer ${validCsvPlayers.length} speler${validCsvPlayers.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}

          <button onClick={onNext} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">
            Doorgaan →
          </button>
        </div>
      )}
    </div>
  );
}
