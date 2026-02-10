import React from 'react';
import type { Player } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PlayerCardModalProps {
  player: Player;
  onClose: () => void;
}

export default function PlayerCardModal({ player, onClose }: PlayerCardModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-gray-700 hover:bg-red-600 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition"
        >
          ✕
        </button>
        <div className="transform scale-125 sm:scale-150">
          <PlayerCard player={player} />
        </div>
      </div>
    </div>
  );
}
