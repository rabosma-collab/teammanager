'use client';

import React, { useState } from 'react';
import { formationLabels } from '../lib/constants';
import type { Match } from '../lib/types';
import MatchEditModal, { type MatchFormData } from './modals/MatchEditModal';
import { useToast } from '../contexts/ToastContext';

interface MatchesManageViewProps {
  matches: Match[];
  gameFormat: string;
  defaultFormation?: string;
  trackAssemblyTime?: boolean;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
  onAddMatch: (data: MatchFormData) => Promise<boolean>;
  onUpdateMatch: (id: number, data: MatchFormData) => Promise<boolean>;
  onUpdateScore: (id: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
  onCancelMatch: (id: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
  onDeleteMatch: (id: number) => Promise<boolean>;
  onRefresh: () => void;
}

export default function MatchesManageView({
  matches,
  gameFormat,
  defaultFormation,
  trackAssemblyTime = false,
  trackMatchTime = false,
  trackLocationDetails = false,
  onAddMatch,
  onUpdateMatch,
  onUpdateScore,
  onCancelMatch,
  onDeleteMatch,
  onRefresh
}: MatchesManageViewProps) {
  const toast = useToast();
  const [editingMatch, setEditingMatch] = useState<Match | null | 'new'>(null);
  const [editingScoreMatch, setEditingScoreMatch] = useState<Match | null>(null);
  const [scoreGoalsFor, setScoreGoalsFor] = useState<number | null>(null);
  const [scoreGoalsAgainst, setScoreGoalsAgainst] = useState<number | null>(null);
  const [cancellingMatch, setCancellingMatch] = useState<Match | null>(null);
  const [cancelGoalsFor, setCancelGoalsFor] = useState<number | null>(null);
  const [cancelGoalsAgainst, setCancelGoalsAgainst] = useState<number | null>(null);
  const [cancelHasScore, setCancelHasScore] = useState(false);

  const sortedMatches = [...matches].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleSave = async (data: MatchFormData) => {
    let success: boolean;
    if (editingMatch === 'new') {
      success = await onAddMatch(data);
      if (success) {
        toast.success('✅ Wedstrijd toegevoegd!');
        onRefresh();
      } else {
        toast.error('❌ Kon wedstrijd niet toevoegen');
      }
    } else if (editingMatch) {
      success = await onUpdateMatch(editingMatch.id, data);
      if (success) {
        toast.success('✅ Wedstrijd bijgewerkt!');
      } else {
        toast.error('❌ Kon wedstrijd niet bijwerken');
      }
    }
    setEditingMatch(null);
  };

  const openScoreEdit = (match: Match) => {
    setEditingScoreMatch(match);
    setScoreGoalsFor(match.goals_for ?? null);
    setScoreGoalsAgainst(match.goals_against ?? null);
  };

  const handleSaveScore = async () => {
    if (!editingScoreMatch) return;
    const success = await onUpdateScore(editingScoreMatch.id, scoreGoalsFor, scoreGoalsAgainst);
    if (success) {
      toast.success('✅ Uitslag bijgewerkt!');
      setEditingScoreMatch(null);
    } else {
      toast.error('❌ Kon uitslag niet opslaan');
    }
  };

  const openCancelModal = (match: Match) => {
    setCancellingMatch(match);
    setCancelHasScore(false);
    setCancelGoalsFor(null);
    setCancelGoalsAgainst(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancellingMatch) return;
    const success = await onCancelMatch(
      cancellingMatch.id,
      cancelHasScore ? cancelGoalsFor : null,
      cancelHasScore ? cancelGoalsAgainst : null
    );
    if (success) {
      toast.success('✅ Wedstrijd geannuleerd');
      setCancellingMatch(null);
    } else {
      toast.error('❌ Kon wedstrijd niet annuleren');
    }
  };

  const handleDelete = async (match: Match) => {
    const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    const isCancelled = match.match_status === 'geannuleerd';
    const isFinalized = match.match_status === 'afgerond';
    const extraWarning = isFinalized
      ? '\n\nLet op: dit is een AFGESLOTEN wedstrijd. Verwijderen kan niet ongedaan worden gemaakt.'
      : isCancelled
      ? '\n\nLet op: dit is een GEANNULEERDE wedstrijd.'
      : '';
    if (!confirm(`Weet je zeker dat je de wedstrijd tegen ${match.opponent} (${dateStr}) wilt verwijderen? Dit verwijdert ook alle opstellingen, wissels, afwezigheden en gastspelers.${extraWarning}`)) {
      return;
    }
    const success = await onDeleteMatch(match.id);
    if (success) {
      toast.success('✅ Wedstrijd verwijderd!');
    } else {
      toast.error('❌ Kon wedstrijd niet verwijderen');
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">📅 Wedstrijdenbeheer</h2>
        <button
          onClick={() => setEditingMatch('new')}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm flex items-center gap-1.5"
        >
          <span>➕</span>
          <span className="hidden sm:inline">Nieuwe wedstrijd</span>
        </button>
      </div>

      {editingMatch !== null && (
        <MatchEditModal
          match={editingMatch === 'new' ? null : editingMatch}
          gameFormat={gameFormat}
          defaultFormation={defaultFormation}
          trackAssemblyTime={trackAssemblyTime}
          trackMatchTime={trackMatchTime}
          trackLocationDetails={trackLocationDetails}
          onSave={handleSave}
          onClose={() => setEditingMatch(null)}
        />
      )}

      {/* Annuleer modal */}
      {cancellingMatch && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setCancellingMatch(null)}
        >
          <div
            className="bg-gray-800 rounded-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold">🚫 Wedstrijd annuleren</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {cancellingMatch.opponent} · {new Date(cancellingMatch.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setCancellingMatch(null)} className="text-2xl hover:text-red-400 p-1">✕</button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-gray-300">
                De wedstrijd wordt gemarkeerd als geannuleerd. Spelersstatistieken en speler van de week worden niet bijgewerkt.
              </p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelHasScore}
                  onChange={e => setCancelHasScore(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">Reglementaire uitslag invoeren</span>
              </label>

              {cancelHasScore && (
                <div className="flex items-center gap-4 justify-center pt-1">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-2">Wij</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCancelGoalsFor(v => v === null || v === 0 ? null : v - 1)}
                        className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-xl font-bold flex items-center justify-center"
                        disabled={cancelGoalsFor === null}
                      >−</button>
                      <span className="text-3xl font-black w-8 text-center tabular-nums">
                        {cancelGoalsFor ?? '–'}
                      </span>
                      <button
                        onClick={() => setCancelGoalsFor(v => (v ?? -1) + 1)}
                        className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                  <div className="text-gray-400 font-black text-2xl">–</div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-2">Tegenstander</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCancelGoalsAgainst(v => v === null || v === 0 ? null : v - 1)}
                        className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-xl font-bold flex items-center justify-center"
                        disabled={cancelGoalsAgainst === null}
                      >−</button>
                      <span className="text-3xl font-black w-8 text-center tabular-nums">
                        {cancelGoalsAgainst ?? '–'}
                      </span>
                      <button
                        onClick={() => setCancelGoalsAgainst(v => (v ?? -1) + 1)}
                        className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setCancellingMatch(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold text-sm"
              >
                Terug
              </button>
              <button
                onClick={handleCancelConfirm}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded font-bold text-sm"
              >
                🚫 Annuleren bevestigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score bewerken modal voor afgesloten wedstrijden */}
      {editingScoreMatch && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingScoreMatch(null)}
        >
          <div
            className="bg-gray-800 rounded-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold">⚽ Uitslag bijwerken</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editingScoreMatch.opponent} · {new Date(editingScoreMatch.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setEditingScoreMatch(null)} className="text-2xl hover:text-red-400 p-1">✕</button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="p-3 bg-amber-900/30 border border-amber-700 rounded-lg text-xs text-amber-300">
                ⚠️ <strong>Let op:</strong> het bijwerken van de uitslag wordt niet automatisch verwerkt in de spelersranglijst of spelersstatistieken. Pas dit handmatig aan via de Spelerskaarten.
              </div>

              <div className="flex items-center gap-4 justify-center">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-2">Wij</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreGoalsFor(v => v === null || v === 0 ? null : v - 1)}
                      className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-xl font-bold flex items-center justify-center"
                      disabled={scoreGoalsFor === null}
                    >−</button>
                    <span className="text-3xl font-black w-8 text-center tabular-nums">
                      {scoreGoalsFor ?? '–'}
                    </span>
                    <button
                      onClick={() => setScoreGoalsFor(v => (v ?? -1) + 1)}
                      className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center"
                    >+</button>
                  </div>
                </div>
                <div className="text-gray-400 font-black text-2xl">–</div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-2">Tegenstander</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreGoalsAgainst(v => v === null || v === 0 ? null : v - 1)}
                      className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-xl font-bold flex items-center justify-center"
                      disabled={scoreGoalsAgainst === null}
                    >−</button>
                    <span className="text-3xl font-black w-8 text-center tabular-nums">
                      {scoreGoalsAgainst ?? '–'}
                    </span>
                    <button
                      onClick={() => setScoreGoalsAgainst(v => (v ?? -1) + 1)}
                      className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setEditingScoreMatch(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold text-sm"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveScore}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold text-sm"
              >
                ✓ Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {sortedMatches.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Geen wedstrijden</div>
        ) : (
          sortedMatches.map(match => {
            const matchDate = new Date(match.date);
            const isPast = matchDate < today;
            const isFinalized = match.match_status === 'afgerond';
            const isCancelled = match.match_status === 'geannuleerd';

            return (
              <div
                key={match.id}
                className={`flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50 ${
                  isPast && !isFinalized && !isCancelled ? 'opacity-60' : ''
                } ${isCancelled ? 'opacity-70' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isFinalized ? 'bg-blue-500' : isCancelled ? 'bg-orange-500' : isPast ? 'bg-gray-500' : 'bg-green-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm sm:text-base truncate">
                    {match.opponent}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      match.home_away === 'Thuis' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'
                    }`}>
                      {match.home_away}
                    </span>
                    {match.match_type === 'oefenwedstrijd' && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-700/80 text-gray-400">
                        🔵 Oefenwedstrijd
                      </span>
                    )}
                    {isFinalized && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-400">
                        ✅ Afgerond
                      </span>
                    )}
                    {isCancelled && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-orange-900/50 text-orange-400">
                        🚫 Geannuleerd
                      </span>
                    )}
                    {(isFinalized || isCancelled) && match.goals_for != null && match.goals_against != null && (
                      <span className="ml-2 text-sm font-black text-yellow-400">
                        {match.goals_for} – {match.goals_against}
                        {isCancelled && <span className="ml-1 text-xs font-normal text-orange-400">(W.O.)</span>}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                    <span>📅 {matchDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>📋 {formationLabels[gameFormat]?.[match.formation] ?? match.formation}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {isFinalized ? (
                    <button
                      onClick={() => openScoreEdit(match)}
                      className="px-2 sm:px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded text-xs sm:text-sm font-bold"
                      title="Uitslag bewerken"
                    >
                      ⚽
                    </button>
                  ) : isCancelled ? (
                    <button
                      onClick={() => openScoreEdit(match)}
                      className="px-2 sm:px-3 py-1.5 bg-orange-800 hover:bg-orange-700 rounded text-xs sm:text-sm font-bold"
                      title="Uitslag bewerken"
                    >
                      ⚽
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingMatch(match)}
                        className="px-2 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs sm:text-sm font-bold"
                        title="Bewerken"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => openCancelModal(match)}
                        className="px-2 sm:px-3 py-1.5 bg-orange-700 hover:bg-orange-600 rounded text-xs sm:text-sm font-bold"
                        title="Annuleren"
                      >
                        🚫
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(match)}
                    className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm font-bold"
                    title="Verwijderen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 text-center text-gray-500 text-sm">
        Totaal: {matches.length} wedstrijden
      </div>
    </div>
  );
}
