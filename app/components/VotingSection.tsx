import React, { useState } from 'react';
import type { Player, VotingMatch } from '../lib/types';

interface VotingSectionProps {
  votingMatches: VotingMatch[];
  isLoading: boolean;
  players: Player[];
  currentPlayerId: number | null;
  onSelectCurrentPlayer: (playerId: number) => void;
  onVote: (matchId: number, votedForPlayerId: number) => void;
}

export default function VotingSection({
  votingMatches,
  isLoading,
  players,
  currentPlayerId,
  onSelectCurrentPlayer,
  onVote
}: VotingSectionProps) {
  const [selectedVotes, setSelectedVotes] = useState<Record<number, number>>({});

  if (votingMatches.length === 0 && !isLoading) return null;

  const nonGuestPlayers = players.filter(p => !p.is_guest);

  return (
    <div className="w-full max-w-[900px] mx-auto mt-6">
      <div className="bg-gradient-to-br from-yellow-900/40 to-amber-950/40 rounded-xl p-4 sm:p-6 border-2 border-yellow-700/50">
        <h2 className="text-lg sm:text-2xl font-bold mb-4">🏆 Speler van de Week</h2>

        {/* Wie ben jij? selector — alleen tonen als speler niet bekend is */}
        {!currentPlayerId && (
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

        {!currentPlayerId && !isLoading && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Selecteer je naam om te stemmen
          </div>
        )}

        {currentPlayerId && votingMatches.map(vm => (
          <div key={vm.match.id} className="bg-gray-800/50 rounded-lg p-3 sm:p-4 mb-3 last:mb-0 border border-gray-700">
            {/* Match info */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-700">
              <div>
                <div className="font-bold text-base sm:text-lg text-white">
                  {vm.match.home_away === 'Thuis' ? 'Thuis' : 'Uit'} vs {vm.match.opponent}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(vm.match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 border border-yellow-700/50 text-yellow-400 whitespace-nowrap">
                Nog {vm.daysRemaining} {vm.daysRemaining === 1 ? 'dag' : 'dagen'}
              </span>
            </div>

            {/* Nog niet gestemd */}
            {!vm.hasVoted && (
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
                      alert('Selecteer een speler om op te stemmen');
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

            {/* Wel gestemd */}
            {vm.hasVoted && (
              <div>
                <p className="text-green-400 mb-3 text-sm font-bold">
                  ✓ Je hebt gestemd op {vm.players.find(p => p.id === vm.votedFor)?.name}
                </p>
                <div className="text-sm">
                  <p className="font-bold text-gray-300 mb-2">Huidige stand:</p>
                  <div className="space-y-1">
                    {vm.votes.filter(v => v.vote_count > 0).map((v, idx) => (
                      <div key={v.player_id} className="flex justify-between items-center p-1.5 rounded bg-gray-700/30">
                        <span className={idx === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                          {idx === 0 && '🥇 '}{idx === 1 && '🥈 '}{idx === 2 && '🥉 '}
                          {v.player_name}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {v.vote_count} {v.vote_count === 1 ? 'stem' : 'stemmen'}
                        </span>
                      </div>
                    ))}
                    {vm.votes.filter(v => v.vote_count > 0).length === 0 && (
                      <div className="text-gray-500 text-xs">Nog geen stemmen</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
