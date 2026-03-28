import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import { logActivity } from '../lib/logActivity';

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
    } catch {
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
        if (today < deadline) continue;

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

        // Batch fetch: balances + spelernamen parallel ophalen
        const playerIds = Object.keys(creditMap).map(Number);
        const [balancesResult, playerNamesResult] = await Promise.all([
          supabase
            .from('stat_credits')
            .select('player_id, balance')
            .in('player_id', playerIds)
            .eq('team_id', currentTeam.id),
          supabase
            .from('players')
            .select('id, name')
            .in('id', playerIds),
        ]);

        const balanceMap = new Map<number, number>(
          (balancesResult.data ?? []).map((r: { player_id: number; balance: number }) => [r.player_id, r.balance])
        );
        const nameMap = new Map(
          (playerNamesResult.data ?? []).map((p: { id: number; name: string }) => [p.id, p.name])
        );

        // Batch insert voor spelers zonder balance-rij
        const missingIds = playerIds.filter(id => !balanceMap.has(id));
        if (missingIds.length > 0) {
          await supabase.from('stat_credits').insert(
            missingIds.map(id => ({ player_id: id, team_id: currentTeam.id, balance: INITIAL_BALANCE }))
          );
          await supabase.from('stat_credit_transactions').insert(
            missingIds.map(id => ({
              team_id: currentTeam.id,
              player_id: id,
              balance_change: INITIAL_BALANCE,
              reason: 'initial',
            }))
          );
          for (const id of missingIds) balanceMap.set(id, INITIAL_BALANCE);
        }

        // Parallel RPC-calls voor credit-uitkering
        // Gebruikt award_player_credits() (SECURITY DEFINER) zodat elk teamlid
        // credits kan uitbetalen aan anderen zonder verruimde RLS-policy.
        await Promise.all(
          Object.entries(creditMap).map(([pid, pts]) => {
            const playerId = parseInt(pid);
            const currentBal = balanceMap.get(playerId) ?? INITIAL_BALANCE;
            return supabase.rpc('award_player_credits', {
              p_player_id:   playerId,
              p_team_id:     currentTeam.id,
              p_new_balance: currentBal + pts,
              p_change:      pts,
              p_reason:      'spdw',
              p_match_id:    match.id,
            });
          })
        );

        // Log alle winnaars (hoogste pts = rang 1, kan gelijkspel zijn)
        const winnerEntries = Object.entries(creditMap).filter(([, pts]) => pts === POINTS_BY_RANK[0]);
        for (const [pid] of winnerEntries) {
          const winnerId = parseInt(pid);
          logActivity({
            teamId: currentTeam.id,
            type: 'spdw_winner',
            subjectId: winnerId,
            matchId: match.id,
            payload: {
              subject_name: nameMap.get(winnerId) ?? 'Onbekend',
              opponent: match.opponent ?? '',
              home_away: match.home_away ?? '',
            },
          });
        }
      }
    } catch {
      // credits ongewijzigd laten bij fout
    }
  }, [currentTeam]);

  // Spend multiple credits to save draft stat changes for a player
  const spendCreditsForStats = useCallback(async (
    spenderId: number,
    targetPlayerId: number,
    finalStats: Record<string, number>,
    totalCost: number,
    actorName?: string,
    subjectName?: string,
    prevStats?: Record<string, number>
  ): Promise<{ success: boolean; errorMessage?: string }> => {
    if (!currentTeam) return { success: false, errorMessage: 'Geen actief team gevonden.' };
    if (balance === null) return { success: false, errorMessage: 'Creditbalans niet geladen. Ververs de pagina.' };
    if (balance < totalCost) return { success: false, errorMessage: `Niet genoeg credits (nodig: ${totalCost}, beschikbaar: ${balance}).` };
    if (totalCost <= 0) return { success: false, errorMessage: 'Ongeldige kosten.' };

    try {
      const newBalance = balance - totalCost;

      // SECURITY DEFINER RPC: valideert spender-koppeling, target-team en stat-whitelist,
      // en trekt credits atomisch af. Voorkomt stat-wijzigingen zonder credits via directe API.
      const { error: rpcError } = await supabase.rpc('spend_credits_for_stats', {
        p_spender_id:       spenderId,
        p_target_player_id: targetPlayerId,
        p_team_id:          currentTeam.id,
        p_stats:            finalStats,
        p_total_cost:       totalCost,
        p_new_balance:      newBalance,
      });

      if (rpcError) throw rpcError;

      // Log elke gewijzigde stat als activiteit
      if (prevStats) {
        for (const [stat, newVal] of Object.entries(finalStats)) {
          const oldVal = prevStats[stat];
          if (oldVal !== undefined && oldVal !== newVal) {
            logActivity({
              teamId: currentTeam.id,
              type: 'stat_changed',
              actorId: spenderId,
              subjectId: targetPlayerId,
              payload: {
                stat,
                from: oldVal,
                to: newVal,
                actor_name: actorName ?? 'Onbekend',
                subject_name: subjectName ?? 'Onbekend',
              },
            });
          }
        }
      }

      setBalance(newBalance);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: msg };
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

      const newBalance = balance - 1;

      // SECURITY DEFINER RPC: valideert spender-koppeling, stat-whitelist en trekt credit atomisch af.
      const { error: rpcError } = await supabase.rpc('spend_credit_single', {
        p_spender_id:       spenderId,
        p_target_player_id: targetPlayerId,
        p_team_id:          currentTeam.id,
        p_stat:             stat,
        p_new_stat_value:   next,
        p_new_balance:      newBalance,
      });

      if (rpcError) throw rpcError;

      setBalance(newBalance);
      return true;
    } catch {
      return false;
    }
  }, [currentTeam, balance]);

  // Award 1 credit to each player who played in a match (aanwezigheidsbonus)
  const awardAttendanceCredits = useCallback(async (playerIds: number[], matchId: number) => {
    if (!currentTeam || playerIds.length === 0) return;

    try {
      // Haal huidige balansen op
      const { data: balances } = await supabase
        .from('stat_credits')
        .select('player_id, balance')
        .in('player_id', playerIds)
        .eq('team_id', currentTeam.id);

      const balanceMap = new Map<number, number>(
        (balances ?? []).map((r: { player_id: number; balance: number }) => [r.player_id, r.balance])
      );

      // Initialiseer spelers zonder credit-rij
      const missingIds = playerIds.filter(id => !balanceMap.has(id));
      if (missingIds.length > 0) {
        await supabase.from('stat_credits').insert(
          missingIds.map(id => ({ player_id: id, team_id: currentTeam.id, balance: INITIAL_BALANCE }))
        );
        await supabase.from('stat_credit_transactions').insert(
          missingIds.map(id => ({
            team_id: currentTeam.id,
            player_id: id,
            balance_change: INITIAL_BALANCE,
            reason: 'initial',
          }))
        );
        for (const id of missingIds) balanceMap.set(id, INITIAL_BALANCE);
      }

      // Ken 1 credit toe per speler
      await Promise.all(
        playerIds.map(playerId => {
          const currentBal = balanceMap.get(playerId) ?? INITIAL_BALANCE;
          return supabase.rpc('award_player_credits', {
            p_player_id:   playerId,
            p_team_id:     currentTeam.id,
            p_new_balance: currentBal + 1,
            p_change:      1,
            p_reason:      'attendance',
            p_match_id:    matchId,
          });
        })
      );
    } catch {
      // credits ongewijzigd laten bij fout
    }
  }, [currentTeam]);

  return { balance, fetchBalance, awardSpdwCredits, awardAttendanceCredits, spendCredit, spendCreditsForStats };
}
