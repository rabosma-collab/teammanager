'use client';

import React from 'react';
import type { Player, PositionInstruction } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PersonalCardProps {
  player: Player | null;
  potwWins: number;
  isManager: boolean;
  isStaff: boolean;
  creditBalance?: number | null;
  matchInstruction?: PositionInstruction | null;
}

export default function PersonalCard({
  player,
  potwWins,
  isManager,
  isStaff,
  creditBalance,
  matchInstruction,
}: PersonalCardProps) {
  // Staflid → welkomstscherm
  if (isStaff && !player) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="text-5xl mb-3">🧑‍💼</div>
        <p className="text-lg font-bold text-white mb-1">Welkom, staflid!</p>
        <p className="text-gray-400 text-sm">
          Je kunt de opstelling bekijken, je beschikbaarheid aangeven en stemmen op de speler van de week.
        </p>
      </div>
    );
  }

  // Geen speler → lege state
  if (!player) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center justify-center min-h-[200px]">
        <div className="text-4xl mb-3">👤</div>
        <p className="text-gray-400 text-sm text-center">Geen spelerscijfers beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mijn profiel</h3>
      <div className="flex justify-center mb-4">
        <PlayerCard player={player} size="md" />
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.goals}</div>
          <div className="text-xs text-gray-400 mt-0.5">⚽ Goals</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.assists}</div>
          <div className="text-xs text-gray-400 mt-0.5">🎯 Assists</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.min}</div>
          <div className="text-xs text-gray-400 mt-0.5">⏱ Wissel</div>
        </div>
        <div className="bg-yellow-900/40 rounded-lg p-2 border border-yellow-700/40">
          <div className="text-xl font-black text-yellow-400">{potwWins}</div>
          <div className="text-xs text-yellow-600 mt-0.5">🏆 SVDW</div>
        </div>
      </div>
      {creditBalance != null && (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <span className="text-sm">💰</span>
          <span className="text-sm font-black text-yellow-400">{creditBalance}</span>
          <span className="text-xs text-yellow-700">{creditBalance === 1 ? 'statcredit' : 'statcredits'}</span>
        </div>
      )}
      {matchInstruction && (
        <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">📋 Instructie volgende wedstrijd</div>
          {matchInstruction.general_tips.length > 0 && (
            <div className="mb-1.5">
              <div className="text-xs font-bold text-yellow-500 mb-1">💡 Tips</div>
              <ul className="space-y-0.5">
                {matchInstruction.general_tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1"><span>•</span><span>{tip}</span></li>
                ))}
              </ul>
            </div>
          )}
          {matchInstruction.with_ball.length > 0 && (
            <div className="mb-1.5">
              <div className="text-xs font-bold text-green-500 mb-1">⚽ Met bal</div>
              <ul className="space-y-0.5">
                {matchInstruction.with_ball.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1"><span>•</span><span>{tip}</span></li>
                ))}
              </ul>
            </div>
          )}
          {matchInstruction.without_ball.length > 0 && (
            <div>
              <div className="text-xs font-bold text-red-500 mb-1">🛡️ Zonder bal</div>
              <ul className="space-y-0.5">
                {matchInstruction.without_ball.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-1"><span>•</span><span>{tip}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
