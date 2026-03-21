'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Match, Player, MatchPlayerStats, TeamSettings, Season } from '../lib/types';
import { useMatchStats } from '../hooks/useMatchStats';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';

interface UitslagenViewProps {
  matches: Match[];
  players: Player[];
  teamSettings: TeamSettings | null;
  seasons: Season[];
  activeSeasonId: number | null;
  onRefreshPlayers: () => void;
  onUpdateMatchReport: (matchId: number, report: string | null) => Promise<boolean>;
  onUpdateMatchScore: (matchId: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
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
  onSave: (stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>) => Promise<void>;
  onCancel: () => void;
}

function StatsEditor({ players, existingStats, trackAssists, trackCards, onSave, onCancel }: StatsEditorProps) {
  const selectablePlayers = useMemo(
    () => players.filter(p => !p.is_guest).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // Initialiseer lokale state vanuit existingStats
  type Row = { player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number };
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
          own_goals: s.own_goals ?? 0,
        }));
    }
    return [];
  });
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows(prev => [...prev, { player_id: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, own_goals: 0 }]);
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
        trackCards ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]' : trackAssists ? 'grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_auto]'
      }`}>
        <span>Speler</span>
        <span className="text-center">⚽</span>
        {trackAssists && <span className="text-center">🅰️</span>}
        <span className="text-center text-orange-400">🥅</span>
        {trackCards && <span className="text-center">🟡</span>}
        {trackCards && <span className="text-center">🔴</span>}
        <span />
      </div>

      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className={`grid gap-1 items-center ${
            trackCards ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]' : trackAssists ? 'grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'grid-cols-[2fr_1fr_1fr_auto]'
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
            <input type="number" min="0" max="10" value={row.own_goals}
              onChange={e => updateRow(i, 'own_goals', parseInt(e.target.value) || 0)}
              className="px-1 py-1 bg-gray-700 border border-orange-800/50 rounded text-orange-300 text-xs text-center w-full" />
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
export default function UitslagenView({ matches, players, teamSettings, seasons, activeSeasonId, onRefreshPlayers, onUpdateMatchReport, onUpdateMatchScore }: UitslagenViewProps) {
  const { isManager, currentTeam } = useTeamContext();
  const toast = useToast();
  const { fetchStatsForMatches, saveMatchStats } = useMatchStats();

  const trackGoals   = teamSettings?.track_goals   ?? true;
  const trackAssists = teamSettings?.track_assists  ?? true;
  const trackCards   = teamSettings?.track_cards    ?? false;
  const trackResults = teamSettings?.track_results  ?? true;

  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(activeSeasonId);
  const [seasonMatches, setSeasonMatches] = useState<Match[]>(matches);
  const [seasonLoading, setSeasonLoading] = useState(false);

  // Sync naar activeSeasonId als die verandert (bijv. nieuw seizoen gestart)
  useEffect(() => {
    setSelectedSeasonId(activeSeasonId);
  }, [activeSeasonId]);

  // Bij actief seizoen: gebruik matches van parent; bij oud seizoen: fetch zelf
  useEffect(() => {
    if (selectedSeasonId === activeSeasonId) {
      setSeasonMatches(matches);
      return;
    }
    if (!currentTeam || selectedSeasonId == null) return;
    setSeasonLoading(true);
    supabase
      .from('matches')
      .select('*')
      .eq('team_id', currentTeam.id)
      .eq('season_id', selectedSeasonId)
      .order('date', { ascending: false })
      .then(({ data }: { data: Match[] | null }) => {
        setSeasonMatches(data || []);
        setSeasonLoading(false);
      });
  }, [selectedSeasonId, activeSeasonId, matches, currentTeam]);

  // Afgeronde + geannuleerde wedstrijden, nieuwste eerst
  const finishedMatches = useMemo(
    () => seasonMatches
      .filter(m => m.match_status === 'afgerond' || m.match_status === 'geannuleerd')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [seasonMatches]
  );

  const [statsMap, setStatsMap] = useState<Record<number, MatchPlayerStats[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [reportDraft, setReportDraft] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
  const [scoreDraftFor, setScoreDraftFor] = useState<number>(0);
  const [scoreDraftAgainst, setScoreDraftAgainst] = useState<number>(0);
  const [savingScore, setSavingScore] = useState(false);

  // Lokale match_report overrides (na opslaan zonder page refresh)
  const [reportOverrides, setReportOverrides] = useState<Record<number, string | null>>({});

  const startEditReport = (match: Match) => {
    setEditingReportId(match.id);
    setReportDraft(reportOverrides[match.id] !== undefined ? (reportOverrides[match.id] ?? '') : (match.match_report ?? ''));
  };

  const handleSaveReport = async (matchId: number) => {
    setSavingReport(true);
    const ok = await onUpdateMatchReport(matchId, reportDraft.trim() || null);
    if (ok) {
      setReportOverrides(prev => ({ ...prev, [matchId]: reportDraft.trim() || null }));
      toast.success('✅ Verslag opgeslagen!');
      setEditingReportId(null);
    } else {
      toast.error('❌ Kon verslag niet opslaan');
    }
    setSavingReport(false);
  };

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

  const startEditScore = (match: Match) => {
    setEditingScoreId(match.id);
    setScoreDraftFor(match.goals_for ?? 0);
    setScoreDraftAgainst(match.goals_against ?? 0);
  };

  const handleSaveScore = async (matchId: number) => {
    setSavingScore(true);
    const ok = await onUpdateMatchScore(matchId, scoreDraftFor, scoreDraftAgainst);
    if (ok) {
      toast.success('✅ Uitslag opgeslagen!');
      setEditingScoreId(null);
    } else {
      toast.error('❌ Kon uitslag niet opslaan');
    }
    setSavingScore(false);
  };

  const handleSaveStats = useCallback(async (
    matchId: number,
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>
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

  const seasonSelector = seasons.length > 1 && (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-xs text-gray-400 shrink-0">Seizoen:</label>
      <select
        value={selectedSeasonId ?? ''}
        onChange={e => setSelectedSeasonId(Number(e.target.value))}
        className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        {seasons.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}{s.is_active ? ' (actief)' : ''}
          </option>
        ))}
      </select>
    </div>
  );

  if (finishedMatches.length === 0 && !seasonLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-bold mb-4">📋 Uitslagen</h2>
          {seasonSelector}
          <div className="flex items-center justify-center text-gray-500 py-16">
            <div className="text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="font-bold">Nog geen afgesloten wedstrijden</div>
              <div className="text-sm mt-1">Uitslagen verschijnen hier zodra wedstrijden zijn afgesloten.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-bold mb-4">📋 Uitslagen</h2>
        {seasonSelector}

        {loading && (
          <div className="text-center text-gray-500 py-4 text-sm">Statistieken laden…</div>
        )}

        <div className="space-y-2">
          {finishedMatches.map(match => {
            const result = getResult(match);
            const stats = statsMap[match.id] ?? [];
            const isExpanded = expandedId === match.id;
            const isEditing = editingId === match.id;
            const isEditingReport = editingReportId === match.id;
            const reportText = reportOverrides[match.id] !== undefined ? reportOverrides[match.id] : match.match_report;

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
                    <div className="font-bold text-sm truncate">
                      {match.opponent}
                      {match.match_status === 'geannuleerd' && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 font-normal">W.O.</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{match.home_away === 'Thuis' ? '🏠 Thuis' : '✈️ Uit'}</span>
                      {match.match_type === 'oefenwedstrijd' && (
                        <span className="text-gray-500">· 🔵 Oefenwedstrijd</span>
                      )}
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

                    {/* Score editor trigger voor managers */}
                    {isManager && trackResults && editingScoreId !== match.id && (
                      <button
                        onClick={() => startEditScore(match)}
                        className="mt-3 text-xs text-gray-400 hover:text-yellow-400 transition"
                      >
                        ✏️ {match.goals_for != null ? 'Uitslag aanpassen' : 'Uitslag invullen'}
                      </button>
                    )}

                    {/* Score editor */}
                    {isManager && trackResults && editingScoreId === match.id && (
                      <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Uitslag aanpassen</div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setScoreDraftFor(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold flex items-center justify-center">−</button>
                            <span className="text-xl font-black w-6 text-center tabular-nums">{scoreDraftFor}</span>
                            <button onClick={() => setScoreDraftFor(v => v + 1)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold flex items-center justify-center">+</button>
                          </div>
                          <span className="text-gray-500 font-bold">–</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setScoreDraftAgainst(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold flex items-center justify-center">−</button>
                            <span className="text-xl font-black w-6 text-center tabular-nums">{scoreDraftAgainst}</span>
                            <button onClick={() => setScoreDraftAgainst(v => v + 1)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold flex items-center justify-center">+</button>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={() => handleSaveScore(match.id)}
                              disabled={savingScore}
                              className="py-1.5 px-3 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition disabled:opacity-50"
                            >
                              {savingScore ? '…' : '✅'}
                            </button>
                            <button
                              onClick={() => setEditingScoreId(null)}
                              className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stats overzicht */}
                    {trackGoals && (
                      <>
                        {stats.filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0).length > 0 ? (
                          <div className="mt-3 space-y-1">
                            {stats
                              .filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0)
                              .map(s => (
                                <div key={s.id ?? s.player_id} className="flex items-center justify-between text-sm py-1">
                                  <span className="text-gray-300">{s.player_name ?? `Speler ${s.player_id}`}</span>
                                  <div className="flex gap-3 text-xs">
                                    {s.goals > 0 && <span className="text-green-400">⚽ {s.goals}</span>}
                                    {trackAssists && s.assists > 0 && <span className="text-blue-400">🅰️ {s.assists}</span>}
                                    {s.own_goals > 0 && <span className="text-orange-400">🥅 {s.own_goals}</span>}
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

                    {/* Wedstrijdverslag */}
                    {(reportText != null || isEditingReport || isManager) && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-1.5">Verslag</div>
                        {isEditingReport ? (
                          <div className="space-y-2">
                            <textarea
                              value={reportDraft}
                              onChange={e => setReportDraft(e.target.value)}
                              maxLength={2000}
                              rows={5}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-yellow-500 transition"
                            />
                            <div className="text-xs text-gray-500 text-right">{reportDraft.length} / 2000</div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveReport(match.id)}
                                disabled={savingReport}
                                className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition disabled:opacity-50"
                              >
                                {savingReport ? 'Opslaan…' : '✅ Opslaan'}
                              </button>
                              <button
                                onClick={() => setEditingReportId(null)}
                                className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        ) : reportText ? (
                          <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700/20 rounded-lg p-3">
                            {reportText}
                            {isManager && (
                              <button
                                onClick={() => startEditReport(match)}
                                className="block mt-2 text-xs text-gray-500 hover:text-yellow-400 transition"
                              >
                                ✏️ Verslag bewerken
                              </button>
                            )}
                          </div>
                        ) : isManager && (
                          <button
                            onClick={() => startEditReport(match)}
                            className="text-xs text-gray-500 hover:text-yellow-400 transition"
                          >
                            + Verslag toevoegen
                          </button>
                        )}
                      </div>
                    )}

                    {/* Manager: bewerkknop statistieken */}
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
