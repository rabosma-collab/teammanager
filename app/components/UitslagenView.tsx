'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Match, Player, MatchPlayerStats, TeamSettings } from '../lib/types';
import { useMatchStats } from '../hooks/useMatchStats';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';

interface UitslagenViewProps {
  matches: Match[];
  players: Player[];
  teamSettings: TeamSettings | null;
  onRefreshPlayers: () => void;
}

// ─── Hulpfuncties ─────────────────────────────────────────────
function getResult(m: Match): 'W' | 'G' | 'V' | null {
  if (m.goals_for == null || m.goals_against == null) return null;
  if (m.goals_for > m.goals_against) return 'W';
  if (m.goals_for === m.goals_against) return 'G';
  return 'V';
}

function ResultBadge({ result }: { result: 'W' | 'G' | 'V' | null }) {
  if (!result) return null;
  const cfg = {
    W: 'bg-green-600 text-white',
    G: 'bg-yellow-600 text-white',
    V: 'bg-red-700 text-white',
  }[result];
  return (
    <span className={`text-xs font-black px-1.5 py-0.5 rounded ${cfg}`}>{result}</span>
  );
}

// ─── Stats editor (inline, per wedstrijd) ─────────────────────
interface StatsEditorProps {
  players: Player[];
  existingStats: MatchPlayerStats[];
  trackAssists: boolean;
  trackCards: boolean;
  onSave: (stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number }>) => Promise<void>;
  onCancel: () => void;
}

function StatsEditor({ players, existingStats, trackAssists, trackCards, onSave, onCancel }: StatsEditorProps) {
  const selectablePlayers = useMemo(
    () => players.filter(p => !p.is_guest).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // Initialiseer lokale state vanuit existingStats
  type Row = { player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number };
  const [rows, setRows] = useState<Row[]>(() => {
    if (existingStats.length > 0) {
      return existingStats
        .filter(s => s.player_id !== null)
        .map(s => ({
          player_id: s.player_id!,
          goals: s.goals,
          assists: s.assists,
          yellow_cards: s.yellow_cards,
          red_cards: s.red_cards,
        }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows(prev => [...prev, { player_id: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, j) => j !== i));
  const updateRow = (i: number, field: keyof Row, value: number) =>
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    const valid = rows.filter(r => r.player_id > 0);
    setSaving(true);
    await onSave(valid);
    setSaving(false);
  };

  return (
    <div className="mt-3 p-3 bg-gray-900/60 rounded-lg border border-gray-600">
      <div className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wide">Statistieken bewerken</div>

      {/* Header */}
      <div className={`grid gap-1 text-[10px] text-gray-500 font-bold uppercase mb-1 px-1 ${
        trackCards ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]' : trackAssists ? 'grid-cols-[2fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_auto]'
      }`}>
        <span>Speler</span>
        <span className="text-center">⚽</span>
        {trackAssists && <span className="text-center">🅰️</span>}
        {trackCards && <span className="text-center">🟡</span>}
        {trackCards && <span className="text-center">🔴</span>}
        <span />
      </div>

      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className={`grid gap-1 items-center ${
            trackCards ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]' : trackAssists ? 'grid-cols-[2fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_auto]'
          }`}>
            <select
              value={row.player_id || ''}
              onChange={e => updateRow(i, 'player_id', parseInt(e.target.value) || 0)}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
            >
              <option value="">Speler…</option>
              {selectablePlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input type="number" min="0" max="20" value={row.goals}
              onChange={e => updateRow(i, 'goals', parseInt(e.target.value) || 0)}
              className="px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-center w-full" />
            {trackAssists && (
              <input type="number" min="0" max="20" value={row.assists}
                onChange={e => updateRow(i, 'assists', parseInt(e.target.value) || 0)}
                className="px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-center w-full" />
            )}
            {trackCards && (
              <input type="number" min="0" max="10" value={row.yellow_cards}
                onChange={e => updateRow(i, 'yellow_cards', parseInt(e.target.value) || 0)}
                className="px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-center w-full" />
            )}
            {trackCards && (
              <input type="number" min="0" max="10" value={row.red_cards}
                onChange={e => updateRow(i, 'red_cards', parseInt(e.target.value) || 0)}
                className="px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-center w-full" />
            )}
            <button onClick={() => removeRow(i)} className="text-gray-500 hover:text-red-400 transition text-sm px-1">✕</button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-2 w-full py-1.5 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white hover:border-gray-400 transition"
      >
        + Speler toevoegen
      </button>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition disabled:opacity-50"
        >
          {saving ? 'Opslaan…' : '✅ Opslaan'}
        </button>
        <button
          onClick={onCancel}
          className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────
export default function UitslagenView({ matches, players, teamSettings, onRefreshPlayers }: UitslagenViewProps) {
  const { isManager } = useTeamContext();
  const toast = useToast();
  const { fetchStatsForMatches, saveMatchStats } = useMatchStats();

  const trackGoals   = teamSettings?.track_goals   ?? true;
  const trackAssists = teamSettings?.track_assists  ?? true;
  const trackCards   = teamSettings?.track_cards    ?? false;
  const trackResults = teamSettings?.track_results  ?? true;

  // Alleen afgeronde wedstrijden, nieuwste eerst
  const finishedMatches = useMemo(
    () => matches.filter(m => m.match_status === 'afgerond').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches]
  );

  const [statsMap, setStatsMap] = useState<Record<number, MatchPlayerStats[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Laad stats voor alle afgeronde wedstrijden
  useEffect(() => {
    if (finishedMatches.length === 0) return;
    setLoading(true);
    const ids = finishedMatches.map(m => m.id);
    fetchStatsForMatches(ids).then(data => {
      setStatsMap(data);
      setLoading(false);
    });
  }, [finishedMatches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveStats = useCallback(async (
    matchId: number,
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number }>
  ) => {
    const ok = await saveMatchStats(matchId, stats);
    if (ok) {
      toast.success('✅ Statistieken opgeslagen!');
      // Herlaad stats voor dit match
      const updated = await fetchStatsForMatches([matchId]);
      setStatsMap(prev => ({ ...prev, ...updated }));
      setEditingId(null);
      onRefreshPlayers();
    } else {
      toast.error('❌ Kon statistieken niet opslaan');
    }
  }, [saveMatchStats, fetchStatsForMatches, onRefreshPlayers, toast]);

  if (finishedMatches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-bold">Nog geen afgesloten wedstrijden</div>
          <div className="text-sm mt-1">Uitslagen verschijnen hier zodra wedstrijden zijn afgesloten.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-bold mb-4">📋 Uitslagen</h2>

        {loading && (
          <div className="text-center text-gray-500 py-4 text-sm">Statistieken laden…</div>
        )}

        <div className="space-y-2">
          {finishedMatches.map(match => {
            const result = getResult(match);
            const stats = statsMap[match.id] ?? [];
            const isExpanded = expandedId === match.id;
            const isEditing = editingId === match.id;

            return (
              <div key={match.id} className="bg-gray-800 rounded-xl overflow-hidden">
                {/* Match header — klikbaar om uit te klappen */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-700/40 transition text-left"
                  onClick={() => setExpandedId(isExpanded ? null : match.id)}
                >
                  {/* Datum */}
                  <div className="w-12 text-center flex-shrink-0">
                    <div className="text-xs text-gray-500">{new Date(match.date).toLocaleDateString('nl-NL', { month: 'short' })}</div>
                    <div className="text-lg font-black leading-tight">{new Date(match.date).getDate()}</div>
                  </div>

                  {/* Wedstrijd info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{match.opponent}</div>
                    <div className="text-xs text-gray-400">
                      {match.home_away === 'Thuis' ? '🏠 Thuis' : '✈️ Uit'}
                    </div>
                  </div>

                  {/* Score */}
                  {trackResults && match.goals_for != null && match.goals_against != null ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ResultBadge result={result} />
                      <span className="font-black text-base">
                        <span className={result === 'W' ? 'text-green-400' : result === 'V' ? 'text-red-400' : 'text-yellow-400'}>
                          {match.goals_for}
                        </span>
                        <span className="text-gray-500 mx-1">–</span>
                        <span>{match.goals_against}</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">geen uitslag</span>
                  )}

                  {/* Pijl */}
                  <span className="text-gray-500 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Uitklapbare details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-700/60">
                    {/* Stats overzicht */}
                    {trackGoals && (
                      <>
                        {stats.filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0).length > 0 ? (
                          <div className="mt-3 space-y-1">
                            {stats
                              .filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0)
                              .map(s => (
                                <div key={s.id ?? s.player_id} className="flex items-center justify-between text-sm py-1">
                                  <span className="text-gray-300">{s.player_name ?? `Speler ${s.player_id}`}</span>
                                  <div className="flex gap-3 text-xs">
                                    {s.goals > 0 && <span className="text-green-400">⚽ {s.goals}</span>}
                                    {trackAssists && s.assists > 0 && <span className="text-blue-400">🅰️ {s.assists}</span>}
                                    {trackCards && s.yellow_cards > 0 && <span className="text-yellow-400">🟡 {s.yellow_cards}</span>}
                                    {trackCards && s.red_cards > 0 && <span className="text-red-400">🔴 {s.red_cards}</span>}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 mt-3">Geen spelerstatistieken geregistreerd.</p>
                        )}
                      </>
                    )}

                    {/* Manager: bewerkknop */}
                    {isManager && !isEditing && (
                      <button
                        onClick={() => setEditingId(match.id)}
                        className="mt-3 text-xs text-gray-400 hover:text-yellow-400 transition"
                      >
                        ✏️ Statistieken bewerken
                      </button>
                    )}

                    {/* Inline editor */}
                    {isManager && isEditing && (
                      <StatsEditor
                        players={players}
                        existingStats={stats}
                        trackAssists={trackAssists}
                        trackCards={trackCards}
                        onSave={newStats => handleSaveStats(match.id, newStats)}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
