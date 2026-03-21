import React, { useState } from 'react';
import type { Player, Substitution } from '../lib/types';

interface SubstitutionCardsProps {
  subMoments: number;           // 0 = vrij, 1-4 = vaste momenten
  subMomentMinutes: number[];   // berekende minuten (leeg bij vrije wissels)
  substitutions: Substitution[];
  players: Player[];
  isAdmin: boolean;
  isEditable: boolean;
  isFinalized: boolean;
  matchDuration: number;
  onEditSub: (subNumber: number, minute?: number) => void;
  onAddExtraSub: () => void;
  onDeleteExtraSub: (subId: number) => void;
}

function InfoHeader({ showInfo, onToggle }: { showInfo: boolean; onToggle: () => void }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500">Wissels</span>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-300 transition-colors touch-manipulation"
          aria-label="Uitleg wissels"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {showInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => onToggle()}>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 max-w-sm w-full text-sm text-gray-300 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-2">Wissels</h3>
            <p className="mb-3 leading-relaxed">Hier stel je de wissels in voor deze wedstrijd. Kies het aantal wisselmomenten via de toolbar bovenaan (1 / 2 / 3 / 4). De minuten worden automatisch gelijkmatig verdeeld over de wedstrijd. Wissels buiten de vaste momenten voeg je toe via <span className="text-white font-medium">Extra wissels</span>.</p>
            <button onClick={() => onToggle()} className="text-blue-400 hover:text-blue-200 text-xs font-medium">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}

const colorSchemes = ['blue', 'purple', 'emerald', 'orange', 'rose'] as const;
type ColorScheme = typeof colorSchemes[number];

const colors: Record<ColorScheme, { bg: string; border: string; button: string; inner: string }> = {
  blue:    { bg: 'from-blue-900 to-blue-950',    border: 'border-blue-700',    button: 'bg-blue-600 hover:bg-blue-700',    inner: 'bg-blue-950/50' },
  purple:  { bg: 'from-purple-900 to-purple-950', border: 'border-purple-700',  button: 'bg-purple-600 hover:bg-purple-700', inner: 'bg-purple-950/50' },
  emerald: { bg: 'from-emerald-900 to-emerald-950', border: 'border-emerald-700', button: 'bg-emerald-600 hover:bg-emerald-700', inner: 'bg-emerald-950/50' },
  orange:  { bg: 'from-orange-900 to-orange-950', border: 'border-orange-700',  button: 'bg-orange-600 hover:bg-orange-700', inner: 'bg-orange-950/50' },
  rose:    { bg: 'from-rose-900 to-rose-950',    border: 'border-rose-700',    button: 'bg-rose-600 hover:bg-rose-700',    inner: 'bg-rose-950/50' },
};

export default function SubstitutionCards({
  subMoments,
  subMomentMinutes,
  substitutions,
  players,
  isAdmin,
  isEditable,
  isFinalized,
  onEditSub,
  onAddExtraSub,
  onDeleteExtraSub,
}: SubstitutionCardsProps) {
  const [showInfo, setShowInfo] = useState(false);
  const isFreeSubstitution = subMoments === 0;

  const regularSubs = substitutions.filter(s => !s.is_extra);
  const extraSubs = substitutions.filter(s => s.is_extra).sort((a, b) => {
    const minA = a.custom_minute ?? a.minute;
    const minB = b.custom_minute ?? b.minute;
    return minA - minB;
  });

  const renderExtraSubsSection = () => (
    <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-3 border-2 border-gray-600">
      <div className="flex justify-between items-center mb-2 gap-2">
        <h4 className="font-bold text-sm">➕ Extra wissels</h4>
        {isAdmin && isEditable && !isFinalized && (
          <button
            onClick={onAddExtraSub}
            className="flex-shrink-0 px-2 py-1 bg-gray-500 hover:bg-gray-600 rounded text-xs font-bold touch-manipulation active:scale-95"
          >
            + Toevoegen
          </button>
        )}
      </div>

      {extraSubs.length === 0 ? (
        <div className="text-center py-3 text-gray-400 text-xs sm:text-sm">
          Geen extra wissels
        </div>
      ) : (
        <div className="space-y-2">
          {extraSubs.map(sub => {
            const playerOut = players.find(p => p.id === sub.player_out_id);
            const playerIn  = players.find(p => p.id === sub.player_in_id);
            return (
              <div key={sub.id} className="bg-gray-800/50 rounded p-2 text-xs sm:text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-yellow-400">{sub.custom_minute ?? sub.minute}&apos;</span>
                  <span className="text-red-400">⬇️ {playerOut?.name}</span>
                  <span>→</span>
                  <span className="text-green-400">⬆️ {playerIn?.name}</span>
                </div>
                {isAdmin && isEditable && !isFinalized && (
                  <button
                    onClick={() => onDeleteExtraSub(sub.id)}
                    className="text-red-500 hover:text-red-400 p-2 touch-manipulation active:scale-95"
                  >
                    🗑️
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Vrije wissels: groepeer opgeslagen wissels op substitution_number
  if (isFreeSubstitution) {
    const freeSubs = [...regularSubs].sort((a, b) => {
      const minA = a.custom_minute ?? a.minute;
      const minB = b.custom_minute ?? b.minute;
      return minA - minB;
    });

    const groups = new Map<number, Substitution[]>();
    for (const sub of freeSubs) {
      const existing = groups.get(sub.substitution_number) || [];
      existing.push(sub);
      groups.set(sub.substitution_number, existing);
    }

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      const minA = a[1][0]?.custom_minute ?? a[1][0]?.minute ?? 0;
      const minB = b[1][0]?.custom_minute ?? b[1][0]?.minute ?? 0;
      return minA - minB;
    });

    return (
      <div className="w-full">
        <InfoHeader showInfo={showInfo} onToggle={() => setShowInfo(v => !v)} />
        <div className="flex flex-col gap-3">
          {sortedGroups.map(([subNumber, subs], idx) => {
            const minute = subs[0]?.custom_minute ?? subs[0]?.minute ?? 0;
            const c = colors[colorSchemes[idx % colorSchemes.length]];

            return (
              <div key={subNumber} className={`bg-gradient-to-br ${c.bg} rounded-xl p-3 border-2 ${c.border}`}>
                <div className="flex justify-between items-center mb-2 gap-2">
                  <h4 className="font-bold text-sm">🔄 Wissel <span className="text-xs font-normal opacity-75">{minute}&apos;</span></h4>
                  {isAdmin && isEditable && !isFinalized && (
                    <button
                      onClick={() => onEditSub(subNumber, minute)}
                      className={`flex-shrink-0 px-2 py-1 ${c.button} rounded text-xs font-bold touch-manipulation`}
                    >
                      ✏️ {subs.length}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {subs.map(sub => {
                    const playerOut = players.find(p => p.id === sub.player_out_id);
                    const playerIn  = players.find(p => p.id === sub.player_in_id);
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
              </div>
            );
          })}

          {isAdmin && isEditable && !isFinalized && (
            <button
              onClick={() => {
                const maxNum = sortedGroups.length > 0
                  ? Math.max(...sortedGroups.map(([n]) => n))
                  : 0;
                onEditSub(maxNum + 1);
              }}
              className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-xl font-bold text-sm sm:text-base border-2 border-yellow-500 border-dashed"
            >
              + Wissel toevoegen
            </button>
          )}

          {isAdmin && renderExtraSubsSection()}
        </div>

        {sortedGroups.length === 0 && !isAdmin && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Nog geen wissels ingesteld
          </div>
        )}
      </div>
    );
  }

  // Vaste wisselmomenten: één kaart per moment
  return (
    <div className="flex flex-col gap-3 w-full">
      <InfoHeader showInfo={showInfo} onToggle={() => setShowInfo(v => !v)} />
      <div className="flex flex-col gap-3">
        {subMomentMinutes.map((minute, idx) => {
          const subNumber = idx + 1;
          const subs = regularSubs.filter(s => s.substitution_number === subNumber);
          const c = colors[colorSchemes[idx % colorSchemes.length]];

          return (
            <div key={subNumber} className={`bg-gradient-to-br ${c.bg} rounded-xl p-3 border-2 ${c.border}`}>
              <div className="flex justify-between items-center mb-2 gap-2">
                <h4 className="font-bold text-sm min-w-0 truncate">🔄 Wissel {subNumber} <span className="text-xs font-normal opacity-75">({minute}&apos;)</span></h4>
                {isAdmin && isEditable && !isFinalized && (
                  <button
                    onClick={() => onEditSub(subNumber, minute)}
                    className={`flex-shrink-0 px-2 py-1 ${c.button} rounded text-xs font-bold touch-manipulation`}
                  >
                    {subs.length > 0 ? `✏️ ${subs.length}` : '+ Stel in'}
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
                    const playerIn  = players.find(p => p.id === sub.player_in_id);
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
        })}
      </div>

      {isAdmin && renderExtraSubsSection()}
    </div>
  );
}
