'use client';

import React, { useState } from 'react';
import type { Match, Player } from '../../lib/types';
import { positionEmojis, positionOrder } from '../../lib/constants';
import InfoButton from '../InfoButton';
import { useTeamContext } from '../../contexts/TeamContext';

function formatShareDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

interface PlayerRowProps {
  player: Player;
  isAbsent: boolean;
}

function PlayerRow({ player, isAbsent }: PlayerRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-700/40 last:border-0">
      <span className="text-sm flex-shrink-0">{positionEmojis[player.position] || '⚽'}</span>
      <span className="flex-1 text-sm font-medium truncate">{player.name}</span>
      {player.is_guest && (
        <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded flex-shrink-0">Gast</span>
      )}
      {!player.is_guest && player.injured && (
        <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded flex-shrink-0">🏥 Geblesseerd</span>
      )}
      {!player.is_guest && !player.injured && isAbsent && (
        <span className="text-xs px-1.5 py-0.5 bg-orange-900/50 text-orange-300 rounded flex-shrink-0">❌ Afwezig</span>
      )}
      {!player.is_guest && !player.injured && !isAbsent && (
        <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded flex-shrink-0">✅</span>
      )}
    </div>
  );
}

interface SquadAvailabilityPanelProps {
  players: Player[];
  matchAbsences: number[];
  match: Match;
  isManager: boolean;
  onNavigateToWedstrijd: (match: Match) => void;
}

export default function SquadAvailabilityPanel({
  players,
  matchAbsences,
  match,
  isManager,
  onNavigateToWedstrijd,
}: SquadAvailabilityPanelProps) {
  const { currentTeam } = useTeamContext();
  const teamColor = currentTeam?.color || '#f59e0b';

  const [expanded, setExpanded] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const handleShareAvailability = async () => {
    const dateStr = formatShareDate(match.date);
    const regularPlayers = players.filter(p => !p.is_guest);
    const matchGuests = players.filter(p => p.is_guest && p.guest_match_id === match.id);

    const available = regularPlayers.filter(p => !p.injured && !matchAbsences.includes(p.id));
    const absent = regularPlayers.filter(p => !p.injured && matchAbsences.includes(p.id));
    const injured = regularPlayers.filter(p => p.injured);

    const lines: string[] = [
      `📋 Beschikbaarheid — ${match.opponent} · ${dateStr}`,
      '',
      `✅ Beschikbaar (${available.length + matchGuests.length}):`,
      ...available.map(p => `  ${p.name}`),
      ...matchGuests.map(p => `  ${p.name} (gast)`),
    ];
    if (absent.length > 0) {
      lines.push('', `❌ Afwezig (${absent.length}):`, ...absent.map(p => `  ${p.name}`));
    }
    if (injured.length > 0) {
      lines.push('', `🏥 Geblesseerd (${injured.length}):`, ...injured.map(p => `  ${p.name}`));
    }
    lines.push('', 'Klopt jouw status niet? Meld je af via de app of op tmvoetbal.nl');

    const text = lines.join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // gebruiker heeft geannuleerd
      }
    } else {
      await navigator.clipboard.writeText(text);
      setShareToast('Gekopieerd naar klembord!');
      setTimeout(() => setShareToast(null), 2500);
    }
  };

  const regularPlayers = players.filter(p => !p.is_guest);
  const matchGuests = players.filter(p => p.is_guest && p.guest_match_id === match.id);

  if (regularPlayers.length === 0 && matchGuests.length === 0) return null;

  const injuredCount = regularPlayers.filter(p => p.injured).length;
  const absentCount = matchAbsences.filter(id => {
    const p = regularPlayers.find(pl => pl.id === id);
    return p && !p.injured;
  }).length;
  const availableCount = regularPlayers.length - injuredCount - absentCount + matchGuests.length;

  const allForMatch = [...regularPlayers, ...matchGuests];
  const byPosition = positionOrder.map(pos => ({
    pos,
    group: allForMatch.filter(p => p.position === pos),
  })).filter(({ group }) => group.length > 0);

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500 border-l-2 pl-2" style={{ borderLeftColor: teamColor }}>Selectie aanwezigheid</h3>
          <InfoButton>
            <p className="font-semibold text-white mb-1">Hoe werkt beschikbaarheid?</p>
            <div className="space-y-1">
              <div className="flex gap-1.5"><span>✅</span><span><span className="text-white font-semibold">Beschikbaar</span> — speler heeft niets opgegeven en is niet geblesseerd.</span></div>
              <div className="flex gap-1.5"><span>❌</span><span><span className="text-white font-semibold">Afwezig</span> — speler heeft zichzelf als afwezig opgegeven via het Dashboard.</span></div>
              <div className="flex gap-1.5"><span>🏥</span><span><span className="text-white font-semibold">Geblesseerd</span> — ingesteld door de manager via Spelers beheren.</span></div>
            </div>
          </InfoButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {match.opponent} · {new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
          {isManager && (
            <button
              onClick={handleShareAvailability}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition touch-manipulation active:scale-95"
              title="Deel beschikbaarheid"
            >
              <span>📤</span>
              <span className="hidden sm:inline">Delen</span>
            </button>
          )}
        </div>
      </div>
      {shareToast && (
        <div className="mb-2 text-center text-xs text-green-400 font-semibold animate-pulse">
          ✅ {shareToast}
        </div>
      )}

      {/* Totalen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center justify-center gap-1 py-3 px-2 bg-green-900/30 rounded-lg border border-green-700/30">
          <span className="text-base leading-none">✅</span>
          <span className="font-display font-bold text-2xl text-green-300 leading-none">{availableCount}</span>
          <span className="text-xs text-green-400 font-medium text-center leading-tight">Beschikbaar</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 py-3 px-2 bg-orange-900/30 rounded-lg border border-orange-700/30">
          <span className="text-base leading-none">❌</span>
          <span className="font-display font-bold text-2xl text-orange-300 leading-none">{absentCount}</span>
          <span className="text-xs text-orange-400 font-medium text-center leading-tight">Afwezig</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 py-3 px-2 bg-red-900/30 rounded-lg border border-red-700/30">
          <span className="text-base leading-none">🏥</span>
          <span className="font-display font-bold text-2xl text-red-300 leading-none">{injuredCount}</span>
          <span className="text-xs text-red-400 font-medium text-center leading-tight">Geblesseerd</span>
        </div>
      </div>

      {/* Uitklapknop */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition touch-manipulation active:scale-95"
      >
        <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
        <span>{expanded ? 'Verberg spelers' : 'Toon spelers'}</span>
      </button>

      {/* Uitklapbaar: spelerlijst per positie */}
      {expanded && (
        <>
          <div className="mt-4 space-y-3">
            {byPosition.map(({ pos, group }) => (
              <div key={pos}>
                <div className="text-xs font-bold text-gray-400 mb-1">
                  {positionEmojis[pos]} {pos} ({group.length})
                </div>
                {group.map(p => (
                  <PlayerRow
                    key={`${p.is_guest ? 'g' : 'r'}_${p.id}`}
                    player={p}
                    isAbsent={matchAbsences.includes(p.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Manager: knop naar wedstrijdscherm */}
          {isManager && (
            <button
              onClick={() => onNavigateToWedstrijd(match)}
              className="mt-4 w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 flex items-center justify-center gap-2"
            >
              <span>✏️</span>
              <span>Wedstrijdselectie bewerken</span>
              <span className="text-gray-400">→</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
