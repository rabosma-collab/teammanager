'use client';

import React, { useState } from 'react';
import type { Match, Player, Substitution } from '../../lib/types';
import type { TaskBadge } from '../../lib/taskAssignment';
import { formationLabels, displayScore } from '../../lib/constants';
import { useTeamContext } from '../../contexts/TeamContext';
import LineupStatusBadge from './LineupStatusBadge';
import { generateWhatsAppText } from '../../utils/generateWhatsAppText';

interface NextMatchCardProps {
  match: Match | null;
  matchAbsences: number[];
  taskBadges: TaskBadge[];
  fieldOccupants: (Player | null)[];
  currentPlayerId: number | null;
  isManager: boolean;
  players: Player[];
  gameFormat: string;
  positionName?: string;
  teamName?: string;
  trackWasbeurt?: boolean;
  trackConsumpties?: boolean;
  trackVervoer?: boolean;
  vervoerCount?: number;
  substitutions?: Substitution[];
  subMomentMinutes?: number[];
  trackAssemblyTime?: boolean;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
  onToggleAbsence: (playerId: number, matchId: number) => Promise<boolean>;
  onToggleInjury: (playerId: number) => Promise<boolean>;
  onNavigateToWedstrijd: (match: Match) => void;
  onNavigateToMatches?: () => void;
}

function formatTime(timeStr: string): string {
  // timeStr is "HH:MM:SS" or "HH:MM" — return "HH:MM"
  return timeStr.slice(0, 5);
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
  taskBadges,
  fieldOccupants,
  currentPlayerId,
  isManager,
  players,
  gameFormat,
  positionName,
  teamName,
  trackWasbeurt = true,
  trackConsumpties = true,
  substitutions = [],
  subMomentMinutes = [],
  trackVervoer = true,
  vervoerCount = 3,
  trackAssemblyTime = false,
  trackMatchTime = false,
  trackLocationDetails = false,
  onToggleAbsence,
  onToggleInjury,
  onNavigateToWedstrijd,
  onNavigateToMatches,
}: NextMatchCardProps) {
  const { currentTeam } = useTeamContext();
  const teamColor = currentTeam?.color || '#f59e0b';

  const [loadingAbsence, setLoadingAbsence] = useState(false);
  const [loadingInjury, setLoadingInjury] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const handleShare = async () => {
    if (!match) return;
    const text = generateWhatsAppText({
      match,
      players,
      fieldOccupants,
      matchAbsences,
      teamName,
      gameFormat,
      substitutions,
      subMomentMinutes,
      trackWasbeurt,
      trackConsumpties,
      trackVervoer,
      vervoerCount,
      trackAssemblyTime,
      trackMatchTime,
      trackLocationDetails,
      taskBadges,
      appUrl: 'https://tmvoetbal.nl',
    });

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // gebruiker heeft geannuleerd — geen actie nodig
      }
    } else {
      await navigator.clipboard.writeText(text);
      setShareToast('Gekopieerd naar klembord!');
      setTimeout(() => setShareToast(null), 2500);
    }
  };

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
  const formationLabel = formationLabels[gameFormat]?.[match.formation] ?? match.formation;

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
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-4 border-l-4" style={{ borderLeftColor: teamColor }}>
      <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-gray-500 border-l-2 pl-2" style={{ borderLeftColor: teamColor }}>{getMatchCardTitle(match)}</h3>

      {/* Match info */}
      <div>
        <div className="text-xs text-gray-500 capitalize mb-1">{formatDate(match.date)}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold text-2xl sm:text-3xl text-white uppercase leading-none">{match.opponent}</span>
          <span className={`text-xs px-2 py-1 rounded font-bold ${
            isThuis ? 'bg-green-900/60 text-green-300 border border-green-700/50' : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
          }`}>
            {isThuis ? '🏠 Thuis' : '✈️ Uit'}
          </span>
          {match.match_type === 'oefenwedstrijd' && (
            <span className="text-xs px-2 py-1 rounded font-bold bg-gray-700/60 text-gray-300 border border-gray-600/50">
              🔵 Oefenwedstrijd
            </span>
          )}
          {match.match_type === 'beker' && (
            <span className="text-xs px-2 py-1 rounded font-bold bg-purple-900/60 text-purple-300 border border-purple-700/50">
              🏅 Beker
            </span>
          )}
          {isFinalized && (
            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded border border-gray-600">✅ Afgerond</span>
          )}
          {!isFinalized && (
            <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
              match.lineup_published
                ? 'bg-green-900/50 text-green-300 border-green-700/50'
                : 'bg-gray-800 text-gray-400 border-gray-600'
            }`}>
              {match.lineup_published ? '✅ Opstelling definitief' : '⏳ Opstelling open'}
            </span>
          )}
        </div>
        {isFinalized && match.goals_for != null && match.goals_against != null && (() => {
          const { left, right } = displayScore(match.goals_for, match.goals_against, match.home_away);
          return (
            <div className="font-display font-bold text-4xl text-yellow-400 mt-1 leading-none">
              {left} – {right}
            </div>
          );
        })()}
        <div className="text-xs text-gray-500 mt-1">{formationLabel}</div>
        {(trackAssemblyTime && match.assembly_time) || (trackMatchTime && match.match_time) || (trackLocationDetails && match.location_details) ? (
          <div className="mt-2 space-y-1">
            {trackAssemblyTime && match.assembly_time && (
              <div className="flex items-center gap-1.5 text-xs">
                <span>🕐</span>
                <span className="text-gray-300">Verzamelen: <span className="font-bold text-white">{formatTime(match.assembly_time)}</span></span>
              </div>
            )}
            {trackMatchTime && match.match_time && (
              <div className="flex items-center gap-1.5 text-xs">
                <span>⚽</span>
                <span className="text-gray-300">Aanvang: <span className="font-bold text-white">{formatTime(match.match_time)}</span></span>
              </div>
            )}
            {trackLocationDetails && match.location_details && (
              <div className="flex items-center gap-1.5 text-xs">
                <span>📍</span>
                <span className="text-gray-300">Verzamellocatie: <span className="font-bold text-white">{match.location_details}</span></span>
              </div>
            )}
          </div>
        ) : null}
        {!isFinalized && taskBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {taskBadges.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-700/60 rounded-full px-2.5 py-1 text-gray-300">
                {b.emoji} <span className="font-medium text-white">{b.name}</span>
              </span>
            ))}
          </div>
        )}
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
            lineupPublished={match.lineup_published ?? false}
            positionName={positionName}
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
            {loadingInjury ? '...' : isInjured ? '✅ Ik ben hersteld' : '🏥 Geblesseerd melden'}
          </button>
        </div>
      )}

      {/* Deel + Bekijk knoppen */}
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="flex-shrink-0 px-3 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition touch-manipulation active:scale-95 flex items-center gap-1.5"
          title="Deel wedstrijdinfo"
        >
          📤 Deel
        </button>
        <button
          onClick={() => onNavigateToWedstrijd(match)}
          className="flex-1 px-4 py-2.5 rounded-lg font-display font-bold text-sm uppercase tracking-wide transition touch-manipulation active:scale-95 flex items-center justify-center gap-2"
          style={{ backgroundColor: teamColor, color: '#111827' }}
        >
          <span>{isManager && !isFinalized ? 'Bekijk / bewerk opstelling' : 'Bekijk opstelling'}</span>
          <span>→</span>
        </button>
      </div>

      {/* Kopieer-toast (desktop fallback) */}
      {shareToast && (
        <div className="text-center text-xs text-green-400 font-semibold animate-pulse">
          ✅ {shareToast}
        </div>
      )}
    </div>
  );
}
