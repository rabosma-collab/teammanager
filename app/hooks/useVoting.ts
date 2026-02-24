import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, VotingMatch, VoteResults, SpdwResult, SpdwPodiumEntry } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';

const VOTING_PERIOD_DAYS = 4;
const POINTS_BY_RANK = [5, 3, 2];

function computePodium(
  voteCounts: Record<number, number>,
  playerMap: Map<number, string>
): SpdwPodiumEntry[] {
  const sorted = Object.entries(voteCounts)
    .map(([pid, count]) => ({ player_id: parseInt(pid), vote_count: count }))
    .filter(e => e.vote_count > 0)
    .sort((a, b) => b.vote_count - a.vote_count);

  const podium: SpdwPodiumEntry[] = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].vote_count < sorted[i - 1].vote_count) {
      rank = i + 1;
    }
    if (rank > 3) break;
    const credits = POINTS_BY_RANK[rank - 1] ?? 0;
    podium.push({
      rank,
      player_id: sorted[i].player_id,
      player_name: playerMap.get(sorted[i].player_id) ?? `Speler ${sorted[i].player_id}`,
      vote_count: sorted[i].vote_count,
      credits,
    });
  }
  return podium;
}

export function useVoting() {
  const { currentTeam } = useTeamContext();
  const toast = useToast();
  const [votingMatches, setVotingMatches] = useState<VotingMatch[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(false);
  const [lastSpdwResult, setLastSpdwResult] = useState<SpdwResult | null>(null);
  const fetchIdRef = useRef(0);

  const fetchVotingMatches = useCallback(async (
    allMatches: Match[],
    currentPlayerId: number | null
  ) => {
    if (!currentTeam) return;

    const fetchId = ++fetchIdRef.current;

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id ?? null;

    setIsLoadingVotes(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - VOTING_PERIOD_DAYS);

      const eligibleMatches = allMatches.filter(m => {
        if (m.match_status !== 'afgerond') return false;
        const matchDate = new Date(m.date);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate >= cutoffDate;
      });

      if (eligibleMatches.length === 0) {
        if (fetchId === fetchIdRef.current) setVotingMatches([]);

        // Geen actieve stemronde: zoek meest recente afgesloten wedstrijd voor eindstand
        const finishedMatches = allMatches
          .filter(m => m.match_status === 'afgerond')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (finishedMatches.length === 0) {
          if (fetchId === fetchIdRef.current) setLastSpdwResult(null);
          return;
        }

        const lastMatch = finishedMatches[0];

        const { data: votesData } = await supabase
          .from('player_of_week_votes')
          .select('voted_for_player_id')
          .eq('match_id', lastMatch.id)
          .eq('team_id', currentTeam.id);

        if (!votesData || votesData.length === 0) {
          if (fetchId === fetchIdRef.current) setLastSpdwResult({ match: lastMatch, podium: [] });
          return;
        }

        const voteCounts: Record<number, number> = {};
        for (const v of votesData) {
          voteCounts[v.voted_for_player_id] = (voteCounts[v.voted_for_player_id] || 0) + 1;
        }

        const playerIds = Object.keys(voteCounts).map(Number);
        const { data: playerData } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds);

        const playerMap = new Map<number, string>();
        for (const p of (playerData || [])) playerMap.set(p.id, p.name);

        const podium = computePodium(voteCounts, playerMap);
        if (fetchId === fetchIdRef.current) setLastSpdwResult({ match: lastMatch, podium });
        return;
      }

      // Actieve stemronde: wis de eindstand
      if (fetchId === fetchIdRef.current) setLastSpdwResult(null);

      const matchIds = eligibleMatches.map(m => m.id);

      // 3 batch-queries parallel in plaats van 4 queries per wedstrijd
      const [lineupResult, subResult, votesResult] = await Promise.all([
        supabase
          .from('lineups')
          .select('match_id, player_id')
          .in('match_id', matchIds),
        supabase
          .from('substitutions')
          .select('match_id, player_in_id')
          .in('match_id', matchIds),
        supabase
          .from('player_of_week_votes')
          .select('match_id, voter_player_id, voter_user_id, voted_for_player_id')
          .in('match_id', matchIds)
          .eq('team_id', currentTeam.id),
      ]);

      // Verzamel alle unieke speler-IDs over alle wedstrijden heen
      const allPlayerIds = new Set<number>();
      for (const row of (lineupResult.data || [])) allPlayerIds.add(row.player_id);
      for (const row of (subResult.data || [])) allPlayerIds.add(row.player_in_id);

      if (allPlayerIds.size === 0) {
        if (fetchId === fetchIdRef.current) setVotingMatches([]);
        return;
      }

      // Één spelers-query voor alle wedstrijden
      const { data: playerData } = await supabase
        .from('players')
        .select('id, name')
        .in('id', Array.from(allPlayerIds));

      const playerMap = new Map<number, string>();
      for (const p of (playerData || [])) playerMap.set(p.id, p.name);

      // Groepeer lineup + subs per wedstrijd
      const participantsByMatch = new Map<number, Set<number>>();
      for (const row of (lineupResult.data || [])) {
        if (!participantsByMatch.has(row.match_id)) participantsByMatch.set(row.match_id, new Set());
        participantsByMatch.get(row.match_id)!.add(row.player_id);
      }
      for (const row of (subResult.data || [])) {
        if (!participantsByMatch.has(row.match_id)) participantsByMatch.set(row.match_id, new Set());
        participantsByMatch.get(row.match_id)!.add(row.player_in_id);
      }

      // Groepeer stemmen per wedstrijd
      type VoteRow = {
        match_id: number;
        voter_player_id: number | null;
        voter_user_id: string | null;
        voted_for_player_id: number;
      };

      const votesByMatch = new Map<number, VoteRow[]>();
      for (const vote of (votesResult.data || [])) {
        if (!votesByMatch.has(vote.match_id)) votesByMatch.set(vote.match_id, []);
        votesByMatch.get(vote.match_id)!.push(vote as VoteRow);
      }

      const results: VotingMatch[] = [];

      for (const match of eligibleMatches) {
        const participantIds = Array.from(participantsByMatch.get(match.id) || new Set<number>());
        if (participantIds.length === 0) continue;

        const matchPlayers = participantIds
          .filter(id => playerMap.has(id))
          .map(id => ({ id, name: playerMap.get(id)! }));

        const votes: VoteRow[] = votesByMatch.get(match.id) || [];

        const voteCounts: Record<number, number> = {};
        for (const vote of votes) {
          voteCounts[vote.voted_for_player_id] = (voteCounts[vote.voted_for_player_id] || 0) + 1;
        }

        const voteResults: VoteResults[] = matchPlayers.map(p => ({
          player_id: p.id,
          player_name: p.name,
          vote_count: voteCounts[p.id] || 0
        })).sort((a, b) => b.vote_count - a.vote_count);

        const currentVote = votes.find(v =>
          (currentUserId && v.voter_user_id === currentUserId) ||
          (currentPlayerId && v.voter_player_id === currentPlayerId)
        ) ?? null;

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

      results.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
      if (fetchId === fetchIdRef.current) setVotingMatches(results);
    } catch (error) {
      console.error('Error fetching voting matches:', error);
    } finally {
      if (fetchId === fetchIdRef.current) setIsLoadingVotes(false);
    }
  }, [currentTeam]);

  const submitVote = useCallback(async (
    matchId: number,
    currentPlayerId: number | null,
    votedForPlayerId: number,
    allMatches: Match[]
  ): Promise<boolean> => {
    if (!currentTeam) return false;

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id ?? null;

    if (!currentPlayerId && !currentUserId) {
      toast.warning('Je moet ingelogd zijn om te stemmen');
      return false;
    }

    if (currentPlayerId && votedForPlayerId === currentPlayerId) {
      toast.warning('Je kunt niet op jezelf stemmen');
      return false;
    }

    try {
      // Check deadline voor de insert
      const match = allMatches.find(m => m.id === matchId);
      if (match) {
        const matchDate = new Date(match.date);
        matchDate.setHours(0, 0, 0, 0);
        const deadline = new Date(matchDate);
        deadline.setDate(deadline.getDate() + VOTING_PERIOD_DAYS);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today > deadline) {
          toast.warning('Stemperiode is verlopen');
          return false;
        }
      }

      // Lineup- en dubbelcheck parallel uitvoeren
      const [lineupCheck, subCheck, existingVoteCheck] = await Promise.all([
        supabase
          .from('lineups')
          .select('player_id')
          .eq('match_id', matchId)
          .eq('player_id', votedForPlayerId)
          .maybeSingle(),
        supabase
          .from('substitutions')
          .select('player_in_id')
          .eq('match_id', matchId)
          .eq('player_in_id', votedForPlayerId)
          .maybeSingle(),
        currentUserId
          ? supabase
              .from('player_of_week_votes')
              .select('id')
              .eq('match_id', matchId)
              .eq('team_id', currentTeam.id)
              .eq('voter_user_id', currentUserId)
              .maybeSingle()
          : supabase
              .from('player_of_week_votes')
              .select('id')
              .eq('match_id', matchId)
              .eq('team_id', currentTeam.id)
              .eq('voter_player_id', currentPlayerId!)
              .maybeSingle(),
      ]);

      if (!lineupCheck.data && !subCheck.data) {
        toast.warning('Deze speler speelde niet mee in deze wedstrijd');
        return false;
      }

      if (existingVoteCheck.data) {
        toast.warning('Je hebt al gestemd op deze wedstrijd');
        return false;
      }

      const { error } = await supabase
        .from('player_of_week_votes')
        .insert({
          match_id: matchId,
          voter_player_id: currentPlayerId ?? null,
          voter_user_id: currentUserId,
          voted_for_player_id: votedForPlayerId,
          team_id: currentTeam.id
        });

      if (error) throw error;

      toast.success('✅ Succesvol gestemd!');
      await fetchVotingMatches(allMatches, currentPlayerId);
      return true;
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast.error('Er ging iets mis, probeer opnieuw');
      return false;
    }
  }, [fetchVotingMatches, currentTeam]);

  return {
    votingMatches,
    isLoadingVotes,
    lastSpdwResult,
    fetchVotingMatches,
    submitVote
  };
}
