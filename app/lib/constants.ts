export const GAME_FORMATS: Record<string, { players: number; periods: number; match_duration: number }> = {
  '4v4':   { players: 4,  periods: 3, match_duration: 45 },
  '5v5':   { players: 5,  periods: 2, match_duration: 40 },
  '6v6':   { players: 6,  periods: 2, match_duration: 50 },
  '7v7':   { players: 7,  periods: 2, match_duration: 60 },
  '8v8':   { players: 8,  periods: 2, match_duration: 60 },
  '9v9':   { players: 9,  periods: 2, match_duration: 60 },
  '11v11': { players: 11, periods: 2, match_duration: 90 },
};

export const DEFAULT_GAME_FORMAT = '11v11';

/**
 * Bereken de wisselmomenten (in minuten) voor N wisselmomenten in een wedstrijd van matchDuration minuten.
 * N momenten → verdeeld over N+1 gelijke stukken.
 * Voorbeeld: 3 momenten, 60 min → [15, 30, 45]
 */
export function computeSubMomentMinutes(n: number, matchDuration: number): number[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) =>
    Math.round(matchDuration * (i + 1) / (n + 1))
  );
}

/**
 * Geeft de uitslag terug in de juiste weergavevolgorde.
 * Thuiswedstrijd: eigen team links, tegenstander rechts.
 * Uitwedstrijd: tegenstander links (thuisploeg), eigen team rechts.
 */
export function displayScore(
  goalsFor: number | null | undefined,
  goalsAgainst: number | null | undefined,
  homeAway: string
): { left: number | null; right: number | null } {
  const gf = goalsFor ?? null;
  const ga = goalsAgainst ?? null;
  if (homeAway === 'Thuis') return { left: gf, right: ga };
  return { left: ga, right: gf };
}

export const DEFAULT_FORMATIONS: Record<string, string> = {
  '4v4':   '2-2',
  '5v5':   '2-2',
  '6v6':   '2-2-1',
  '7v7':   '2-3-1',
  '8v8':   '3-3-1',
  '9v9':   '3-3-2',
  '11v11': '4-3-3-aanvallend',
};

export const formations: Record<string, Record<string, Array<{ t: number; l: number }>>> = {
  '11v11': {
    '4-3-3-aanvallend': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 52, l: 30 }, { t: 52, l: 70 },
      { t: 35, l: 50 },
      { t: 20, l: 15 }, { t: 15, l: 50 }, { t: 20, l: 85 }
    ],
    '4-3-3-verdedigend': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 58, l: 50 },
      { t: 45, l: 30 }, { t: 45, l: 70 },
      { t: 20, l: 15 }, { t: 15, l: 50 }, { t: 20, l: 85 }
    ],
    '4-4-2-plat': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 48, l: 15 }, { t: 48, l: 38 }, { t: 48, l: 62 }, { t: 48, l: 85 },
      { t: 22, l: 35 }, { t: 22, l: 65 }
    ],
    '4-4-2-ruit': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 58, l: 50 },
      { t: 45, l: 25 }, { t: 45, l: 75 },
      { t: 32, l: 50 },
      { t: 18, l: 35 }, { t: 18, l: 65 }
    ],
    '3-4-3': [
      { t: 88, l: 50 },
      { t: 72, l: 25 }, { t: 75, l: 50 }, { t: 72, l: 75 },
      { t: 48, l: 10 }, { t: 48, l: 37 }, { t: 48, l: 63 }, { t: 48, l: 90 },
      { t: 22, l: 20 }, { t: 18, l: 50 }, { t: 22, l: 80 }
    ],
    '5-3-2': [
      { t: 93, l: 50 },
      { t: 72, l: 10 }, { t: 75, l: 30 }, { t: 78, l: 50 }, { t: 75, l: 70 }, { t: 72, l: 90 },
      { t: 50, l: 25 }, { t: 50, l: 50 }, { t: 50, l: 75 },
      { t: 22, l: 35 }, { t: 22, l: 65 }
    ],
  },
  '4v4': {
    '2-2': [
      { t: 72, l: 30 }, { t: 72, l: 70 },
      { t: 20, l: 30 }, { t: 20, l: 70 },
    ],
    '1-2-1': [
      { t: 80, l: 50 },
      { t: 50, l: 25 }, { t: 50, l: 75 },
      { t: 15, l: 50 },
    ],
  },
  '5v5': {
    '2-2': [
      { t: 88, l: 50 },
      { t: 68, l: 30 }, { t: 68, l: 70 },
      { t: 20, l: 30 }, { t: 20, l: 70 },
    ],
    '1-2-1': [
      { t: 88, l: 50 },
      { t: 68, l: 50 },
      { t: 40, l: 25 }, { t: 40, l: 75 },
      { t: 15, l: 50 },
    ],
  },
  '6v6': {
    '2-2-1': [
      { t: 88, l: 50 },
      { t: 72, l: 30 }, { t: 72, l: 70 },
      { t: 45, l: 25 }, { t: 45, l: 75 },
      { t: 15, l: 50 },
    ],
    '1-3-1': [
      { t: 88, l: 50 },
      { t: 72, l: 50 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 15, l: 50 },
    ],
  },
  '7v7': {
    '2-3-1': [
      { t: 88, l: 50 },
      { t: 72, l: 30 }, { t: 72, l: 70 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 15, l: 50 },
    ],
    '3-2-1': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 72, l: 50 }, { t: 72, l: 85 },
      { t: 45, l: 30 }, { t: 45, l: 70 },
      { t: 15, l: 50 },
    ],
  },
  '8v8': {
    '3-3-1': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 72, l: 50 }, { t: 72, l: 85 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 15, l: 50 },
    ],
    '2-3-2': [
      { t: 88, l: 50 },
      { t: 72, l: 30 }, { t: 72, l: 70 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 18, l: 30 }, { t: 18, l: 70 },
    ],
    '3-2-2': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 72, l: 50 }, { t: 72, l: 85 },
      { t: 45, l: 30 }, { t: 45, l: 70 },
      { t: 18, l: 30 }, { t: 18, l: 70 },
    ],
  },
  '9v9': {
    '3-3-2': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 72, l: 50 }, { t: 72, l: 85 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 18, l: 30 }, { t: 18, l: 70 },
    ],
    '2-3-3': [
      { t: 88, l: 50 },
      { t: 72, l: 30 }, { t: 72, l: 70 },
      { t: 45, l: 15 }, { t: 45, l: 50 }, { t: 45, l: 85 },
      { t: 18, l: 15 }, { t: 15, l: 50 }, { t: 18, l: 85 },
    ],
  },
};

export const formationLabels: Record<string, Record<string, string>> = {
  '11v11': {
    '4-3-3-aanvallend': '4-3-3 Aanvallend',
    '4-3-3-verdedigend': '4-3-3 Verdedigend',
    '4-4-2-plat': '4-4-2 Plat',
    '4-4-2-ruit': '4-4-2 Ruit',
    '3-4-3': '3-4-3',
    '5-3-2': '5-3-2',
  },
  '4v4':  { '2-2': '2-2',   '1-2-1': '1-2-1' },
  '5v5':  { '2-2': '2-2',   '1-2-1': '1-2-1' },
  '6v6':  { '2-2-1': '2-2-1', '1-3-1': '1-3-1' },
  '7v7':  { '2-3-1': '2-3-1', '3-2-1': '3-2-1' },
  '8v8':  { '3-3-1': '3-3-1', '2-3-2': '2-3-2', '3-2-2': '3-2-2' },
  '9v9':  { '3-3-2': '3-3-2', '2-3-3': '2-3-3' },
};

export const positionOrder = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'] as const;

export const positionEmojis: Record<string, string> = {
  'Keeper': '🧤',
  'Verdediger': '🛡️',
  'Middenvelder': '⚙️',
  'Aanvaller': '⚡'
};

export const DEFAULT_FORMATION = '4-3-3-aanvallend';

/** Spelvormen zonder keeper (positie 0 is gewoon een veldspeler) */
export const FORMATS_WITHOUT_KEEPER = new Set(['4v4']);

/**
 * Geeft de positiecategorie (Keeper / Verdediger / Middenvelder / Aanvaller) voor een gegeven
 * positie-index op basis van spelvorm en formatie.
 */
export function getPositionCategory(gameFormat: string, formation: string, positionIndex: number): string {
  const hasKeeper = !FORMATS_WITHOUT_KEEPER.has(gameFormat);
  if (hasKeeper && positionIndex === 0) return 'Keeper';
  const offset = hasKeeper ? 1 : 0;
  const idx = positionIndex - offset;
  const numericParts = formation.split('-').filter(p => !isNaN(Number(p))).map(Number);
  const categories = ['Verdediger', 'Middenvelder', 'Aanvaller'];
  let cumulative = 0;
  for (let i = 0; i < numericParts.length; i++) {
    cumulative += numericParts[i];
    if (idx < cumulative) return categories[i] ?? 'Aanvaller';
  }
  return 'Aanvaller';
}

export const normalizeFormation = (form: string | null | undefined, gameFormat: string = DEFAULT_GAME_FORMAT): string => {
  const gameFormations = formations[gameFormat] ?? formations[DEFAULT_GAME_FORMAT];
  const defaultForm = DEFAULT_FORMATIONS[gameFormat] ?? DEFAULT_FORMATION;
  if (!form || !(form in gameFormations)) return defaultForm;
  return form;
};

/**
 * Bereken de effectieve opstelling voor een bepaalde periode.
 * Period 1 = startopstelling (baseLineup ongewijzigd).
 * Period N = baseLineup na het toepassen van alle reguliere wissels bij
 * wisselmomenten 1 t/m N-1.
 *
 * @param baseLineup  De startopstelling (11 posities, kan null bevatten)
 * @param substitutions  Alle wissels van de wedstrijd
 * @param allPlayers  Alle spelers (regulier + gasten) om player_in op te zoeken
 * @param period  1-geïndexeerde periode (1 = start, 2 = na wisselmoment 1, ...)
 */
export function computeLineupForPeriod(
  baseLineup: (import('./types').Player | null)[],
  substitutions: import('./types').Substitution[],
  allPlayers: import('./types').Player[],
  period: number
): (import('./types').Player | null)[] {
  if (period <= 1) return baseLineup;
  const lineup = [...baseLineup];
  for (let moment = 1; moment < period; moment++) {
    const subs = substitutions.filter(s => s.substitution_number === moment && !s.is_extra);
    for (const sub of subs) {
      const idx = lineup.findIndex(p => p !== null && p.id === sub.player_out_id);
      if (idx !== -1) {
        lineup[idx] = allPlayers.find(p => p.id === sub.player_in_id) ?? null;
      }
    }
  }
  return lineup;
}
