'use client';

import React, { useEffect, useState } from 'react';
import { useTeamContext } from '../contexts/TeamContext';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useToast } from '../contexts/ToastContext';
import { formationLabels } from '../lib/constants';

const PRESET_COLORS = [
  { hex: '#f59e0b', name: 'Geel' },
  { hex: '#ef4444', name: 'Rood' },
  { hex: '#3b82f6', name: 'Blauw' },
  { hex: '#22c55e', name: 'Groen' },
  { hex: '#f97316', name: 'Oranje' },
  { hex: '#a855f7', name: 'Paars' },
  { hex: '#ec4899', name: 'Roze' },
  { hex: '#ffffff', name: 'Wit' },
];

export default function TeamSettingsView() {
  const { currentTeam, refreshTeam } = useTeamContext();
  const { settings, isLoading, fetchSettings, upsertSettings, updateTeamInfo } = useTeamSettings();
  const toast = useToast();

  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#f59e0b');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      setTeamName(currentTeam.name);
      setTeamColor(currentTeam.color || '#f59e0b');
      fetchSettings(currentTeam.id);
    }
  }, [currentTeam, fetchSettings]);

  const handleSaveTeamInfo = async () => {
    if (!currentTeam) return;
    if (!teamName.trim() || teamName.trim().length < 2) {
      toast.error('Teamnaam moet minimaal 2 tekens zijn');
      return;
    }
    setSaving(true);
    const ok = await updateTeamInfo(currentTeam.id, {
      name: teamName.trim(),
      color: teamColor,
    });
    if (ok) {
      await refreshTeam();
      toast.success('✅ Teamgegevens opgeslagen!');
    } else {
      toast.error('❌ Kon teamgegevens niet opslaan');
    }
    setSaving(false);
  };

  const handleToggle = async (key: string, value: boolean) => {
    if (!currentTeam) return;
    const ok = await upsertSettings(currentTeam.id, { [key]: value });
    if (!ok) toast.error('❌ Kon instelling niet opslaan');
  };

  const handleFormationChange = async (formation: string) => {
    if (!currentTeam) return;
    const ok = await upsertSettings(currentTeam.id, { default_formation: formation });
    if (!ok) toast.error('❌ Kon formatie niet opslaan');
  };

  if (isLoading || !settings) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-black">⚙️ Teaminstellingen</h1>

        {/* ── Teamgegevens ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-base text-gray-200">Teamgegevens</h2>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Teamnaam</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-500"
              placeholder="Naam van het team"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Teamkleur</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setTeamColor(c.hex)}
                  title={c.name}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    teamColor === c.hex ? 'border-white scale-110' : 'border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer bg-transparent border-0"
                title="Aangepaste kleur"
              />
              <span className="text-sm text-gray-400 font-mono">{teamColor}</span>
              <span
                className="ml-auto px-3 py-1 rounded-full text-sm font-bold text-black"
                style={{ backgroundColor: teamColor }}
              >
                {teamName || 'Voorbeeld'}
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveTeamInfo}
            disabled={saving}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg disabled:opacity-50 transition"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </section>

        {/* ── Standaard formatie ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-base text-gray-200">Standaard formatie</h2>
          <p className="text-sm text-gray-400">Wordt als standaard gebruikt bij nieuwe wedstrijden.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(formationLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleFormationChange(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  settings.default_formation === key
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Ranglijst bijhouden ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-base text-gray-200">Statistieken bijhouden</h2>
          <p className="text-sm text-gray-400">Kies welke stats zichtbaar zijn op de ranglijst.</p>

          <div className="space-y-2">
            {[
              { key: 'track_goals',        label: '⚽ Doelpunten' },
              { key: 'track_assists',      label: '🎯 Assists' },
              { key: 'track_minutes',      label: '⏱️ Speeltijd (bankminuten)' },
              { key: 'track_spdw',         label: '🏆 SPDW (speler van de week)' },
              { key: 'track_results',      label: '📊 Wedstrijduitslagen' },
              { key: 'track_cards',        label: '🟨 Kaarten (geel/rood)' },
              { key: 'track_clean_sheets', label: '🧤 Clean sheets (keeper)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition">
                <span className="text-sm font-medium">{label}</span>
                <button
                  role="switch"
                  aria-checked={settings[key as keyof typeof settings] as boolean}
                  onClick={() => handleToggle(key, !(settings[key as keyof typeof settings] as boolean))}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                    settings[key as keyof typeof settings] ? 'bg-yellow-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings[key as keyof typeof settings] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
