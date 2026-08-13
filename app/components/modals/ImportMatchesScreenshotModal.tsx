'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

/** Antwoord van /api/import-matches per wedstrijd (velden kunnen null zijn). */
interface ParsedMatch {
  date: string | null;
  opponent: string | null;
  home_away: 'Thuis' | 'Uit' | null;
  match_time: string | null;
  location_details: string | null;
}

/** Interne rij-state: verplichte velden kunnen tijdens bewerken nog leeg zijn. */
interface DraftRow {
  id: string;
  date: string;
  opponent: string;
  home_away: 'Thuis' | 'Uit';
  match_time: string;
  location_details: string;
}

interface ImportMatchesScreenshotModalProps {
  teamId: string;
  teamName: string;
  defaultFormation: string;
  seasonId: number | null;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
  onImported: () => void;
  onClose: () => void;
}

type Step = 'upload' | 'reading' | 'review';

let rowCounter = 0;
const newRowId = () => `row-${Date.now()}-${rowCounter++}`;

export default function ImportMatchesScreenshotModal({
  teamId,
  teamName,
  defaultFormation,
  seasonId,
  trackMatchTime = false,
  trackLocationDetails = false,
  onImported,
  onClose,
}: ImportMatchesScreenshotModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Kies een afbeelding (jpg, png, webp, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Afbeelding mag maximaal 5 MB zijn');
      return;
    }

    setError(null);
    setStep('reading');

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/import-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, teamName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Er ging iets mis bij het lezen van de screenshot.');
        setStep('upload');
        return;
      }

      const data: { matches?: ParsedMatch[] } = await res.json();
      const parsed = data.matches ?? [];

      if (parsed.length === 0) {
        setError('Geen wedstrijden herkend. Probeer een duidelijkere screenshot, of voeg ze handmatig toe.');
        setStep('upload');
        return;
      }

      setRows(
        parsed.map((m) => ({
          id: newRowId(),
          date: m.date ?? '',
          opponent: m.opponent ?? '',
          home_away: m.home_away ?? 'Thuis',
          match_time: m.match_time ?? '',
          location_details: m.location_details ?? '',
        }))
      );
      setStep('review');
    } catch {
      setError('Er ging iets mis bij het verwerken van de afbeelding.');
      setStep('upload');
    }
  };

  const updateRow = (id: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addEmptyRow = () => {
    setRows((prev) => [
      ...prev,
      { id: newRowId(), date: '', opponent: '', home_away: 'Thuis', match_time: '', location_details: '' },
    ]);
  };

  const isRowComplete = (r: DraftRow) => !!r.date && !!r.opponent.trim();
  const completeCount = rows.filter(isRowComplete).length;
  const allComplete = rows.length > 0 && completeCount === rows.length;

  const handleConfirm = async () => {
    if (!allComplete || saving) return;
    setSaving(true);
    setError(null);

    const insertRows = rows.map((r) => ({
      team_id: teamId,
      date: r.date,
      opponent: r.opponent.trim(),
      home_away: r.home_away,
      formation: defaultFormation,
      match_type: 'competitie',
      match_status: 'concept',
      season_id: seasonId,
      match_time: r.match_time || null,
      location_details: r.location_details.trim() || null,
    }));

    const { error: insertError } = await supabase.from('matches').insert(insertRows);
    setSaving(false);

    if (insertError) {
      setError('Kon de wedstrijden niet toevoegen. Probeer het opnieuw.');
      return;
    }
    onImported();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-base font-bold">📷 Wedstrijden importeren uit screenshot</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col min-h-0 flex-1">
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-200 shrink-0">
              {error}
            </div>
          )}

          {/* STAP 1 — Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Upload een screenshot van je KNVB-wedstrijdschema. De wedstrijden worden automatisch
                herkend; daarna kun je ze controleren en aanvullen voordat ze worden toegevoegd.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-green-500 hover:bg-gray-700/30 transition">
                <span className="text-4xl">🖼️</span>
                <span className="text-sm font-bold text-gray-300">Klik om een screenshot te kiezen</span>
                <span className="text-xs text-gray-500">PNG, JPG of WEBP · max 5 MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              <button onClick={onClose} className="w-full py-2 text-gray-400 hover:text-gray-200 text-sm transition">
                Annuleren
              </button>
            </div>
          )}

          {/* STAP 2 — Lezen */}
          {step === 'reading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-gray-600 border-t-green-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-300 font-bold">Wedstrijden worden gelezen…</p>
              <p className="text-xs text-gray-500">Dit kan een paar seconden duren.</p>
            </div>
          )}

          {/* STAP 3 — Controleren */}
          {step === 'review' && (
            <>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-sm text-gray-400">
                  <span className={allComplete ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold'}>
                    {completeCount} van {rows.length}
                  </span>{' '}
                  wedstrijden compleet. Vul ontbrekende velden (geel) aan.
                </p>
                <button
                  onClick={addEmptyRow}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded font-bold shrink-0"
                >
                  ➕ Rij
                </button>
              </div>

              <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-2">
                {rows.map((r) => {
                  const dateMissing = !r.date;
                  const opponentMissing = !r.opponent.trim();
                  const complete = isRowComplete(r);
                  return (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-2.5 ${
                        complete ? 'border-gray-700 bg-gray-800/40' : 'border-yellow-600/60 bg-yellow-900/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-2 text-lg shrink-0" title={complete ? 'Compleet' : 'Vul aan'}>
                          {complete ? '✅' : '⚠️'}
                        </span>
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-12 gap-2">
                          {/* Datum */}
                          <div className="col-span-1 sm:col-span-3">
                            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Datum *</label>
                            <input
                              type="date"
                              value={r.date}
                              onChange={(e) => updateRow(r.id, { date: e.target.value })}
                              className={`w-full px-2 py-1.5 bg-gray-700 border rounded text-white text-xs ${
                                dateMissing ? 'border-yellow-500' : 'border-gray-600'
                              }`}
                            />
                          </div>
                          {/* Tegenstander */}
                          <div className="col-span-1 sm:col-span-4">
                            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Tegenstander *</label>
                            <input
                              type="text"
                              value={r.opponent}
                              maxLength={60}
                              placeholder="Naam tegenstander"
                              onChange={(e) => updateRow(r.id, { opponent: e.target.value })}
                              className={`w-full px-2 py-1.5 bg-gray-700 border rounded text-white text-xs ${
                                opponentMissing ? 'border-yellow-500' : 'border-gray-600'
                              }`}
                            />
                          </div>
                          {/* Thuis/Uit */}
                          <div className="col-span-1 sm:col-span-2">
                            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Thuis/Uit</label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => updateRow(r.id, { home_away: 'Thuis' })}
                                className={`flex-1 py-1.5 rounded text-xs font-bold ${
                                  r.home_away === 'Thuis' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                                }`}
                              >
                                🏠
                              </button>
                              <button
                                type="button"
                                onClick={() => updateRow(r.id, { home_away: 'Uit' })}
                                className={`flex-1 py-1.5 rounded text-xs font-bold ${
                                  r.home_away === 'Uit' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300'
                                }`}
                              >
                                ✈️
                              </button>
                            </div>
                          </div>
                          {/* Tijd */}
                          {trackMatchTime && (
                            <div className="col-span-1 sm:col-span-3">
                              <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Aanvang</label>
                              <input
                                type="time"
                                value={r.match_time}
                                onChange={(e) => updateRow(r.id, { match_time: e.target.value })}
                                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                              />
                            </div>
                          )}
                          {/* Locatie */}
                          {trackLocationDetails && (
                            <div className="col-span-2 sm:col-span-12">
                              <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Locatie</label>
                              <input
                                type="text"
                                value={r.location_details}
                                maxLength={100}
                                placeholder="bijv. Sportpark Noord, veld 2"
                                onChange={(e) => updateRow(r.id, { location_details: e.target.value })}
                                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                              />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeRow(r.id)}
                          className="mt-5 text-gray-500 hover:text-red-400 p-1 shrink-0"
                          title="Wedstrijd verwijderen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-3 shrink-0 border-t border-gray-700 mt-3">
                <button
                  onClick={handleConfirm}
                  disabled={!allComplete || saving}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {saving
                    ? 'Bezig met toevoegen…'
                    : allComplete
                      ? `➕ ${rows.length} ${rows.length === 1 ? 'wedstrijd' : 'wedstrijden'} toevoegen`
                      : 'Vul eerst alle verplichte velden in'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-600 hover:bg-gray-700 rounded-xl font-bold text-sm"
                >
                  Annuleren
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Leest een bestand en geeft de pure base64 (zonder data:-prefix) terug. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
