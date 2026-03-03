'use client';

import React, { useMemo } from 'react';
import type { Match, MatchPlayerStats } from '../../lib/types';

interface RecentResultsProps {
  matches: Match[];
  statsMap: Record<number, MatchPlayerStats[]>;
  onNavigateToUitslagen: () => void;
}

function getResult(m: Match): 'W' | 'G' | 'V' | null {
  if (m.goals_for == null || m.goals_against == null) return null;
  if (m.goals_for > m.goals_against) return 'W';
  if (m.goals_for === m.goals_against) return 'G';
  return 'V';
}

export default function RecentResults({ matches, statsMap, onNavigateToUitslagen }: RecentResultsProps) {
  const recent = useMemo(
    () => matches
      .filter(m => m.match_status === 'afgerond')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [matches]
  );

  if (recent.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">🕐 Recente uitslagen</h3>
        <button
          onClick={onNavigateToUitslagen}
          className="text-xs text-gray-400 hover:text-yellow-400 transition"
        >
          Alle →
        </button>
      </div>

      <div className="space-y-1.5">
        {recent.map(match => {
          const result = getResult(match);
          const stats = statsMap[match.id] ?? [];
          const scorers = stats.filter(s => s.goals > 0);

          const resultColor = result === 'W' ? 'border-green-600 bg-green-900/20'
            : result === 'V' ? 'border-red-700 bg-red-900/20'
            : result === 'G' ? 'border-yellow-600 bg-yellow-900/20'
            : 'border-gray-700 bg-gray-700/20';

          return (
            <div key={match.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${resultColor}`}>
              {/* Datum */}
              <div className="text-xs text-gray-400 w-14 flex-shrink-0">
                {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </div>

              {/* Tegenstander */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{match.opponent}</div>
                {scorers.length > 0 && (
                  <div className="text-[10px] text-gray-500 truncate">
                    ⚽ {scorers.map(s => s.player_name ?? `Speler ${s.player_id}`).join(', ')}
                  </div>
                )}
              </div>

              {/* Score */}
              {match.goals_for != null && match.goals_against != null ? (
                <div className="text-sm font-black flex-shrink-0">
                  <span className={result === 'W' ? 'text-green-400' : result === 'V' ? 'text-red-400' : 'text-yellow-400'}>
                    {match.goals_for}
                  </span>
                  <span className="text-gray-500 mx-0.5">–</span>
                  <span>{match.goals_against}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-600">–</span>
              )}

              {/* W/G/V badge */}
              {result && (
                <span className={`text-[10px] font-black w-5 text-center flex-shrink-0 ${
                  result === 'W' ? 'text-green-400' : result === 'V' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {result}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
