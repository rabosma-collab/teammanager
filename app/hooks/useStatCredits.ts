import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';

const VOTING_PERIOD_DAYS = 4;
const INITIAL_BALANCE = 10;
const POINTS_BY_RANK = [5, 3, 2];

export function useStatCredits() {
  const { currentTeam } = useTeamContext();
  const [balance, setBalance] = useState<number | null>(null);

  // Ensure a stat_credits row exists; returns current balance
  const ensureBalance = useCallback(async (playerId: number): Promise<number> => {
    if (!currentTeam) return 0;

    const { data, error } = await supabase
      .from('stat_credits')
      .select('balance')
      .eq('player_id', playerId)
      .eq('team_id', currentTeam.id)
      .single();

    if (!error && data) return data.balance;

    // No row yet — create with initial balance
    const { error: insertError } = await supabase
      .from('stat_credits')
      .insert({ player_id: playerId, team_id: currentTeam.id, balance: INITIAL_BALANCE });

    if (!insertError) {
      await supabase.from('stat_credit_transactions').insert({
        team_id: currentTeam.id,
        player_id: playerId,
        balance_change: INITIAL_BALANCE,
        reason: 'initial',
      });
    }

    return INITIAL_BALANCE;
  }, [currentTeam]);

  const fetchBalance = useCallback(async (playerId: number) => {
    try {
      const bal = await ensureBalance(playerId);
      setBalance(bal);
    } catch (e) {
      console.error('Error fetching credit balance:', e);
    }
  }, [ensureBalance]);

  // Lazy payout: award SPDW credits for matches whose voting period has ended
  const awardSpdwCredits = useCallback(async () => {
    if (!currentTeam) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: pendingMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('team_id', currentTeam.id)
        .eq('match_status', 'afgerond')
        .eq('credits_awarded', false);

      if (!pendingMatches || pendingMatches.length === 0) return;

      for (const match of pendingMatches) {
        const matchDate = new Date(match.date);
        matchDate.setHours(0, 0, 0, 0);
        const deadline = new Date(matchDate);
        deadline.setDate(deadline.getDate() + VOTING_PERIOD_DAYS);

        // Only process if voting period has ended
        if (today <= deadline) continue;

        // Fetch votes
        const { data: votes } = await supabase
          .from('player_of_week_votes')
          .select('voted_for_player_id')
          .eq('match_id', match.id)
          .eq('team_id', currentTeam.id);

        // Mark as awarded regardless (even if no votes)
        await supabase
          .from('matches')
          .update({ credits_awarded: true })
          .eq('id', match.id);

        if (!votes || votes.length === 0) continue;

        // Count votes per player
        const voteCounts: Record<number, number> = {};
        for (const v of votes) {
          voteCounts[v.voted_for_player_id] = (voteCounts[v.voted_for_player_id] || 0) + 1;
        }

        // Sort descending by vote count
        const sorted = Object.entries(voteCounts)
          .map(([pid, count]) => ({ playerId: parseInt(pid), count }))
          .sort((a, b) => b.count - a.count);

        // Award points, handling ties (tied players all get same rank's points)
        const creditMap: Record<number, number> = {};
        let i = 0;
        let rankIdx = 0;
        while (i < sorted.length && rankIdx < POINTS_BY_RANK.length) {
          const currentCount = sorted[i].count;
          const tied = sorted.filter(s => s.count === currentCount);
          const points = POINTS_BY_RANK[rankIdx];
          for (const t of tied) {
            creditMap[t.playerId] = (creditMap[t.playerId] || 0) + points;
          }
          i += tied.length;
          rankIdx += tied.length;
        }

        // Credit each qualifying player
        for (const [pid, pts] of Object.entries(creditMap)) {
          const playerId = parseInt(pid);
          const currentBal = await ensureBalance(playerId);
          const newBal = currentBal + pts;

          await supabase
            .from('stat_credits')
            .update({ balance: newBal })
            .eq('player_id', playerId)
            .eq('team_id', currentTeam.id);

          await supabase.from('stat_credit_transactions').insert({
            team_id: currentTeam.id,
            player_id: playerId,
            balance_change: pts,
            reason: 'spdw',
            match_id: match.id,
          });
        }
      }
    } catch (e) {
      console.error('Error awarding SPDW credits:', e);
    }
  }, [currentTeam, ensureBalance]);

  // Spend multiple credits to save draft stat changes for a player
  const spendCreditsForStats = useCallback(async (
    spenderId: number,
    targetPlayerId: number,
    finalStats: Record<string, number>,
    totalCost: number
  ): Promise<boolean> => {
    if (!currentTeam || balance === null || balance < totalCost || totalCost <= 0) return false;

    try {
      const { error: statError } = await supabase
        .from('players')
        .update(finalStats)
        .eq('id', targetPlayerId);

      if (statError) throw statError;

      const newBalance = balance - totalCost;
      const { error: creditError } = await supabase
        .from('stat_credits')
        .update({ balance: newBalance })
        .eq('player_id', spenderId)
        .eq('team_id', currentTeam.id);

      if (creditError) throw creditError;

      await supabase.from('stat_credit_transactions').insert({
        team_id: currentTeam.id,
        player_id: spenderId,
        target_player_id: targetPlayerId,
        balance_change: -totalCost,
        reason: 'stat_change',
      });

      setBalance(newBalance);
      return true;
    } catch (e) {
      console.error('Error spending credits for stats:', e);
      return false;
    }
  }, [currentTeam, balance]);

  // Spend 1 credit to change a target player's stat by +1 or -1
  const spendCredit = useCallback(async (
    spenderId: number,
    targetPlayerId: number,
    stat: string,
    change: 1 | -1
  ): Promise<boolean> => {
    if (!currentTeam || balance === null || balance <= 0) return false;

    try {
      // Fetch current stat value
      const { data: playerData } = await supabase
        .from('players')
        .select(stat)
        .eq('id', targetPlayerId)
        .single();

      if (!playerData) return false;

      const current = (playerData[stat] as number) ?? 0;
      const next = Math.max(1, Math.min(99, current + change));
      if (next === current) return false; // already at boundary

      // Update stat
      const { error: statError } = await supabase
        .from('players')
        .update({ [stat]: next })
        .eq('id', targetPlayerId);

      if (statError) throw statError;

      // Deduct credit
      const newBalance = balance - 1;
      const { error: creditError } = await supabase
        .from('stat_credits')
        .update({ balance: newBalance })
        .eq('player_id', spenderId)
        .eq('team_id', currentTeam.id);

      if (creditError) throw creditError;

      // Log transaction
      await supabase.from('stat_credit_transactions').insert({
        team_id: currentTeam.id,
        player_id: spenderId,
        target_player_id: targetPlayerId,
        stat,
        balance_change: -1,
        reason: 'stat_change',
      });

      setBalance(newBalance);
      return true;
    } catch (e) {
      console.error('Error spending credit:', e);
      return false;
    }
  }, [currentTeam, balance]);

  return { balance, fetchBalance, awardSpdwCredits, spendCredit, spendCreditsForStats };
}
