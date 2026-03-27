import React, { useState } from 'react';
import type { Player } from '../../lib/types';
import { TeamsterrenCard } from '../PlayerCard';
import DraggableModal from './DraggableModal';

interface TeamsterrenEditModalProps {
  player: Player;
  gamesPlayed: number;
  wins: number;
  draws: number;
  onSave: (bonusWins: number, bonusDraws: number) => void;
  onClose: () => void;
}

export default function TeamsterrenEditModal({
  player,
  gamesPlayed,
  wins,
  draws,
  onSave,
  onClose,
}: TeamsterrenEditModalProps) {
  const losses = gamesPlayed - wins - draws;
  const [bonusWins, setBonusWins]   = useState(player.bonus_wins  ?? 0);
  const [bonusDraws, setBonusDraws] = useState(player.bonus_draws ?? 0);

  const handleSave = () => {
    onSave(bonusWins, bonusDraws);
    onClose();
  };

  const BonusRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-300 w-28">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-black text-sm touch-manipulation"
        >
          −
        </button>
        <span className="w-8 text-center font-black text-white text-sm">
          {value > 0 ? `+${value}` : '0'}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-lg font-black text-sm touch-manipulation"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-sm">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">⭐ Sterren — {player.name}</h3>
          <button onClick={onClose} className="text-xl hover:text-red-500 p-2">✕</button>
        </div>

        <div className="flex justify-center mb-5">
          <TeamsterrenCard
            player={player}
            gamesPlayed={gamesPlayed}
            wins={wins}
            draws={draws}
            bonusWins={bonusWins}
            bonusDraws={bonusDraws}
            size="sm"
          />
        </div>

        {/* Huidige stand */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4 text-xs text-gray-400 space-y-1">
          <div className="font-bold text-gray-300 mb-1.5">Berekend uit wedstrijden</div>
          <div className="flex justify-between"><span>🏆 Gewonnen</span><span className="text-white font-bold">{wins}</span></div>
          <div className="flex justify-between"><span>➖ Gelijk</span><span className="text-white font-bold">{draws}</span></div>
          <div className="flex justify-between"><span>❌ Verloren</span><span className="text-white font-bold">{losses}</span></div>
        </div>

        {/* Bonus */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4 space-y-3">
          <div className="text-sm font-bold text-gray-300 mb-1">
            Bonuswedstrijden
          </div>
          <p className="text-xs text-gray-500 -mt-1 mb-2">
            Voeg wedstrijden toe van voor de app of van een ander team.
          </p>
          <BonusRow label="🏆 Gewonnen" value={bonusWins}  onChange={setBonusWins}  />
          <BonusRow label="➖ Gelijk"   value={bonusDraws} onChange={setBonusDraws} />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
        >
          ✅ Opslaan
        </button>
      </div>
    </DraggableModal>
  );
}
