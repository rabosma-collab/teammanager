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
  const { pac = 50, sho = 50, pas = 50, dri = 50, def: d = 50 } = player;
  switch (player.position) {
    case 'Keeper':
      return Math.round((pac * 0.05) + (sho * 0.05) + (pas * 0.15) + (dri * 0.10) + (d * 0.65));
    case 'Verdediger':
      return Math.round((pac * 0.15) + (sho * 0.05) + (pas * 0.15) + (dri * 0.10) + (d * 0.55));
    case 'Middenvelder':
      return Math.round((pac * 0.15) + (sho * 0.15) + (pas * 0.30) + (dri * 0.25) + (d * 0.15));
    case 'Aanvaller':
      return Math.round((pac * 0.20) + (sho * 0.35) + (pas * 0.15) + (dri * 0.25) + (d * 0.05));
    default:
      return Math.round((pac + sho + pas + dri + d) / 5);
  }
}

export { calcRating, positionAbbr, positionColors };

export default function PlayerCard({ player, onClick, size = 'md' }: PlayerCardProps) {
  const rating = calcRating(player);
  const colors = positionColors[player.position] || positionColors['Middenvelder'];
  const abbr = positionAbbr[player.position] || 'SP';

  const isSm = size === 'sm';

  const stats = [
    { label: 'PAC', value: player.pac || 0 },
    { label: 'SHO', value: player.sho || 0 },
    { label: 'PAS', value: player.pas || 0 },
    { label: 'DRI', value: player.dri || 0 },
    { label: 'DEF', value: player.def || 0 },
  ];

  return (
    <div
      onClick={onClick}
      className={`relative select-none ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''} transition-transform touch-manipulation`}
    >
      <div className={`bg-gradient-to-b ${colors.from} ${colors.to} ${isSm ? 'rounded-xl p-2.5 w-[130px]' : 'rounded-2xl p-3 sm:p-4 w-[160px] sm:w-[180px]'} border-2 ${colors.border} shadow-lg relative overflow-hidden`}>
        {/* Gold shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-transparent to-yellow-400/5 pointer-events-none" />

        {/* Injured overlay */}
        {player.injured && (
          <div className="absolute inset-0 bg-red-900/40 z-10 flex items-center justify-center pointer-events-none">
            <span className={`${isSm ? 'text-3xl' : 'text-4xl'} opacity-80`}>🏥</span>
          </div>
        )}

        {/* Rating + Position */}
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

        {/* Divider */}
        <div className="border-t border-yellow-400/30 my-1.5" />

        {/* Name */}
        <div className={`${isSm ? 'text-sm' : 'text-base sm:text-lg'} font-black text-center text-white truncate leading-tight`}>
          {player.name}
        </div>

        {/* Divider */}
        <div className="border-t border-yellow-400/30 my-1.5" />

        {/* FIFA stats with mini bars */}
        <div className={`${isSm ? 'space-y-0' : 'space-y-0.5'}`}>
          {stats.map(({ label, value }) => (
            <div key={label} className={`flex items-center justify-between ${isSm ? 'text-[10px]' : 'text-xs'}`}>
              <span className="font-bold opacity-70 w-8">{label}</span>
              <div className="flex-1 mx-1.5 h-1 bg-black/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    value >= 80 ? 'bg-green-400' : value >= 60 ? 'bg-yellow-400' : value >= 40 ? 'bg-orange-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="font-black text-yellow-300 w-6 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
