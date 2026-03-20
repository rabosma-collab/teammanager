'use client';

import React, { useMemo } from 'react';
import type { Match } from '../../lib/types';

interface SeasonChartProps {
  matches: Match[];
  onNavigateToUitslagen: () => void;
}

function getResult(m: Match): 'W' | 'G' | 'V' | null {
  if (m.goals_for == null || m.goals_against == null) return null;
  if (m.goals_for > m.goals_against) return 'W';
  if (m.goals_for === m.goals_against) return 'G';
  return 'V';
}

function getPoints(result: 'W' | 'G' | 'V' | null): number {
  if (result === 'W') return 3;
  if (result === 'G') return 1;
  return 0;
}

const RESULT_COLOR = {
  W: { bar: '#22c55e', bg: 'bg-green-600', text: 'text-green-400', label: 'W' },
  G: { bar: '#eab308', bg: 'bg-yellow-600', text: 'text-yellow-400', label: 'G' },
  V: { bar: '#ef4444', bg: 'bg-red-700', text: 'text-red-400', label: 'V' },
} as const;

export default function SeasonChart({ matches, onNavigateToUitslagen }: SeasonChartProps) {
  // Afgeronde + geannuleerde wedstrijden met uitslag, chronologisch
  const finished = useMemo(
    () => matches
      .filter(m =>
        m.match_status === 'afgerond' ||
        (m.match_status === 'geannuleerd' && m.goals_for != null && m.goals_against != null)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [matches]
  );

  // Statistieken berekenen
  const matchData = useMemo(() => {
    let cumPoints = 0;
    return finished.map(m => {
      const result = getResult(m);
      const pts = getPoints(result);
      cumPoints += pts;
      return { match: m, result, pts, cumPoints };
    });
  }, [finished]);

  const totalPoints = matchData.length > 0 ? matchData[matchData.length - 1].cumPoints : 0;
  const wins   = matchData.filter(d => d.result === 'W').length;
  const draws  = matchData.filter(d => d.result === 'G').length;
  const losses = matchData.filter(d => d.result === 'V').length;
  const goalsFor     = finished.reduce((s, m) => s + (m.goals_for ?? 0), 0);
  const goalsAgainst = finished.reduce((s, m) => s + (m.goals_against ?? 0), 0);
  const cleanSheets  = finished.filter(m => m.match_status === 'afgerond' && m.goals_against === 0).length;

  if (finished.length === 0) return null;

  const maxPoints = Math.max(...matchData.map(d => d.cumPoints), 1);

  // Grafiek: SVG-lijn voor cumulatieve punten
  const chartW = 400;
  const chartH = 80;
  const padL = 8; const padR = 8; const padT = 6; const padB = 4;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  // Start van de lijn is (0,0) cumulatief — plus elk punt daarna
  const points = [{ x: 0, y: chartH - padB }, ...matchData.map((d, i) => ({
    x: padL + (innerW / (matchData.length)) * (i + 1),
    y: padT + innerH - (d.cumPoints / maxPoints) * innerH,
  }))];

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${chartH} L0,${chartH} Z`;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">📈 Dit seizoen</h3>
          <p className="text-xs text-gray-400">{finished.length} wedstrijden gespeeld</p>
        </div>
        <button
          onClick={onNavigateToUitslagen}
          className="text-xs text-gray-400 hover:text-yellow-400 transition"
        >
          Alle uitslagen →
        </button>
      </div>

      {/* Statistieken rij */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <div className="text-xl font-black text-yellow-400">{totalPoints}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Punten</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-green-400">{wins}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Gewonnen</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-yellow-400">{draws}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Gelijk</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black text-red-400">{losses}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Verloren</div>
        </div>
      </div>

      {/* SVG Lijngraafiek — cumulatieve punten */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full"
          style={{ height: 80 }}
          preserveAspectRatio="none"
        >
          {/* Grid lijnen */}
          {[0.25, 0.5, 0.75, 1].map(frac => (
            <line
              key={frac}
              x1={0} y1={padT + innerH * (1 - frac)}
              x2={chartW} y2={padT + innerH * (1 - frac)}
              stroke="#374151" strokeWidth="0.5" strokeDasharray="4 4"
            />
          ))}

          {/* Area fill */}
          <path d={areaD} fill="rgba(234,179,8,0.08)" />

          {/* Lijn */}
          <path d={pathD} fill="none" stroke="#eab308" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Punten */}
          {matchData.map((d, i) => {
            const pt = points[i + 1];
            const color = d.result ? RESULT_COLOR[d.result].bar : '#6b7280';
            return (
              <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill={color} stroke="#1f2937" strokeWidth="1.5" />
            );
          })}
        </svg>
      </div>

      {/* W/D/V balkjes (laatste 10) */}
      {finished.length > 0 && (
        <div className="flex gap-0.5 mt-2">
          {matchData.slice(-10).map((d, i) => {
            const cfg = d.result ? RESULT_COLOR[d.result] : null;
            return (
              <div
                key={i}
                className={`flex-1 h-4 rounded-sm flex items-center justify-center text-[9px] font-black ${cfg ? cfg.bg : 'bg-gray-700'}`}
                title={`${d.match.opponent} ${d.match.goals_for}–${d.match.goals_against}`}
              >
                {cfg?.label ?? '?'}
              </div>
            );
          })}
        </div>
      )}

      {/* Goals samenvatting + clean sheets */}
      {(goalsFor > 0 || goalsAgainst > 0) && (
        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-gray-400">
          <span><span className="text-green-400 font-bold">{goalsFor}</span> goals voor</span>
          <span><span className="text-red-400 font-bold">{goalsAgainst}</span> goals tegen</span>
          <span>doelsaldo: <span className={goalsFor >= goalsAgainst ? 'text-green-400' : 'text-red-400'}>
            {goalsFor - goalsAgainst > 0 ? '+' : ''}{goalsFor - goalsAgainst}
          </span></span>
          {cleanSheets > 0 && (
            <span>🧤 <span className="text-blue-400 font-bold">{cleanSheets}</span> clean sheet{cleanSheets !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
  );
}
