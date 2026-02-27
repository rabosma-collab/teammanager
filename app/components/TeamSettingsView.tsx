'use client';

import React, { useEffect, useState } from 'react';
import { useTeamContext } from '../contexts/TeamContext';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useToast } from '../contexts/ToastContext';
import { formationLabels, GAME_FORMATS, DEFAULT_FORMATIONS } from '../lib/constants';
import type { TeamSettings } from '../lib/types';

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

type SettingsDraft = Omit<TeamSettings, 'team_id'>;

export default function TeamSettingsView({ onSettingsSaved }: { onSettingsSaved?: () => void }) {
  const { currentTeam, refreshTeam } = useTeamContext();
  const { settings, isLoading, fetchSettings, upsertSettings, updateTeamInfo } = useTeamSettings();
  const toast = useToast();

  // --- Teamgegevens (eigen opslaan) ---
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#f59e0b');
  const [savingTeam, setSavingTeam] = useState(false);

  // --- Settings draft (één opslaan voor spelvorm + formatie + statistieken) ---
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [localDuration, setLocalDuration] = useState<string>('90');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      setTeamName(currentTeam.name);
      setTeamColor(currentTeam.color || '#f59e0b');
      fetchSettings(currentTeam.id);
    }
  }, [currentTeam, fetchSettings]);

  // Initialiseer draft zodra settings geladen zijn
  useEffect(() => {
    if (settings) {
      const duration = settings.match_duration ?? 90;
      setLocalDuration(String(duration));
      setDraft({
        game_format:       settings.game_format       ?? '11v11',
        periods:           settings.periods            ?? 2,
        default_formation: settings.default_formation  ?? '4-3-3-aanvallend',
        match_duration:    duration,
        track_goals:       settings.track_goals        ?? true,
        track_assists:     settings.track_assists      ?? true,
        track_minutes:     settings.track_minutes      ?? true,
        track_cards:       settings.track_cards        ?? false,
        track_clean_sheets:settings.track_clean_sheets ?? false,
        track_spdw:        settings.track_spdw         ?? true,
        track_results:     settings.track_results      ?? true,
      });
    }
  }, [settings]);

  const handleSaveTeamInfo = async () => {
    if (!currentTeam) return;
    if (!teamName.trim() || teamName.trim().length < 2) {
      toast.error('Teamnaam moet minimaal 2 tekens zijn');
      return;
    }
    setSavingTeam(true);
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
    setSavingTeam(false);
  };

  const handleSaveSettings = async () => {
    if (!currentTeam || !draft) return;
    const clampedDuration = Math.max(10, Math.min(120, parseInt(localDuration) || 90));
    setLocalDuration(String(clampedDuration));
    const finalDraft = { ...draft, match_duration: clampedDuration };
    setSavingSettings(true);
    const ok = await upsertSettings(currentTeam.id, finalDraft);
    if (ok) {
      toast.success('✅ Instellingen opgeslagen!');
      onSettingsSaved?.();
    } else {
      toast.error('❌ Kon instellingen niet opslaan');
    }
    setSavingSettings(false);
  };

  const handleGameFormatChange = (fmt: string) => {
    const fmtData = GAME_FORMATS[fmt];
    const defaultFormation = DEFAULT_FORMATIONS[fmt] ?? '4-3-3-aanvallend';
    setLocalDuration(String(fmtData.match_duration));
    setDraft(prev => prev ? {
      ...prev,
      game_format:       fmt,
      periods:           fmtData.periods,
      match_duration:    fmtData.match_duration,
      default_formation: defaultFormation,
    } : null);
  };

  const handleFormationChange = (formation: string) => {
    setDraft(prev => prev ? { ...prev, default_formation: formation } : null);
  };

  const handleDurationChange = (value: string) => {
    setLocalDuration(value);
  };

  const handleToggle = (key: keyof SettingsDraft, value: boolean) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (isLoading || !settings || !draft) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  const currentFormat = draft.game_format ?? '11v11';
  const availableFormations = formationLabels[currentFormat] ?? formationLabels['11v11'];

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
            disabled={savingTeam}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg disabled:opacity-50 transition"
          >
            {savingTeam ? 'Opslaan...' : 'Opslaan'}
          </button>
        </section>

        {/* ── Spelvorm ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-base text-gray-200">Spelvorm</h2>
          <p className="text-sm text-gray-400">
            Bepaalt het aantal spelers en periodes.
            <span className="text-yellow-500 ml-1">Let op: wijzigen reset de standaard formatie.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(GAME_FORMATS).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleGameFormatChange(fmt)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
                  currentFormat === fmt
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            {GAME_FORMATS[currentFormat]?.players} spelers ·{' '}
            {GAME_FORMATS[currentFormat]?.periods} periodes
          </div>

          <div className="pt-2 border-t border-gray-700">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Wedstrijdduur (totaal)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={localDuration}
                onChange={(e) => handleDurationChange(e.target.value)}
                min={10}
                max={120}
                step={5}
                className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center focus:outline-none focus:border-yellow-500"
              />
              <span className="text-sm text-gray-400">minuten totaal</span>
              <span className="text-xs text-gray-500">
                ({GAME_FORMATS[currentFormat]?.periods ?? 2}×{Math.round((parseInt(localDuration) || 90) / (GAME_FORMATS[currentFormat]?.periods ?? 2))} min)
              </span>
            </div>
          </div>
        </section>

        {/* ── Standaard formatie ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-base text-gray-200">Standaard formatie</h2>
          <p className="text-sm text-gray-400">Wordt als standaard gebruikt bij nieuwe wedstrijden.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(availableFormations).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleFormationChange(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  draft.default_formation === key
                    ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Statistieken bijhouden ── */}
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
                  aria-checked={draft[key as keyof SettingsDraft] as boolean}
                  onClick={() => handleToggle(key as keyof SettingsDraft, !(draft[key as keyof SettingsDraft] as boolean))}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                    draft[key as keyof SettingsDraft] ? 'bg-yellow-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      draft[key as keyof SettingsDraft] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </section>

        {/* ── Opslaan ── */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg disabled:opacity-50 transition text-base"
          >
            {savingSettings ? 'Opslaan...' : '💾 Instellingen opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
