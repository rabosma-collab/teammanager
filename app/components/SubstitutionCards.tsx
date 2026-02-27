import React from 'react';
import type { Player, Substitution, SubstitutionScheme } from '../lib/types';

interface SubstitutionCardsProps {
  scheme: SubstitutionScheme | null;
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

const colorSchemes = ['blue', 'purple', 'emerald', 'orange', 'rose'] as const;
type ColorScheme = typeof colorSchemes[number];

const colors: Record<ColorScheme, { bg: string; border: string; button: string; inner: string }> = {
  blue: { bg: 'from-blue-900 to-blue-950', border: 'border-blue-700', button: 'bg-blue-600 hover:bg-blue-700', inner: 'bg-blue-950/50' },
  purple: { bg: 'from-purple-900 to-purple-950', border: 'border-purple-700', button: 'bg-purple-600 hover:bg-purple-700', inner: 'bg-purple-950/50' },
  emerald: { bg: 'from-emerald-900 to-emerald-950', border: 'border-emerald-700', button: 'bg-emerald-600 hover:bg-emerald-700', inner: 'bg-emerald-950/50' },
  orange: { bg: 'from-orange-900 to-orange-950', border: 'border-orange-700', button: 'bg-orange-600 hover:bg-orange-700', inner: 'bg-orange-950/50' },
  rose: { bg: 'from-rose-900 to-rose-950', border: 'border-rose-700', button: 'bg-rose-600 hover:bg-rose-700', inner: 'bg-rose-950/50' },
};

export default function SubstitutionCards({
  scheme,
  substitutions,
  players,
  isAdmin,
  isEditable,
  isFinalized,
  matchDuration,
  onEditSub,
  onAddExtraSub,
  onDeleteExtraSub
}: SubstitutionCardsProps) {
  // Scale 90-min reference minutes to actual match duration
  const scaleMinute = (m: number) => Math.round(m * matchDuration / 90);
  if (!scheme) return null;

  const regularSubs = substitutions.filter(s => !s.is_extra);
  const extraSubs = substitutions.filter(s => s.is_extra).sort((a, b) => {
    const minA = a.custom_minute ?? a.minute;
    const minB = b.custom_minute ?? b.minute;
    return minA - minB;
  });

  const isFreeSubstitution = scheme.minutes.length === 0;

  const renderExtraSubsSection = () => (
    <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-3 sm:p-4 border-2 border-gray-600">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-bold text-sm sm:text-lg">➕ Extra wissels</h4>
        {isAdmin && isEditable && !isFinalized && (
          <button
            onClick={onAddExtraSub}
            className="px-2 sm:px-3 py-1 bg-gray-500 hover:bg-gray-600 rounded text-xs sm:text-sm touch-manipulation active:scale-95"
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
            const playerIn = players.find(p => p.id === sub.player_in_id);
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

  if (isFreeSubstitution) {
    // Group all regular substitutions (they use custom_minute)
    const freeSubs = [...regularSubs].sort((a, b) => {
      const minA = a.custom_minute ?? a.minute;
      const minB = b.custom_minute ?? b.minute;
      return minA - minB;
    });

    // Group by substitution_number
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
      <div className="w-full max-w-[900px] mx-auto">
        <div className="flex flex-col gap-3 sm:gap-4">
          {sortedGroups.map(([subNumber, subs], idx) => {
            const minute = subs[0]?.custom_minute ?? subs[0]?.minute ?? 0;
            const c = colors[colorSchemes[idx % colorSchemes.length]];

            return (
              <div key={subNumber} className={`bg-gradient-to-br ${c.bg} rounded-xl p-3 sm:p-4 border-2 ${c.border}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm sm:text-lg">🔄 Wissel {minute}&apos;</h4>
                  {isAdmin && isEditable && !isFinalized && (
                    <button
                      onClick={() => onEditSub(subNumber, minute)}
                      className={`px-2 sm:px-3 py-1 ${c.button} rounded text-xs sm:text-sm touch-manipulation`}
                    >
                      ✏️ ({subs.length})
                    </button>
                  )}
                </div>
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
              </div>
            );
          })}

          {isAdmin && isEditable && !isFinalized && (
            <button
              onClick={() => {
                // Use next available substitution_number
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

          {/* Extra wissels sectie */}
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

  // Fixed scheme: render one card per minute
  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[900px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {scheme.minutes.map((storedMinute, idx) => {
          const minute = scaleMinute(storedMinute);
          const subNumber = idx + 1;
          const subs = regularSubs.filter(s => s.substitution_number === subNumber);
          const c = colors[colorSchemes[idx % colorSchemes.length]];

          return (
            <div key={subNumber} className={`bg-gradient-to-br ${c.bg} rounded-xl p-3 sm:p-4 border-2 ${c.border}`}>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm sm:text-lg">🔄 Wissel {subNumber} ({minute}&apos;)</h4>
                {isAdmin && isEditable && !isFinalized && (
                  <button
                    onClick={() => onEditSub(subNumber, minute)}
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
        })}
      </div>

      {/* Extra wissels sectie */}
      {isAdmin && renderExtraSubsSection()}
    </div>
  );
}
