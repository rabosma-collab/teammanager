import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

interface BenchPanelProps {
  benchPlayers: Player[];
  unavailablePlayers: {
    injured: Player[];
    absent: Player[];
  };
  selectedPlayer: Player | null;
  isEditable: boolean;
  /** Periode 2+: bank is puur visueel, samenstelling volgt uit de wissels */
  periodLocked?: boolean;
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

// Interne component per bankspeler — gebruikt useDraggable
function BenchPlayerDraggable({
  player,
  isEditable,
  isSelected,
  onSelectPlayer,
  onShowPlayerCard,
}: {
  player: Player;
  isEditable: boolean;
  isSelected: boolean;
  onSelectPlayer: (player: Player | null) => void;
  onShowPlayerCard?: (player: Player) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `bench-${playerKey(player)}`,
    disabled: !isEditable,
    data: { type: 'bench', player },
  });
  const { teamSettings } = useTeamContext();
  const trackMinutes = teamSettings?.track_minutes ?? true;

  return (
    <div
      ref={setNodeRef}
      {...(isEditable ? listeners : {})}
      {...(isEditable ? attributes : {})}
      onClick={() => {
        if (!isEditable) {
          onShowPlayerCard?.(player);
          return;
        }
        if (isSelected) {
          onSelectPlayer(null);
        } else {
          onSelectPlayer(player);
        }
      }}
      className={`flex items-center justify-between bg-amber-950/50 border-2 ${
        isSelected ? 'border-yellow-400' : 'border-amber-700'
      } rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-900/50 transition active:scale-95 touch-manipulation select-none ${
        isDragging ? 'opacity-20' : ''
      }`}
    >
      <div className="font-bold text-sm">
        {player.name}
        {player.is_guest && <span className="text-purple-400 text-xs ml-1">(Gast)</span>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs opacity-50">
          {player.assists}🎯 {player.goals}⚽
        </span>
        {trackMinutes && player.min > 0 && (
          <span className="text-xs font-bold bg-amber-700/60 text-amber-200 rounded px-1.5 py-0.5">
            {player.min}&apos;
          </span>
        )}
      </div>
    </div>
  );
}

export default function BenchPanel({
  benchPlayers: rawBenchPlayers,
  unavailablePlayers,
  selectedPlayer,
  isEditable,
  periodLocked,
  onSelectPlayer,
  onShowPlayerCard
}: BenchPanelProps) {
  // Droppable bench-zone: sleep een veldspeler hierheen om hem terug te zetten
  const { setNodeRef: setBenchDropRef, isOver: isBenchOver } = useDroppable({
    id: 'bench-zone',
    disabled: !isEditable,
  });

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
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="w-full lg:flex lg:flex-col">
      <div
        ref={setBenchDropRef}
        className={`relative bg-gradient-to-b from-amber-900 to-amber-950 rounded-t-3xl p-3 sm:p-4 border-4 border-amber-800 lg:flex-1 transition-colors ${
          isBenchOver ? 'border-yellow-400 bg-amber-800/50' : ''
        } ${periodLocked ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-center mb-3">
          <h3 className="font-bold text-lg sm:text-xl text-amber-200 select-none">
            🪑 Wissels ({benchPlayers.length})
          </h3>
          <button
            onClick={() => setShowInfo(true)}
            className="ml-2 text-amber-400 hover:text-amber-200 transition-colors touch-manipulation"
            aria-label="Info wisselbank"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {showInfo && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInfo(false)}>
            <div className="bg-gray-900 border border-amber-700 rounded-xl p-4 max-w-sm w-full text-sm text-gray-200 shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="font-bold text-amber-300 mb-2">Wisselbank</p>
              <p className="mb-2">Hier staan de spelers die niet in de basisopstelling staan, gegroepeerd op positie.</p>
              <p className="mb-2">Spelers zijn gesorteerd op <span className="font-semibold text-amber-300">wisselminuten</span> — het totaal aantal minuten dat iemand dit seizoen op de bank heeft gezeten. Wie het meest op de bank heeft gestaan, staat bovenaan.</p>
              <p className="mb-3">Spelers die <span className="font-semibold text-red-400">niet beschikbaar</span> zijn (geblesseerd of afwezig) worden apart weergegeven.</p>
              <button onClick={() => setShowInfo(false)} className="text-amber-400 hover:text-amber-200 text-xs font-medium">Sluiten</button>
            </div>
          </div>
        )}

        {periodLocked && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-950/70 border border-amber-700 text-center">
            <span className="text-xs text-amber-400 select-none">
              🔒 Banksamenstelling volgt uit de wissels
            </span>
          </div>
        )}

        {benchPlayers.length === 0 ? (
          <div className={`text-center py-6 sm:py-8 text-sm select-none ${
            isBenchOver ? 'text-yellow-400' : 'text-gray-400'
          }`}>
            {isBenchOver ? '⬇️ Loslaten om terug te zetten' : 'Geen wisselspelers'}
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
                    <BenchPlayerDraggable
                      key={`bench-${playerKey(player)}`}
                      player={player}
                      isEditable={isEditable}
                      isSelected={isSamePlayer(selectedPlayer, player)}
                      onSelectPlayer={onSelectPlayer}
                      onShowPlayerCard={onShowPlayerCard}
                    />
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
