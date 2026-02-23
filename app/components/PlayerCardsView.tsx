import React, { useState } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import PlayerCard, { calcRating } from './PlayerCard';
import PlayerStatsEditModal from './modals/PlayerStatsEditModal';

const OUTFIELD_STAT_LABELS: { key: keyof Player; label: string }[] = [
  { key: 'pac', label: 'PAC' },
  { key: 'sho', label: 'SHO' },
  { key: 'pas', label: 'PAS' },
  { key: 'dri', label: 'DRI' },
  { key: 'def', label: 'DEF' },
];

const KEEPER_STAT_LABELS: { key: keyof Player; label: string }[] = [
  { key: 'div', label: 'DIV' },
  { key: 'han', label: 'HAN' },
  { key: 'kic', label: 'KIC' },
  { key: 'ref', label: 'REF' },
  { key: 'spe', label: 'SPE' },
  { key: 'pos', label: 'POS' },
];

function getStatLabels(position: string) {
  return position === 'Keeper' ? KEEPER_STAT_LABELS : OUTFIELD_STAT_LABELS;
}

interface PlayerCardsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
  currentPlayerId?: number | null;
  creditBalance?: number | null;
  onSpendCredit?: (targetPlayerId: number, stat: string, change: 1 | -1) => Promise<boolean>;
}

export default function PlayerCardsView({
  players,
  isAdmin,
  onUpdateStat,
  currentPlayerId,
  creditBalance,
  onSpendCredit,
}: PlayerCardsViewProps) {
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [creditEditingId, setCreditEditingId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'rating'>('position');
  const [pendingSpend, setPendingSpend] = useState<string | null>(null);

  const regularPlayers = players.filter(p => !p.is_guest);
  const hasCredits = currentPlayerId != null && creditBalance != null && creditBalance > 0;

  const sortedPlayers = [...regularPlayers].sort((a, b) => {
    if (sortBy === 'rating') {
      return calcRating(b) - calcRating(a);
    }
    const posOrder = positionOrder as readonly string[];
    const posA = posOrder.indexOf(a.position);
    const posB = posOrder.indexOf(b.position);
    if (posA !== posB) return posA - posB;
    return calcRating(b) - calcRating(a);
  });

  const handleSpend = async (targetPlayerId: number, stat: string, change: 1 | -1) => {
    if (!onSpendCredit || !currentPlayerId) return;
    const key = `${targetPlayerId}-${stat}`;
    setPendingSpend(key);
    try {
      await onSpendCredit(targetPlayerId, stat, change);
    } finally {
      setPendingSpend(null);
    }
  };

  const renderCreditPanel = (player: Player) => (
    <div className="mt-2 p-2 bg-gray-800 border border-yellow-700/50 rounded-lg w-[155px]">
      <div className="text-xs text-yellow-400 font-bold mb-1.5 text-center">💰 Stats aanpassen</div>
      {getStatLabels(player.position).map(({ key, label }) => {
        const value = (player[key] as number) ?? 0;
        const keyStr = String(key);
        const isPending = pendingSpend === `${player.id}-${keyStr}`;
        return (
          <div key={keyStr} className="flex items-center justify-between gap-1 mb-1">
            <span className="text-xs font-bold text-gray-400 w-8">{label}</span>
            <button
              onClick={() => handleSpend(player.id, keyStr, -1)}
              disabled={isPending || !hasCredits || value <= 1}
              className="w-6 h-6 bg-red-800 hover:bg-red-700 disabled:opacity-30 rounded text-xs font-black leading-none touch-manipulation"
            >
              −
            </button>
            <span className="text-xs font-black text-yellow-300 w-6 text-center">{value}</span>
            <button
              onClick={() => handleSpend(player.id, keyStr, 1)}
              disabled={isPending || !hasCredits || value >= 99}
              className="w-6 h-6 bg-green-800 hover:bg-green-700 disabled:opacity-30 rounded text-xs font-black leading-none touch-manipulation"
            >
              +
            </button>
          </div>
        );
      })}
      <button
        onClick={() => setCreditEditingId(null)}
        className="w-full mt-1 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
      >
        Sluiten
      </button>
    </div>
  );

  const renderCard = (player: Player) => (
    <div key={player.id} className="flex flex-col items-center">
      <div className="relative">
        <PlayerCard player={player} size="sm" />
        {isAdmin && (
          <button
            onClick={() => setEditingPlayer(player)}
            className="absolute top-1 right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
          >
            ✏️
          </button>
        )}
      </div>
      {hasCredits && !player.is_guest && (
        <button
          onClick={() => setCreditEditingId(creditEditingId === player.id ? null : player.id)}
          className={`mt-1.5 px-3 py-1 rounded-full text-xs font-bold transition touch-manipulation ${
            creditEditingId === player.id
              ? 'bg-yellow-600 text-black'
              : 'bg-gray-700 hover:bg-yellow-700/50 text-yellow-400'
          }`}
        >
          💰
        </button>
      )}
      {creditEditingId === player.id && renderCreditPanel(player)}
    </div>
  );

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold">🃏 Spelerskaarten</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {hasCredits && (
            <span className="px-3 py-1.5 bg-yellow-900/40 border border-yellow-700/50 rounded-full text-xs font-bold text-yellow-400">
              💰 {creditBalance} {creditBalance === 1 ? 'credit' : 'credits'}
            </span>
          )}
          <button
            onClick={() => setSortBy('position')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'position' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Per positie
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'rating' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Op rating
          </button>
        </div>
      </div>

      {editingPlayer && isAdmin && (
        <PlayerStatsEditModal
          player={editingPlayer}
          onUpdateStat={(id, field, value) => {
            onUpdateStat(id, field, value);
            setEditingPlayer(prev => prev ? { ...prev, [field]: parseInt(value) || 0 } : null);
          }}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {sortBy === 'position' ? (
        <div className="space-y-6">
          {positionOrder.map(position => {
            const posPlayers = sortedPlayers.filter(p => p.position === position);
            if (posPlayers.length === 0) return null;

            return (
              <div key={position}>
                <h3 className="font-bold text-gray-400 mb-3 flex items-center gap-2 text-sm">
                  <span>{positionEmojis[position]}</span>
                  <span>{position}</span>
                </h3>
                <div className="flex flex-wrap gap-3 sm:gap-4 items-start">
                  {posPlayers.map(player => renderCard(player))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center items-start">
          {sortedPlayers.map(player => renderCard(player))}
        </div>
      )}
    </div>
  );
}
