'use client';
import React, { useState } from 'react';
import type { Player } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

export type SeasonBadge = 'top-scorer' | 'top-assist';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  size?: 'sm' | 'md';
  isFlippable?: boolean;
  backContent?: 'full' | 'radar-only';
  isSpdwWinner?: boolean;
  seasonBadges?: SeasonBadge[];
  isJustUpgraded?: boolean;
}

const positionAbbr: Record<string, string> = {
  'Keeper': 'KP',
  'Verdediger': 'VD',
  'Middenvelder': 'MV',
  'Aanvaller': 'AV',
};

const positionAccent: Record<string, { accent: string }> = {
  'Keeper':       { accent: 'text-green-300' },
  'Verdediger':   { accent: 'text-blue-300' },
  'Middenvelder': { accent: 'text-yellow-200' },
  'Aanvaller':    { accent: 'text-red-300' },
};

// Keep positionColors export for any consumers that import it
const positionColors: Record<string, { from: string; to: string; accent: string; border: string }> = {
  'Keeper':       { from: 'from-green-700',  to: 'to-green-900',  accent: 'text-green-300',  border: 'border-green-500' },
  'Verdediger':   { from: 'from-blue-700',   to: 'to-blue-900',   accent: 'text-blue-300',   border: 'border-blue-500' },
  'Middenvelder': { from: 'from-yellow-600', to: 'to-yellow-800', accent: 'text-yellow-200', border: 'border-yellow-500' },
  'Aanvaller':    { from: 'from-red-700',    to: 'to-red-900',    accent: 'text-red-300',    border: 'border-red-500' },
};

type CardTier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend';

function getCardTier(rating: number): CardTier {
  if (rating >= 90) return 'legend';
  if (rating >= 85) return 'elite';
  if (rating >= 75) return 'gold';
  if (rating >= 65) return 'silver';
  return 'bronze';
}

const tierStyles: Record<CardTier, {
  gradient: string;
  border: string;
  shimmer: string;
  ratingColor: string;
  glow: string;
  label: string | null;
  labelColor: string;
}> = {
  bronze: {
    gradient: 'from-amber-900 via-amber-800 to-amber-950',
    border: 'border-amber-600',
    shimmer: 'from-amber-400/8 via-transparent to-amber-600/5',
    ratingColor: 'text-amber-400',
    glow: '',
    label: null,
    labelColor: '',
  },
  silver: {
    gradient: 'from-gray-500 via-gray-600 to-gray-800',
    border: 'border-gray-300',
    shimmer: 'from-white/20 via-transparent to-white/5',
    ratingColor: 'text-white',
    glow: '',
    label: null,
    labelColor: '',
  },
  gold: {
    gradient: 'from-yellow-700 via-yellow-800 to-yellow-950',
    border: 'border-yellow-400',
    shimmer: 'from-yellow-300/20 via-transparent to-yellow-400/8',
    ratingColor: 'text-yellow-300',
    glow: '',
    label: null,
    labelColor: '',
  },
  elite: {
    gradient: 'from-violet-900 via-purple-900 to-indigo-950',
    border: 'border-violet-400',
    shimmer: 'from-violet-400/25 via-transparent to-cyan-400/10',
    ratingColor: 'text-violet-200',
    glow: '0 0 20px rgba(167,139,250,0.45)',
    label: 'ELITE',
    labelColor: '#a78bfa',
  },
  legend: {
    gradient: 'from-gray-900 via-slate-900 to-gray-950',
    border: 'border-cyan-400',
    shimmer: 'from-cyan-400/15 via-transparent to-yellow-400/10',
    ratingColor: 'text-cyan-300',
    glow: '0 0 28px rgba(34,211,238,0.5)',
    label: 'LEGEND',
    labelColor: '#22d3ee',
  },
};

const badgeConfig: Record<SeasonBadge, { emoji: string; title: string; bg: string }> = {
  'top-scorer': { emoji: '⚽', title: 'Topschutter',    bg: 'bg-yellow-600' },
  'top-assist': { emoji: '🎯', title: 'Meeste assists', bg: 'bg-blue-600' },
};

const positionSilhouette: Record<string, string> = {
  'Keeper':       '🧤',
  'Verdediger':   '🛡️',
  'Middenvelder': '⚙️',
  'Aanvaller':    '⚡',
};

function calcRating(player: Player): number {
  if (player.position === 'Keeper') {
    const { div = 50, han = 50, kic = 50, ref = 50, spe = 50, pos = 50 } = player;
    return Math.round((div * 0.25) + (ref * 0.25) + (pos * 0.20) + (han * 0.15) + (spe * 0.10) + (kic * 0.05));
  }
  const { pac = 50, sho = 50, pas = 50, dri = 50, def: d = 50, phy = 70 } = player;
  switch (player.position) {
    case 'Verdediger':
      return Math.round((d * 0.45) + (phy * 0.15) + (pac * 0.15) + (pas * 0.10) + (dri * 0.10) + (sho * 0.05));
    case 'Middenvelder':
      return Math.round((pas * 0.25) + (dri * 0.20) + (pac * 0.15) + (sho * 0.15) + (phy * 0.15) + (d * 0.10));
    case 'Aanvaller':
      return Math.round((sho * 0.30) + (dri * 0.25) + (pac * 0.20) + (phy * 0.15) + (pas * 0.05) + (d * 0.05));
    default:
      return Math.round((pac + sho + pas + dri + d + phy) / 6);
  }
}

export { calcRating, positionAbbr, positionColors };

// ─── Teamsterren helpers ────────────────────────────────────────────────────

export type TeamsterrenLevel = 'Rookie' | 'Belofte' | 'Ster' | 'Legende';

export function getTeamsterrenLevel(stars: number): TeamsterrenLevel {
  if (stars >= 50) return 'Legende';
  if (stars >= 25) return 'Ster';
  if (stars >= 10) return 'Belofte';
  return 'Rookie';
}

export function getTeamsterrenNextThreshold(stars: number): number {
  if (stars >= 50) return 50;
  if (stars >= 25) return 50;
  if (stars >= 10) return 25;
  return 10;
}

const levelStyles: Record<TeamsterrenLevel, { badge: string; gradient: string; border: string; badgeColor: string }> = {
  Rookie:  { badge: '⚪ ROOKIE',  gradient: 'from-gray-700 via-gray-800 to-gray-900',         border: 'border-gray-500',  badgeColor: 'text-gray-300' },
  Belofte: { badge: '🔵 BELOFTE', gradient: 'from-blue-800 via-blue-900 to-slate-900',         border: 'border-blue-400',  badgeColor: 'text-blue-300' },
  Ster:    { badge: '🟣 STER',    gradient: 'from-purple-800 via-indigo-900 to-slate-950',     border: 'border-purple-400', badgeColor: 'text-purple-300' },
  Legende: { badge: '👑 LEGENDE', gradient: 'from-yellow-700 via-amber-800 to-yellow-950',    border: 'border-yellow-400', badgeColor: 'text-yellow-300' },
};

interface TeamsterrenCardProps {
  player: Player;
  gamesPlayed: number;
  wins: number;
  starOverride?: number | null;
  isFlippable?: boolean;
  size?: 'sm' | 'md';
}

export function TeamsterrenCard({ player, gamesPlayed, wins, starOverride, isFlippable = false, size = 'md' }: TeamsterrenCardProps) {
  const [flipped, setFlipped] = useState(false);

  const calculatedStars = wins * 2 + gamesPlayed; // wins×3 + nonWins×1 = wins×2 + gamesPlayed
  const stars = starOverride != null ? starOverride : calculatedStars;
  const level = getTeamsterrenLevel(stars);
  const nextThreshold = getTeamsterrenNextThreshold(stars);
  const prevThreshold = level === 'Rookie' ? 0 : level === 'Belofte' ? 10 : level === 'Ster' ? 25 : 50;
  const progress = level === 'Legende'
    ? 100
    : Math.round(((stars - prevThreshold) / (nextThreshold - prevThreshold)) * 100);

  const ls = levelStyles[level];
  const isSm = size === 'sm';
  const cardW = isSm ? 'w-[155px]' : 'w-[180px] sm:w-[210px]';
  const roundClass = isSm ? 'rounded-xl' : 'rounded-2xl';
  const shellClass = `bg-gradient-to-b ${ls.gradient} ${cardW} border-2 ${ls.border} shadow-lg relative overflow-hidden`;

  const nonWins = gamesPlayed - wins;
  const winsStars = wins * 3;
  const nonWinsStars = nonWins;

  const nextLevelName = level === 'Rookie' ? 'Belofte' : level === 'Belofte' ? 'Ster' : 'Legende';
  const starsToNext = level !== 'Legende' ? nextThreshold - stars : 0;

  const progressBarColor =
    level === 'Rookie' ? 'bg-gray-400' :
    level === 'Belofte' ? 'bg-blue-400' :
    level === 'Ster' ? 'bg-purple-400' :
    'bg-yellow-400';

  const initials = player.name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative select-none ${isFlippable ? 'cursor-pointer' : ''} touch-pan-y`}
      style={{ perspective: '1000px', width: 'fit-content' }}
      onClick={() => isFlippable && setFlipped(f => !f)}
    >
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
        }}
      >
        {/* ── VOORKANT ── */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          <div className={`${shellClass} ${roundClass} ${isSm ? 'p-3' : 'p-3 sm:p-4'}`}>
            {/* Level badge */}
            <div className={`text-center text-[10px] font-black tracking-widest ${ls.badgeColor} mb-2`}>
              {ls.badge}
            </div>

            {/* Avatar */}
            <div className="flex justify-center mb-2">
              {player.avatar_url ? (
                <div className={`${isSm ? 'w-14 h-14' : 'w-16 h-16'} rounded-full overflow-hidden border-2 border-white/30`}>
                  <img src={player.avatar_url} alt={player.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`${isSm ? 'w-14 h-14' : 'w-16 h-16'} rounded-full border-2 border-white/30 bg-black/30 flex items-center justify-center`}>
                  <span className="text-lg font-black text-white/80">{initials}</span>
                </div>
              )}
            </div>

            {/* Name + position */}
            <div className={`${isSm ? 'text-sm' : 'text-base'} font-black text-center text-white truncate leading-tight`}>
              {player.name}
            </div>
            <div className="text-[10px] text-center text-white/50 mb-2">
              {player.position}
            </div>

            <div className="border-t border-white/20 mb-2" />

            {/* Stats row */}
            <div className="flex justify-around mb-2">
              <div className="text-center">
                <div className="text-lg">⚽</div>
                <div className="text-sm font-black text-white">{gamesPlayed}</div>
                <div className="text-[9px] text-white/40">gespeeld</div>
              </div>
              <div className="text-center">
                <div className="text-lg">🏆</div>
                <div className="text-sm font-black text-white">{wins}</div>
                <div className="text-[9px] text-white/40">gewonnen</div>
              </div>
              <div className="text-center">
                <div className="text-lg">⭐</div>
                <div className={`text-sm font-black ${ls.badgeColor}`}>{stars}</div>
                <div className="text-[9px] text-white/40">sterren</div>
              </div>
            </div>

            {/* Progress bar */}
            {level !== 'Legende' ? (
              <div>
                <div className="flex justify-between text-[9px] text-white/40 mb-0.5">
                  <span>{stars} sterren</span>
                  <span>→ {nextThreshold}</span>
                </div>
                <div className="w-full bg-black/30 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${progressBarColor}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center text-[10px] text-yellow-400 font-bold">
                ✨ Maximaal niveau bereikt!
              </div>
            )}

            {isFlippable && (
              <div className="mt-1.5 text-center text-[9px] text-white/30 font-bold tracking-wide">
                ↻ tik voor opbouw
              </div>
            )}
          </div>
        </div>

        {/* ── ACHTERKANT ── */}
        {isFlippable && (
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            <div className={`${shellClass} ${roundClass} p-3 flex flex-col gap-2`}>

              {/* Header */}
              <div className={`text-center text-[10px] font-black tracking-widest ${ls.badgeColor}`}>
                ⭐ OPBOUW
              </div>

              <div className="border-t border-white/20" />

              {/* Sterren-opbouw (A) */}
              {starOverride != null ? (
                <div className="text-center space-y-1">
                  <div className="text-[10px] text-yellow-300 font-bold">⚡ Handmatig ingesteld</div>
                  <div className={`text-xl font-black ${ls.badgeColor}`}>{stars} ⭐</div>
                  <div className="text-[9px] text-white/40">
                    Berekend zou zijn: {calculatedStars} ⭐
                  </div>
                  <div className="text-[9px] text-white/30">
                    ({wins} gewonnen, {gamesPlayed} gespeeld)
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/70">🏆 {wins}× gewonnen</span>
                    <span className={`font-black ${ls.badgeColor}`}>+{winsStars} ⭐</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/70">➖ {nonWins}× overig</span>
                    <span className="font-black text-white/60">+{nonWinsStars} ⭐</span>
                  </div>
                  <div className="border-t border-white/20 pt-1 flex items-center justify-between text-[10px]">
                    <span className="text-white/50 font-bold">Totaal</span>
                    <span className={`font-black text-sm ${ls.badgeColor}`}>{stars} ⭐</span>
                  </div>
                </div>
              )}

              <div className="border-t border-white/20" />

              {/* Volgend level (D) */}
              {level !== 'Legende' ? (
                <div>
                  <div className="text-[9px] text-white/40 mb-1 text-center">
                    Volgend level
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2.5 mb-1">
                    <div
                      className={`h-2.5 rounded-full transition-all ${progressBarColor}`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/50">
                    <span>{stars} ⭐</span>
                    <span>{nextThreshold} ⭐</span>
                  </div>
                  <div className="text-center text-[10px] font-bold text-white/70 mt-1">
                    Nog <span className={ls.badgeColor}>{starsToNext} ⭐</span> voor {nextLevelName}
                  </div>
                </div>
              ) : (
                <div className="text-center text-[10px] text-yellow-400 font-bold">
                  ✨ Maximaal niveau bereikt!
                </div>
              )}

              <div className="text-center text-[9px] text-white/30 font-bold tracking-wide mt-auto">
                ↻ tik terug
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hexagon radar chart (SVG)
function HexRadar({ stats, tier, size }: {
  stats: { label: string; value: number }[];
  tier: CardTier;
  size: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 96 : 112;
  const cx = dim / 2;
  const cy = dim / 2;
  const r = dim * 0.36;
  const n = stats.length;

  const getCoord = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return {
      x: cx + scale * r * Math.cos(angle),
      y: cy + scale * r * Math.sin(angle),
    };
  };

  const gridPolygon = (scale: number) =>
    Array.from({ length: n }, (_, i) => {
      const p = getCoord(i, scale);
      return `${p.x},${p.y}`;
    }).join(' ');

  const statPolygon = stats.map((s, i) => {
    const p = getCoord(i, Math.max(0.05, s.value / 99));
    return `${p.x},${p.y}`;
  }).join(' ');

  const isSpecial = tier === 'elite' || tier === 'legend';
  const fillColor = isSpecial ? 'rgba(167,139,250,0.28)' : 'rgba(250,204,21,0.28)';
  const strokeColor = isSpecial ? 'rgb(167,139,250)' : 'rgb(250,204,21)';
  const labelR = r * 1.28;

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
      {[0.33, 0.66, 1].map(scale => (
        <polygon key={scale} points={gridPolygon(scale)}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const p = getCoord(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />;
      })}
      <polygon points={statPolygon} fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
      {stats.map((s, i) => {
        const lp = getCoord(i, labelR / r);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.75)" fontSize={size === 'sm' ? '7' : '8'} fontWeight="bold">
            {s.label}
          </text>
        );
      })}
      {stats.map((s, i) => {
        const p = getCoord(i, Math.max(0.05, s.value / 99));
        return <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="2.5" fill={strokeColor} />;
      })}
    </svg>
  );
}

export default function PlayerCard({
  player,
  onClick,
  size = 'md',
  isFlippable = false,
  backContent = 'full',
  isSpdwWinner = false,
  seasonBadges = [],
  isJustUpgraded = false,
}: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false);
  const { teamSettings } = useTeamContext();
  const trackMinutes       = teamSettings?.track_minutes        ?? true;
  const trackPlayedMinutes = teamSettings?.track_played_minutes ?? false;

  const rating = calcRating(player);
  const tier = getCardTier(rating);
  const ts = tierStyles[tier];
  const accent = positionAccent[player.position] || positionAccent['Middenvelder'];
  const abbr = positionAbbr[player.position] || 'SP';
  const isSm = size === 'sm';

  const stats = player.position === 'Keeper'
    ? [
        { label: 'DIV', value: player.div || 0 },
        { label: 'HAN', value: player.han || 0 },
        { label: 'KIC', value: player.kic || 0 },
        { label: 'REF', value: player.ref || 0 },
        { label: 'SPE', value: player.spe || 0 },
        { label: 'POS', value: player.pos || 0 },
      ]
    : [
        { label: 'PAC', value: player.pac || 0 },
        { label: 'SHO', value: player.sho || 0 },
        { label: 'PAS', value: player.pas || 0 },
        { label: 'DRI', value: player.dri || 0 },
        { label: 'DEF', value: player.def || 0 },
        { label: 'PHY', value: player.phy ?? 70 },
      ];

  const initials = player.name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleClick = () => {
    if (isFlippable) setFlipped(f => !f);
    onClick?.();
  };

  const cardW = isSm ? 'w-[155px]' : 'w-[180px] sm:w-[210px]';

  const upgradedStyle: React.CSSProperties = isJustUpgraded
    ? { boxShadow: '0 0 0 3px #4ade80, 0 0 18px rgba(74,222,128,0.6)' }
    : {};

  // Shared card shell classes
  const shellClass = `bg-gradient-to-b ${ts.gradient} ${cardW} border-2 ${ts.border} shadow-lg relative overflow-hidden`;
  const roundClass = isSm ? 'rounded-xl' : 'rounded-2xl';

  return (
    <div
      className={`relative select-none ${(onClick || isFlippable) ? 'cursor-pointer' : ''} touch-pan-y`}
      style={{ perspective: '1000px', width: 'fit-content' }}
      onClick={handleClick}
    >
      {/* SPDW crown */}
      {isSpdwWinner && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 text-xl drop-shadow-lg pointer-events-none">
          👑
        </div>
      )}

      {/* Season badges */}
      {seasonBadges.length > 0 && (
        <div className="absolute -top-1 -right-1 z-20 flex flex-col gap-0.5 pointer-events-none">
          {seasonBadges.map(badge => (
            <div
              key={badge}
              className={`${badgeConfig[badge].bg} rounded-full w-5 h-5 flex items-center justify-center shadow-md`}
              title={badgeConfig[badge].title}
              style={{ fontSize: '10px' }}
            >
              {badgeConfig[badge].emoji}
            </div>
          ))}
        </div>
      )}

      {/* Upgrade glow */}
      {isJustUpgraded && (
        <div className={`absolute inset-0 ${roundClass} z-10 pointer-events-none animate-pulse`}
          style={{ boxShadow: '0 0 0 3px #4ade80, 0 0 20px rgba(74,222,128,0.5)', borderRadius: 'inherit' }} />
      )}

      {/* Flip container */}
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
        }}
      >
        {/* ── FRONT ── */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          <div
            className={`${shellClass} ${roundClass} ${isSm ? 'p-3' : 'p-3 sm:p-4'}`}
            style={ts.glow ? { ...upgradedStyle, boxShadow: ts.glow } : upgradedStyle}
          >
            {/* Shimmer overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${ts.shimmer} pointer-events-none`} />

            {/* Elite / Legend label */}
            {ts.label && (
              <div
                className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[8px] font-black tracking-[0.2em] opacity-50 z-10 pointer-events-none"
                style={{ color: ts.labelColor }}
              >
                {ts.label}
              </div>
            )}

            {/* Rating + Abbr | Avatar */}
            <div className="flex justify-between items-start mb-1 relative z-0">
              <div className="text-center">
                <div className={`${isSm ? 'text-3xl' : 'text-3xl sm:text-4xl'} font-black ${ts.ratingColor} leading-none`}>
                  {rating}
                </div>
                <div className={`text-xs font-bold ${accent.accent} mt-0.5`}>
                  {abbr}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {player.avatar_url ? (
                  <div className={`${isSm ? 'w-12 h-12' : 'w-12 h-12 sm:w-14 sm:h-14'} rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0`}>
                    <img src={player.avatar_url} alt={player.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`${isSm ? 'w-12 h-12' : 'w-12 h-12 sm:w-14 sm:h-14'} rounded-full flex-shrink-0 flex flex-col items-center justify-center border-2 border-white/20 bg-black/25`}>
                    <span className="text-xs font-black text-white/80 leading-none">{initials}</span>
                    <span className="leading-none mt-0.5" style={{ fontSize: '11px' }}>
                      {positionSilhouette[player.position] ?? '👤'}
                    </span>
                  </div>
                )}
                {player.is_guest && (
                  <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded font-bold">GAST</span>
                )}
              </div>
            </div>

            <div className="border-t border-white/20 my-1.5" />

            {/* Name */}
            <div className={`${isSm ? 'text-base' : 'text-base sm:text-lg'} font-black text-center text-white truncate leading-tight`}>
              {player.name}
            </div>

            <div className="border-t border-white/20 my-1.5" />

            {/* Stat bars */}
            <div className="space-y-0.5">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="font-bold opacity-70 w-8">{label}</span>
                  <div className="flex-1 mx-1.5 h-1.5 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        value >= 80 ? 'bg-green-400' : value >= 60 ? 'bg-yellow-400' : value >= 40 ? 'bg-orange-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className={`font-black w-6 text-right ${ts.ratingColor}`}>{value}</span>
                </div>
              ))}
            </div>

            {isFlippable && (
              <div className="mt-1.5 text-center text-[9px] text-white/30 font-bold tracking-wide">
                ↻ tik voor details
              </div>
            )}
          </div>
        </div>

        {/* ── BACK ── */}
        {isFlippable && (
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            <div
              className={`${shellClass} ${roundClass} p-3 flex flex-col`}
              style={ts.glow ? { boxShadow: ts.glow } : undefined}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${ts.shimmer} pointer-events-none`} />

              {/* Header */}
              <div className="text-center relative z-0 mb-1">
                <div className="text-sm font-black text-white truncate leading-tight">{player.name}</div>
                <div className={`text-[10px] font-bold ${accent.accent}`}>{abbr} · {rating}</div>
              </div>

              <div className="border-t border-white/20 mb-1" />

              {/* Hex radar */}
              <div className="flex justify-center relative z-0">
                <HexRadar stats={stats} tier={tier} size={size} />
              </div>

              {backContent === 'full' && (() => {
                const statItems = [
                  { label: '⚽ Goals',     value: player.goals || 0 },
                  { label: '🎯 Assists',   value: player.assists || 0 },
                  { label: '🟨 Geel',     value: player.yellow_cards || 0 },
                  ...(trackMinutes       ? [{ label: '⏱️ Wissel',   value: player.min || 0 }] : []),
                  ...(trackPlayedMinutes ? [{ label: '⏱️ Ges. min', value: player.played_min || 0 }] : []),
                ];
                return (
                  <>
                    <div className="border-t border-white/20 my-1" />
                    <div className="grid grid-cols-2 gap-1 relative z-0">
                      {statItems.map(({ label, value }) => (
                        <div key={label} className="bg-black/25 rounded px-1.5 py-1 text-center">
                          <div className="text-[9px] text-white/50 leading-none mb-0.5">{label}</div>
                          <div className="text-xs font-black text-white">{value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              <div className="mt-1.5 text-center text-[9px] text-white/30 font-bold tracking-wide">
                ↻ tik voor stats
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
