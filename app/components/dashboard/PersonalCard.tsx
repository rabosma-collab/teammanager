'use client';

import React from 'react';
import type { Player } from '../../lib/types';
import PlayerCard from '../PlayerCard';

interface PersonalCardProps {
  player: Player | null;
  potwWins: number;
  isManager: boolean;
  isStaff: boolean;
  creditBalance?: number | null;
  // Team overview stats voor manager-zonder-speler
  totalPlayers: number;
  availablePlayers: number;
  absentPlayers: number;
  injuredPlayers: number;
  lineupSet: boolean;
}

function TeamOverviewCard({ totalPlayers, availablePlayers, absentPlayers, injuredPlayers, lineupSet }: {
  totalPlayers: number;
  availablePlayers: number;
  absentPlayers: number;
  injuredPlayers: number;
  lineupSet: boolean;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Team overzicht</h3>

      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between p-2.5 bg-green-900/30 rounded-lg border border-green-700/30">
          <span className="text-sm font-bold text-green-300">✅ Beschikbaar</span>
          <span className="text-xl font-black text-green-300">{availablePlayers}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-orange-900/30 rounded-lg border border-orange-700/30">
          <span className="text-sm font-bold text-orange-300">❌ Afwezig</span>
          <span className="text-xl font-black text-orange-300">{absentPlayers}</span>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-red-900/30 rounded-lg border border-red-700/30">
          <span className="text-sm font-bold text-red-300">🏥 Geblesseerd</span>
          <span className="text-xl font-black text-red-300">{injuredPlayers}</span>
        </div>
      </div>

      <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold text-center ${
        lineupSet
          ? 'bg-green-900/30 text-green-400 border border-green-700/30'
          : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
      }`}>
        {lineupSet ? '✅ Opstelling ingesteld' : '📋 Opstelling nog niet ingesteld'}
      </div>
    </div>
  );
}

export default function PersonalCard({
  player,
  potwWins,
  isManager,
  isStaff,
  creditBalance,
  totalPlayers,
  availablePlayers,
  absentPlayers,
  injuredPlayers,
  lineupSet,
}: PersonalCardProps) {
  // Manager zonder spelerrecord → team overzicht
  if (isManager && !player) {
    return (
      <TeamOverviewCard
        totalPlayers={totalPlayers}
        availablePlayers={availablePlayers}
        absentPlayers={absentPlayers}
        injuredPlayers={injuredPlayers}
        lineupSet={lineupSet}
      />
    );
  }

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

  // Geen speler (en geen manager, geen staff) → lege state
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
      <div className="grid grid-cols-5 gap-1.5 text-center">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.goals}</div>
          <div className="text-xs text-gray-400 mt-0.5">⚽ Goals</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.assists}</div>
          <div className="text-xs text-gray-400 mt-0.5">🎯 Assists</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.was}</div>
          <div className="text-xs text-gray-400 mt-0.5">🏅 Gestart</div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <div className="text-xl font-black text-white">{player.min}</div>
          <div className="text-xs text-gray-400 mt-0.5">⏱ Wissel</div>
        </div>
        <div className="bg-yellow-900/40 rounded-lg p-2 border border-yellow-700/40">
          <div className="text-xl font-black text-yellow-400">{potwWins}</div>
          <div className="text-xs text-yellow-600 mt-0.5">🏆 SPDW</div>
        </div>
      </div>
      {creditBalance != null && (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <span className="text-sm">💰</span>
          <span className="text-sm font-black text-yellow-400">{creditBalance}</span>
          <span className="text-xs text-yellow-700">{creditBalance === 1 ? 'statcredit' : 'statcredits'}</span>
        </div>
      )}
    </div>
  );
}
