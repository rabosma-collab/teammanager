'use client';

import React, { useEffect, useState } from 'react';
import { useTeamContext } from '../contexts/TeamContext';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { formationLabels, GAME_FORMATS, DEFAULT_FORMATIONS } from '../lib/constants';
import InfoButton from './InfoButton';
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
  const { currentTeam, isManager, refreshTeam } = useTeamContext();
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

  // --- Team verwijderen ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingTeam, setDeletingTeam] = useState(false);

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
        track_wasbeurt:         settings.track_wasbeurt         ?? true,
        track_consumpties:      settings.track_consumpties      ?? true,
        track_assembly_time:    settings.track_assembly_time    ?? false,
        track_match_time:       settings.track_match_time       ?? false,
        track_location_details: settings.track_location_details ?? false,
        track_played_minutes:   settings.track_played_minutes   ?? false,
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

  const handleDeleteTeam = async () => {
    if (!currentTeam || !isManager || deleteConfirmName !== currentTeam.name) return;
    setDeletingTeam(true);
    try {
      const teamId = currentTeam.id;

      // Haal match- en speler-IDs op voor cascade-achtige verwijdering
      const { data: matchRows } = await supabase.from('matches').select('id').eq('team_id', teamId);
      const matchIds = (matchRows ?? []).map((m: { id: number }) => m.id);

      const { data: playerRows } = await supabase.from('players').select('id, avatar_url').eq('team_id', teamId);
      const playerIds = (playerRows ?? []).map((p: { id: number }) => p.id);

      // Verwijder avatars uit Storage vóór de database-records
      const avatarPaths = (playerRows ?? [])
        .map((p: { avatar_url?: string | null }) => p.avatar_url?.match(/\/avatars\/(.+?)(\?|$)/)?.[1])
        .filter((path: string | undefined): path is string => Boolean(path));
      if (avatarPaths.length > 0) {
        await supabase.storage.from('avatars').remove(avatarPaths);
      }

      if (matchIds.length > 0) {
        await supabase.from('lineups').delete().in('match_id', matchIds);
        await supabase.from('substitutions').delete().in('match_id', matchIds);
        await supabase.from('match_absences').delete().in('match_id', matchIds);
        await supabase.from('match_position_instructions').delete().in('match_id', matchIds);
        await supabase.from('guest_players').delete().in('match_id', matchIds);
      }

      if (playerIds.length > 0) {
        await supabase.from('stat_credit_transactions').delete().in('player_id', playerIds);
      }

      await supabase.from('player_of_week_votes').delete().eq('team_id', teamId);
      await supabase.from('stat_credits').delete().eq('team_id', teamId);
      await supabase.from('players').delete().eq('team_id', teamId);
      await supabase.from('matches').delete().eq('team_id', teamId);
      await supabase.from('position_instructions').delete().eq('team_id', teamId);
      await supabase.from('team_settings').delete().eq('team_id', teamId);
      await supabase.from('invite_tokens').delete().eq('team_id', teamId);
      await supabase.from('announcements').delete().eq('team_id', teamId);
      await supabase.from('team_members').delete().eq('team_id', teamId);
      const { error: teamDeleteError } = await supabase.from('teams').delete().eq('id', teamId);
      if (teamDeleteError) throw teamDeleteError;

      window.location.href = '/';
    } catch {
      toast.error('Fout bij verwijderen van team');
      setDeletingTeam(false);
    }
  };

  const handleGameFormatChange = (fmt: string) => {
    const fmtData = GAME_FORMATS[fmt];
    const defaultFormation = DEFAULT_FORMATIONS[fmt] ?? '4-3-3-aanvallend';
    setLocalDuration(String(fmtData.match_duration));
    setDraft(prev => prev ? {
      ...prev,
      game_format:       fmt,
      match_duration:    fmtData.match_duration,
      default_formation: defaultFormation,
      // periods wordt NIET gereset — manager kiest dit zelf
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
            {GAME_FORMATS[currentFormat]?.players} spelers
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Aantal periodes</label>
            <div className="flex gap-2">
              {[2, 3, 4].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft(prev => prev ? { ...prev, periods: p } : null)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition ${
                    draft.periods === p
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-600 hover:border-gray-500 text-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {draft.periods} periodes van {Math.round((parseInt(localDuration) || 90) / draft.periods)} minuten
            </p>
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
                ({draft.periods}×{Math.round((parseInt(localDuration) || 90) / draft.periods)} min)
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

        {/* ── Wedstrijdbeheer ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="font-bold text-base text-gray-200">Wedstrijdbeheer</h2>

          {/* Wedstrijdinfo */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wedstrijdinfo</p>
            <p className="text-xs text-gray-500">Informatie die je vastlegt bij het aanmaken van een wedstrijd.</p>
            {[
              { key: 'track_assembly_time',      label: '🕐 Verzameltijd' },
              { key: 'track_match_time',         label: '⚽ Speeltijd (aanvang)' },
              { key: 'track_location_details',   label: '📍 Kleedkamer / locatie' },
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

          <div className="border-t border-gray-700" />

          {/* Wedstrijdtaken */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wedstrijdtaken</p>
            <p className="text-xs text-gray-500">Taken die je toewijst bij het maken van de opstelling.</p>
            {[
              { key: 'track_wasbeurt',    label: '🧺 Wasbeurt' },
              { key: 'track_consumpties', label: '🥤 Consumpties' },
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

        {/* ── Statistieken bijhouden ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-gray-200">Statistieken bijhouden</h2>
            <InfoButton>
              <p className="font-semibold text-white mb-1">Wat doen deze toggles?</p>
              <div className="space-y-1">
                <div><span className="text-white font-semibold">⚽ Doelpunten / 🎯 Assists</span> — zichtbaar op de ranglijst en spelerskaarten.</div>
                <div><span className="text-white font-semibold">⏱️ Speeltijd</span> — telt bankminuten bij; zichtbaar op de ranglijst.</div>
                <div><span className="text-white font-semibold">🏆 SPDW</span> — toont de Speler van de Week-stemming op het Dashboard en ranglijst.</div>
                <div><span className="text-white font-semibold">🟨 Kaarten</span> — gele en rode kaarten bijhouden bij het afronden van een wedstrijd.</div>
              </div>
              <p className="mt-1.5 text-gray-500">Uitgeschakelde stats worden niet meer getoond, maar eerder ingevoerde data blijft bewaard.</p>
            </InfoButton>
          </div>
          <p className="text-sm text-gray-400">Kies welke stats zichtbaar zijn op de ranglijst.</p>

          <div className="space-y-2">
            {[
              { key: 'track_goals',        label: '⚽ Doelpunten' },
              { key: 'track_assists',      label: '🎯 Assists' },
              { key: 'track_minutes',        label: '⏱️ Wisselminuten' },
              { key: 'track_played_minutes', label: '⏱️ Gespeelde minuten' },
              { key: 'track_spdw',         label: '🏆 SPDW (speler van de week)' },
              { key: 'track_cards',        label: '🟨 Kaarten (geel/rood)' },
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

        {/* ── Gevaarzone ── */}
        <section className="bg-gray-800 rounded-xl p-5 space-y-3 border border-red-900/40">
          <h2 className="font-bold text-base text-red-400">Gevaarzone</h2>
          <p className="text-sm text-gray-400">
            Het verwijderen van een team wist alle spelers, wedstrijden, statistieken en instellingen permanent. Dit kan niet ongedaan worden gemaakt.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 text-red-400 font-bold rounded-lg transition text-sm"
            >
              Team verwijderen
            </button>
          ) : (
            <div className="space-y-3 p-4 bg-red-900/20 border border-red-700/60 rounded-xl">
              <p className="text-sm text-red-300 font-medium">
                Weet je zeker dat je <strong>{currentTeam?.name}</strong> wilt verwijderen?
              </p>
              <p className="text-xs text-gray-400">Typ de teamnaam om te bevestigen:</p>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={currentTeam?.name ?? ''}
                className="w-full px-3 py-2 bg-gray-900 border border-red-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteTeam}
                  disabled={deleteConfirmName !== currentTeam?.name || deletingTeam}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition"
                >
                  {deletingTeam ? 'Verwijderen...' : 'Ja, verwijder dit team'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg text-sm transition"
                >
                  Annuleer
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
