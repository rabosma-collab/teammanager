import React from 'react';
import type { Player } from '../../lib/types';
import PlayerCard from '../PlayerCard';
import DraggableModal from './DraggableModal';

interface PlayerCardModalProps {
  player: Player;
  onClose: () => void;
}

export default function PlayerCardModal({ player, onClose }: PlayerCardModalProps) {
  return (
    <DraggableModal onClose={onClose}>
      <div className="p-4 flex justify-center">
        <PlayerCard player={player} />
      </div>
    </DraggableModal>
  );
}
