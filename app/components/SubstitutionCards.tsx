import React from 'react';
import type { Player, Substitution } from '../lib/types';

interface SubstitutionCardsProps {
  sub1: Substitution[];
  sub2: Substitution[];
  players: Player[];
  isAdmin: boolean;
  isEditable: boolean;
  onEditSub: (subNumber: number) => void;
}

export default function SubstitutionCards({
  sub1,
  sub2,
  players,
  isAdmin,
  isEditable,
  onEditSub
}: SubstitutionCardsProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 justify-center w-full max-w-[900px] mx-auto">
      <SubCard
        title="Wissel 1 (30 min)"
        subNumber={1}
        subs={sub1}
        players={players}
        isAdmin={isAdmin}
        isEditable={isEditable}
        onEdit={onEditSub}
        colorScheme="blue"
      />
      <SubCard
        title="Wissel 2 (60 min)"
        subNumber={2}
        subs={sub2}
        players={players}
        isAdmin={isAdmin}
        isEditable={isEditable}
        onEdit={onEditSub}
        colorScheme="purple"
      />
    </div>
  );
}

function SubCard({ title, subNumber, subs, players, isAdmin, isEditable, onEdit, colorScheme }: {
  title: string;
  subNumber: number;
  subs: Substitution[];
  players: Player[];
  isAdmin: boolean;
  isEditable: boolean;
  onEdit: (n: number) => void;
  colorScheme: 'blue' | 'purple';
}) {
  const colors = {
    blue: {
      bg: 'from-blue-900 to-blue-950',
      border: 'border-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700',
      inner: 'bg-blue-950/50'
    },
    purple: {
      bg: 'from-purple-900 to-purple-950',
      border: 'border-purple-700',
      button: 'bg-purple-600 hover:bg-purple-700',
      inner: 'bg-purple-950/50'
    }
  };

  const c = colors[colorScheme];

  return (
    <div className={`flex-1 bg-gradient-to-br ${c.bg} rounded-xl p-3 sm:p-4 border-2 ${c.border}`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-sm sm:text-lg">🔄 {title}</h4>
        {isAdmin && isEditable && (
          <button
            onClick={() => onEdit(subNumber)}
            className={`px-2 sm:px-3 py-1 ${c.button} rounded text-xs sm:text-sm touch-manipulation`}
          >
            {subs.length > 0 ? `✏️ (${subs.length})` : '+ Instellen'}
          </button>
        )}
      </div>

      {subs.length === 0 ? (
        <div className="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
          Nog niet ingesteld
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map(sub => {
            const playerOut = players.find(p => p.id === sub.player_out_id);
            const playerIn = players.find(p => p.id === sub.player_in_id);
            return (
              <div key={sub.id} className={`${c.inner} rounded p-2 text-xs sm:text-sm`}>
                <div className="flex items-center gap-2">
                  <span className="text-red-400">⬇️ {playerOut?.name}</span>
                  <span>→</span>
                  <span className="text-green-400">⬆️ {playerIn?.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}