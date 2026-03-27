'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Match, Player, MatchPlayerStats, TeamSettings, Season } from '../lib/types';
import { useMatchStats } from '../hooks/useMatchStats';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import MatchEditModal, { type MatchFormData } from './modals/MatchEditModal';
import ImportMatchesModal from './modals/ImportMatchesModal';

interface UitslagenViewProps {
  matches: Match[];
  players: Player[];
  teamSettings: TeamSettings | null;
  seasons: Season[];
  activeSeasonId: number | null;
  currentPlayerId: number | null;
  gameFormat: string;
  defaultFormation?: string;
  onRefreshPlayers: () => void;
  onRefreshMatches: () => void;
  onUpdateMatchReport: (matchId: number, report: string | null) => Promise<boolean>;
  onUpdateMatchScore: (matchId: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
  onAddMatch: (data: MatchFormData) => Promise<boolean>;
  onUpdateMatch: (id: number, data: MatchFormData) => Promise<boolean>;
  onCancelMatch: (id: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
  onDeleteMatch: (id: number) => Promise<boolean>;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
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

// ─── Taken badges (read-only, ontvangt pre-computed data) ─────
function TakenBadges({ tasks }: { tasks: { emoji: string; name: string }[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {tasks.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-700/60 rounded-full px-2.5 py-1 text-gray-300">
          {t.emoji} <span className="font-medium text-white">{t.name}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Sequentiële taakberekening voor aankomende wedstrijden ───
function computeUpcomingTasks(
  matches: Match[],
  players: Player[],
  absencesMap: Record<number, number[]>,
  teamSettings: TeamSettings | null
): Record<number, { emoji: string; name: string }[]> {
  const trackWasbeurt = teamSettings?.track_wasbeurt ?? true;
  const trackConsumpties = teamSettings?.track_consumpties ?? true;
  const trackVervoer = teamSettings?.track_vervoer ?? true;
  const vervoerCount = teamSettings?.vervoer_count ?? 3;

  const washCounts = new Map<number, number>(players.filter(p => !p.is_guest).map(p => [p.id, p.wash_count]));
  const consumptionCounts = new Map<number, number>(players.filter(p => !p.is_guest).map(p => [p.id, p.consumption_count]));
  const transportCounts = new Map<number, number>(players.filter(p => !p.is_guest).map(p => [p.id, p.transport_count]));

  const result: Record<number, { emoji: string; name: string }[]> = {};

  for (const match of matches) {
    const absentIds = new Set(absencesMap[match.id] ?? []);
    const available = players.filter(p => !p.is_guest && !p.injured && !absentIds.has(p.id));
    const tasks: { emoji: string; name: string }[] = [];

    if (trackWasbeurt) {
      const overrideId = match.wasbeurt_player_id ?? null;
      let player = overrideId ? (available.find(p => p.id === overrideId) ?? null) : null;
      if (!player) {
        player = [...available].sort((a, b) => ((washCounts.get(a.id) ?? 0) - (washCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
      }
      if (player) {
        tasks.push({ emoji: '🧺', name: player.name });
        washCounts.set(player.id, (washCounts.get(player.id) ?? 0) + 1);
      }
    }

    if (trackConsumpties) {
      const overrideId = match.consumpties_player_id ?? null;
      let player = overrideId ? (available.find(p => p.id === overrideId) ?? null) : null;
      if (!player) {
        player = [...available].sort((a, b) => ((consumptionCounts.get(a.id) ?? 0) - (consumptionCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
      }
      if (player) {
        tasks.push({ emoji: '🥤', name: player.name });
        consumptionCounts.set(player.id, (consumptionCounts.get(player.id) ?? 0) + 1);
      }
    }

    if (trackVervoer && match.home_away !== 'Thuis') {
      const overrideIds = match.transport_player_ids ?? [];
      const usedIds = new Set<number>();
      const vervoerPlayers: Player[] = [];
      const eligibleList = [...available].sort((a, b) => ((transportCounts.get(a.id) ?? 0) - (transportCounts.get(b.id) ?? 0)) || a.name.localeCompare(b.name));
      for (let i = 0; i < vervoerCount; i++) {
        const overrideId = overrideIds[i] ?? null;
        if (overrideId) {
          const op = available.find(p => p.id === overrideId && !usedIds.has(p.id)) ?? null;
          if (op) { vervoerPlayers.push(op); usedIds.add(op.id); continue; }
        }
        const auto = eligibleList.find(p => !usedIds.has(p.id)) ?? null;
        if (auto) { vervoerPlayers.push(auto); usedIds.add(auto.id); }
      }
      if (vervoerPlayers.length > 0) {
        vervoerPlayers.forEach((p, i) => tasks.push({ emoji: i === 0 ? '🚗' : '🚙', name: p.name }));
        for (const p of vervoerPlayers) transportCounts.set(p.id, (transportCounts.get(p.id) ?? 0) + 1);
      }
    }

    result[match.id] = tasks;
  }

  return result;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

// ─── Hoofd component ──────────────────────────────────────────
export default function UitslagenView({
  matches, players, teamSettings, seasons, activeSeasonId, currentPlayerId,
  gameFormat, defaultFormation = '4-3-3-aanvallend',
  onRefreshPlayers, onRefreshMatches,
  onUpdateMatchReport, onUpdateMatchScore,
  onAddMatch, onUpdateMatch, onCancelMatch, onDeleteMatch,
  onToggleAbsence,
}: UitslagenViewProps) {
  const { isManager, currentTeam } = useTeamContext();
  const toast = useToast();
  const { fetchStatsForMatches, saveMatchStats } = useMatchStats();

  const trackGoals   = teamSettings?.track_goals   ?? true;
  const trackAssists = teamSettings?.track_assists  ?? true;
  const trackCards   = teamSettings?.track_cards    ?? false;
  const trackResults = teamSettings?.track_results  ?? true;
  const trackAssemblyTime  = teamSettings?.track_assembly_time  ?? false;
  const trackMatchTime     = teamSettings?.track_match_time     ?? false;
  const trackLocationDetails = teamSettings?.track_location_details ?? false;

  // ── Seizoen selector ──────────────────────────────────────
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(activeSeasonId);
  const [seasonMatches, setSeasonMatches] = useState<Match[]>(matches);
  const [seasonLoading, setSeasonLoading] = useState(false);

  useEffect(() => { setSelectedSeasonId(activeSeasonId); }, [activeSeasonId]);

  useEffect(() => {
    if (selectedSeasonId === activeSeasonId) { setSeasonMatches(matches); return; }
    if (!currentTeam || selectedSeasonId == null) return;
    setSeasonLoading(true);
    supabase
      .from('matches').select('*')
      .eq('team_id', currentTeam.id)
      .eq('season_id', selectedSeasonId)
      .order('date', { ascending: false })
      .then(({ data }: { data: Match[] | null }) => { setSeasonMatches(data || []); setSeasonLoading(false); });
  }, [selectedSeasonId, activeSeasonId, matches, currentTeam]);

  // ── Gesplitste lijsten ────────────────────────────────────
  const upcomingMatches = useMemo(
    () => matches.filter(m => m.match_status === 'concept')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [matches]
  );
  const finishedMatches = useMemo(
    () => seasonMatches.filter(m => m.match_status === 'afgerond' || m.match_status === 'geannuleerd')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [seasonMatches]
  );

  // ── Afwezigheid voor aankomende wedstrijden ───────────────
  const [absencesMap, setAbsencesMap] = useState<Record<number, number[]>>({});
  useEffect(() => {
    if (!currentTeam || upcomingMatches.length === 0) return;
    const ids = upcomingMatches.map(m => m.id);
    supabase.from('match_absences').select('match_id, player_id').in('match_id', ids)
      .then(({ data }: { data: { match_id: number; player_id: number }[] | null }) => {
        const map: Record<number, number[]> = {};
        for (const row of data ?? []) {
          if (!map[row.match_id]) map[row.match_id] = [];
          map[row.match_id].push(row.player_id);
        }
        setAbsencesMap(map);
      });
  }, [upcomingMatches.length, currentTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleAbsence = async (playerId: number, matchId: number) => {
    const ok = await onToggleAbsence(playerId, matchId);
    if (ok) {
      setAbsencesMap(prev => {
        const current = prev[matchId] ?? [];
        const isAbsent = current.includes(playerId);
        return { ...prev, [matchId]: isAbsent ? current.filter(id => id !== playerId) : [...current, playerId] };
      });
    }
  };

  const upcomingTasksByMatch = useMemo(
    () => computeUpcomingTasks(upcomingMatches, players, absencesMap, teamSettings),
    [upcomingMatches, players, absencesMap, teamSettings]
  );

  // ── Stats ────────────────────────────────────────────────
  const [statsMap, setStatsMap] = useState<Record<number, MatchPlayerStats[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingStatsId, setEditingStatsId] = useState<number | null>(null);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [reportDraft, setReportDraft] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
  const [scoreDraftFor, setScoreDraftFor] = useState<number>(0);
  const [scoreDraftAgainst, setScoreDraftAgainst] = useState<number>(0);
  const [savingScore, setSavingScore] = useState(false);
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

  useEffect(() => {
    if (finishedMatches.length === 0) return;
    setLoading(true);
    fetchStatsForMatches(finishedMatches.map(m => m.id)).then(data => { setStatsMap(data); setLoading(false); });
  }, [finishedMatches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditScore = (match: Match) => {
    setEditingScoreId(match.id);
    setScoreDraftFor(match.goals_for ?? 0);
    setScoreDraftAgainst(match.goals_against ?? 0);
  };

  const handleSaveScore = async (matchId: number) => {
    setSavingScore(true);
    const ok = await onUpdateMatchScore(matchId, scoreDraftFor, scoreDraftAgainst);
    if (ok) { toast.success('✅ Uitslag opgeslagen!'); setEditingScoreId(null); }
    else toast.error('❌ Kon uitslag niet opslaan');
    setSavingScore(false);
  };

  const handleSaveStats = useCallback(async (
    matchId: number,
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>
  ) => {
    const ok = await saveMatchStats(matchId, stats);
    if (ok) {
      toast.success('✅ Statistieken opgeslagen!');
      const updated = await fetchStatsForMatches([matchId]);
      setStatsMap(prev => ({ ...prev, ...updated }));
      setEditingStatsId(null);
      onRefreshPlayers();
    } else {
      toast.error('❌ Kon statistieken niet opslaan');
    }
  }, [saveMatchStats, fetchStatsForMatches, onRefreshPlayers, toast]);

  // ── Beheer state ─────────────────────────────────────────
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | 'new' | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Cancel modal
  const [cancellingMatch, setCancellingMatch] = useState<Match | null>(null);
  const [cancelHasScore, setCancelHasScore] = useState(false);
  const [cancelGoalsFor, setCancelGoalsFor] = useState<number>(0);
  const [cancelGoalsAgainst, setCancelGoalsAgainst] = useState<number>(0);
  const [cancelling, setCancelling] = useState(false);

  const openCancelModal = (match: Match) => {
    setCancellingMatch(match);
    setCancelHasScore(false);
    setCancelGoalsFor(0);
    setCancelGoalsAgainst(0);
  };

  const handleCancelConfirm = async () => {
    if (!cancellingMatch) return;
    setCancelling(true);
    const ok = await onCancelMatch(
      cancellingMatch.id,
      cancelHasScore ? cancelGoalsFor : null,
      cancelHasScore ? cancelGoalsAgainst : null,
    );
    setCancelling(false);
    if (ok) { toast.success('✅ Wedstrijd geannuleerd'); setCancellingMatch(null); }
    else toast.error('❌ Kon wedstrijd niet annuleren');
  };

  const handleDeleteMatch = async (match: Match) => {
    const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    const extra = match.match_status === 'afgerond'
      ? '\n\nLet op: dit is een AFGESLOTEN wedstrijd.'
      : match.match_status === 'geannuleerd'
      ? '\n\nLet op: dit is een GEANNULEERDE wedstrijd.'
      : '';
    if (!confirm(`Weet je zeker dat je de wedstrijd tegen ${match.opponent} (${dateStr}) wilt verwijderen?${extra}`)) return;
    const ok = await onDeleteMatch(match.id);
    if (ok) toast.success('✅ Wedstrijd verwijderd!');
    else toast.error('❌ Kon wedstrijd niet verwijderen');
  };

  const handleSaveMatch = async (data: MatchFormData) => {
    let ok: boolean;
    if (editingMatch === 'new') {
      ok = await onAddMatch(data);
      if (ok) { toast.success('✅ Wedstrijd toegevoegd!'); onRefreshMatches(); }
      else toast.error('❌ Kon wedstrijd niet toevoegen');
    } else if (editingMatch) {
      ok = await onUpdateMatch(editingMatch.id, data);
      if (ok) toast.success('✅ Wedstrijd bijgewerkt!');
      else toast.error('❌ Kon wedstrijd niet bijwerken');
    }
    setEditingMatch(null);
  };

  // ── Seizoen selector ──────────────────────────────────────
  const seasonSelector = seasons.length > 1 && (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-xs text-gray-400 shrink-0">Seizoen:</label>
      <select
        value={selectedSeasonId ?? ''}
        onChange={e => setSelectedSeasonId(Number(e.target.value))}
        className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        {seasons.map(s => (
          <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (actief)' : ''}</option>
        ))}
      </select>
    </div>
  );

  const isEmpty = finishedMatches.length === 0 && upcomingMatches.length === 0 && !seasonLoading;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">📅 Wedstrijden</h2>
          {isManager && (
            <div className="flex items-center gap-2">
              {isEditMode && (
                <>
                  <button
                    onClick={() => setEditingMatch('new')}
                    className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-bold transition"
                  >
                    + Nieuw
                  </button>
                  <button
                    onClick={() => setShowImport(true)}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-bold transition"
                  >
                    📂 Importeer
                  </button>
                </>
              )}
              <button
                onClick={() => setIsEditMode(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  isEditMode
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {isEditMode ? '✓ Klaar' : '✏️ Bewerken'}
              </button>
            </div>
          )}
        </div>

        {seasonSelector}

        {isEmpty && (
          <div className="flex items-center justify-center text-gray-500 py-16">
            <div className="text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="font-bold">Nog geen wedstrijden gepland</div>
              {isManager && isEditMode && (
                <div className="text-sm mt-2 text-gray-400">Gebruik &quot;+ Nieuw&quot; of &quot;📂 Importeer&quot; hierboven.</div>
              )}
            </div>
          </div>
        )}

        {/* ── Aankomende wedstrijden ── */}
        {upcomingMatches.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Aankomend</div>
            <div className="space-y-2">
              {upcomingMatches.map(match => {
                const matchAbsences = absencesMap[match.id] ?? [];
                const hasMatchInfo = (trackAssemblyTime && match.assembly_time) ||
                  (trackMatchTime && match.match_time) ||
                  (trackLocationDetails && match.location_details);
                return (
                  <div key={match.id} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      {/* Datum */}
                      <div className="w-12 text-center flex-shrink-0">
                        <div className="text-xs text-gray-500">{new Date(match.date).toLocaleDateString('nl-NL', { month: 'short' })}</div>
                        <div className="text-lg font-black leading-tight">{new Date(match.date).getDate()}</div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{match.opponent}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>{match.home_away === 'Thuis' ? '🏠 Thuis' : '✈️ Uit'}</span>
                          {match.match_type === 'oefenwedstrijd' && (
                            <span className="text-gray-500">· 🔵 Oefenwedstrijd</span>
                          )}
                        </div>

                        {hasMatchInfo && (
                          <div className="mt-1.5 space-y-0.5">
                            {trackAssemblyTime && match.assembly_time && (
                              <div className="text-xs text-gray-400">🕐 Verzamelen: <span className="text-white font-medium">{formatTime(match.assembly_time)}</span></div>
                            )}
                            {trackMatchTime && match.match_time && (
                              <div className="text-xs text-gray-400">⚽ Aanvang: <span className="text-white font-medium">{formatTime(match.match_time)}</span></div>
                            )}
                            {trackLocationDetails && match.location_details && (
                              <div className="text-xs text-gray-400">📍 Verzamellocatie: <span className="text-white font-medium">{match.location_details}</span></div>
                            )}
                          </div>
                        )}

                        <TakenBadges tasks={upcomingTasksByMatch[match.id] ?? []} />
                      </div>

                      {/* Beheer-knoppen (edit mode) */}
                      {isManager && isEditMode && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingMatch(match)}
                            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                            title="Bewerken"
                          >✏️</button>
                          <button
                            onClick={() => openCancelModal(match)}
                            className="p-1.5 bg-orange-900/50 hover:bg-orange-800/60 rounded text-sm transition"
                            title="Annuleren"
                          >🚫</button>
                          <button
                            onClick={() => handleDeleteMatch(match)}
                            className="p-1.5 bg-red-900/50 hover:bg-red-800/60 rounded text-sm transition"
                            title="Verwijderen"
                          >🗑️</button>
                        </div>
                      )}
                    </div>

                    {/* Afwezigheidsknop */}
                    {currentPlayerId && (
                      <div className="mt-3 pt-3 border-t border-gray-700/60">
                        <div className="flex gap-2">
                          <button
                            onClick={!matchAbsences.includes(currentPlayerId) ? undefined : () => handleToggleAbsence(currentPlayerId, match.id)}
                            disabled={!matchAbsences.includes(currentPlayerId)}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 ${
                              !matchAbsences.includes(currentPlayerId)
                                ? 'bg-green-600 text-white shadow-inner ring-2 ring-green-400'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                            } disabled:cursor-default`}
                          >
                            Aanwezig
                          </button>
                          <button
                            onClick={matchAbsences.includes(currentPlayerId) ? undefined : () => handleToggleAbsence(currentPlayerId, match.id)}
                            disabled={matchAbsences.includes(currentPlayerId)}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 ${
                              matchAbsences.includes(currentPlayerId)
                                ? 'bg-red-600 text-white shadow-inner ring-2 ring-red-400'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                            } disabled:cursor-default`}
                          >
                            Afwezig
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Gespeelde wedstrijden ── */}
        {finishedMatches.length > 0 && (
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Gespeeld</div>
        )}

        {loading && (
          <div className="text-center text-gray-500 py-4 text-sm">Statistieken laden…</div>
        )}

        <div className="space-y-2">
          {finishedMatches.map(match => {
            const result = getResult(match);
            const stats = statsMap[match.id] ?? [];
            const isExpanded = expandedId === match.id;
            const isEditing = editingStatsId === match.id;
            const isEditingReport = editingReportId === match.id;
            const reportText = reportOverrides[match.id] !== undefined ? reportOverrides[match.id] : match.match_report;

            return (
              <div key={match.id} className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center">
                  {/* Klikbaar deel */}
                  <button
                    className="flex-1 flex items-center gap-3 p-4 hover:bg-gray-700/40 transition text-left min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : match.id)}
                  >
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-xs text-gray-500">{new Date(match.date).toLocaleDateString('nl-NL', { month: 'short' })}</div>
                      <div className="text-lg font-black leading-tight">{new Date(match.date).getDate()}</div>
                    </div>
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
                    <span className="text-gray-500 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Verwijder-knop (edit mode) */}
                  {isManager && isEditMode && (
                    <button
                      onClick={() => handleDeleteMatch(match)}
                      className="p-3 text-gray-500 hover:text-red-400 transition flex-shrink-0"
                      title="Verwijderen"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Uitklapbare details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-700/60">
                    {isManager && trackResults && editingScoreId !== match.id && (
                      <button onClick={() => startEditScore(match)} className="mt-3 text-xs text-gray-400 hover:text-yellow-400 transition">
                        ✏️ {match.goals_for != null ? 'Uitslag aanpassen' : 'Uitslag invullen'}
                      </button>
                    )}

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
                            <button onClick={() => handleSaveScore(match.id)} disabled={savingScore} className="py-1.5 px-3 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition disabled:opacity-50">
                              {savingScore ? '…' : '✅'}
                            </button>
                            <button onClick={() => setEditingScoreId(null)} className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition">✕</button>
                          </div>
                        </div>
                      </div>
                    )}

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
                              <button onClick={() => handleSaveReport(match.id)} disabled={savingReport} className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs font-bold transition disabled:opacity-50">
                                {savingReport ? 'Opslaan…' : '✅ Opslaan'}
                              </button>
                              <button onClick={() => setEditingReportId(null)} className="py-1.5 px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold transition">Annuleren</button>
                            </div>
                          </div>
                        ) : reportText ? (
                          <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700/20 rounded-lg p-3">
                            {reportText}
                            {isManager && (
                              <button onClick={() => startEditReport(match)} className="block mt-2 text-xs text-gray-500 hover:text-yellow-400 transition">
                                ✏️ Verslag bewerken
                              </button>
                            )}
                          </div>
                        ) : isManager && (
                          <button onClick={() => startEditReport(match)} className="text-xs text-gray-500 hover:text-yellow-400 transition">
                            + Verslag toevoegen
                          </button>
                        )}
                      </div>
                    )}

                    {isManager && !isEditing && (
                      <button onClick={() => setEditingStatsId(match.id)} className="mt-3 text-xs text-gray-400 hover:text-yellow-400 transition">
                        ✏️ Statistieken bewerken
                      </button>
                    )}

                    {isManager && isEditing && (
                      <StatsEditor
                        players={players}
                        existingStats={stats}
                        trackAssists={trackAssists}
                        trackCards={trackCards}
                        onSave={newStats => handleSaveStats(match.id, newStats)}
                        onCancel={() => setEditingStatsId(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Modals ── */}
      {editingMatch !== null && (
        <MatchEditModal
          match={editingMatch === 'new' ? null : editingMatch}
          gameFormat={gameFormat}
          defaultFormation={defaultFormation}
          trackAssemblyTime={trackAssemblyTime}
          trackMatchTime={trackMatchTime}
          trackLocationDetails={trackLocationDetails}
          onSave={handleSaveMatch}
          onClose={() => setEditingMatch(null)}
        />
      )}

      {showImport && currentTeam && (
        <ImportMatchesModal
          teamId={currentTeam.id}
          defaultFormation={defaultFormation}
          onImported={() => { onRefreshMatches(); setShowImport(false); }}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Cancel modal */}
      {cancellingMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-base mb-1">🚫 Wedstrijd annuleren</h3>
            <p className="text-sm text-gray-400 mb-4">
              Wedstrijd tegen <strong className="text-white">{cancellingMatch.opponent}</strong> als W.O. markeren?
            </p>

            <label className="flex items-center gap-2 text-sm text-gray-300 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelHasScore}
                onChange={e => setCancelHasScore(e.target.checked)}
                className="rounded"
              />
              Er is wel een uitslag gespeeld
            </label>

            {cancelHasScore && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCancelGoalsFor(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 font-bold flex items-center justify-center">−</button>
                  <span className="text-xl font-black w-6 text-center tabular-nums">{cancelGoalsFor}</span>
                  <button onClick={() => setCancelGoalsFor(v => v + 1)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 font-bold flex items-center justify-center">+</button>
                </div>
                <span className="text-gray-500 font-bold">–</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCancelGoalsAgainst(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 font-bold flex items-center justify-center">−</button>
                  <span className="text-xl font-black w-6 text-center tabular-nums">{cancelGoalsAgainst}</span>
                  <button onClick={() => setCancelGoalsAgainst(v => v + 1)} className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 font-bold flex items-center justify-center">+</button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
              >
                {cancelling ? 'Bezig…' : '🚫 Annuleren'}
              </button>
              <button
                onClick={() => setCancellingMatch(null)}
                className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-sm transition"
              >
                Terug
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
