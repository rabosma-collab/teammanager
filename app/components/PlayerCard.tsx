import React from 'react';
import type { Player } from '../lib/types';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const positionAbbr: Record<string, string> = {
  'Keeper': 'KP',
  'Verdediger': 'VD',
  'Middenvelder': 'MV',
  'Aanvaller': 'AV',
};

const positionColors: Record<string, { from: string; to: string; accent: string; border: string }> = {
  'Keeper': { from: 'from-green-700', to: 'to-green-900', accent: 'text-green-300', border: 'border-green-500' },
  'Verdediger': { from: 'from-blue-700', to: 'to-blue-900', accent: 'text-blue-300', border: 'border-blue-500' },
  'Middenvelder': { from: 'from-yellow-600', to: 'to-yellow-800', accent: 'text-yellow-200', border: 'border-yellow-500' },
  'Aanvaller': { from: 'from-red-700', to: 'to-red-900', accent: 'text-red-300', border: 'border-red-500' },
};

function calcRating(player: Player): number {
  return Math.min(99, 60 + (player.goals * 3) + (player.assists * 2) + Math.floor(player.min / 90));
}

export { calcRating, positionAbbr, positionColors };

export default function PlayerCard({ player, onClick, size = 'md' }: PlayerCardProps) {
  const rating = calcRating(player);
  const colors = positionColors[player.position] || positionColors['Middenvelder'];
  const abbr = positionAbbr[player.position] || 'SP';

  const isSm = size === 'sm';

  return (
    <div
      onClick={onClick}
      className={`relative select-none ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} transition-transform touch-manipulation`}
    >
      {/* Card body */}
      <div className={`bg-gradient-to-b ${colors.from} ${colors.to} ${isSm ? 'rounded-xl p-2.5 w-[130px]' : 'rounded-2xl p-3 sm:p-4 w-[160px] sm:w-[180px]'} border-2 ${colors.border} shadow-lg relative overflow-hidden`}>
        {/* Gold shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-400/5 pointer-events-none" />

        {/* Injured overlay */}
        {player.injured && (
          <div className="absolute inset-0 bg-red-900/40 z-10 flex items-center justify-center pointer-events-none">
            <span className={`${isSm ? 'text-3xl' : 'text-4xl'} opacity-80`}>🏥</span>
          </div>
        )}

        {/* Top: Rating + Position */}
        <div className="flex justify-between items-start mb-1 relative z-0">
          <div className="text-center">
            <div className={`${isSm ? 'text-2xl' : 'text-3xl sm:text-4xl'} font-black text-yellow-400 leading-none`}>
              {rating}
            </div>
            <div className={`${isSm ? 'text-[10px]' : 'text-xs'} font-bold ${colors.accent} mt-0.5`}>
              {abbr}
            </div>
          </div>
          {player.is_guest && (
            <span className={`${isSm ? 'text-[10px]' : 'text-xs'} bg-purple-600 px-1.5 py-0.5 rounded font-bold`}>GAST</span>
          )}
        </div>

        {/* Divider line */}
        <div className="border-t border-yellow-400/30 my-1.5" />

        {/* Player name */}
        <div className={`${isSm ? 'text-sm' : 'text-base sm:text-lg'} font-black text-center text-white truncate leading-tight`}>
          {player.name}
        </div>

        {/* Divider line */}
        <div className="border-t border-yellow-400/30 my-1.5" />

        {/* Stats grid */}
        <div className={`grid grid-cols-2 gap-x-2 ${isSm ? 'gap-y-0.5 text-[10px]' : 'gap-y-1 text-xs'}`}>
          <div className="flex items-center justify-between">
            <span className="opacity-70">⚽</span>
            <span className="font-bold text-yellow-300">{player.goals}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">✅</span>
            <span className="font-bold text-yellow-300">{player.was}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">🎯</span>
            <span className="font-bold text-yellow-300">{player.assists}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">⏱️</span>
            <span className="font-bold text-yellow-300">{player.min}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
