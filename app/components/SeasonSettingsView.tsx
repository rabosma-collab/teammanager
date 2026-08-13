'use client';

import React, { useEffect, useState } from 'react';
import { useSeasons } from '../hooks/useSeasons';
import { useToast } from '../contexts/ToastContext';
import type { Season, PlayerSeasonStats } from '../lib/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SeasonSettingsView() {
  const { seasons, activeSeason, loading, fetchSeasons, startNewSeason, fetchPlayerSeasonStats } = useSeasons();
  const toast = useToast();

  const [showConfirm, setShowConfirm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedSeasonId, setExpandedSeasonId] = useState<number | null>(null);
  const [seasonStats, setSeasonStats] = useState<Record<number, PlayerSeasonStats[]>>({});
  const [statsLoading, setStatsLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // Stel een standaard naam voor op basis van huidig jaar
  useEffect(() => {
    if (showConfirm && !newName) {
      const year = new Date().getFullYear();
      setNewName(`${year}-${year + 1}`);
    }
  }, [showConfirm, newName]);

  const handleStartNewSeason = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { id, error } = await startNewSeason(newName.trim());
    setSaving(false);
    if (id) {
      toast.success(`Seizoen "${newName.trim()}" gestart!`);
      setShowConfirm(false);
      setNewName('');
    } else {
      toast.error(error ?? 'Er ging iets mis bij het starten van het nieuwe seizoen.');
    }
  };

  const pastSeasons = seasons.filter(s => !s.is_active);

  const toggleSeason = async (seasonId: number) => {
    if (expandedSeasonId === seasonId) {
      setExpandedSeasonId(null);
      return;
    }
    setExpandedSeasonId(seasonId);
    if (!seasonStats[seasonId]) {
      setStatsLoading(seasonId);
      const stats = await fetchPlayerSeasonStats(seasonId);
      setSeasonStats(prev => ({ ...prev, [seasonId]: stats }));
      setStatsLoading(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Laden...</div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <h2 className="text-lg font-bold">Seizoenbeheer</h2>

      {/* Actief seizoen */}
      {activeSeason ? (
        <div className="bg-gray-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Actief seizoen</p>
              <p className="font-bold text-yellow-400 text-lg">{activeSeason.name}</p>
              <p className="text-xs text-gray-500">
                Gestart op {formatDate(activeSeason.start_date)}
              </p>
            </div>
            <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full font-medium">Actief</span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">
          Geen actief seizoen gevonden.
        </div>
      )}

      {/* Nieuw seizoen starten */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition"
        >
          Nieuw seizoen starten
        </button>
      ) : (
        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <p className="text-sm font-semibold">Nieuw seizoen starten</p>
          <p className="text-xs text-gray-400">
            De huidige spelersstats (goals, assists, kaarten, minuten) worden opgeslagen als seizoensarchief en daarna gereset naar 0.
            FIFA-stats en credits blijven ongewijzigd.
          </p>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Naam nieuw seizoen</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="bijv. 2025-2026"
              maxLength={50}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowConfirm(false); setNewName(''); }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded-lg transition"
            >
              Annuleren
            </button>
            <button
              onClick={handleStartNewSeason}
              disabled={saving || !newName.trim()}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-bold py-2 rounded-lg transition"
            >
              {saving ? 'Bezig...' : 'Bevestigen'}
            </button>
          </div>
        </div>
      )}

      {/* Archief */}
      {pastSeasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Archief</p>
          {pastSeasons.map((s: Season) => {
            const isExpanded = expandedSeasonId === s.id;
            const stats = seasonStats[s.id] ?? [];
            const isStatsLoading = statsLoading === s.id;
            return (
              <div key={s.id} className="bg-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSeason(s.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700 transition"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(s.start_date)} – {formatDate(s.end_date)}
                    </p>
                  </div>
                  <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-700 px-4 py-3">
                    {isStatsLoading ? (
                      <p className="text-xs text-gray-400">Statistieken laden...</p>
                    ) : stats.length === 0 ? (
                      <p className="text-xs text-gray-400">Geen statistieken opgeslagen voor dit seizoen.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 text-left">
                              <th className="py-1 pr-2 font-medium">Speler</th>
                              <th className="py-1 px-1 font-medium text-center" title="Goals">G</th>
                              <th className="py-1 px-1 font-medium text-center" title="Assists">A</th>
                              <th className="py-1 px-1 font-medium text-center" title="Gele kaarten">🟨</th>
                              <th className="py-1 px-1 font-medium text-center" title="Rode kaarten">🟥</th>
                              <th className="py-1 px-1 font-medium text-center" title="Eigen doelpunten">EG</th>
                              <th className="py-1 pl-1 font-medium text-center" title="Minuten">Min</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...stats]
                              .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || (a.player?.name ?? '').localeCompare(b.player?.name ?? ''))
                              .map((ps: PlayerSeasonStats) => (
                                <tr key={ps.player_id} className="border-t border-gray-700/50">
                                  <td className="py-1 pr-2">{ps.player?.name ?? 'Onbekend'}</td>
                                  <td className="py-1 px-1 text-center">{ps.goals}</td>
                                  <td className="py-1 px-1 text-center">{ps.assists}</td>
                                  <td className="py-1 px-1 text-center">{ps.yellow_cards}</td>
                                  <td className="py-1 px-1 text-center">{ps.red_cards}</td>
                                  <td className="py-1 px-1 text-center">{ps.own_goals}</td>
                                  <td className="py-1 pl-1 text-center">{ps.min}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
