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
 * Strategy:
 * - Period 1: pick the fairest starting lineup based on historical stats.
 * - Period 2+: ALL bench players MUST rotate onto the field, replacing field
 *   players who have played the most (highest "should rest" priority). This
 *   guarantees every available player gets field time across periods.
 *
 * @param availablePlayers All players available for this match (present, not injured).
 * @param config Algorithm configuration from the wizard.
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
  const pool = [...availablePlayers].filter(p => !p.injured);
  const minutesPerPeriod = matchDuration / periods;

  // Running fairness state
  const runningFieldMins = new Map<number, number>();
  const runningBenchMins = new Map<number, number>();
  for (const p of pool) {
    const key = playerKey(p);
    runningFieldMins.set(key, p.played_min ?? 0);
    runningBenchMins.set(key, p.min ?? 0);
  }

  const results: PeriodLineup[] = [];
  let currentLineup: (Player | null)[] | null = null;

  for (let period = 1; period <= periods; period++) {
    const warnings: string[] = [];
    const slotCategories: string[] = [];
    for (let i = 0; i < playerCount; i++) {
      slotCategories.push(getPositionCategory(gameFormat, formation, i));
    }

    let lineup: (Player | null)[];
    let subs: SubstitutionPair[] = [];

    if (period === 1 || !currentLineup) {
      // ── Period 1: build fresh starting lineup ──
      lineup = buildFreshLineup(
        pool, playerCount, hasKeeper, rotateGoalkeeper,
        slotCategories, positionMode, basis,
        runningFieldMins, runningBenchMins, warnings
      );
    } else {
      // ── Period 2+: force ALL bench players onto the field ──
      lineup = [...currentLineup];
      const onFieldKeys = new Set(lineup.filter(Boolean).map(p => playerKey(p!)));
      const benchPlayers = pool.filter(p => !onFieldKeys.has(playerKey(p)));

      // Sort bench by "most deserving of field time" (lowest fairness score first)
      const benchSorted = [...benchPlayers].sort((a, b) => {
        const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
        const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
        return fa - fb || tieBreaker(a) - tieBreaker(b);
      });

      // Field players eligible to be swapped out, sorted by "most deserving of rest"
      // (highest fairness = played most / least bench)
      const fieldPlayersWithSlot = lineup
        .map((p, i) => ({ player: p, slotIndex: i }))
        .filter((item): item is { player: Player; slotIndex: number } => item.player !== null);

      // Exclude keeper from swap-out candidates if keeper rotation is off
      const swapOutCandidates = fieldPlayersWithSlot
        .filter(item => {
          if (!rotateGoalkeeper && hasKeeper && item.slotIndex === 0) return false;
          return true;
        })
        .sort((a, b) => {
          // Reverse: highest fairness first = should rest most
          const fa = adjustedFairness(a.player, basis, runningFieldMins, runningBenchMins);
          const fb = adjustedFairness(b.player, basis, runningFieldMins, runningBenchMins);
          return fb - fa || tieBreaker(a.player) - tieBreaker(b.player);
        });

      // Swap ALL bench players in (up to available swap-out candidates)
      const subsCount = Math.min(benchSorted.length, swapOutCandidates.length);
      for (let s = 0; s < subsCount; s++) {
        const benchPlayer = benchSorted[s];
        const swapOut = swapOutCandidates[s];

        subs.push({ out: swapOut.player, in: benchPlayer });
        lineup[swapOut.slotIndex] = benchPlayer;
      }

      // If keeper rotation is on and bench contains a keeper candidate, handle keeper swap
      if (rotateGoalkeeper && hasKeeper) {
        const keeperOnField = lineup[0];
        const keeperNeedsSwap = keeperOnField && subs.some(s => playerKey(s.in) === playerKey(keeperOnField));
        // Keeper was already swapped out through normal rotation — no extra action needed
        if (!keeperNeedsSwap) {
          // Check if a bench keeper should come in
          const benchKeeper = benchSorted.find(p => {
            const pref = p.preferred_position ?? p.position;
            return (pref === 'Keeper' || p.can_play_goalkeeper) && !subs.some(sub => playerKey(sub.in) === playerKey(p));
          });
          if (benchKeeper && keeperOnField) {
            // Already handled above since we swap ALL bench players
          }
        }
      }

      // Position optimization: try to swap players to better-matching slots (soft/strict)
      if (positionMode !== 'off') {
        optimizePositions(lineup, slotCategories, positionMode, hasKeeper, warnings);
      }
    }

    // Build bench for this period
    const assignedKeys = new Set(lineup.filter(Boolean).map(p => playerKey(p!)));
    const bench = pool.filter(p => !assignedKeys.has(playerKey(p)));

    // Update running minutes
    for (const p of pool) {
      const key = playerKey(p);
      if (assignedKeys.has(key)) {
        runningFieldMins.set(key, (runningFieldMins.get(key) ?? 0) + minutesPerPeriod);
      } else {
        runningBenchMins.set(key, (runningBenchMins.get(key) ?? 0) + minutesPerPeriod);
      }
    }

    results.push({ period, lineup, bench, subs, warnings });
    currentLineup = lineup;
  }

  return results;
}

// ── Build fresh lineup (period 1) ─────────────────────────

function buildFreshLineup(
  pool: Player[],
  playerCount: number,
  hasKeeper: boolean,
  rotateGoalkeeper: boolean,
  slotCategories: string[],
  positionMode: PositionMode,
  basis: AutoLineupBasis,
  runningFieldMins: Map<number, number>,
  runningBenchMins: Map<number, number>,
  warnings: string[]
): (Player | null)[] {
  const lineup: (Player | null)[] = Array(playerCount).fill(null);
  const assigned = new Set<number>();

  // Assign keeper
  if (hasKeeper) {
    const keeperCandidates = pool
      .filter(p => {
        if (assigned.has(playerKey(p))) return false;
        if (!rotateGoalkeeper) {
          const pref = p.preferred_position ?? p.position;
          return pref === 'Keeper';
        }
        const pref = p.preferred_position ?? p.position;
        return pref === 'Keeper' || p.can_play_goalkeeper;
      })
      .sort((a, b) => {
        const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
        const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
        return fa - fb || tieBreaker(a) - tieBreaker(b);
      });

    if (keeperCandidates.length > 0) {
      lineup[0] = keeperCandidates[0];
      assigned.add(playerKey(keeperCandidates[0]));
    } else {
      const fallback = pool
        .filter(p => !assigned.has(playerKey(p)))
        .sort((a, b) => {
          const fa = adjustedFairness(a, basis, runningFieldMins, runningBenchMins);
          const fb = adjustedFairness(b, basis, runningFieldMins, runningBenchMins);
          return fa - fb || tieBreaker(a) - tieBreaker(b);
        })[0] ?? null;
      if (fallback) {
        lineup[0] = fallback;
        assigned.add(playerKey(fallback));
        warnings.push(`Geen keeper beschikbaar — ${fallback.name} ingedeeld als keeper`);
      }
    }
  }

  // Assign remaining field slots
  const openSlots = Array.from({ length: playerCount }, (_, i) => i).filter(i => lineup[i] === null);
  const unassigned = pool.filter(p => !assigned.has(playerKey(p)));
  const slotAssignments = assignPlayersToSlots(
    openSlots, unassigned, slotCategories, positionMode, basis,
    runningFieldMins, runningBenchMins, warnings
  );
  for (const { slotIndex, player } of slotAssignments) {
    lineup[slotIndex] = player;
    assigned.add(playerKey(player));
  }

  return lineup;
}

/**
 * After substitutions, try to optimize player→slot mapping for better position fit.
 * Only swaps players within the current lineup (no bench changes).
 */
function optimizePositions(
  lineup: (Player | null)[],
  slotCategories: string[],
  positionMode: PositionMode,
  hasKeeper: boolean,
  warnings: string[]
): void {
  // Simple pairwise swap optimization
  const startIdx = hasKeeper ? 1 : 0; // don't move keeper
  for (let i = startIdx; i < lineup.length; i++) {
    for (let j = i + 1; j < lineup.length; j++) {
      const pi = lineup[i];
      const pj = lineup[j];
      if (!pi || !pj) continue;

      const currentCost =
        positionMatchScore(pi, slotCategories[i], positionMode) +
        positionMatchScore(pj, slotCategories[j], positionMode);
      const swapCost =
        positionMatchScore(pi, slotCategories[j], positionMode) +
        positionMatchScore(pj, slotCategories[i], positionMode);

      if (swapCost < currentCost) {
        lineup[i] = pj;
        lineup[j] = pi;
      }
    }
  }

  // Generate warnings for mismatches
  for (let i = startIdx; i < lineup.length; i++) {
    const p = lineup[i];
    if (!p) continue;
    const pref = p.preferred_position ?? p.position;
    if (pref && pref !== slotCategories[i] && positionMode === 'strict') {
      warnings.push(`${p.name} speelt als ${slotCategories[i]} (voorkeur: ${pref})`);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────

export function playerKey(p: Player): number {
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
