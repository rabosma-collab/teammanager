import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, VotingMatch, VoteResults } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

const VOTING_PERIOD_DAYS = 4;

export function useVoting() {
  const { currentTeam } = useTeamContext();
  const [votingMatches, setVotingMatches] = useState<VotingMatch[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);

  const fetchVotingMatches = useCallback(async (
    allMatches: Match[],
    currentPlayerId: number | null
  ) => {
    if (!currentTeam) return;

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

        const lineupPlayerIds = (lineupData || []).map((l: { player_id: number }) => l.player_id);

        // Also fetch substitutes who came in (made minutes)
        const { data: subData } = await supabase
          .from('substitutions')
          .select('player_in_id')
          .eq('match_id', match.id);

        const subPlayerIds = (subData || []).map((s: { player_in_id: number }) => s.player_in_id);
        const playerIds = Array.from(new Set([...lineupPlayerIds, ...subPlayerIds]));

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

        const matchPlayers = (playerData || []).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }));

        // Fetch votes for this match
        const { data: voteData, error: voteError } = await supabase
          .from('player_of_week_votes')
          .select('*')
          .eq('match_id', match.id)
          .eq('team_id', currentTeam.id);

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

        const voteResults: VoteResults[] = matchPlayers.map((p: { id: number; name: string }) => ({
          player_id: p.id,
          player_name: p.name,
          vote_count: voteCounts[p.id] || 0
        })).sort((a: VoteResults, b: VoteResults) => b.vote_count - a.vote_count);

        // Check if current player has voted
        const currentVote = currentPlayerId
          ? votes.find((v: any) => v.voter_player_id === currentPlayerId)
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
  }, [currentTeam]);

  const submitVote = useCallback(async (
    matchId: number,
    currentPlayerId: number,
    votedForPlayerId: number,
    allMatches: Match[]
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    // Validation: can't vote for yourself
    if (votedForPlayerId === currentPlayerId) {
      alert('Je kunt niet op jezelf stemmen');
      return false;
    }

    try {
      // Check if player is in lineup or came in as substitute
      const { data: lineupCheck } = await supabase
        .from('lineups')
        .select('player_id')
        .eq('match_id', matchId)
        .eq('player_id', votedForPlayerId)
        .single();

      const { data: subCheck } = await supabase
        .from('substitutions')
        .select('player_in_id')
        .eq('match_id', matchId)
        .eq('player_in_id', votedForPlayerId)
        .single();

      if (!lineupCheck && !subCheck) {
        alert('Deze speler speelde niet mee in deze wedstrijd');
        return false;
      }

      // Check if already voted
      const { data: existingVote } = await supabase
        .from('player_of_week_votes')
        .select('id')
        .eq('match_id', matchId)
        .eq('voter_player_id', currentPlayerId)
        .eq('team_id', currentTeam.id)
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
          voted_for_player_id: votedForPlayerId,
          team_id: currentTeam.id
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
  }, [fetchVotingMatches, currentTeam]);

  return {
    votingMatches,
    isLoadingVotes,
    fetchVotingMatches,
    submitVote
  };
}
