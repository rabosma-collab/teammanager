import React from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player, Substitution } from '../lib/types';

interface BenchPanelProps {
  benchPlayers: Player[];
  unavailablePlayers: {
    injured: Player[];
    absent: Player[];
  };
  selectedPlayer: Player | null;
  isEditable: boolean;
  substitutions?: Substitution[];
  onSelectPlayer: (player: Player | null) => void;
  onShowPlayerCard?: (player: Player) => void;
}

function playerKey(p: Player): string {
  return `${p.is_guest ? 'g' : 'r'}_${p.id}`;
}

function isSamePlayer(a: Player | null, b: Player | null): boolean {
  if (!a || !b) return false;
  return a.id === b.id && Boolean(a.is_guest) === Boolean(b.is_guest);
}

export default function BenchPanel({
  benchPlayers: rawBenchPlayers,
  unavailablePlayers,
  selectedPlayer,
  isEditable,
  onSelectPlayer,
  onShowPlayerCard
}: BenchPanelProps) {
  // NUCLEAR dedup: absolute last line of defense against duplicates
  // Uses composite key (guest vs regular) to avoid ID collision between tables
  const benchPlayers = React.useMemo(() => {
    const seen = new Map<string, typeof rawBenchPlayers[0]>();
    for (const p of rawBenchPlayers) {
      const key = playerKey(p);
      if (!seen.has(key)) seen.set(key, p);
    }
    const result = Array.from(seen.values());
    if (result.length !== rawBenchPlayers.length) {
      console.error(`[BenchPanel] DEDUP removed ${rawBenchPlayers.length - result.length} duplicates!`,
        rawBenchPlayers.map(p => `${p.id}:${p.name}`));
    }
    return result;
  }, [rawBenchPlayers]);

  // Groepeer per positiecategorie, gesorteerd op totaal speelminuten
  const grouped = React.useMemo(() => {
    return positionOrder.map(pos => {
      const inPos = benchPlayers.filter(p => p.position === pos);
      const sorted = inPos
        .map((p: Player) => ({ player: p }))
        .sort((a: { player: Player }, b: { player: Player }) => {
          if (b.player.min !== a.player.min) return b.player.min - a.player.min;
          return a.player.name.localeCompare(b.player.name);
        });
      return { pos, players: sorted };
    }).filter(g => g.players.length > 0);
  }, [benchPlayers]);

  const hasUnavailable = unavailablePlayers.injured.length > 0 || unavailablePlayers.absent.length > 0;

  return (
    <div className="w-full lg:flex lg:flex-col">
      <div className="bg-gradient-to-b from-amber-900 to-amber-950 rounded-t-3xl p-3 sm:p-4 border-4 border-amber-800 lg:flex-1">
        <h3 className="text-center font-bold text-lg sm:text-xl mb-3 text-amber-200 select-none">
          🪑 Wissels ({benchPlayers.length})
        </h3>

        {benchPlayers.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-400 text-sm select-none">
            Geen wisselspelers
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map(({ pos, players }) => (
              <div key={pos}>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-amber-400/80 uppercase tracking-wide select-none">
                  <span>{positionEmojis[pos]}</span>
                  <span>{pos}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {players.map(({ player }) => (
                    <div
                      key={`bench-${playerKey(player)}`}
                      onClick={() => {
                        if (!isEditable) {
                          onShowPlayerCard?.(player);
                          return;
                        }
                        if (isSamePlayer(selectedPlayer, player)) {
                          onSelectPlayer(null);
                        } else {
                          onSelectPlayer(player);
                        }
                      }}
                      className={`flex items-center justify-between bg-amber-950/50 border-2 ${
                        isSamePlayer(selectedPlayer, player)
                          ? 'border-yellow-400'
                          : 'border-amber-700'
                      } rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-900/50 transition active:scale-95 touch-manipulation select-none`}
                    >
                      <div className="font-bold text-sm">
                        {player.name}
                        {player.is_guest && <span className="text-purple-400 text-xs ml-1">(Gast)</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs opacity-50">
                          {player.assists}🎯 {player.goals}⚽
                        </span>
                        {player.min > 0 && (
                          <span className="text-xs font-bold bg-amber-700/60 text-amber-200 rounded px-1.5 py-0.5">
                            {player.min}&apos;
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasUnavailable && (
        <div className="bg-gray-800 rounded-b-xl p-3 sm:p-4 border-4 border-t-0 border-gray-700">
          <h4 className="font-bold text-xs sm:text-sm mb-2 text-gray-400 select-none">❌ Niet beschikbaar</h4>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {unavailablePlayers.injured.map(player => (
              <span key={player.id} className="px-2 py-1 bg-red-900/30 border border-red-700 rounded text-xs select-none">
                {player.name} 🏥
              </span>
            ))}
            {unavailablePlayers.absent.map(player => (
              <span key={player.id} className="px-2 py-1 bg-orange-900/30 border border-orange-700 rounded text-xs select-none">
                {player.name} ❌
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
