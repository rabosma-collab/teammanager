'use client';

import React, { useEffect, useState } from 'react';
import { useSeasons } from '../hooks/useSeasons';
import { useToast } from '../contexts/ToastContext';
import type { Season } from '../lib/types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SeasonSettingsView() {
  const { seasons, activeSeason, loading, fetchSeasons, startNewSeason } = useSeasons();
  const toast = useToast();

  const [showConfirm, setShowConfirm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

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
    const id = await startNewSeason(newName.trim());
    setSaving(false);
    if (id) {
      toast.success(`Seizoen "${newName.trim()}" gestart!`);
      setShowConfirm(false);
      setNewName('');
    } else {
      toast.error('Er ging iets mis bij het starten van het nieuwe seizoen.');
    }
  };

  const pastSeasons = seasons.filter(s => !s.is_active);

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
          {pastSeasons.map((s: Season) => (
            <div key={s.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(s.start_date)} – {formatDate(s.end_date)}
                </p>
              </div>
              <span className="text-xs text-gray-500">Afgesloten</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
