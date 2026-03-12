'use client';

import React, { useState, useMemo } from 'react';
import type { Match, Player, TeamSettings } from '../../lib/types';

interface GoalEntry {
  scorer_id: number | null;
  assist_id: number | null;
  is_own_goal: boolean;
}

interface CardEntry {
  player_id: number | null;
  card_type: 'yellow' | 'red';
}

interface FinalizeMatchModalProps {
  match: Match;
  players: Player[]; // alle spelers incl. gasten
  teamSettings: TeamSettings | null;
  teamName: string;
  onFinalize: (params: {
    calcMinutes: boolean;
    goalsFor: number | null;
    goalsAgainst: number | null;
    stats: Array<{ player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>;
  }) => Promise<void>;
  onClose: () => void;
}

type Step = 'uitslag' | 'doelpunten' | 'kaarten' | 'bevestig';

export default function FinalizeMatchModal({
  match,
  players,
  teamSettings,
  teamName,
  onFinalize,
  onClose,
}: FinalizeMatchModalProps) {
  const trackGoals   = teamSettings?.track_goals   ?? true;
  const trackAssists = teamSettings?.track_assists  ?? true;
  const trackCards   = teamSettings?.track_cards    ?? false;

  // Step state
  const steps: Step[] = useMemo(() => {
    const s: Step[] = ['uitslag'];
    if (trackGoals) s.push('doelpunten');
    if (trackCards) s.push('kaarten');
    s.push('bevestig');
    return s;
  }, [trackGoals, trackCards]);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  // Step 1 — Uitslag
  const [calcMinutes, setCalcMinutes] = useState(true);
  const [goalsFor, setGoalsFor] = useState<number | null>(null);
  const [goalsAgainst, setGoalsAgainst] = useState<number | null>(null);

  // Step 2 — Doelpunten
  const [goals, setGoals] = useState<GoalEntry[]>([{ scorer_id: null, assist_id: null, is_own_goal: false }]);

  // Step 3 — Kaarten
  const [cards, setCards] = useState<CardEntry[]>([{ player_id: null, card_type: 'yellow' }]);

  const [saving, setSaving] = useState(false);

  // Beschikbare spelers voor selects (geen gasten voor career-stats, maar toelaten voor match-context)
  const selectablePlayers = useMemo(
    () => players.filter(p => !p.is_guest).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // Berekend overzicht van stats per speler voor bevestig-stap
  const computedStats = useMemo(() => {
    const map = new Map<number, { player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>();

    const ensure = (id: number) => {
      if (!map.has(id)) map.set(id, { player_id: id, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, own_goals: 0 });
      return map.get(id)!;
    };

    for (const g of goals) {
      if (g.scorer_id) {
        if (g.is_own_goal) {
          ensure(g.scorer_id).own_goals++;
        } else {
          ensure(g.scorer_id).goals++;
          if (g.assist_id) ensure(g.assist_id).assists++;
        }
      }
    }
    for (const c of cards) {
      if (c.player_id) {
        const s = ensure(c.player_id);
        if (c.card_type === 'yellow') s.yellow_cards++;
        else s.red_cards++;
      }
    }

    return Array.from(map.values()).filter(s => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0);
  }, [goals, cards]);

  const getPlayerName = (id: number) =>
    players.find(p => p.id === id)?.name ?? `Speler ${id}`;

  const goNext = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  const handleFinalize = async () => {
    setSaving(true);
    await onFinalize({
      calcMinutes,
      goalsFor:     goalsFor,
      goalsAgainst: goalsAgainst,
      stats:        computedStats,
    });
    setSaving(false);
  };

  // Voortgangsindicator
  const stepLabels: Record<Step, string> = {
    uitslag:    'Uitslag',
    doelpunten: 'Doelpunten',
    kaarten:    'Kaarten',
    bevestig:   'Bevestig',
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">🏁 Wedstrijd afsluiten</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {match.opponent} · {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl hover:text-red-400 p-1 transition">✕</button>
        </div>

        {/* Stap-indicator */}
        <div className="flex items-center gap-1 px-5 py-3 flex-shrink-0">
          {steps.map((step, i) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                i === stepIndex ? 'text-yellow-400' : i < stepIndex ? 'text-green-400' : 'text-gray-500'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  i < stepIndex ? 'bg-green-600' : i === stepIndex ? 'bg-yellow-500 text-black' : 'bg-gray-700'
                }`}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                <span className="hidden sm:block">{stepLabels[step]}</span>
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-700 mx-1" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content — scrollbaar */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">

          {/* ─── STAP 1: UITSLAG ─── */}
          {currentStep === 'uitslag' && (
            <div className="space-y-4 pt-1">
              <div className="p-3 bg-gray-700/50 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcMinutes}
                    onChange={e => setCalcMinutes(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-green-500 flex-shrink-0"
                  />
                  <div>
                    <div className="font-bold text-sm">Speelminuten automatisch berekenen</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Berekent wisselminuten en telt deze op bij spelers. Schakel uit bij extra tijd of handmatige invoer.
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <div className="text-sm font-bold mb-2">Uitslag</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-2">{teamName}</div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setGoalsFor(v => v === null || v === 0 ? null : v - 1)}
                        className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
                        disabled={goalsFor === null}
                      >−</button>
                      <span className="text-4xl font-black w-10 text-center tabular-nums">
                        {goalsFor ?? '–'}
                      </span>
                      <button
                        onClick={() => setGoalsFor(v => (v ?? -1) + 1)}
                        className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white text-2xl font-bold transition flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                  <div className="text-gray-400 font-black text-xl">–</div>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-2">Tegenstander</div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setGoalsAgainst(v => v === null || v === 0 ? null : v - 1)}
                        className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
                        disabled={goalsAgainst === null}
                      >−</button>
                      <span className="text-4xl font-black w-10 text-center tabular-nums">
                        {goalsAgainst ?? '–'}
                      </span>
                      <button
                        onClick={() => setGoalsAgainst(v => (v ?? -1) + 1)}
                        className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white text-2xl font-bold transition flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Waarschuwing als doelpunten-stap volgt maar geen uitslag is ingevuld */}
              {trackGoals && goalsFor === null && (
                <p className="text-xs text-amber-400">
                  Tip: vul eigen goals in voor de doelpunten-stap.
                </p>
              )}
            </div>
          )}

          {/* ─── STAP 2: DOELPUNTEN & ASSISTS ─── */}
          {currentStep === 'doelpunten' && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-gray-400">
                Voeg per doelpunt de schutter toe, en optioneel de aangever.
                {goalsFor !== null && (
                  <span className="ml-1 text-yellow-400 font-bold">
                    ({goals.filter(g => g.scorer_id && !g.is_own_goal).length}/{goalsFor} doelpunten ingevuld)
                  </span>
                )}
              </div>

              {goals.map((goal, i) => (
                <div key={i} className={`flex gap-2 items-start p-3 rounded-lg ${goal.is_own_goal ? 'bg-orange-900/30 border border-orange-700/50' : 'bg-gray-700/40'}`}>
                  <span className="text-gray-400 text-sm font-bold w-5 pt-2 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    {/* Eigen doelpunt toggle */}
                    <button
                      onClick={() => setGoals(prev => prev.map((g, j) =>
                        j === i ? { ...g, is_own_goal: !g.is_own_goal, assist_id: null } : g
                      ))}
                      className={`text-xs px-2 py-1 rounded font-bold transition ${
                        goal.is_own_goal
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      🥅 Eigen doelpunt
                    </button>

                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">
                        {goal.is_own_goal ? '🥅 Wie scoorde het eigen doelpunt?' : '⚽ Schutter'}
                      </label>
                      <select
                        value={goal.scorer_id ?? ''}
                        onChange={e => {
                          const v = e.target.value ? parseInt(e.target.value) : null;
                          setGoals(prev => prev.map((g, j) => j === i ? { ...g, scorer_id: v } : g));
                        }}
                        className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      >
                        <option value="">Selecteer speler…</option>
                        {selectablePlayers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    {trackAssists && !goal.is_own_goal && (
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">🅰️ Aangever (optioneel)</label>
                        <select
                          value={goal.assist_id ?? ''}
                          onChange={e => {
                            const v = e.target.value ? parseInt(e.target.value) : null;
                            setGoals(prev => prev.map((g, j) => j === i ? { ...g, assist_id: v } : g));
                          }}
                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        >
                          <option value="">Geen aangever</option>
                          {selectablePlayers.filter(p => p.id !== goal.scorer_id).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setGoals(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-500 hover:text-red-400 transition pt-2 flex-shrink-0"
                    title="Verwijder dit doelpunt"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={() => setGoals(prev => [...prev, { scorer_id: null, assist_id: null, is_own_goal: false }])}
                className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-400 transition"
              >
                + Doelpunt toevoegen
              </button>

              {goalsFor !== null && goals.filter(g => g.scorer_id && !g.is_own_goal).length !== goalsFor && (
                <p className="text-xs text-amber-400">
                  Let op: je hebt {goals.filter(g => g.scorer_id && !g.is_own_goal).length} schutter(s) ingevuld, maar de score is {goalsFor}.
                  {goals.some(g => g.is_own_goal && g.scorer_id) && (
                    <span className="ml-1">(eigen doelpunten tellen niet mee voor jouw score)</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* ─── STAP 3: KAARTEN ─── */}
          {currentStep === 'kaarten' && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-gray-400">
                Voeg gele en rode kaarten toe. Geel en rood worden los bijgehouden.
              </div>

              {cards.map((card, i) => (
                <div key={i} className="flex gap-2 items-center p-3 bg-gray-700/40 rounded-lg">
                  <span className="text-gray-400 text-sm font-bold w-5 flex-shrink-0">{i + 1}</span>
                  <div className="flex gap-2 flex-1">
                    <select
                      value={card.player_id ?? ''}
                      onChange={e => {
                        const v = e.target.value ? parseInt(e.target.value) : null;
                        setCards(prev => prev.map((c, j) => j === i ? { ...c, player_id: v } : c));
                      }}
                      className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Selecteer speler…</option>
                      {selectablePlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={card.card_type}
                      onChange={e => {
                        const v = e.target.value as 'yellow' | 'red';
                        setCards(prev => prev.map((c, j) => j === i ? { ...c, card_type: v } : c));
                      }}
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="yellow">🟡 Geel</option>
                      <option value="red">🔴 Rood</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setCards(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-500 hover:text-red-400 transition flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={() => setCards(prev => [...prev, { player_id: null, card_type: 'yellow' }])}
                className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-400 transition"
              >
                + Kaart toevoegen
              </button>
            </div>
          )}

          {/* ─── STAP 4: BEVESTIG ─── */}
          {currentStep === 'bevestig' && (
            <div className="space-y-4 pt-1">
              {/* Score samenvatting */}
              <div className="p-3 bg-gray-700/50 rounded-lg text-center">
                <div className="text-xs text-gray-400 mb-1">{match.opponent}</div>
                {goalsFor !== null && goalsAgainst !== null ? (
                  <div className="text-3xl font-black">
                    <span className={goalsFor > goalsAgainst ? 'text-green-400' : goalsFor < goalsAgainst ? 'text-red-400' : 'text-yellow-400'}>
                      {goalsFor}
                    </span>
                    <span className="text-gray-500 mx-2">–</span>
                    <span className={goalsAgainst > goalsFor ? 'text-red-400' : goalsFor > goalsAgainst ? 'text-green-400' : 'text-yellow-400'}>
                      {goalsAgainst}
                    </span>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Geen uitslag ingevuld</div>
                )}
              </div>

              {/* Speler statistieken */}
              {computedStats.length > 0 ? (
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Statistieken</div>
                  <div className="space-y-1">
                    {computedStats.map(s => (
                      <div key={s.player_id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-700/30 rounded">
                        <span className="font-medium">{getPlayerName(s.player_id!)}</span>
                        <div className="flex gap-3 text-xs">
                          {s.goals > 0 && <span className="text-green-400">⚽ {s.goals}</span>}
                          {s.assists > 0 && <span className="text-blue-400">🅰️ {s.assists}</span>}
                          {s.own_goals > 0 && <span className="text-orange-400">🥅 {s.own_goals}</span>}
                          {s.yellow_cards > 0 && <span className="text-yellow-400">🟡 {s.yellow_cards}</span>}
                          {s.red_cards > 0 && <span className="text-red-400">🔴 {s.red_cards}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">Geen spelerstatistieken ingevuld.</p>
              )}

              <div className="p-2 bg-red-900/30 border border-red-700 rounded text-xs text-center text-red-300">
                ⚠️ Dit kan NIET ongedaan gemaakt worden! De wedstrijd wordt permanent afgesloten.
              </div>
            </div>
          )}
        </div>

        {/* Footer knoppen */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          {stepIndex > 0 ? (
            <button
              onClick={goBack}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold text-sm transition"
            >
              ← Terug
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold text-sm transition"
            >
              Annuleren
            </button>
          )}

          {currentStep !== 'bevestig' ? (
            <button
              onClick={goNext}
              className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold text-sm transition"
            >
              Volgende →
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-sm transition disabled:opacity-50"
            >
              {saving ? 'Bezig…' : '🏁 Definitief afsluiten'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
