'use client';

import React, { useState, useMemo } from 'react';
import { MATCH_REPORT_MAX_LENGTH } from '../../lib/constants';
import type { Match, Player, TeamSettings } from '../../lib/types';

interface PlayerTally {
  goals: number;
  assists: number;
  own_goals: number;
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
    matchReport: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

type Step = 'uitslag' | 'doelpunten' | 'kaarten' | 'verslag' | 'bevestig';

function TallyCounter({
  value,
  onAdjust,
  disabled,
}: {
  value: number;
  onAdjust: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onAdjust(-1)}
        disabled={disabled || value === 0}
        className="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-20 text-white font-bold text-sm transition flex items-center justify-center"
      >−</button>
      <span className={`w-5 text-center tabular-nums text-sm font-bold ${value > 0 ? 'text-white' : 'text-gray-600'}`}>
        {value}
      </span>
      <button
        onClick={() => onAdjust(1)}
        disabled={disabled}
        className="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-20 text-white font-bold text-sm transition flex items-center justify-center"
      >+</button>
    </div>
  );
}

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
    s.push('verslag');
    s.push('bevestig');
    return s;
  }, [trackGoals, trackCards]);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  // Step 1 — Uitslag
  const [calcMinutes, setCalcMinutes] = useState(true);
  const [goalsFor, setGoalsFor] = useState<number | null>(null);
  const [goalsAgainst, setGoalsAgainst] = useState<number | null>(null);

  // Step 2 — Doelpunten (tally per speler)
  const [tally, setTally] = useState<Record<number, PlayerTally>>({});

  const adjustTally = (playerId: number, field: keyof PlayerTally, delta: number) => {
    setTally(prev => {
      const cur = prev[playerId] ?? { goals: 0, assists: 0, own_goals: 0 };
      return { ...prev, [playerId]: { ...cur, [field]: Math.max(0, cur[field] + delta) } };
    });
  };

  // Step 3 — Kaarten
  const [cards, setCards] = useState<CardEntry[]>([{ player_id: null, card_type: 'yellow' }]);

  // Step 4 — Verslag
  const [matchReport, setMatchReport] = useState('');

  const [saving, setSaving] = useState(false);

  const selectablePlayers = useMemo(
    () => players.filter(p => !p.is_guest).sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // Totaal eigen goals (voor validatie)
  const totalGoalsEntered = useMemo(
    () => Object.values(tally).reduce((sum, t) => sum + t.goals, 0),
    [tally]
  );
  const totalOwnGoalsEntered = useMemo(
    () => Object.values(tally).reduce((sum, t) => sum + t.own_goals, 0),
    [tally]
  );

  // Thuis/uit: bepaal volgorde uitslag
  const isThuis = match.home_away === 'Thuis';
  const scoreComplete = goalsFor !== null && goalsAgainst !== null;

  // Berekend overzicht van stats per speler voor bevestig-stap
  const computedStats = useMemo(() => {
    const map = new Map<number, { player_id: number; goals: number; assists: number; yellow_cards: number; red_cards: number; own_goals: number }>();

    const ensure = (id: number) => {
      if (!map.has(id)) map.set(id, { player_id: id, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, own_goals: 0 });
      return map.get(id)!;
    };

    for (const [idStr, t] of Object.entries(tally)) {
      const id = parseInt(idStr);
      if (t.goals > 0 || t.assists > 0 || t.own_goals > 0) {
        const s = ensure(id);
        s.goals     = t.goals;
        s.assists   = t.assists;
        s.own_goals = t.own_goals;
      }
    }

    for (const c of cards) {
      if (c.player_id) {
        const s = ensure(c.player_id);
        if (c.card_type === 'yellow') s.yellow_cards++;
        else s.red_cards++;
      }
    }

    return Array.from(map.values()).filter(s =>
      s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0
    );
  }, [tally, cards]);

  const getPlayerName = (id: number) =>
    players.find(p => p.id === id)?.name ?? `Speler ${id}`;

  const goNext = () => setStepIndex(i => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  const handleFinalize = async () => {
    setSaving(true);
    await onFinalize({
      calcMinutes,
      goalsFor,
      goalsAgainst,
      stats: computedStats,
      matchReport: matchReport.trim() || null,
    });
    setSaving(false);
  };

  const stepLabels: Record<Step, string> = {
    uitslag:    'Uitslag',
    doelpunten: 'Doelpunten',
    kaarten:    'Kaarten',
    verslag:    'Verslag',
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
                  {/* Linker ploeg: eigen bij thuis, tegenstander bij uit */}
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-2">
                      {isThuis ? teamName : match.opponent}
                      <span className="ml-1 text-gray-600">({isThuis ? 'thuis' : 'uit'})</span>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => isThuis
                          ? setGoalsFor(v => v === null || v === 0 ? null : v - 1)
                          : setGoalsAgainst(v => v === null || v === 0 ? null : v - 1)
                        }
                        className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
                        disabled={isThuis ? goalsFor === null : goalsAgainst === null}
                      >−</button>
                      <span className="text-4xl font-black w-10 text-center tabular-nums">
                        {(isThuis ? goalsFor : goalsAgainst) ?? '–'}
                      </span>
                      <button
                        onClick={() => isThuis
                          ? setGoalsFor(v => (v ?? -1) + 1)
                          : setGoalsAgainst(v => (v ?? -1) + 1)
                        }
                        className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white text-2xl font-bold transition flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                  <div className="text-gray-400 font-black text-xl">–</div>
                  {/* Rechter ploeg: tegenstander bij thuis, eigen bij uit */}
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-2">
                      {isThuis ? match.opponent : teamName}
                      <span className="ml-1 text-gray-600">({isThuis ? 'uit' : 'thuis'})</span>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => isThuis
                          ? setGoalsAgainst(v => v === null || v === 0 ? null : v - 1)
                          : setGoalsFor(v => v === null || v === 0 ? null : v - 1)
                        }
                        className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-2xl font-bold transition flex items-center justify-center"
                        disabled={isThuis ? goalsAgainst === null : goalsFor === null}
                      >−</button>
                      <span className="text-4xl font-black w-10 text-center tabular-nums">
                        {(isThuis ? goalsAgainst : goalsFor) ?? '–'}
                      </span>
                      <button
                        onClick={() => isThuis
                          ? setGoalsAgainst(v => (v ?? -1) + 1)
                          : setGoalsFor(v => (v ?? -1) + 1)
                        }
                        className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white text-2xl font-bold transition flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              {trackGoals && goalsFor === null && (
                <p className="text-xs text-amber-400">
                  Tip: vul eigen goals in voor de doelpunten-stap.
                </p>
              )}
            </div>
          )}

          {/* ─── STAP 2: DOELPUNTEN & ASSISTS (tally) ─── */}
          {currentStep === 'doelpunten' && (
            <div className="space-y-1 pt-1">
              {/* Legenda */}
              <div className="flex items-center gap-1 px-2 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                <span className="flex-1 min-w-[3rem]">Speler</span>
                <span className="w-[72px] text-center text-green-600">⚽ Goal</span>
                {trackAssists && <span className="w-[72px] text-center text-blue-500">A Assist</span>}
                <span className="w-[72px] text-center text-orange-500">EG Eigen</span>
              </div>
              {selectablePlayers.map(player => {
                const t = tally[player.id] ?? { goals: 0, assists: 0, own_goals: 0 };
                const hasAny = t.goals > 0 || t.assists > 0 || t.own_goals > 0;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-1 px-2 py-2 rounded-lg transition ${
                      hasAny ? 'bg-gray-700/70' : 'bg-gray-700/20'
                    }`}
                  >
                    <span className={`flex-1 min-w-[3rem] text-sm truncate ${hasAny ? 'font-bold text-white' : 'text-gray-400'}`}>
                      {player.name}
                    </span>
                    <div className="w-[72px] flex justify-center shrink-0">
                      <TallyCounter
                        value={t.goals}
                        onAdjust={d => adjustTally(player.id, 'goals', d)}
                      />
                    </div>
                    {trackAssists && (
                      <div className="w-[72px] flex justify-center shrink-0">
                        <TallyCounter
                          value={t.assists}
                          onAdjust={d => adjustTally(player.id, 'assists', d)}
                        />
                      </div>
                    )}
                    <div className="w-[72px] flex justify-center shrink-0">
                      <TallyCounter
                        value={t.own_goals}
                        onAdjust={d => adjustTally(player.id, 'own_goals', d)}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Validatie */}
              {goalsFor !== null && totalGoalsEntered !== goalsFor && (
                <p className="text-xs text-amber-400 pt-1">
                  Let op: {totalGoalsEntered} goal(s) ingevuld, maar de score is {goalsFor}.
                  {totalOwnGoalsEntered > 0 && (
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

          {/* ─── STAP 4: VERSLAG ─── */}
          {currentStep === 'verslag' && (
            <div className="space-y-3 pt-1">
              <div className="text-sm text-gray-400">
                Schrijf een kort verslag over de wedstrijd. Dit is optioneel en wordt zichtbaar op het dashboard.
              </div>
              <textarea
                value={matchReport}
                onChange={e => setMatchReport(e.target.value)}
                maxLength={MATCH_REPORT_MAX_LENGTH}
                rows={8}
                placeholder="Bijv. Een spannende wedstrijd met een sterke tweede helft. We scoorden vroeg maar moesten lang wachten op de overwinning…"
                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-yellow-500 transition"
              />
              <div className="text-xs text-gray-500 text-right">
                {matchReport.length} / {MATCH_REPORT_MAX_LENGTH} tekens
              </div>
            </div>
          )}

          {/* ─── STAP 5: BEVESTIG ─── */}
          {currentStep === 'bevestig' && (
            <div className="space-y-4 pt-1">
              {/* Score samenvatting */}
              <div className="p-3 bg-gray-700/50 rounded-lg text-center">
                {goalsFor !== null && goalsAgainst !== null ? (
                  <>
                    <div className="flex justify-between text-xs text-gray-400 mb-1 px-2">
                      <span>{isThuis ? teamName : match.opponent}</span>
                      <span>{isThuis ? match.opponent : teamName}</span>
                    </div>
                    <div className="text-3xl font-black">
                      {(() => {
                        const leftGoals  = isThuis ? goalsFor : goalsAgainst;
                        const rightGoals = isThuis ? goalsAgainst : goalsFor;
                        const win  = goalsFor > goalsAgainst;
                        const lose = goalsFor < goalsAgainst;
                        return (
                          <>
                            <span className={isThuis ? (win ? 'text-green-400' : lose ? 'text-red-400' : 'text-yellow-400') : (lose ? 'text-red-400' : win ? 'text-green-400' : 'text-yellow-400')}>
                              {leftGoals}
                            </span>
                            <span className="text-gray-500 mx-2">–</span>
                            <span className={isThuis ? (lose ? 'text-red-400' : win ? 'text-green-400' : 'text-yellow-400') : (win ? 'text-green-400' : lose ? 'text-red-400' : 'text-yellow-400')}>
                              {rightGoals}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </>
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

              {matchReport.trim() && (
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Verslag</div>
                  <div className="p-3 bg-gray-700/30 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                    {matchReport.trim()}
                  </div>
                </div>
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
              disabled={currentStep === 'uitslag' && !scoreComplete}
              className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-bold text-sm transition"
            >
              {currentStep === 'uitslag' && !scoreComplete ? 'Vul eerst de uitslag in' : 'Volgende →'}
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={saving || !scoreComplete}
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
