import React, { useState, useEffect, useRef } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import type { SeasonBadge } from './PlayerCard';
import PlayerCard, { calcRating, TeamsterrenCard } from './PlayerCard';
import PlayerStatsEditModal from './modals/PlayerStatsEditModal';
import { useTeamContext } from '../contexts/TeamContext';
import { supabase } from '../lib/supabase';

const OUTFIELD_STAT_LABELS: { key: keyof Player; label: string }[] = [
  { key: 'pac', label: 'PAC' },
  { key: 'sho', label: 'SHO' },
  { key: 'pas', label: 'PAS' },
  { key: 'dri', label: 'DRI' },
  { key: 'def', label: 'DEF' },
  { key: 'phy', label: 'PHY' },
];

const KEEPER_STAT_LABELS: { key: keyof Player; label: string }[] = [
  { key: 'div', label: 'DIV' },
  { key: 'han', label: 'HAN' },
  { key: 'kic', label: 'KIC' },
  { key: 'ref', label: 'REF' },
  { key: 'spe', label: 'SPE' },
  { key: 'pos', label: 'POS' },
];

function getStatLabels(position: string) {
  return position === 'Keeper' ? KEEPER_STAT_LABELS : OUTFIELD_STAT_LABELS;
}

interface PlayerCardsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
  currentPlayerId?: number | null;
  creditBalance?: number | null;
  onSaveStatDraft?: (targetPlayerId: number, finalStats: Record<string, number>, totalCost: number, actorName?: string, subjectName?: string, prevStats?: Record<string, number>) => Promise<boolean>;
  spdwWinnerPlayerIds?: number[];
}

function computeSeasonBadges(players: Player[]): Record<number, SeasonBadge[]> {
  const regular = players.filter(p => !p.is_guest);
  if (regular.length === 0) return {};

  const maxGoals   = Math.max(...regular.map(p => p.goals || 0));
  const maxAssists = Math.max(...regular.map(p => p.assists || 0));

  const result: Record<number, SeasonBadge[]> = {};
  for (const p of regular) {
    const badges: SeasonBadge[] = [];
    if (maxGoals   > 0 && (p.goals   || 0) === maxGoals)   badges.push('top-scorer');
    if (maxAssists > 0 && (p.assists || 0) === maxAssists) badges.push('top-assist');
    if (badges.length > 0) result[p.id] = badges;
  }
  return result;
}

export default function PlayerCardsView({
  players,
  isAdmin,
  onUpdateStat,
  currentPlayerId,
  creditBalance,
  onSaveStatDraft,
  spdwWinnerPlayerIds = [],
}: PlayerCardsViewProps) {
  const { currentTeam, teamSettings } = useTeamContext();
  const playerCardMode = teamSettings?.player_card_mode ?? 'competitive';
  const allowEditOthers = teamSettings?.allow_edit_others ?? true;

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [creditEditingId, setCreditEditingId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'rating'>('position');
  const [showInfo, setShowInfo] = useState(false);
  const [justUpgradedId, setJustUpgradedId] = useState<number | null>(null);
  const upgradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draft-modus state
  const [originalStats, setOriginalStats] = useState<Record<string, number> | null>(null);
  const [draftStats, setDraftStats] = useState<Record<string, number> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Teamsterren: gamesPlayed + wins per player (afgeronde wedstrijden)
  const [starData, setStarData] = useState<Record<number, { gamesPlayed: number; wins: number }>>({});

  useEffect(() => {
    if (playerCardMode !== 'teamsterren' || !currentTeam) return;
    async function fetchStarData() {
      const { data: lineupRows } = await supabase
        .from('lineups')
        .select('player_id, match_id')
        .eq('team_id', currentTeam!.id)
        .not('player_id', 'is', null);

      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, goals_for, goals_against')
        .eq('team_id', currentTeam!.id)
        .eq('match_status', 'afgerond');

      if (!lineupRows || !matchRows) return;

      const matchMap = new Map<number, { id: number; goals_for: number | null; goals_against: number | null }>(
        matchRows.map((m: { id: number; goals_for: number | null; goals_against: number | null }) => [m.id, m])
      );
      const result: Record<number, { gamesPlayed: number; wins: number }> = {};

      for (const row of lineupRows as { player_id: number; match_id: number }[]) {
        const match = matchMap.get(row.match_id);
        if (!match) continue;
        if (!result[row.player_id]) result[row.player_id] = { gamesPlayed: 0, wins: 0 };
        result[row.player_id].gamesPlayed++;
        if ((match.goals_for ?? 0) > (match.goals_against ?? 0)) {
          result[row.player_id].wins++;
        }
      }
      setStarData(result);
    }
    fetchStarData();
  }, [playerCardMode, currentTeam]);

  useEffect(() => {
    return () => {
      if (upgradeTimerRef.current) clearTimeout(upgradeTimerRef.current);
    };
  }, []);

  const regularPlayers = players.filter(p => !p.is_guest);
  const hasCredits = currentPlayerId != null && creditBalance != null;
  const seasonBadges = computeSeasonBadges(regularPlayers);

  const sortedPlayers = [...regularPlayers].sort((a, b) => {
    if (sortBy === 'rating') {
      return calcRating(b) - calcRating(a);
    }
    const posOrder = positionOrder as readonly string[];
    const posA = posOrder.indexOf(a.position);
    const posB = posOrder.indexOf(b.position);
    if (posA !== posB) return posA - posB;
    return calcRating(b) - calcRating(a);
  });

  const openCreditPanel = (player: Player) => {
    if (creditEditingId === player.id) {
      closeCreditPanel();
      return;
    }
    const statLabels = getStatLabels(player.position);
    const stats: Record<string, number> = {};
    for (const { key } of statLabels) {
      stats[String(key)] = (player[key] as number) ?? 0;
    }
    setOriginalStats(stats);
    setDraftStats({ ...stats });
    setCreditEditingId(player.id);
  };

  const closeCreditPanel = () => {
    setCreditEditingId(null);
    setOriginalStats(null);
    setDraftStats(null);
  };

  const handleSaveDraft = async (player: Player) => {
    if (!onSaveStatDraft || !draftStats || !originalStats) return;
    const statLabels = getStatLabels(player.position);
    const cost = statLabels.reduce((sum, { key }) => {
      const k = String(key);
      return sum + Math.abs((draftStats[k] ?? 0) - (originalStats[k] ?? 0));
    }, 0);
    if (cost === 0) return;

    const actorPlayer = players.find(p => p.id === currentPlayerId);
    setIsSaving(true);
    try {
      const success = await onSaveStatDraft(
        player.id,
        draftStats,
        cost,
        actorPlayer?.name,
        player.name,
        originalStats
      );
      if (success) {
        closeCreditPanel();
        // Trigger upgrade glow
        setJustUpgradedId(player.id);
        if (upgradeTimerRef.current) clearTimeout(upgradeTimerRef.current);
        upgradeTimerRef.current = setTimeout(() => setJustUpgradedId(null), 2200);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderCreditPanel = (player: Player) => {
    const statLabels = getStatLabels(player.position);
    const cost = draftStats && originalStats
      ? statLabels.reduce((sum, { key }) => {
          const k = String(key);
          return sum + Math.abs((draftStats[k] ?? 0) - (originalStats[k] ?? 0));
        }, 0)
      : 0;
    const canSave = cost > 0 && creditBalance != null && cost <= creditBalance && !isSaving;

    const currentRating = calcRating(player);
    const draftRating = draftStats
      ? calcRating({ ...player, ...Object.fromEntries(Object.entries(draftStats).map(([k, v]) => [k, v])) } as Player)
      : currentRating;
    const ratingDiff = draftRating - currentRating;

    return (
      <div className="mt-2 p-2 bg-gray-800 border border-yellow-700/50 rounded-lg w-[155px]">
        <div className="text-xs text-yellow-400 font-bold mb-1.5 text-center">💰 Stats aanpassen</div>
        {statLabels.map(({ key, label }) => {
          const k = String(key);
          const value = draftStats?.[k] ?? (player[key] as number) ?? 0;
          const changed = draftStats && originalStats && draftStats[k] !== originalStats[k];
          return (
            <div key={k} className="flex items-center justify-between gap-1 mb-1">
              <span className="text-xs font-bold text-gray-400 w-8">{label}</span>
              <button
                onClick={() => setDraftStats(prev => prev ? { ...prev, [k]: Math.max(1, prev[k] - 1) } : prev)}
                disabled={isSaving || value <= 1}
                className="w-6 h-6 bg-red-800 hover:bg-red-700 disabled:opacity-30 rounded text-xs font-black leading-none touch-manipulation"
              >
                −
              </button>
              <span className={`text-xs font-black w-6 text-center ${changed ? 'text-blue-300' : 'text-yellow-300'}`}>
                {value}
              </span>
              <button
                onClick={() => setDraftStats(prev => prev ? { ...prev, [k]: Math.min(99, prev[k] + 1) } : prev)}
                disabled={isSaving || value >= 99}
                className="w-6 h-6 bg-green-800 hover:bg-green-700 disabled:opacity-30 rounded text-xs font-black leading-none touch-manipulation"
              >
                +
              </button>
            </div>
          );
        })}

        <div className="flex items-center justify-center gap-1.5 mt-2 mb-1 py-1 bg-gray-900/60 rounded">
          <span className="text-sm font-black text-white">{currentRating}</span>
          <span className="text-gray-500 text-xs">→</span>
          <span className={`text-sm font-black ${ratingDiff > 0 ? 'text-green-400' : ratingDiff < 0 ? 'text-red-400' : 'text-white'}`}>
            {draftRating}
          </span>
          {ratingDiff !== 0 && (
            <span className={`text-xs font-bold ${ratingDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ({ratingDiff > 0 ? '+' : ''}{ratingDiff})
            </span>
          )}
        </div>

        <div className="text-center text-xs mt-1 mb-1.5">
          {cost > 0 ? (
            <span className={cost > (creditBalance ?? 0) ? 'text-red-400 font-bold' : 'text-yellow-400'}>
              {cost > (creditBalance ?? 0) ? 'Te weinig credits' : `Kosten: ${cost} ${cost === 1 ? 'credit' : 'credits'}`}
            </span>
          ) : (
            <span className="text-gray-500">Geen wijzigingen</span>
          )}
        </div>

        <button
          onClick={() => handleSaveDraft(player)}
          disabled={!canSave}
          className="w-full py-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 rounded text-xs font-bold text-black touch-manipulation"
        >
          {isSaving ? '...' : 'Opslaan'}
        </button>
        <button
          onClick={closeCreditPanel}
          disabled={isSaving}
          className="w-full mt-1 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded text-xs text-gray-300 touch-manipulation"
        >
          Annuleren
        </button>
      </div>
    );
  };

  const canEditCard = (player: Player) =>
    hasCredits && !player.is_guest &&
    (allowEditOthers || player.id === currentPlayerId);

  const renderCard = (player: Player) => {
    if (playerCardMode === 'teamsterren') {
      const sd = starData[player.id] ?? { gamesPlayed: 0, wins: 0 };
      return (
        <div key={player.id} className="flex flex-col items-center">
          <div className="relative">
            <TeamsterrenCard
              player={player}
              gamesPlayed={sd.gamesPlayed}
              wins={sd.wins}
              size="sm"
            />
            {isAdmin && (
              <button
                onClick={e => { e.stopPropagation(); setEditingPlayer(player); }}
                className="absolute top-1 right-1 w-7 h-7 bg-gray-700 hover:bg-gray-500 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={player.id} className="flex flex-col items-center">
        <div className="relative">
          <PlayerCard
            player={player}
            size="sm"
            isFlippable
            isSpdwWinner={spdwWinnerPlayerIds.includes(player.id)}
            seasonBadges={seasonBadges[player.id] ?? []}
            isJustUpgraded={justUpgradedId === player.id}
          />
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); setEditingPlayer(player); }}
              className="absolute top-1 right-1 w-7 h-7 bg-gray-700 hover:bg-gray-500 rounded-full flex items-center justify-center text-xs shadow-lg z-10"
            >
              ✏️
            </button>
          )}
        </div>
        {canEditCard(player) && (
          <button
            onClick={() => openCreditPanel(player)}
            className={`mt-1.5 px-3 py-1 rounded-full text-xs font-bold transition touch-manipulation ${
              creditEditingId === player.id
                ? 'bg-yellow-600 text-black'
                : 'bg-gray-700 hover:bg-yellow-700/50 text-yellow-400'
            }`}
          >
            💰
          </button>
        )}
        {creditEditingId === player.id && renderCreditPanel(player)}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl sm:text-3xl font-bold">
            {playerCardMode === 'teamsterren' ? '⭐ Teamsterren' : '🃏 Spelerskaarten'}
          </h2>
          <button
            onClick={() => setShowInfo(v => !v)}
            title="Hoe werkt het?"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              showInfo
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            i
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasCredits && playerCardMode === 'competitive' && (
            <span className="px-3 py-1.5 bg-yellow-900/40 border border-yellow-700/50 rounded-full text-xs font-bold text-yellow-400">
              💰 {creditBalance} {creditBalance === 1 ? 'credit' : 'credits'}
            </span>
          )}
          <button
            onClick={() => setSortBy('position')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'position' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Per positie
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1.5 rounded text-xs sm:text-sm font-bold ${
              sortBy === 'rating' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {playerCardMode === 'teamsterren' ? 'Op sterren' : 'Op rating'}
          </button>
        </div>
      </div>

      {/* Legenda — alleen bij competitive */}
      {playerCardMode === 'competitive' && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          {[
            { tier: 'bronze', label: 'Bronze',  color: 'bg-amber-700',   text: '< 65' },
            { tier: 'silver', label: 'Silver',  color: 'bg-gray-500',    text: '65–74' },
            { tier: 'gold',   label: 'Goud',    color: 'bg-yellow-600',  text: '75–84' },
            { tier: 'elite',  label: 'Elite',   color: 'bg-violet-700',  text: '85–89' },
            { tier: 'legend', label: 'Legend',  color: 'bg-cyan-700',    text: '90+' },
          ].map(({ label, color, text }) => (
            <span key={label} className="flex items-center gap-1 text-xs text-gray-400">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="font-bold text-white">{label}</span>
              <span>{text}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 text-xs text-gray-400 ml-1">
            <span>👑</span><span>SPDW-winnaar</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-4 h-4 rounded-full bg-yellow-600 flex items-center justify-center" style={{ fontSize: '9px' }}>⚽</span>
            <span>Topschutter</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center" style={{ fontSize: '9px' }}>🎯</span>
            <span>Meeste assists</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span>↻</span><span>tik = flip voor details</span>
          </span>
        </div>
      )}

      {/* Teamsterren legenda */}
      {playerCardMode === 'teamsterren' && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          {[
            { label: '⚪ Rookie',  text: '0–9 ⭐' },
            { label: '🔵 Belofte', text: '10–24 ⭐' },
            { label: '🟣 Ster',    text: '25–49 ⭐' },
            { label: '👑 Legende', text: '50+ ⭐' },
          ].map(({ label, text }) => (
            <span key={label} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="font-bold text-white">{label}</span>
              <span>{text}</span>
            </span>
          ))}
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInfo(false)}>
        <div className="bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-300 space-y-5 max-w-lg w-full max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>

          {playerCardMode === 'teamsterren' ? (
            <>
              <div>
                <h3 className="font-bold text-white mb-2 flex items-center gap-1.5">
                  <span>⭐</span> Hoe werken Teamsterren?
                </h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Je verdient sterren voor elke wedstrijd die je meespeelt: <span className="text-yellow-300 font-semibold">3 sterren</span> bij winst, <span className="text-yellow-300 font-semibold">1 ster</span> bij gelijkspel of verlies.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Sterren stapelen op en bepalen je level: <span className="text-white font-semibold">Rookie → Belofte → Ster → Legende</span>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Sterren zijn puur visueel — je kaart groeit automatisch. Er is niets te winnen of verliezen.</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-3">
                <h3 className="font-bold text-white mb-2">Niveaus</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { badge: '⚪ Rookie',  range: '0–9 sterren',   color: 'border-gray-500' },
                    { badge: '🔵 Belofte', range: '10–24 sterren', color: 'border-blue-500' },
                    { badge: '🟣 Ster',    range: '25–49 sterren', color: 'border-purple-500' },
                    { badge: '👑 Legende', range: '50+ sterren',   color: 'border-yellow-500' },
                  ].map(({ badge, range, color }) => (
                    <div key={badge} className={`bg-gray-900 rounded-lg p-2.5 border-l-2 ${color}`}>
                      <div className="font-bold text-white">{badge}</div>
                      <div className="text-gray-400 mt-0.5">{range}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="font-bold text-white mb-2 flex items-center gap-1.5">
                  <span>⚡</span> Hoe wordt de rating berekend?
                </h3>
                <p className="text-gray-400 text-xs mb-3">
                  De overall rating is een gewogen gemiddelde van de basisattributen. Per positie tellen andere attributen zwaarder mee.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { pos: '🧤 Keeper',     color: 'border-green-600',  stats: [{ label: 'DIV', pct: 25 }, { label: 'REF', pct: 25 }, { label: 'POS', pct: 20 }, { label: 'HAN', pct: 15 }, { label: 'SPE', pct: 10 }, { label: 'KIC', pct: 5 }] },
                    { pos: '🛡️ Verdediger', color: 'border-blue-600',   stats: [{ label: 'DEF', pct: 45 }, { label: 'PHY', pct: 15 }, { label: 'PAC', pct: 15 }, { label: 'PAS', pct: 10 }, { label: 'DRI', pct: 10 }, { label: 'SHO', pct: 5 }] },
                    { pos: '⚙️ Middenvelder', color: 'border-yellow-600', stats: [{ label: 'PAS', pct: 25 }, { label: 'DRI', pct: 20 }, { label: 'PAC', pct: 15 }, { label: 'SHO', pct: 15 }, { label: 'PHY', pct: 15 }, { label: 'DEF', pct: 10 }] },
                    { pos: '⚡ Aanvaller',  color: 'border-red-600',    stats: [{ label: 'SHO', pct: 30 }, { label: 'DRI', pct: 25 }, { label: 'PAC', pct: 20 }, { label: 'PHY', pct: 15 }, { label: 'PAS', pct: 5 }, { label: 'DEF', pct: 5 }] },
                  ].map(({ pos, color, stats }) => (
                    <div key={pos} className={`bg-gray-900 rounded-lg p-3 border-l-2 ${color}`}>
                      <div className="font-semibold text-white text-xs mb-2">{pos}</div>
                      <div className="space-y-1.5">
                        {stats.map(({ label, pct }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-8">{label}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-7 text-right">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h3 className="font-bold text-white mb-2 flex items-center gap-1.5">
                  <span>💰</span> Hoe werkt het creditsysteem?
                </h3>
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Je verdient <span className="text-yellow-300 font-semibold">1 credit</span> voor elke wedstrijd die je hebt meegespeeld{(teamSettings?.spdw_enabled ?? true) ? <>, en extra credits door de <span className="text-yellow-300 font-semibold">Speler van de Week</span> te worden via de stemming op het Dashboard</> : null}.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Met 1 credit kun je <span className="text-white font-semibold">één attribuutpunt</span> omhoog of omlaag aanpassen{(teamSettings?.allow_edit_others ?? true) ? <> bij <em>elke willekeurige speler</em>, inclusief jezelf</> : <> bij <em>je eigen kaart</em></>}.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Klik op de <span className="text-yellow-300 font-semibold">💰-knop</span> onder een spelerskaart om het aanpasspaneel te openen. Pas attributen naar wens aan en klik <span className="text-white font-semibold">Opslaan</span> — credits worden pas dan afgetrokken op basis van de netto wijziging.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">→</span>
                    <span>Jouw huidige saldo staat rechts bovenaan deze pagina. Credits kun je niet overdragen.</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-gray-700 pt-3">
            <button onClick={() => setShowInfo(false)} className="text-blue-400 hover:text-blue-200 text-xs font-medium">Sluiten</button>
          </div>
        </div>
        </div>
      )}

      {editingPlayer && isAdmin && (
        <PlayerStatsEditModal
          player={editingPlayer}
          onUpdateStat={(id, field, value) => {
            onUpdateStat(id, field, value);
            setEditingPlayer(prev => prev ? { ...prev, [field]: parseInt(value) || 0 } : null);
          }}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {sortBy === 'position' ? (
        <div className="space-y-6">
          {positionOrder.map(position => {
            const posPlayers = sortedPlayers.filter(p => p.position === position);
            if (posPlayers.length === 0) return null;
            return (
              <div key={position}>
                <h3 className="font-bold text-gray-400 mb-3 flex items-center gap-2 text-sm">
                  <span>{positionEmojis[position]}</span>
                  <span>{position}</span>
                </h3>
                <div className="flex flex-wrap gap-3 sm:gap-4 items-start">
                  {posPlayers.map(player => renderCard(player))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center items-start">
          {sortedPlayers.map(player => renderCard(player))}
        </div>
      )}
    </div>
  );
}
