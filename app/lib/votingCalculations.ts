import type { SpdwPodiumEntry } from './types';

export const VOTING_POINTS_BY_RANK = [5, 3, 2];

// Rangschik stemmen tot een podium (max 3 plekken) met gedeelde rang bij gelijke stemmen.
export function computePodium(
  voteCounts: Record<number, number>,
  playerMap: Map<number, string>,
  votersByPlayer?: Map<number, string[]>
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
    const credits = VOTING_POINTS_BY_RANK[rank - 1] ?? 0;
    podium.push({
      rank,
      player_id: sorted[i].player_id,
      player_name: playerMap.get(sorted[i].player_id) ?? `Speler ${sorted[i].player_id}`,
      vote_count: sorted[i].vote_count,
      credits,
      voters: votersByPlayer?.get(sorted[i].player_id) ?? [],
    });
  }
  return podium;
}
