'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';
import type { TeamSettings } from '../../lib/types';
import StepBasicInfo from './wizard/StepBasicInfo';
import StepFormation from './wizard/StepFormation';
import StepSettings from './wizard/StepSettings';
import StepPlayers from './wizard/StepPlayers';
import StepMatch from './wizard/StepMatch';
import StepSummary from './wizard/StepSummary';

const TOTAL_STEPS = 6;

const STEP_LABELS = [
  'Team',
  'Formatie',
  'Stats',
  'Spelers',
  'Wedstrijd',
  'Klaar',
];

type SettingsState = Pick<TeamSettings,
  'track_goals' | 'track_assists' | 'track_minutes' | 'track_spdw' |
  'track_results' | 'track_cards' | 'track_clean_sheets'
>;

const DEFAULT_SETTINGS: SettingsState = {
  track_goals: true,
  track_assists: true,
  track_minutes: true,
  track_spdw: true,
  track_results: true,
  track_cards: false,
  track_clean_sheets: false,
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
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [formationSaved, setFormationSaved] = useState(false);

  // Stap 3
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Stap 4
  const [playersImported, setPlayersImported] = useState(0);

  // Stap 5
  const [matchCreated, setMatchCreated] = useState(false);

  // Stap 6
  const [finishLoading, setFinishLoading] = useState(false);

  // ── Stap 1: Team aanmaken ──────────────────────────────────
  const handleCreateTeam = async () => {
    if (!currentUserId) { setStep1Error('Niet ingelogd'); return; }
    if (name.trim().length < 2) { setStep1Error('Teamnaam moet minimaal 2 tekens zijn'); return; }

    setStep1Loading(true);
    setStep1Error(null);

    // 1. Team aanmaken
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        slug: generateSlug(name.trim()),
        color,
        setup_done: false,
        team_size: 20,
      })
      .select('id')
      .single();

    if (teamError || !teamData) {
      setStep1Error('Kon team niet aanmaken: ' + (teamError?.message ?? 'Onbekende fout'));
      setStep1Loading(false);
      return;
    }

    const newTeamId = teamData.id as string;

    // 2. Gebruiker als manager toevoegen
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

    // 3. Default team_settings aanmaken
    await supabase.from('team_settings').insert({
      team_id: newTeamId,
      default_formation: formation,
      match_duration: 90,
      ...DEFAULT_SETTINGS,
    });

    setTeamId(newTeamId);
    setStep1Loading(false);
    setStep(2);
  };

  // ── Stap 2: Formatie opslaan ───────────────────────────────
  const handleSaveFormation = async () => {
    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({ team_id: teamId, default_formation: formation }, { onConflict: 'team_id' });
      setFormationSaved(true);
    }
    setStep(3);
  };

  // ── Stap 3: Settings opslaan ──────────────────────────────
  const handleSaveSettings = async () => {
    if (teamId) {
      await supabase
        .from('team_settings')
        .upsert({ team_id: teamId, ...settings }, { onConflict: 'team_id' });
      setSettingsSaved(true);
    }
    setStep(4);
  };

  // ── Stap 6: Afronden ──────────────────────────────────────
  const handleFinish = async () => {
    if (!teamId) return;
    setFinishLoading(true);

    // Markeer wizard als voltooid
    await supabase.from('teams').update({ setup_done: true }).eq('id', teamId);

    // Wissel naar het nieuwe team
    await switchTeam(teamId);

    router.push('/');
  };

  const handleSkip = () => setStep(s => s + 1);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-sm text-gray-400">Team aanmaken</span>
        <span className="text-xs text-gray-500">Stap {step} van {TOTAL_STEPS}</span>
      </div>

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
            <StepFormation
              formation={formation}
              onChangeFormation={setFormation}
              onNext={handleSaveFormation}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepSettings
              settings={settings}
              onToggle={(key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }))}
              onNext={handleSaveSettings}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && teamId && (
            <StepPlayers
              teamId={teamId}
              onNext={() => setStep(5)}
              onSkip={handleSkip}
              onPlayersImported={(count) => setPlayersImported(count)}
            />
          )}
          {step === 5 && teamId && (
            <StepMatch
              teamId={teamId}
              defaultFormation={formation}
              onNext={() => setStep(6)}
              onSkip={handleSkip}
              onMatchCreated={() => setMatchCreated(true)}
            />
          )}
          {step === 6 && (
            <StepSummary
              data={{
                name,
                color,
                formation,
                playersImported,
                matchCreated,
                settingsDone: settingsSaved,
              }}
              onFinish={handleFinish}
              isLoading={finishLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
