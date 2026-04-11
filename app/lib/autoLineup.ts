/**
 * Auto-opstelling generator.
 *
 * Bepaalt per periode een eerlijke opstelling en wissels op basis van:
 * - Gekozen fairness-basis (bench_minutes of played_minutes)
 * - Optionele keeperrotatie
 * - Voorkeurspositie weging (off / soft / strict)
 *
 * De generator is puur functioneel en produceert een deterministische output.
 */
import type { Player, Substitution } from '../lib/types';
import { getPositionCategory, FORMATS_WITHOUT_KEEPER } from '../lib/constants';

// ── Public types ──────────────────────────────────────────

export type AutoLineupBasis = 'bench_minutes' | 'played_minutes';
export type PositionMode = 'off' | 'soft' | 'strict';

export interface AutoLineupConfig {
  basis: AutoLineupBasis;
  rotateGoalkeeper: boolean;
  positionMode: PositionMode;
  gameFormat: string;       // e.g. '11v11'
  formation: string;        // e.g. '4-3-3-aanvallend'
  periods: number;          // total periods in the match
  matchDuration: number;    // in minutes
}

export interface PeriodLineup {
  period: number;            // 1-indexed
  lineup: (Player | null)[]; // field occupants (length = playerCount)
  bench: Player[];           // remaining players on the bench
  subs: SubstitutionPair[];  // substitutions entering this period (empty for period 1)
  warnings: string[];        // e.g. position fallback warnings
}

export interface SubstitutionPair {
  out: Player;
  in: Player;
}

// ── Helpers ───────────────────────────────────────────────

/** Fairness score: lower = higher priority to START on the field. */
function fairnessScore(player: Player, basis: AutoLineupBasis): number {
  if (basis === 'bench_minutes') {
    // More bench minutes → should play more → lower score (higher priority to be on field)
    return -(player.min ?? 0);
  }
  // played_minutes: more played minutes → should rest → higher score (lower priority)
  return player.played_min ?? 0;
}

/**
 * Position match score for placing a player in a specific formation slot.
 * Returns 0 (perfect match), 1 (mismatch but allowed), or Infinity (blocked in strict mode).
 */
function positionMatchScore(
  player: Player,
  slotCategory: string,
  positionMode: PositionMode
): number {
  if (positionMode === 'off') return 0;
  const pref = player.preferred_position ?? player.position;
  if (!pref) return 0; // no preference known → neutral
  if (pref === slotCategory) return 0; // perfect match
  if (positionMode === 'soft') return 1; // slight penalty
  // strict: only allow if no alternative exists (handled by caller as Infinity)
  return Infinity;
}

/**
 * Stable sort key for deterministic tie-breaking.
 * Uses player.id so reruns produce identical output.
 */
function tieBreaker(player: Player): number {
  return player.id;
}

// ── Core algorithm ────────────────────────────────────────

/**
 * Generate lineups for all periods.
 *
 * @param availablePlayers All players available for this match (present, not injured).
 *   Must include both regular and guest players.
 * @param config Algorithm configuration from the wizard.
 * @param existingSubstitutions Already-saved substitutions (used to compute cumulative minutes
 *   context; empty array for a fresh generation).
 * @returns Array of PeriodLineup for period 1 through config.periods.
 */
export function generateAutoLineup(
  availablePlayers: Player[],
  config: AutoLineupConfig,
  _existingSubstitutions: Substitution[] = []
): PeriodLineup[] {
  const { basis, rotateGoalkeeper, positionMode, gameFormat, formation, periods, matchDuration } = config;
  const hasKeeper = !FORMATS_WITHOUT_KEEPER.has(gameFormat);
  const playerCount = formationPlayerCount(gameFormat, formation);

  // Separate pool
  const pool = [...availablePlayers].filter(p => !p.injured);

  // Minutes per period (for fairness tracking during generation)
  const minutesPerPeriod = matchDuration / periods;

  // Running fairness state: cumulative field minutes and bench minutes during generation.
  // Starts from the player's existing stats and accumulates as we assign periods.
  const runningFieldMins = new Map<number, number>();
  const runningBenchMins = new Map<number, number>();
  for (const p of pool) {
    // guest key uses negative id to avoid collision
    const key = playerKey(p);
    runningFieldMins.set(key, p.played_min ?? 0);
    runningBenchMins.set(key, p.min ?? 0);
  }

  const results: PeriodLineup[] = [];

  let prevLineup: (Player | null)[] | null = null;

  for (let period = 1; period <= periods; period++) {
    const warnings: string[] = [];

    // Build slot categories for this formation
    const slotCategories: string[] = [];
    for (let i = 0; i < playerCount; i++) {
      slotCategories.push(getPositionCategory(gameFormat, formation, i));
    }

    // Score each player for each slot → assign greedily
    const lineup: (Player | null)[] = Array(playerCount).fill(null);
    const assigned = new Set<number>();

    // Step 1: Assign keeper slot if applicable
    if (hasKeeper) {
      const keeperSlot = 0;
      const keeperCandidates = pool
        .filter(p => {
          if (assigned.has(playerKey(p))) return false;
          if (!rotateGoalkeeper) {
            // Only players whose preferred position is Keeper (or current position)
            const pref = p.preferred_position ?? p.position;
            return pref === 'Keeper';
          }
          // Rotate: anyone who can_play_goalkeeper or whose preference is Keeper
          const pref = p.preferred_position ?? p.position;
          return pref === 'Keeper' || p.can_play_goalkeeper;
        })
        .sort((a, b) => {
          const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
          const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
          return fa - fb || tieBreaker(a) - tieBreaker(b);
        });

      if (keeperCandidates.length > 0) {
        // For period > 1 with rotateGoalkeeper: pick the one with most "need" to play
        lineup[keeperSlot] = keeperCandidates[0];
        assigned.add(playerKey(keeperCandidates[0]));
      } else {
        // Fallback: pick any player with lowest fairness score
        const fallback = pool
          .filter(p => !assigned.has(playerKey(p)))
          .sort((a, b) => {
            const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
            const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
            return fa - fb || tieBreaker(a) - tieBreaker(b);
          })[0] ?? null;
        if (fallback) {
          lineup[keeperSlot] = fallback;
          assigned.add(playerKey(fallback));
          warnings.push(`Geen keeper beschikbaar — ${fallback.name} ingedeeld als keeper`);
        }
      }
    }

    // Step 2: Assign remaining field slots
    const openSlots = Array.from({ length: playerCount }, (_, i) => i).filter(i => lineup[i] === null);
    const unassigned = pool.filter(p => !assigned.has(playerKey(p)));

    // Build scored candidates per slot
    const slotAssignments = assignPlayersToSlots(
      openSlots,
      unassigned,
      slotCategories,
      positionMode,
      basis,
      runningFieldMins,
      runningBenchMins,
      warnings
    );

    for (const { slotIndex, player } of slotAssignments) {
      lineup[slotIndex] = player;
      assigned.add(playerKey(player));
    }

    // Build bench
    const bench = pool.filter(p => !assigned.has(playerKey(p)));

    // Build substitution pairs (comparing with previous period)
    const subs: SubstitutionPair[] = [];
    if (prevLineup) {
      const prevKeys = new Set(prevLineup.filter(Boolean).map(p => playerKey(p!)));
      const currKeys = new Set(lineup.filter(Boolean).map(p => playerKey(p!)));

      // Players who were on field last period but are now off
      const goingOut = prevLineup.filter(p => p && !currKeys.has(playerKey(p))) as Player[];
      // Players who are now on field but weren't last period
      const comingIn = lineup.filter(p => p && !prevKeys.has(playerKey(p))) as Player[];

      // Pair them by index (deterministic)
      for (let i = 0; i < Math.min(goingOut.length, comingIn.length); i++) {
        subs.push({ out: goingOut[i], in: comingIn[i] });
      }
    }

    // Update running minutes
    for (const p of pool) {
      const key = playerKey(p);
      if (assigned.has(key)) {
        runningFieldMins.set(key, (runningFieldMins.get(key) ?? 0) + minutesPerPeriod);
      } else {
        runningBenchMins.set(key, (runningBenchMins.get(key) ?? 0) + minutesPerPeriod);
      }
    }

    results.push({ period, lineup, bench, subs, warnings });
    prevLineup = lineup;
  }

  return results;
}

// ── Internal helpers ──────────────────────────────────────

function playerKey(p: Player): number {
  return p.is_guest ? -(p.id + 1) : p.id;
}

/** Adjusted fairness score incorporating running totals. */
function adjustedFairness(
  player: Player,
  basis: AutoLineupBasis,
  runningFieldMins: Map<number, number>,
  runningBenchMins: Map<number, number>
): number {
  const key = playerKey(player);
  if (basis === 'bench_minutes') {
    // More bench minutes → should be on field → lower score
    return -(runningBenchMins.get(key) ?? 0);
  }
  // played_minutes: more played minutes → should rest → higher score
  return runningFieldMins.get(key) ?? 0;
}

function formationPlayerCount(gameFormat: string, _formation: string): number {
  const mapping: Record<string, number> = {
    '4v4': 4, '5v5': 5, '6v6': 6, '7v7': 7, '8v8': 8, '9v9': 9, '11v11': 11,
  };
  return mapping[gameFormat] ?? 11;
}

interface SlotAssignment {
  slotIndex: number;
  player: Player;
}

/**
 * Greedy assignment of players to formation slots, respecting position mode and fairness.
 */
function assignPlayersToSlots(
  openSlots: number[],
  candidates: Player[],
  slotCategories: string[],
  positionMode: PositionMode,
  basis: AutoLineupBasis,
  runningFieldMins: Map<number, number>,
  runningBenchMins: Map<number, number>,
  warnings: string[]
): SlotAssignment[] {
  const result: SlotAssignment[] = [];
  const used = new Set<number>();

  // Sort candidates by fairness (best priority first)
  const sorted = [...candidates].sort((a, b) => {
    const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
    const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
    return fa - fb || tieBreaker(a) - tieBreaker(b);
  });

  if (positionMode === 'strict') {
    // Strict: first pass — only place players in matching slots
    for (const slotIdx of openSlots) {
      const cat = slotCategories[slotIdx];
      const match = sorted.find(p => {
        if (used.has(playerKey(p))) return false;
        const pref = p.preferred_position ?? p.position;
        return pref === cat;
      });
      if (match) {
        result.push({ slotIndex: slotIdx, player: match });
        used.add(playerKey(match));
      }
    }
    // Second pass — fill remaining with anyone (fallback)
    const unfilledSlots = openSlots.filter(i => !result.some(r => r.slotIndex === i));
    for (const slotIdx of unfilledSlots) {
      const fallback = sorted.find(p => !used.has(playerKey(p)));
      if (fallback) {
        const cat = slotCategories[slotIdx];
        const pref = fallback.preferred_position ?? fallback.position;
        if (pref !== cat) {
          warnings.push(`${fallback.name} speelt als ${cat} (voorkeur: ${pref || 'geen'})`);
        }
        result.push({ slotIndex: slotIdx, player: fallback });
        used.add(playerKey(fallback));
      }
    }
  } else {
    // off or soft: greedy assignment with optional position boost
    // Score each (candidate, slot) pair and assign via Hungarian-lite approach
    // For simplicity we use greedy: for each slot (in order), pick best available candidate
    for (const slotIdx of openSlots) {
      const cat = slotCategories[slotIdx];
      let best: Player | null = null;
      let bestScore = Infinity;

      for (const p of sorted) {
        if (used.has(playerKey(p))) continue;
        const fairness = adjustedFairness(p, basis, runningFieldMins, runningBenchMins);
        const posPenalty = positionMatchScore(p, cat, positionMode);
        // Combine: position penalty (0 or 1) scaled by a weight, plus fairness
        const combined = posPenalty * 1000 + fairness;
        if (combined < bestScore || (combined === bestScore && tieBreaker(p) < tieBreaker(best!))) {
          bestScore = combined;
          best = p;
        }
      }

      if (best) {
        if (positionMode === 'soft') {
          const pref = best.preferred_position ?? best.position;
          if (pref && pref !== cat) {
            warnings.push(`${best.name} speelt als ${cat} (voorkeur: ${pref})`);
          }
        }
        result.push({ slotIndex: slotIdx, player: best });
        used.add(playerKey(best));
      }
    }
  }

  return result;
}
