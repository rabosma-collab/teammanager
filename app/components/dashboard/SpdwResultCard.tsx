'use client';

import type { SpdwResult } from '../../lib/types';

interface SpdwResultCardProps {
  result: SpdwResult;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function formatMatchDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function SpdwResultCard({ result }: SpdwResultCardProps) {
  const { match, podium } = result;
  const prefix = match.home_away === 'home' ? 'vs' : '@';
  const dateLabel = formatMatchDate(match.date);

  return (
    <div className="bg-gray-800 rounded-xl border border-yellow-700/30 overflow-hidden">
      {/* Header */}
      <div className="bg-yellow-900/30 px-4 py-3 border-b border-yellow-700/20">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <div>
            <p className="text-yellow-400 font-bold text-sm leading-tight">Speler van de Week</p>
            <p className="text-yellow-600/80 text-xs">
              {prefix} {match.opponent} · {dateLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Podium */}
      <div className="px-4 py-3 space-y-2">
        {podium.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-2">Geen stemmen uitgebracht</p>
        ) : (
          podium.map((entry) => (
            <div key={entry.player_id} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{MEDAL[entry.rank - 1]}</span>
                <span
                  className={
                    entry.rank === 1
                      ? 'text-yellow-400 font-bold text-sm truncate'
                      : 'text-gray-200 text-sm truncate'
                  }
                >
                  {entry.player_name}
                </span>
              </div>
              <div className="text-right shrink-0 ml-3">
                <span className="text-gray-400 text-xs">
                  {entry.vote_count} {entry.vote_count === 1 ? 'stem' : 'stemmen'}
                </span>
                <span className="text-gray-600 text-xs ml-2">+{entry.credits} cr.</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
