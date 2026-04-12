import React, { useState } from 'react';
import type { Player, VotingMatch } from '../lib/types';
import { useToast } from '../contexts/ToastContext';
import InfoButton from './InfoButton';
import { displayScore } from '../lib/constants';

const MEDALS = ['🥇', '🥈', '🥉'];

function buildShareText(vm: VotingMatch): string {
  const { match, votes, daysRemaining } = vm;
  const isClosed = daysRemaining === 0;
  const prefix = match.home_away === 'Thuis' ? 'Thuis vs' : 'Uit bij';
  const { left: sl, right: sr } = displayScore(match.goals_for, match.goals_against, match.home_away);
  const scoreStr = sl != null && sr != null
    ? ` (${sl}–${sr})`
    : '';
  const dateStr = new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const topVotes = votes.filter(v => v.vote_count > 0).sort((a, b) => b.vote_count - a.vote_count);

  if (isClosed) {
    const winner = topVotes[0];
    const rest = topVotes.slice(1, 3);
    const winnerLine = winner
      ? `🏆 Winnaar: ${winner.player_name} (${winner.vote_count} ${winner.vote_count === 1 ? 'stem' : 'stemmen'})`
      : '🏆 Geen stemmen uitgebracht';
    const restLines = rest.map((v, i) => `${MEDALS[i + 1]} ${v.player_name} — ${v.vote_count} ${v.vote_count === 1 ? 'stem' : 'stemmen'}`).join('\n');
    return [
      `🏆 Speler van de Week — ${prefix} ${match.opponent}${scoreStr}`,
      `📅 ${dateStr}`,
      '',
      winnerLine,
      restLines ? `\n${restLines}` : '',
      '',
      'Bekijk de volledige stand via de app of op tmvoetbal.nl',
    ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  } else {
    const standLines = topVotes.slice(0, 3).map((v, i) => `${MEDALS[i]} ${v.player_name} — ${v.vote_count} ${v.vote_count === 1 ? 'stem' : 'stemmen'}`).join('\n');
    const dagLabel = daysRemaining === 1 ? 'dag' : 'dagen';
    return [
      `🏆 Stem op de Speler van de Week!`,
      `⚽ ${prefix} ${match.opponent}${scoreStr} · ${dateStr}`,
      '',
      `Nog ${daysRemaining} ${dagLabel} om je stem uit te brengen. Wie verdiende de meeste credits?`,
      topVotes.length > 0 ? `\n📊 Voorlopige stand:\n${standLines}` : '',
      '',
      'Stem via de app of op tmvoetbal.nl',
    ].filter(l => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
}

const POINTS_BY_RANK = [5, 3, 2];

function getDenseRank(voteCount: number, allEntries: { vote_count: number }[]): number {
  return allEntries.filter(e => e.vote_count > voteCount).length + 1;
}

function getMedal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
}

interface VotingSectionProps {
  votingMatches: VotingMatch[];
  isLoading: boolean;
  players: Player[];
  currentPlayerId: number | null;
  isStaff?: boolean;
  onSelectCurrentPlayer: (playerId: number) => void;
  onVote: (matchId: number, votedForPlayerId: number) => void;
}

export default function VotingSection({
  votingMatches,
  isLoading,
  players,
  currentPlayerId,
  isStaff = false,
  onSelectCurrentPlayer,
  onVote
}: VotingSectionProps) {
  const toast = useToast();
  const [selectedVotes, setSelectedVotes] = useState<Record<number, number>>({});
  const [shareToasts, setShareToasts] = useState<Record<number, string | null>>({});
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  const toggleExpand = (matchId: number, playerId: number) => {
    const key = `${matchId}-${playerId}`;
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleShare = async (vm: VotingMatch) => {
    const text = buildShareText(vm);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // gebruiker heeft geannuleerd
      }
    } else {
      await navigator.clipboard.writeText(text);
      setShareToasts(prev => ({ ...prev, [vm.match.id]: 'Gekopieerd naar klembord!' }));
      setTimeout(() => setShareToasts(prev => ({ ...prev, [vm.match.id]: null })), 2500);
    }
  };

  if (votingMatches.length === 0 && !isLoading) return null;

  const nonGuestPlayers = players.filter(p => !p.is_guest);

  return (
    <div className="w-full max-w-[900px] mx-auto mt-6">
      <div className="bg-gradient-to-br from-yellow-900/40 to-amber-950/40 rounded-xl p-4 sm:p-6 border-2 border-yellow-700/50">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg sm:text-2xl font-bold">🏆 Speler van de Week</h2>
          <InfoButton>
            <p className="font-semibold text-white mb-1">Hoe werkt de stemming?</p>
            <p>Na elke afgeronde wedstrijd open je een stemming van <span className="text-yellow-300 font-semibold">4 dagen</span>.</p>
            <p className="mt-1">Je kunt niet op jezelf stemmen. De top 3 ontvangt extra statcredits:</p>
            <div className="mt-1.5 space-y-0.5">
              <div className="flex gap-1.5">🥇 <span><span className="text-yellow-300 font-bold">5 credits</span> voor de winnaar</span></div>
              <div className="flex gap-1.5">🥈 <span><span className="text-yellow-300 font-bold">3 credits</span> voor de tweede</span></div>
              <div className="flex gap-1.5">🥉 <span><span className="text-yellow-300 font-bold">2 credits</span> voor de derde</span></div>
            </div>
            <p className="mt-1.5">Bovendien ontvang je <span className="text-yellow-300 font-bold">1 credit</span> voor elke wedstrijd die je meespeelt.</p>
            <p className="mt-1.5 text-gray-500">Credits gebruik je op de Spelerskaarten-pagina om FIFA-stats aan te passen.</p>
          </InfoButton>
        </div>

        {/* Wie ben jij? selector — alleen voor spelers zonder bekend player_id; stafleden slaan dit over */}
        {!currentPlayerId && !isStaff && (
          <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <label className="block text-sm font-bold mb-2 text-gray-300">Wie ben jij?</label>
            <select
              value={''}
              onChange={(e) => onSelectCurrentPlayer(parseInt(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
            >
              <option value="">Selecteer je naam...</option>
              {nonGuestPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-4 text-gray-400">Laden...</div>
        )}

        {!currentPlayerId && !isStaff && !isLoading && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Selecteer je naam om te stemmen
          </div>
        )}

        {(currentPlayerId || isStaff) && votingMatches.map(vm => {
          const isClosed = vm.daysRemaining === 0;
          const topVotes = vm.votes.filter(v => v.vote_count > 0);

          return (
            <div key={vm.match.id} className="bg-gray-800/50 rounded-lg p-3 sm:p-4 mb-3 last:mb-0 border border-gray-700">
              {/* Match info */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-700">
                <div>
                  <div className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                    {vm.match.home_away === 'Thuis' ? 'Thuis' : 'Uit'} vs {vm.match.opponent}
                    {vm.match.goals_for != null && vm.match.goals_against != null && (() => {
                      const { left, right } = displayScore(vm.match.goals_for, vm.match.goals_against, vm.match.home_away);
                      return (
                        <span className="text-yellow-400 font-black text-base">
                          {left} – {right}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(vm.match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isClosed ? (
                    <span className="text-xs px-2 py-1 rounded bg-gray-700/60 border border-gray-600 text-gray-400 whitespace-nowrap">
                      Stemming gesloten
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 border border-yellow-700/50 text-yellow-400 whitespace-nowrap">
                      Nog {vm.daysRemaining} {vm.daysRemaining === 1 ? 'dag' : 'dagen'}
                    </span>
                  )}
                  <button
                    onClick={() => handleShare(vm)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition touch-manipulation active:scale-95"
                    title={isClosed ? 'Deel uitslag' : 'Deel stemming'}
                  >
                    <span>📤</span>
                    <span className="hidden sm:inline">{isClosed ? 'Uitslag' : 'Delen'}</span>
                  </button>
                </div>
              </div>
              {shareToasts[vm.match.id] && (
                <div className="mb-2 text-center text-xs text-green-400 font-semibold animate-pulse">
                  ✅ {shareToasts[vm.match.id]}
                </div>
              )}

              {/* Stemming gesloten — winnaar announcement */}
              {isClosed && (
                <div>
                  {topVotes.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-3">Geen stemmen uitgebracht</p>
                  ) : (() => {
                    const ranked = topVotes.map(v => ({
                      ...v,
                      rank: getDenseRank(v.vote_count, topVotes),
                      credits: POINTS_BY_RANK[getDenseRank(v.vote_count, topVotes) - 1] ?? 0,
                    })).filter(v => v.rank <= 3);
                    const winners = ranked.filter(v => v.rank === 1);
                    const rest = ranked.filter(v => v.rank > 1);
                    return (
                      <>
                        {/* Winnaar spotlight */}
                        <div
                          className="text-center py-4 px-3 mb-4 rounded-xl bg-gradient-to-b from-yellow-900/40 to-amber-950/30 border border-yellow-600/40 cursor-pointer transition-colors hover:border-yellow-500/60"
                          onClick={() => winners.forEach(w => toggleExpand(vm.match.id, w.player_id))}
                        >
                          <div className="text-4xl mb-1">🏆</div>
                          <div className="text-yellow-500 font-black text-lg tracking-wide uppercase mb-1">Speler van de Week!</div>
                          <div className="text-white font-black text-2xl sm:text-3xl">
                            {winners.map(w => w.player_name).join(' & ')}
                          </div>
                          <div className="text-yellow-600/80 text-sm mt-1">
                            {winners[0].vote_count} {winners[0].vote_count === 1 ? 'stem' : 'stemmen'} &middot; +{POINTS_BY_RANK[0]} credits
                          </div>
                          {winners.some(w => expandedPlayers.has(`${vm.match.id}-${w.player_id}`)) && (
                            <div className="mt-3 pt-3 border-t border-yellow-700/30">
                              {winners.map(w => (
                                <div key={w.player_id}>
                                  {winners.length > 1 && <p className="text-yellow-500/70 text-xs font-bold mb-1">{w.player_name}:</p>}
                                  <p className="text-yellow-600/80 text-xs">
                                    Gestemd door: {w.voters.length > 0 ? w.voters.join(', ') : 'Onbekend'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Top 2 en 3 */}
                        {rest.length > 0 && (
                          <div className="space-y-1.5">
                            {rest.map(v => {
                              const isExpanded = expandedPlayers.has(`${vm.match.id}-${v.player_id}`);
                              return (
                                <div
                                  key={v.player_id}
                                  className="rounded-lg bg-gray-700/30 cursor-pointer transition-colors hover:bg-gray-700/50"
                                  onClick={() => toggleExpand(vm.match.id, v.player_id)}
                                >
                                  <div className="flex items-center justify-between px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">{getMedal(v.rank)}</span>
                                      <span className="text-gray-200 text-sm font-medium">{v.player_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-400 text-xs">{v.vote_count} {v.vote_count === 1 ? 'stem' : 'stemmen'}</span>
                                      {v.credits > 0 && (
                                        <span className="text-yellow-700 text-xs font-bold">+{v.credits} cr.</span>
                                      )}
                                    </div>
                                  </div>
                                  {isExpanded && v.voters.length > 0 && (
                                    <div className="px-3 pb-2 pl-9">
                                      <p className="text-gray-500 text-xs">
                                        Gestemd door: {v.voters.join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Stemming open — Nog niet gestemd */}
              {!isClosed && !vm.hasVoted && (
                <div>
                  <p className="text-sm text-gray-300 mb-3">Stem op jouw speler van de week:</p>
                  <div className="space-y-1 mb-3">
                    {vm.players
                      .filter(p => p.id !== currentPlayerId)
                      .map(player => (
                        <label
                          key={player.id}
                          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                            selectedVotes[vm.match.id] === player.id
                              ? 'bg-yellow-900/40 border border-yellow-600'
                              : 'hover:bg-gray-700/50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`vote-${vm.match.id}`}
                            value={player.id}
                            checked={selectedVotes[vm.match.id] === player.id}
                            onChange={() => setSelectedVotes(prev => ({ ...prev, [vm.match.id]: player.id }))}
                            className="mr-3 accent-yellow-500"
                          />
                          <span className="text-sm sm:text-base">{player.name}</span>
                          {(vm.votes.find(v => v.player_id === player.id)?.vote_count || 0) > 0 && (
                            <span className="text-gray-500 text-xs ml-2">
                              ({vm.votes.find(v => v.player_id === player.id)?.vote_count} {vm.votes.find(v => v.player_id === player.id)?.vote_count === 1 ? 'stem' : 'stemmen'})
                            </span>
                          )}
                        </label>
                      ))}
                  </div>
                  <button
                    onClick={() => {
                      const votedFor = selectedVotes[vm.match.id];
                      if (!votedFor) {
                        toast.warning('Selecteer een speler om op te stemmen');
                        return;
                      }
                      onVote(vm.match.id, votedFor);
                    }}
                    disabled={!selectedVotes[vm.match.id]}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold text-sm sm:text-base touch-manipulation active:scale-95"
                  >
                    STEM
                  </button>
                </div>
              )}

              {/* Stemming open — Wel gestemd */}
              {!isClosed && vm.hasVoted && (
                <div>
                  <p className="text-green-400 mb-3 text-sm font-bold">
                    ✓ Je hebt gestemd op {vm.players.find(p => p.id === vm.votedFor)?.name}
                  </p>
                  <div className="text-sm">
                    <p className="font-bold text-gray-300 mb-2">Huidige stand:</p>
                    <div className="space-y-1">
                      {vm.votes.filter(v => v.vote_count > 0).map((v, _idx, arr) => {
                        const rank = getDenseRank(v.vote_count, arr);
                        const medal = getMedal(rank);
                        const isExpanded = expandedPlayers.has(`${vm.match.id}-${v.player_id}`);
                        return (
                          <div
                            key={v.player_id}
                            className="rounded bg-gray-700/30 cursor-pointer transition-colors hover:bg-gray-700/50"
                            onClick={() => toggleExpand(vm.match.id, v.player_id)}
                          >
                            <div className="flex justify-between items-center p-1.5">
                              <span className={rank === 1 ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                                {medal && `${medal} `}{v.player_name}
                              </span>
                              <span className="text-gray-400 text-xs">
                                {v.vote_count} {v.vote_count === 1 ? 'stem' : 'stemmen'}
                              </span>
                            </div>
                            {isExpanded && v.voters.length > 0 && (
                              <div className="px-1.5 pb-1.5 pl-6">
                                <p className="text-gray-500 text-xs">
                                  Gestemd door: {v.voters.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {vm.votes.filter(v => v.vote_count > 0).length === 0 && (
                        <div className="text-gray-500 text-xs">Nog geen stemmen</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
