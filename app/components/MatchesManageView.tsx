import React, { useState } from 'react';
import { formationLabels } from '../lib/constants';
import type { Match, SubstitutionScheme } from '../lib/types';
import MatchEditModal, { type MatchFormData } from './modals/MatchEditModal';
import { useToast } from '../contexts/ToastContext';

interface MatchesManageViewProps {
  matches: Match[];
  schemes: SubstitutionScheme[];
  onAddMatch: (data: MatchFormData) => Promise<boolean>;
  onUpdateMatch: (id: number, data: MatchFormData) => Promise<boolean>;
  onUpdateScore: (id: number, goalsFor: number | null, goalsAgainst: number | null) => Promise<boolean>;
  onDeleteMatch: (id: number) => Promise<boolean>;
  onRefresh: () => void;
}

export default function MatchesManageView({
  matches,
  schemes,
  onAddMatch,
  onUpdateMatch,
  onUpdateScore,
  onDeleteMatch,
  onRefresh
}: MatchesManageViewProps) {
  const toast = useToast();
  const [editingMatch, setEditingMatch] = useState<Match | null | 'new'>(null);
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
  const [scoreGoalsFor, setScoreGoalsFor] = useState('');
  const [scoreGoalsAgainst, setScoreGoalsAgainst] = useState('');

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
    setEditingScoreId(match.id);
    setScoreGoalsFor(match.goals_for != null ? String(match.goals_for) : '');
    setScoreGoalsAgainst(match.goals_against != null ? String(match.goals_against) : '');
  };

  const handleSaveScore = async (matchId: number) => {
    const rawFor = parseInt(scoreGoalsFor, 10);
    const rawAgainst = parseInt(scoreGoalsAgainst, 10);
    const goalsFor = scoreGoalsFor !== '' ? Math.max(0, isNaN(rawFor) ? 0 : rawFor) : null;
    const goalsAgainst = scoreGoalsAgainst !== '' ? Math.max(0, isNaN(rawAgainst) ? 0 : rawAgainst) : null;
    const success = await onUpdateScore(matchId, goalsFor, goalsAgainst);
    if (success) {
      setEditingScoreId(null);
    } else {
      toast.error('❌ Kon uitslag niet opslaan');
    }
  };

  const handleDelete = async (match: Match) => {
    const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    if (!confirm(`Weet je het zeker dat je de wedstrijd tegen ${match.opponent} (${dateStr}) wilt verwijderen? Dit verwijdert ook alle opstellingen, wissels, afwezigheden en gastspelers.`)) {
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
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm sm:text-base"
        >
          ➕ Nieuwe wedstrijd
        </button>
      </div>

      {editingMatch !== null && (
        <MatchEditModal
          match={editingMatch === 'new' ? null : editingMatch}
          schemes={schemes}
          onSave={handleSave}
          onClose={() => setEditingMatch(null)}
        />
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {sortedMatches.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Geen wedstrijden</div>
        ) : (
          sortedMatches.map(match => {
            const matchDate = new Date(match.date);
            const isPast = matchDate < today;
            const isFinalized = match.match_status === 'afgerond';

            return (
              <div
                key={match.id}
                className={`flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50 ${
                  isPast && !isFinalized ? 'opacity-60' : ''
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isFinalized ? 'bg-blue-500' : isPast ? 'bg-gray-500' : 'bg-green-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm sm:text-base truncate">
                    {match.opponent}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      match.home_away === 'Thuis' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'
                    }`}>
                      {match.home_away}
                    </span>
                    {isFinalized && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-400">
                        ✅ Afgerond
                      </span>
                    )}
                    {isFinalized && match.goals_for != null && match.goals_against != null && (
                      <span className="ml-2 text-sm font-black text-yellow-400">
                        {match.goals_for} – {match.goals_against}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                    <span>📅 {matchDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>📋 {formationLabels[match.formation] || match.formation}</span>
                  </div>
                  {/* Inline score editor */}
                  {isFinalized && editingScoreId === match.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number" min="0" max="99"
                        value={scoreGoalsFor}
                        onChange={(e) => setScoreGoalsFor(e.target.value)}
                        className="w-14 px-2 py-1 bg-gray-700 border border-gray-500 rounded text-white text-center font-black text-sm"
                        placeholder="–"
                      />
                      <span className="text-gray-400 font-bold">–</span>
                      <input
                        type="number" min="0" max="99"
                        value={scoreGoalsAgainst}
                        onChange={(e) => setScoreGoalsAgainst(e.target.value)}
                        className="w-14 px-2 py-1 bg-gray-700 border border-gray-500 rounded text-white text-center font-black text-sm"
                        placeholder="–"
                      />
                      <button
                        onClick={() => handleSaveScore(match.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-bold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingScoreId(null)}
                        className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {isFinalized && (
                    <button
                      onClick={() => openScoreEdit(match)}
                      className="px-2 sm:px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded text-xs sm:text-sm font-bold"
                      title="Uitslag bewerken"
                    >
                      ⚽
                    </button>
                  )}
                  {!isFinalized && (
                    <>
                      <button
                        onClick={() => setEditingMatch(match)}
                        className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm font-bold"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(match)}
                        className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm font-bold"
                      >
                        🗑️
                      </button>
                    </>
                  )}
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
