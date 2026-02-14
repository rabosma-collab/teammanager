import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, VotingMatch, VoteResults } from '../lib/types';

const VOTING_PERIOD_DAYS = 4;

export function useVoting() {
  const [votingMatches, setVotingMatches] = useState<VotingMatch[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);

  const fetchVotingMatches = useCallback(async (
    allMatches: Match[],
    currentPlayerId: number | null
  ) => {
    setIsLoadingVotes(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter: afgerond matches within voting period
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - VOTING_PERIOD_DAYS);

      const eligibleMatches = allMatches.filter(m => {
        if (m.match_status !== 'afgerond') return false;
        const matchDate = new Date(m.date);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate >= cutoffDate;
      });

      const results: VotingMatch[] = [];

      for (const match of eligibleMatches) {
        // Fetch lineup players for this match
        const { data: lineupData, error: lineupError } = await supabase
          .from('lineups')
          .select('player_id')
          .eq('match_id', match.id);

        if (lineupError) {
          console.error('Error fetching lineup for voting:', lineupError);
          continue;
        }

        const playerIds = (lineupData || []).map(l => l.player_id);
        if (playerIds.length === 0) continue;

        // Fetch player names
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds);

        if (playerError) {
          console.error('Error fetching players for voting:', playerError);
          continue;
        }

        const matchPlayers = (playerData || []).map(p => ({ id: p.id, name: p.name }));

        // Fetch votes for this match
        const { data: voteData, error: voteError } = await supabase
          .from('player_of_week_votes')
          .select('*')
          .eq('match_id', match.id);

        if (voteError) {
          console.error('Error fetching votes:', voteError);
          continue;
        }

        const votes = voteData || [];

        // Aggregate vote counts
        const voteCounts: Record<number, number> = {};
        for (const vote of votes) {
          voteCounts[vote.voted_for_player_id] = (voteCounts[vote.voted_for_player_id] || 0) + 1;
        }

        const voteResults: VoteResults[] = matchPlayers.map(p => ({
          player_id: p.id,
          player_name: p.name,
          vote_count: voteCounts[p.id] || 0
        })).sort((a, b) => b.vote_count - a.vote_count);

        // Check if current player has voted
        const currentVote = currentPlayerId
          ? votes.find(v => v.voter_player_id === currentPlayerId)
          : null;

        // Calculate days remaining
        const matchDate = new Date(match.date);
        matchDate.setHours(0, 0, 0, 0);
        const deadline = new Date(matchDate);
        deadline.setDate(deadline.getDate() + VOTING_PERIOD_DAYS);
        const diffMs = deadline.getTime() - today.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        results.push({
          match,
          players: matchPlayers,
          votes: voteResults,
          hasVoted: !!currentVote,
          votedFor: currentVote?.voted_for_player_id,
          daysRemaining
        });
      }

      // Sort by most recent match first
      results.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
      setVotingMatches(results);
    } catch (error) {
      console.error('Error fetching voting matches:', error);
    } finally {
      setIsLoadingVotes(false);
    }
  }, []);

  const submitVote = useCallback(async (
    matchId: number,
    currentPlayerId: number,
    votedForPlayerId: number,
    allMatches: Match[]
  ): Promise<boolean> => {
    // Validation: can't vote for yourself
    if (votedForPlayerId === currentPlayerId) {
      alert('Je kunt niet op jezelf stemmen');
      return false;
    }

    try {
      // Check if player is in lineup
      const { data: lineupCheck } = await supabase
        .from('lineups')
        .select('player_id')
        .eq('match_id', matchId)
        .eq('player_id', votedForPlayerId)
        .single();

      if (!lineupCheck) {
        alert('Deze speler zat niet in de opstelling');
        return false;
      }

      // Check if already voted
      const { data: existingVote } = await supabase
        .from('player_of_week_votes')
        .select('id')
        .eq('match_id', matchId)
        .eq('voter_player_id', currentPlayerId)
        .single();

      if (existingVote) {
        alert('Je hebt al gestemd op deze wedstrijd');
        return false;
      }

      // Check deadline
      const match = allMatches.find(m => m.id === matchId);
      if (match) {
        const matchDate = new Date(match.date);
        matchDate.setHours(0, 0, 0, 0);
        const deadline = new Date(matchDate);
        deadline.setDate(deadline.getDate() + VOTING_PERIOD_DAYS);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today > deadline) {
          alert('Stemperiode is verlopen');
          return false;
        }
      }

      // Insert vote
      const { error } = await supabase
        .from('player_of_week_votes')
        .insert({
          match_id: matchId,
          voter_player_id: currentPlayerId,
          voted_for_player_id: votedForPlayerId
        });

      if (error) throw error;

      alert('✅ Succesvol gestemd!');

      // Refresh
      await fetchVotingMatches(allMatches, currentPlayerId);
      return true;
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Er ging iets mis, probeer opnieuw');
      return false;
    }
  }, [fetchVotingMatches]);

  return {
    votingMatches,
    isLoadingVotes,
    fetchVotingMatches,
    submitVote
  };
}
