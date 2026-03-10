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

interface StaffSectionProps {
  staffName: string;
  staffList: string[];
  staffError: string | null;
  onNameChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}

function StaffSection({ staffName, staffList, staffError, onNameChange, onAdd, onRemove }: StaffSectionProps) {
  return (
    <div className="border-t border-gray-700 pt-4 space-y-3">
      <h3 className="text-sm font-bold text-gray-300">
        🧑‍💼 Stafleden toevoegen <span className="font-normal text-gray-500">(optioneel)</span>
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={staffName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onAdd()}
          placeholder="bijv. Jan Koets"
          maxLength={50}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500"
        />
        <button
          onClick={onAdd}
          disabled={staffName.trim().length < 2}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-40 rounded-lg text-sm font-bold transition"
        >
          + Toevoegen
        </button>
      </div>

      {staffList.length > 0 && (
        <div className="space-y-1">
          {staffList.map((name: string, i: number) => (
            <div key={`${name}-${i}`} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg text-sm">
              <span className="font-medium">{name}</span>
              <button
                onClick={() => onRemove(i)}
                className="text-gray-600 hover:text-red-400 transition"
              >
                ✕
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-500 pt-1">
            Na het aanmaken kun je de uitnodigingslinks kopiëren via Beheer → Spelers.
          </p>
        </div>
      )}

      {staffError && <p className="text-red-400 text-xs">{staffError}</p>}
    </div>
  );
}

type Mode = 'choice' | 'manual' | 'csv';

interface Props {
  teamId: string;
  currentUserId: string | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onPlayersImported: (count: number) => void;
}

export default function StepPlayers({ teamId, currentUserId, onNext, onBack, onSkip, onPlayersImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('choice');

  // ── Handmatig ─────────────────────────────────────────────
  const [manualName, setManualName] = useState('');
  const [manualPosition, setManualPosition] = useState<typeof POSITIONS[number]>('Aanvaller');
  const [manualList, setManualList] = useState<{ name: string; position: string }[]>([]);
  const [selfIndex, setSelfIndex] = useState<number | null>(null);
  const [manualImporting, setManualImporting] = useState(false);
  const [manualImported, setManualImported] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ── CSV ───────────────────────────────────────────────────
  const [parsed, setParsed] = useState<ParsedPlayer[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImported, setCsvImported] = useState(false);

  // ── Stafleden ─────────────────────────────────────────────
  const [staffName, setStaffName] = useState('');
  const [staffList, setStaffList] = useState<string[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const validCsvPlayers = parsed?.filter(p => !p.error) ?? [];

  const handleAddManual = () => {
    const trimmed = manualName.trim();
    if (!trimmed) { setManualError('Naam is verplicht'); return; }
    if (trimmed.length < 2) { setManualError('Naam moet minimaal 2 tekens zijn'); return; }
    setManualList(prev => [...prev, { name: trimmed, position: manualPosition }]);
    setManualName('');
    setManualError(null);
  };

  const handleImportManual = async (): Promise<boolean> => {
    if (!manualList.length) return true;
    setManualImporting(true);
    setManualError(null);
    const { data, error } = await supabase.from('players').insert(buildRows(manualList, teamId)).select('id, name');
    setManualImporting(false);
    if (error) { setManualError('Fout bij opslaan: ' + error.message); return false; }

    // Koppel de manager aan zijn eigen spelersrecord
    if (selfIndex !== null && currentUserId && data) {
      const selfPlayer = data[selfIndex] as { id: number; name: string } | undefined;
      if (selfPlayer) {
        await supabase
          .from('team_members')
          .update({ player_id: selfPlayer.id })
          .eq('team_id', teamId)
          .eq('user_id', currentUserId);
      }
    }

    setManualImported(true);
    onPlayersImported(manualList.length);
    return true;
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

  const handleImportCsv = async (): Promise<boolean> => {
    if (!validCsvPlayers.length) return true;
    setCsvImporting(true);
    setCsvImportError(null);
    const { error } = await supabase.from('players').insert(buildRows(validCsvPlayers, teamId));
    setCsvImporting(false);
    if (error) { setCsvImportError('Fout bij importeren: ' + error.message); return false; }
    setCsvImported(true);
    onPlayersImported(validCsvPlayers.length);
    return true;
  };

  const handleAddStaff = () => {
    const trimmed = staffName.trim();
    if (!trimmed || trimmed.length < 2) return;
    setStaffList((prev: string[]) => [...prev, trimmed]);
    setStaffName('');
    setStaffError(null);
  };

  const handleRemoveStaff = (i: number) => {
    setStaffList((prev: string[]) => prev.filter((_: string, j: number) => j !== i));
  };

  const saveStaff = async (): Promise<boolean> => {
    if (!staffList.length) return true;
    setStaffSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStaffSaving(false); return false; }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase.from('invite_tokens').insert(
      staffList.map((name: string) => ({
        team_id: teamId,
        player_id: null,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        invite_type: 'staff',
        display_name: name,
      }))
    );
    setStaffSaving(false);
    if (error) { setStaffError('Kon stafleden niet opslaan: ' + error.message); return false; }
    return true;
  };

  const handleNext = async (importFn?: () => Promise<boolean>) => {
    if (importFn) {
      const ok = await importFn();
      if (!ok) return;
    }
    const ok = await saveStaff();
    if (!ok) return;
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Spelers &amp; stafleden toevoegen</h2>
        <p className="text-gray-400 text-sm">Voeg je selectie toe via een formulier of importeer via CSV. Stafleden voeg je onderaan toe.</p>
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

          <StaffSection
            staffName={staffName}
            staffList={staffList}
            staffError={staffError}
            onNameChange={setStaffName}
            onAdd={handleAddStaff}
            onRemove={handleRemoveStaff}
          />

          <div className="flex gap-3">
            <button onClick={onBack} className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition">
              ← Vorige
            </button>
            <button
              onClick={() => handleNext()}
              disabled={staffSaving}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl transition active:scale-95"
            >
              {staffSaving ? 'Bezig...' : 'Doorgaan →'}
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
                  <div key={`${p.name}-${i}`} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selfIndex === i ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-gray-700/50'}`}>
                    <span className="font-medium">{p.name}{selfIndex === i && <span className="ml-2 text-xs text-yellow-400">(jij)</span>}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{p.position}</span>
                      {!manualImported && (
                        <>
                          <button
                            onClick={() => setSelfIndex(selfIndex === i ? null : i)}
                            className={`text-xs px-2 py-0.5 rounded transition ${selfIndex === i ? 'bg-yellow-600 text-white' : 'text-gray-500 hover:text-yellow-400 border border-gray-600 hover:border-yellow-600'}`}
                          >
                            {selfIndex === i ? '★ ik' : '☆ ik'}
                          </button>
                          <button
                            onClick={() => {
                              setManualList(prev => prev.filter((_, j) => j !== i));
                              if (selfIndex === i) setSelfIndex(null);
                              else if (selfIndex !== null && selfIndex > i) setSelfIndex(selfIndex - 1);
                            }}
                            className="text-gray-600 hover:text-red-400 transition"
                          >✕</button>
                        </>
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

          <StaffSection
            staffName={staffName}
            staffList={staffList}
            staffError={staffError}
            onNameChange={setStaffName}
            onAdd={handleAddStaff}
            onRemove={handleRemoveStaff}
          />

          <button
            onClick={() => handleNext(manualList.length > 0 && !manualImported ? handleImportManual : undefined)}
            disabled={manualImporting || staffSaving}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl transition active:scale-95"
          >
            {manualImporting || staffSaving ? 'Bezig met opslaan...' : 'Doorgaan →'}
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
                  <div key={`${p.name}-${i}`} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${p.error ? 'bg-red-900/20 border border-red-700/50' : 'bg-gray-700/50'}`}>
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

          <StaffSection
            staffName={staffName}
            staffList={staffList}
            staffError={staffError}
            onNameChange={setStaffName}
            onAdd={handleAddStaff}
            onRemove={handleRemoveStaff}
          />

          <button
            onClick={() => handleNext(validCsvPlayers.length > 0 && !csvImported ? handleImportCsv : undefined)}
            disabled={csvImporting || staffSaving}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl transition active:scale-95"
          >
            {csvImporting || staffSaving ? 'Bezig met opslaan...' : 'Doorgaan →'}
          </button>
        </div>
      )}
    </div>
  );
}
