'use client';

import React, { useState } from 'react';
import type { Match, Player } from '../../lib/types';
import { formationLabels } from '../../lib/constants';
import LineupStatusBadge from './LineupStatusBadge';

interface NextMatchCardProps {
  match: Match | null;
  matchAbsences: number[];
  fieldOccupants: (Player | null)[];
  currentPlayerId: number | null;
  isManager: boolean;
  players: Player[];
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  onToggleInjury: (playerId: number) => Promise<boolean>;
  onNavigateToWedstrijd: () => void;
  onNavigateToMatches?: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getMatchCardTitle(match: Match): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const matchDate = new Date(match.date);
  matchDate.setHours(0, 0, 0, 0);

  if (match.match_status === 'afgerond') return 'Afgelopen wedstrijd';
  if (matchDate.getTime() === today.getTime()) return 'Wedstrijd vandaag';
  if (matchDate > today) return 'Volgende wedstrijd';
  return 'Afgelopen wedstrijd';
}

export default function NextMatchCard({
  match,
  matchAbsences,
  fieldOccupants,
  currentPlayerId,
  isManager,
  players,
  onToggleAbsence,
  onToggleInjury,
  onNavigateToWedstrijd,
  onNavigateToMatches,
}: NextMatchCardProps) {
  const [loadingAbsence, setLoadingAbsence] = useState(false);
  const [loadingInjury, setLoadingInjury] = useState(false);

  if (!match) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center justify-center min-h-[200px] gap-3">
        <div className="text-4xl">📭</div>
        <p className="text-gray-400 text-sm text-center">Geen komende wedstrijd gepland</p>
        {isManager && onNavigateToMatches && (
          <button
            onClick={onNavigateToMatches}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg font-bold text-sm touch-manipulation"
          >
            + Wedstrijd toevoegen
          </button>
        )}
      </div>
    );
  }

  const isFinalized = match.match_status === 'afgerond';
  const isThuis = match.home_away === 'Thuis';
  const formationLabel = formationLabels[match.formation] || match.formation;

  const currentPlayer = currentPlayerId
    ? players.find(p => p.id === currentPlayerId && !p.is_guest)
    : null;

  const isInjured = currentPlayer?.injured ?? false;
  const isAbsent = currentPlayerId ? matchAbsences.includes(currentPlayerId) : false;

  // Toon knoppen alleen voor spelers (niet-manager of manager met spelerrecord) bij niet-afgeronde wedstrijden
  const showPlayerButtons = !!(currentPlayerId && !isFinalized && currentPlayer);

  const handleToggleAbsence = async () => {
    if (!currentPlayerId) return;
    setLoadingAbsence(true);
    try {
      await onToggleAbsence(currentPlayerId, match.id);
    } finally {
      setLoadingAbsence(false);
    }
  };

  const handleToggleInjury = async () => {
    if (!currentPlayerId) return;
    setLoadingInjury(true);
    try {
      await onToggleInjury(currentPlayerId);
    } finally {
      setLoadingInjury(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{getMatchCardTitle(match)}</h3>

      {/* Match info */}
      <div>
        <div className="text-xs text-gray-400 capitalize mb-1">{formatDate(match.date)}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-black text-white">{match.opponent}</span>
          <span className={`text-xs px-2 py-1 rounded font-bold ${
            isThuis ? 'bg-green-900/60 text-green-300 border border-green-700/50' : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
          }`}>
            {isThuis ? '🏠 Thuis' : '✈️ Uit'}
          </span>
          {isFinalized && (
            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded border border-gray-600">✅ Afgerond</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1">{formationLabel}</div>
      </div>

      {/* Eigen positie / status */}
      {currentPlayerId && (
        <div>
          <div className="text-xs text-gray-400 mb-1.5">Jouw positie</div>
          <LineupStatusBadge
            currentPlayerId={currentPlayerId}
            fieldOccupants={fieldOccupants}
            matchAbsences={matchAbsences}
            players={players}
          />
        </div>
      )}

      {/* Afwezig + Geblesseerd knoppen voor spelers */}
      {showPlayerButtons && (
        <div className="flex gap-2">
          {/* Afwezigheidsknop — verborgen als geblesseerd */}
          {!isInjured && (
            <button
              onClick={handleToggleAbsence}
              disabled={loadingAbsence}
              className={`flex-1 px-3 py-2.5 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isAbsent
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-orange-700 hover:bg-orange-600 text-white'
              }`}
            >
              {loadingAbsence ? '...' : isAbsent ? '✅ Aanwezig melden' : '❌ Afwezig melden'}
            </button>
          )}

          {/* Blessureknop */}
          <button
            onClick={handleToggleInjury}
            disabled={loadingInjury}
            className={`flex-1 px-3 py-2.5 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isInjured
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-red-800 hover:bg-red-700 text-white'
            }`}
          >
            {loadingInjury ? '...' : isInjured ? '✅ Hersteld melden' : '🏥 Geblesseerd melden'}
          </button>
        </div>
      )}

      {/* Bekijk opstelling knop */}
      <button
        onClick={onNavigateToWedstrijd}
        className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 flex items-center justify-center gap-2"
      >
        <span>⚽</span>
        <span>{isManager && !isFinalized ? 'Bekijk / bewerk opstelling' : 'Bekijk opstelling'}</span>
        <span className="text-gray-400">→</span>
      </button>
    </div>
  );
}
