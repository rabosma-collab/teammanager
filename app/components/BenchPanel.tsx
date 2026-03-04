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

export default function BenchPanel({
  benchPlayers: rawBenchPlayers,
  unavailablePlayers,
  selectedPlayer,
  isEditable,
  substitutions = [],
  onSelectPlayer,
  onShowPlayerCard
}: BenchPanelProps) {
  // NUCLEAR dedup: absolute last line of defense against duplicates
  const benchPlayers = React.useMemo(() => {
    const seen = new Map<number, typeof rawBenchPlayers[0]>();
    for (const p of rawBenchPlayers) {
      if (!seen.has(p.id)) seen.set(p.id, p);
    }
    const result = Array.from(seen.values());
    if (result.length !== rawBenchPlayers.length) {
      console.error(`[BenchPanel] DEDUP removed ${rawBenchPlayers.length - result.length} duplicates!`,
        rawBenchPlayers.map(p => `${p.id}:${p.name}`));
    }
    return result;
  }, [rawBenchPlayers]);

  // Groepeer per positiecategorie, gesorteerd op wisselminuut
  const grouped = React.useMemo(() => {
    return positionOrder.map(pos => {
      const inPos = benchPlayers.filter(p => p.position === pos);
      const withMinute: { player: Player; minute: number | null }[] = inPos
        .map((p: Player) => {
          const sub = substitutions.find(s => s.player_in_id === p.id);
          return { player: p, minute: sub ? (sub.custom_minute ?? sub.minute) : null };
        })
        .sort((a: { player: Player; minute: number | null }, b: { player: Player; minute: number | null }) => {
          if (a.minute !== null && b.minute !== null) return a.minute - b.minute;
          if (a.minute !== null) return -1;
          if (b.minute !== null) return 1;
          return a.player.name.localeCompare(b.player.name);
        });
      return { pos, players: withMinute };
    }).filter(g => g.players.length > 0);
  }, [benchPlayers, substitutions]);

  const hasUnavailable = unavailablePlayers.injured.length > 0 || unavailablePlayers.absent.length > 0;

  return (
    <div className="w-full max-w-[350px] sm:max-w-[400px] lg:w-[380px] flex-shrink-0 lg:flex lg:flex-col">
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
                  {players.map(({ player, minute }) => (
                    <div
                      key={`bench-${player.id}`}
                      onClick={() => {
                        if (!isEditable) {
                          onShowPlayerCard?.(player);
                          return;
                        }
                        if (selectedPlayer?.id === player.id) {
                          onSelectPlayer(null);
                        } else {
                          onSelectPlayer(player);
                        }
                      }}
                      className={`flex items-center justify-between bg-amber-950/50 border-2 ${
                        selectedPlayer?.id === player.id
                          ? 'border-yellow-400'
                          : 'border-amber-700'
                      } rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-900/50 transition active:scale-95 touch-manipulation select-none`}
                    >
                      <div className="font-bold text-sm">
                        {player.name}
                        {player.is_guest && <span className="text-purple-400 text-xs ml-1">(Gast)</span>}
                      </div>
                      {minute !== null ? (
                        <span className="text-xs font-bold bg-amber-700/60 text-amber-200 rounded px-1.5 py-0.5 flex-shrink-0">
                          {minute}&apos;
                        </span>
                      ) : (
                        <span className="text-xs opacity-40 flex-shrink-0">
                          {player.goals}⚽ {player.assists}🎯
                        </span>
                      )}
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
