'use client';

import React, { useState, useMemo, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import type { Player, TeamSettings } from '../../lib/types';
import {
  generateAutoLineup,
  playerKey,
  type AutoLineupConfig,
  type PeriodLineup,
  type SubstitutionPair,
  type AutoLineupBasis,
  type PositionMode,
} from '../../lib/autoLineup';
import { getPositionCategory, FORMATS_WITHOUT_KEEPER } from '../../lib/constants';

/**
 * Rebuild a period's lineup + bench from the previous period's lineup + the subs array.
 * Mutates the period in place.
 */
function rebuildPeriodLineup(allPeriods: PeriodLineup[], periodIdx: number) {
  if (periodIdx === 0) return; // period 1 has no subs to rebuild from
  const prev = allPeriods[periodIdx - 1];
  const period = allPeriods[periodIdx];

  // Start from previous lineup
  const lineup = [...prev.lineup];
  const subsApplied = new Set<number>();

  for (const sub of period.subs) {
    // Find the slot of the outgoing player
    const slot = lineup.findIndex(p => p && playerKey(p) === playerKey(sub.out));
    if (slot !== -1) {
      lineup[slot] = sub.in;
      subsApplied.add(playerKey(sub.in));
    }
  }

  period.lineup = lineup;

  // Rebuild bench: everyone not in lineup
  const onFieldKeys = new Set(lineup.filter(Boolean).map(p => playerKey(p!)));
  // Collect all players from prev lineup + prev bench + subs
  const allPlayers = new Map<number, Player>();
  for (const p of prev.lineup) { if (p) allPlayers.set(playerKey(p), p); }
  for (const p of prev.bench) { allPlayers.set(playerKey(p), p); }
  for (const s of period.subs) {
    allPlayers.set(playerKey(s.in), s.in);
    allPlayers.set(playerKey(s.out), s.out);
  }
  period.bench = Array.from(allPlayers.values()).filter(p => !onFieldKeys.has(playerKey(p)));
}

interface AutoLineupWizardProps {
  players: Player[];               // all available players for this match (present, not injured)
  settings: TeamSettings;
  gameFormat: string;
  formation: string;
  periods: number;
  matchDuration: number;
  onApply: (result: PeriodLineup[]) => void;
  onClose: () => void;
}

export default function AutoLineupWizard({
  players,
  settings,
  gameFormat,
  formation,
  periods,
  matchDuration,
  onApply,
  onClose,
}: AutoLineupWizardProps) {
  // --- Wizard state ---
  const [step, setStep] = useState<'config' | 'preview'>('config');

  // Config defaults from team settings
  const [basis, setBasis] = useState<AutoLineupBasis>(settings.auto_lineup_basis ?? 'bench_minutes');
  const [rotateGoalkeeper, setRotateGoalkeeper] = useState(settings.auto_lineup_rotate_goalkeeper ?? false);
  const [positionMode, setPositionMode] = useState<PositionMode>(settings.auto_lineup_position_mode ?? 'off');

  // Derived: which basis options are available
  const canUseBenchMinutes = settings.track_minutes;
  const canUsePlayedMinutes = settings.track_played_minutes;
  const hasKeeper = !FORMATS_WITHOUT_KEEPER.has(gameFormat);

  // Ensure selected basis is valid
  const effectiveBasis = useMemo(() => {
    if (basis === 'bench_minutes' && !canUseBenchMinutes && canUsePlayedMinutes) return 'played_minutes';
    if (basis === 'played_minutes' && !canUsePlayedMinutes && canUseBenchMinutes) return 'bench_minutes';
    return basis;
  }, [basis, canUseBenchMinutes, canUsePlayedMinutes]);

  // --- Preview state ---
  const [previewResult, setPreviewResult] = useState<PeriodLineup[] | null>(null);
  const [previewPeriod, setPreviewPeriod] = useState(1);
  const [editingSubIndex, setEditingSubIndex] = useState<{ period: number; index: number; field: 'out' | 'in' } | null>(null);

  const handleGenerate = () => {
    const config: AutoLineupConfig = {
      basis: effectiveBasis,
      rotateGoalkeeper,
      positionMode,
      gameFormat,
      formation,
      periods,
      matchDuration,
    };
    const result = generateAutoLineup(players, config);
    setPreviewResult(result);
    setPreviewPeriod(1);
    setEditingSubIndex(null);
    setStep('preview');
  };

  /** Swap a player in a sub pair and recompute affected lineup/bench */
  const handleEditSub = useCallback((periodIdx: number, subIdx: number, field: 'out' | 'in', newPlayer: Player) => {
    if (!previewResult) return;
    const updated = previewResult.map(p => ({
      ...p,
      lineup: [...p.lineup],
      bench: [...p.bench],
      subs: p.subs.map(s => ({ ...s })),
      warnings: [...p.warnings],
    }));

    const period = updated[periodIdx];
    const sub = period.subs[subIdx];

    if (field === 'out') {
      sub.out = newPlayer;
    } else {
      sub.in = newPlayer;
    }

    // Rebuild this period's lineup from previous period + updated subs
    rebuildPeriodLineup(updated, periodIdx);

    // Also rebuild all subsequent periods (their subs stay, but lineups shift)
    for (let i = periodIdx + 1; i < updated.length; i++) {
      rebuildPeriodLineup(updated, i);
    }

    setPreviewResult(updated);
    setEditingSubIndex(null);
  }, [previewResult]);

  const handleApply = () => {
    if (previewResult) {
      onApply(previewResult);
    }
  };

  const currentPreview = previewResult?.[previewPeriod - 1] ?? null;

  // No minute tracking enabled at all → cannot use feature
  if (!canUseBenchMinutes && !canUsePlayedMinutes) {
    return (
      <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
        <div className="p-5 space-y-4">
          <h2 className="text-lg font-black text-white">🤖 Auto-opstelling</h2>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">
            <p className="font-semibold mb-1">Geen minutenregistratie actief</p>
            <p>Schakel in teaminstellingen &apos;Wisselminuten&apos; of &apos;Gespeelde minuten&apos; in om de auto-opstelling te kunnen gebruiken.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition">
            Sluiten
          </button>
        </div>
      </DraggableModal>
    );
  }

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-lg">
      <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-black text-white">🤖 Auto-opstelling</h2>

        {step === 'config' && (
          <>
            {/* Basis keuze */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">Op basis van</label>
              <div className="space-y-1.5">
                <button
                  disabled={!canUseBenchMinutes}
                  onClick={() => setBasis('bench_minutes')}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                    effectiveBasis === 'bench_minutes'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-700 hover:border-gray-500'
                  } ${!canUseBenchMinutes ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="text-lg">⏱️</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">Wisselminuten</div>
                    <div className="text-xs text-gray-400">Spelers met meer bankminuten krijgen voorrang op het veld</div>
                  </div>
                  {effectiveBasis === 'bench_minutes' && <span className="text-yellow-400 text-sm">✓</span>}
                </button>
                <button
                  disabled={!canUsePlayedMinutes}
                  onClick={() => setBasis('played_minutes')}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                    effectiveBasis === 'played_minutes'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-gray-700 hover:border-gray-500'
                  } ${!canUsePlayedMinutes ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="text-lg">⚽</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">Gespeelde minuten</div>
                    <div className="text-xs text-gray-400">Spelers met meer speelminuten worden eerder gewisseld</div>
                  </div>
                  {effectiveBasis === 'played_minutes' && <span className="text-yellow-400 text-sm">✓</span>}
                </button>
              </div>
              {!canUseBenchMinutes && (
                <p className="text-xs text-gray-500">Wisselminuten niet beschikbaar — schakel in via teaminstellingen.</p>
              )}
              {!canUsePlayedMinutes && (
                <p className="text-xs text-gray-500">Gespeelde minuten niet beschikbaar — schakel in via teaminstellingen.</p>
              )}
            </div>

            {/* Keeper rotatie */}
            {hasKeeper && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-300">Keeperrotatie</label>
                <label className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition">
                  <div>
                    <span className="text-sm font-medium text-white">🧤 Keeper ook wisselen</span>
                    <p className="text-xs text-gray-400 mt-0.5">Keepers worden eerlijk meegenomen in de rotatie</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={rotateGoalkeeper}
                    onClick={() => setRotateGoalkeeper(!rotateGoalkeeper)}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                      rotateGoalkeeper ? 'bg-yellow-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        rotateGoalkeeper ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>
            )}

            {/* Positie voorkeur */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-300">Voorkeurspositie</label>
              <div className="space-y-1.5">
                {([
                  { mode: 'off' as PositionMode, label: 'Uit', desc: 'Iedereen kan overal spelen', icon: '🔀' },
                  { mode: 'soft' as PositionMode, label: 'Voorkeur', desc: 'Probeer voorkeurspositie, wijk af bij betere verdeling', icon: '🎯' },
                  { mode: 'strict' as PositionMode, label: 'Strikt', desc: 'Alleen voorkeurspositie, tenzij tekort', icon: '🔒' },
                ] as const).map(({ mode, label, desc, icon }) => (
                  <button
                    key={mode}
                    onClick={() => setPositionMode(mode)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                      positionMode === mode
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                    {positionMode === mode && <span className="text-yellow-400 text-sm">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Samenvatting */}
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
              <div>📊 <span className="text-white">{players.length}</span> beschikbare spelers</div>
              <div>📐 <span className="text-white">{formation}</span> ({gameFormat})</div>
              <div>🔄 <span className="text-white">{periods}</span> periodes, <span className="text-white">{matchDuration}</span> min totaal</div>
            </div>

            {/* Genereer knop */}
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition text-base"
            >
              🤖 Genereer opstelling
            </button>
          </>
        )}

        {step === 'preview' && currentPreview && (
          <>
            {/* Periode tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {previewResult!.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewPeriod(i + 1)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                    previewPeriod === i + 1
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Periode {i + 1}
                </button>
              ))}
            </div>

            {/* Wissels voor deze periode (editable) */}
            {currentPreview.subs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wissels <span className="text-gray-500 normal-case">(klik om aan te passen)</span></p>
                {currentPreview.subs.map((sub, i) => {
                  const periodIdx = previewPeriod - 1;
                  const prevPeriod = periodIdx > 0 ? previewResult![periodIdx - 1] : null;
                  const isEditingOut = editingSubIndex?.period === previewPeriod && editingSubIndex?.index === i && editingSubIndex?.field === 'out';
                  const isEditingIn = editingSubIndex?.period === previewPeriod && editingSubIndex?.index === i && editingSubIndex?.field === 'in';

                  // Available "out" candidates: players on field in previous period, excluding already-subbed-out players in other subs
                  const usedOutKeys = new Set(currentPreview.subs.filter((_, si) => si !== i).map(s => playerKey(s.out)));
                  const outCandidates = prevPeriod
                    ? prevPeriod.lineup.filter((p): p is Player => p !== null && !usedOutKeys.has(playerKey(p)))
                    : [];

                  // Available "in" candidates: players on bench in previous period, excluding already-subbed-in players in other subs
                  const usedInKeys = new Set(currentPreview.subs.filter((_, si) => si !== i).map(s => playerKey(s.in)));
                  const inCandidates = prevPeriod
                    ? prevPeriod.bench.filter(p => !usedInKeys.has(playerKey(p)))
                    : [];

                  return (
                    <div key={i} className="flex items-center gap-1.5 p-2 bg-gray-700/50 rounded-lg text-sm">
                      <span className="text-red-400 text-xs">↩</span>
                      {isEditingOut ? (
                        <select
                          autoFocus
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                          value={playerKey(sub.out)}
                          onChange={(e) => {
                            const p = outCandidates.find(c => playerKey(c) === Number(e.target.value));
                            if (p) handleEditSub(periodIdx, i, 'out', p);
                          }}
                          onBlur={() => setEditingSubIndex(null)}
                        >
                          {outCandidates.map(p => (
                            <option key={playerKey(p)} value={playerKey(p)}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingSubIndex({ period: previewPeriod, index: i, field: 'out' })}
                          className="text-white font-medium hover:text-yellow-400 transition truncate"
                        >
                          {sub.out.name}
                        </button>
                      )}
                      <span className="text-gray-500">→</span>
                      <span className="text-green-400 text-xs">↪</span>
                      {isEditingIn ? (
                        <select
                          autoFocus
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                          value={playerKey(sub.in)}
                          onChange={(e) => {
                            const p = inCandidates.find(c => playerKey(c) === Number(e.target.value));
                            if (p) handleEditSub(periodIdx, i, 'in', p);
                          }}
                          onBlur={() => setEditingSubIndex(null)}
                        >
                          {inCandidates.map(p => (
                            <option key={playerKey(p)} value={playerKey(p)}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingSubIndex({ period: previewPeriod, index: i, field: 'in' })}
                          className="text-white font-medium hover:text-yellow-400 transition truncate"
                        >
                          {sub.in.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Opstelling */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Opstelling</p>
              <div className="grid grid-cols-2 gap-1">
                {currentPreview.lineup.map((player, i) => {
                  const cat = getPositionCategory(gameFormat, formation, i);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-lg text-sm">
                      <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-600 text-gray-300">{cat.substring(0, 3)}</span>
                      <span className="text-white font-medium truncate">{player?.name ?? '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bank */}
            {currentPreview.bench.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bank</p>
                <div className="flex flex-wrap gap-1">
                  {currentPreview.bench.map((p) => (
                    <span key={`${p.is_guest ? 'g' : 'r'}_${p.id}`} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Waarschuwingen */}
            {currentPreview.warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-yellow-400">⚠️ Let op</p>
                {currentPreview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-300">{w}</p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setStep('config')}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition"
              >
                ← Terug
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition"
              >
                ✅ Toepassen
              </button>
            </div>
          </>
        )}

        {step === 'config' && (
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 transition">
            Annuleer
          </button>
        )}
      </div>
    </DraggableModal>
  );
}
