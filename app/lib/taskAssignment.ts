import type { Match, Player, TeamSettings } from './types';
import { isSelectablePlayer } from './constants';

export interface TaskBadge { emoji: string; name: string; }

export interface EffectiveCounts {
  wash: Map<number, number>;
  consumption: Map<number, number>;
  transport: Map<number, number>;
}

function initCounts(players: Player[]): EffectiveCounts {
  const real = players.filter(p => !p.is_guest);
  return {
    wash: new Map(real.map(p => [p.id, p.wash_count])),
    consumption: new Map(real.map(p => [p.id, p.consumption_count])),
    transport: new Map(real.map(p => [p.id, p.transport_count])),
  };
}

export function availableForMatch(
  match: Match,
  players: Player[],
  absencesMap: Record<number, number[]>
): Player[] {
  const absentIds = new Set(absencesMap[match.id] ?? []);
  return players.filter(p => !p.is_guest && isSelectablePlayer(p) && !p.injured && !absentIds.has(p.id));
}

// Verwerk één wedstrijd: muteert de tellers en geeft de badges terug.
function stepMatch(
  match: Match,
  counts: EffectiveCounts,
  players: Player[],
  absencesMap: Record<number, number[]>,
  teamSettings: TeamSettings | null
): TaskBadge[] {
  const trackWasbeurt = teamSettings?.track_wasbeurt ?? true;
  const trackConsumpties = teamSettings?.track_consumpties ?? true;
  const trackVervoer = teamSettings?.track_vervoer ?? true;
  const vervoerCount = teamSettings?.vervoer_count ?? 3;

  const available = availableForMatch(match, players, absencesMap);
  const tasks: TaskBadge[] = [];

  if (trackWasbeurt) {
    const overrideId = match.wasbeurt_player_id ?? null;
    let player = overrideId ? (available.find(p => p.id === overrideId) ?? null) : null;
    if (!player) {
      player = [...available].sort((a, b) => ((counts.wash.get(a.id) ?? 0) - (counts.wash.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
    }
    if (player) {
      tasks.push({ emoji: '🧺', name: player.name });
      counts.wash.set(player.id, (counts.wash.get(player.id) ?? 0) + 1);
    }
  }

  if (trackConsumpties) {
    const overrideId = match.consumpties_player_id ?? null;
    let player = overrideId ? (available.find(p => p.id === overrideId) ?? null) : null;
    if (!player) {
      player = [...available].sort((a, b) => ((counts.consumption.get(a.id) ?? 0) - (counts.consumption.get(b.id) ?? 0)) || a.name.localeCompare(b.name))[0] ?? null;
    }
    if (player) {
      tasks.push({ emoji: '🥤', name: player.name });
      counts.consumption.set(player.id, (counts.consumption.get(player.id) ?? 0) + 1);
    }
  }

  if (trackVervoer && match.home_away !== 'Thuis') {
    const overrideIds = match.transport_player_ids ?? [];
    const eligibleList = [...available].sort((a, b) => ((counts.transport.get(a.id) ?? 0) - (counts.transport.get(b.id) ?? 0)) || a.name.localeCompare(b.name));
    // Auto-rotatie negeert handmatige keuzes zodat vervoer niet cascadeert.
    const autoUsedIds = new Set<number>();
    for (let i = 0; i < vervoerCount; i++) {
      const auto = eligibleList.find(p => !autoUsedIds.has(p.id)) ?? null;
      if (auto) { autoUsedIds.add(auto.id); counts.transport.set(auto.id, (counts.transport.get(auto.id) ?? 0) + 1); }
    }
    // Weergave: respecteer overrides voor deze specifieke wedstrijd.
    const usedIds = new Set<number>();
    const vervoerPlayers: Player[] = [];
    for (let i = 0; i < vervoerCount; i++) {
      const overrideId = overrideIds[i] ?? null;
      if (overrideId) {
        const op = available.find(p => p.id === overrideId && !usedIds.has(p.id)) ?? null;
        if (op) { vervoerPlayers.push(op); usedIds.add(op.id); continue; }
      }
      const auto = eligibleList.find(p => !usedIds.has(p.id)) ?? null;
      if (auto) { vervoerPlayers.push(auto); usedIds.add(auto.id); }
    }
    vervoerPlayers.forEach((p, i) => tasks.push({ emoji: i === 0 ? '🚗' : '🚙', name: p.name }));
  }

  return tasks;
}

// Sequentiële taakberekening voor aankomende wedstrijden (badges).
export function computeUpcomingTasks(
  matches: Match[],
  players: Player[],
  absencesMap: Record<number, number[]>,
  teamSettings: TeamSettings | null
): Record<number, TaskBadge[]> {
  const counts = initCounts(players);
  const result: Record<number, TaskBadge[]> = {};
  for (const match of matches) {
    result[match.id] = stepMatch(match, counts, players, absencesMap, teamSettings);
  }
  return result;
}

// Effectieve tellers vóór een wedstrijd, gesimuleerd over de voorafgaande aankomende wedstrijden.
export function computeEffectiveCountsBefore(
  precedingMatches: Match[],
  players: Player[],
  absencesMap: Record<number, number[]>,
  teamSettings: TeamSettings | null
): EffectiveCounts {
  const counts = initCounts(players);
  for (const match of precedingMatches) {
    stepMatch(match, counts, players, absencesMap, teamSettings);
  }
  return counts;
}
