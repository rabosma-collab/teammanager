'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';
import { GAME_FORMATS, DEFAULT_FORMATIONS } from '../../lib/constants';
import type { TeamSettings } from '../../lib/types';
import StepBasicInfo from './wizard/StepBasicInfo';
import StepSpelvorm from './wizard/StepSpelvorm';
import StepFormation from './wizard/StepFormation';
import StepSettings from './wizard/StepSettings';
import StepPlayers from './wizard/StepPlayers';
import StepMatch from './wizard/StepMatch';
import StepSummary from './wizard/StepSummary';
import StepWedstrijdbeheer from './wizard/StepWedstrijdbeheer';

const TOTAL_STEPS = 8;

const STEP_LABELS = [
  'Team',
  'Spelvorm',
  'Formatie',
  'Stats',
  'Beheer',
  'Spelers',
  'Wedstrijd',
  'Klaar',
];

type SettingsState = Pick<TeamSettings,
  'track_goals' | 'track_assists' | 'track_minutes' | 'track_played_minutes' | 'track_spdw' |
  'track_results' | 'track_cards' | 'track_clean_sheets'
>;

const DEFAULT_SETTINGS: SettingsState = {
  track_goals: true,
  track_assists: true,
  track_minutes: true,
  track_played_minutes: false,
  track_spdw: true,
  track_results: true,
  track_cards: false,
  track_clean_sheets: false,
};

type WedstrijdState = Pick<TeamSettings,
  'track_wasbeurt' | 'track_consumpties' | 'track_vervoer' | 'vervoer_count' |
  'track_assembly_time' | 'track_match_time' | 'track_location_details'
>;

const DEFAULT_WEDSTRIJD: WedstrijdState = {
  track_wasbeurt: true,
  track_consumpties: true,
  track_vervoer: true,
  vervoer_count: 3,
  track_assembly_time: false,
  track_match_time: false,
  track_location_details: false,
};

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

export default function TeamSetupWizard() {
  const router = useRouter();
  const { currentUserId, switchTeam } = useTeamContext();

  const [step, setStep] = useState(1);
  const [teamId, setTeamId] = useState<string | null>(null);

  // Stap 1
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Stap 2
  const [gameFormat, setGameFormat] = useState('11v11');
  const [matchDuration, setMatchDuration] = useState(GAME_FORMATS['11v11'].match_duration);
  const [periods, setPeriods] = useState(2);

  // Stap 3
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [formationSaved, setFormationSaved] = useState(false);

  // Stap 4
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Stap 5
  const [wedstrijd, setWedstrijd] = useState<WedstrijdState>(DEFAULT_WEDSTRIJD);

  // Stap 6
  const [playersImported, setPlayersImported] = useState(0);

  // Stap 7
  const [matchCreated, setMatchCreated] = useState(false);

  // Stap 7
  const [finishLoading, setFinishLoading] = useState(false);

  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [startingOver, setStartingOver] = useState(false);

  // Herstel wizard vanuit localStorage als de gebruiker terugkomt
  useEffect(() => {
    const saved = localStorage.getItem('team_manager_wizard');
    if (!saved) return;
    try {
      const { savedTeamId, savedStep } = JSON.parse(saved);
      if (!savedTeamId) return;
      // Controleer of dit team nog bestaat en nog niet afgerond is
      supabase
        .from('teams')
        .select('id, name, color')
        .eq('id', savedTeamId)
        .eq('setup_done', false)
        .single()
        .then(async ({ data: teamData }: { data: { id: string; name: string; color: string | null } | null }) => {
          if (!teamData) {
            localStorage.removeItem('team_manager_wizard');
            return;
          }
          const { data: s } = await supabase
            .from('team_settings')
            .select('default_formation, game_format, match_duration')
            .eq('team_id', savedTeamId)
            .single();
          setTeamId(savedTeamId);
          setName(teamData.name);
          setColor(teamData.color ?? '#f59e0b');
          if (s) {
            setFormation(s.default_formation ?? '4-3-3-aanvallend');
            setGameFormat(s.game_format ?? '11v11');
            setMatchDuration(s.match_duration ?? 90);
          }
          setStep(savedStep ?? 2);
          setRestoredFromStorage(true);
        });
    } catch {
      localStorage.removeItem('team_manager_wizard');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sla voortgang op in localStorage zodra teamId of step wijzigt
  useEffect(() => {
    if (teamId) {
      localStorage.setItem('team_manager_wizard', JSON.stringify({ savedTeamId: teamId, savedStep: step }));
    }
  }, [teamId, step]);

  // ── Stap 1: Team aanmaken ──────────────────────────────────
  const handleCreateTeam = async () => {
    if (!currentUserId) { setStep1Error('Niet ingelogd'); return; }
    if (name.trim().length < 2) { setStep1Error('Teamnaam moet minimaal 2 tekens zijn'); return; }

    setStep1Loading(true);
    setStep1Error(null);

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        slug: generateSlug(name.trim()),
        color,
        setup_done: false,
      })
      .select('id')
      .single();

    if (teamError || !teamData) {
      setStep1Error('Kon team niet aanmaken: ' + (teamError?.message ?? 'Onbekende fout'));
      setStep1Loading(false);
      return;
    }

    const newTeamId = teamData.id as string;

    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: newTeamId,
      user_id: currentUserId,
      role: 'manager',
      status: 'active',
    });

    if (memberError) {
      setStep1Error('Kon teamlidmaatschap niet aanmaken: ' + memberError.message);
      setStep1Loading(false);
      return;
    }

    // Default team_settings aanmaken met defaults voor 11v11
    await supabase.from('team_settings').insert({
      team_id: newTeamId,
      game_format: '11v11',
      periods: 2,
      default_formation: '4-3-3-aanvallend',
      match_duration: 90,
      ...DEFAULT_SETTINGS,
    });

    setTeamId(newTeamId);
    setStep1Loading(false);
    setStep(2);
  };

  // ── Stap 2: Spelvorm opslaan ──────────────────────────────
  const handleSaveGameFormat = async (fmt: string) => {
    setGameFormat(fmt);
    // Reset formation naar default voor de gekozen spelvorm
    const defaultFormation = DEFAULT_FORMATIONS[fmt] ?? '4-3-3-aanvallend';
    setFormation(defaultFormation);

    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({
          team_id: teamId,
          game_format: fmt,
          periods,
          match_duration: matchDuration,
          default_formation: defaultFormation,
        }, { onConflict: 'team_id' });
    }
    setStep(3);
  };

  // ── Stap 3: Formatie opslaan ──────────────────────────────
  const handleSaveFormation = async () => {
    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({ team_id: teamId, default_formation: formation }, { onConflict: 'team_id' });
      setFormationSaved(true);
    }
    setStep(4);
  };

  // ── Stap 4: Settings opslaan ──────────────────────────────
  const handleSaveSettings = async () => {
    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({ team_id: teamId, ...settings }, { onConflict: 'team_id' });
      setSettingsSaved(true);
    }
    setStep(5);
  };

  // ── Stap 5: Wedstrijdbeheer opslaan ───────────────────────
  const handleSaveWedstrijd = async () => {
    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({ team_id: teamId, ...wedstrijd }, { onConflict: 'team_id' });
    }
    setStep(6);
  };

  // ── Stap 8: Afronden ──────────────────────────────────────
  const handleFinish = async () => {
    if (!teamId) return;
    setFinishLoading(true);
    await supabase.from('teams').update({ setup_done: true, status: 'pending' }).eq('id', teamId);

    // Haal e-mail van de ingelogde gebruiker op voor de notificatiemail
    const { data: { user } } = await supabase.auth.getUser();
    await fetch('/api/notify-team-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamName: name, managerEmail: user?.email ?? null, teamId }),
    });

    localStorage.removeItem('team_manager_wizard');
    router.push('/');
  };

  const handleSkip = () => setStep((s: number) => s + 1);

  const handleStartOver = async () => {
    setStartingOver(true);
    if (teamId) {
      await supabase.from('teams').update({ setup_done: true, status: 'pending' }).eq('id', teamId);
    }
    localStorage.removeItem('team_manager_wizard');
    setTeamId(null);
    setStep(1);
    setName('');
    setColor('#f59e0b');
    setGameFormat('11v11');
    setMatchDuration(90);
    setFormation('4-3-3-aanvallend');
    setFormationSaved(false);
    setSettings(DEFAULT_SETTINGS);
    setSettingsSaved(false);
    setWedstrijd(DEFAULT_WEDSTRIJD);
    setPlayersImported(0);
    setMatchCreated(false);
    setRestoredFromStorage(false);
    setStartingOver(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-sm text-gray-400">Team aanmaken</span>
        <span className="text-xs text-gray-500">Stap {step} van {TOTAL_STEPS}</span>
      </div>

      {/* Hervat-banner: zichtbaar als de wizard hervat is vanuit localStorage */}
      {restoredFromStorage && step > 1 && (
        <div className="bg-blue-900/40 border-b border-blue-700/50 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-blue-300">Verder gegaan waar je gebleven was</span>
          <button
            onClick={handleStartOver}
            disabled={startingOver}
            className="text-blue-400 hover:text-blue-200 underline transition disabled:opacity-50"
          >
            {startingOver ? 'Bezig...' : 'Begin opnieuw'}
          </button>
        </div>
      )}

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-4 px-4 bg-gray-800/50">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const done = step > stepNum;
          const active = step === stepNum;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-yellow-500 text-black scale-110'
                    : 'bg-gray-700 text-gray-500'
                }`}
              >
                {done ? '✓' : stepNum}
              </div>
              <span className={`text-[10px] hidden sm:block ${active ? 'text-yellow-400' : done ? 'text-green-400' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto flex justify-center px-4 py-6">
        <div className="w-full max-w-md">
          {step === 1 && (
            <StepBasicInfo
              name={name}
              color={color}
              onChangeName={setName}
              onChangeColor={setColor}
              onNext={handleCreateTeam}
              isLoading={step1Loading}
              error={step1Error}
            />
          )}
          {step === 2 && (
            <StepSpelvorm
              gameFormat={gameFormat}
              matchDuration={matchDuration}
              periods={periods}
              onChangeGameFormat={(fmt) => {
                setGameFormat(fmt);
                setMatchDuration(GAME_FORMATS[fmt].match_duration);
              }}
              onChangeMatchDuration={setMatchDuration}
              onChangePeriods={setPeriods}
              onNext={() => handleSaveGameFormat(gameFormat)}
              onBack={() => setStep(1)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepFormation
              gameFormat={gameFormat}
              formation={formation}
              onChangeFormation={setFormation}
              onNext={handleSaveFormation}
              onBack={() => setStep(2)}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepSettings
              settings={settings}
              onToggle={(key) => setSettings((prev: SettingsState) => ({ ...prev, [key]: !prev[key] }))}
              onNext={handleSaveSettings}
              onBack={() => setStep(3)}
              onSkip={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <StepWedstrijdbeheer
              settings={wedstrijd}
              onToggle={(key) => setWedstrijd((prev: WedstrijdState) => ({ ...prev, [key]: !prev[key] }))}
              onVervoerCountChange={(count) => setWedstrijd((prev: WedstrijdState) => ({ ...prev, vervoer_count: count }))}
              onNext={handleSaveWedstrijd}
              onBack={() => setStep(4)}
              onSkip={() => setStep(6)}
            />
          )}
          {step === 6 && teamId && (
            <StepPlayers
              teamId={teamId}
              currentUserId={currentUserId}
              onNext={() => setStep(7)}
              onBack={() => setStep(5)}
              onSkip={handleSkip}
              onPlayersImported={(count) => setPlayersImported(count)}
            />
          )}
          {step === 7 && teamId && (
            <StepMatch
              teamId={teamId}
              defaultFormation={formation}
              onNext={() => setStep(8)}
              onBack={() => setStep(6)}
              onSkip={handleSkip}
              onMatchCreated={() => setMatchCreated(true)}
            />
          )}
          {step === 8 && (
            <StepSummary
              data={{
                name,
                color,
                gameFormat,
                formation,
                playersImported,
                matchCreated,
                settingsDone: settingsSaved,
              }}
              onFinish={handleFinish}
              onBack={() => setStep(7)}
              isLoading={finishLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
