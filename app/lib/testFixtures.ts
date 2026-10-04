import type { Player, Match } from './types';

// Gedeelde fabrieksfuncties voor tests; alleen de relevante velden overschrijven per test.
export function makePlayer(overrides: Partial<Player> & { id: number; name?: string }): Player {
  return {
    name: overrides.name ?? `Speler ${overrides.id}`,
    position: 'Middenvelder',
    goals: 0,
    assists: 0,
    wash_count: 0,
    consumption_count: 0,
    transport_count: 0,
    yellow_cards: 0,
    red_cards: 0,
    min: 0,
    played_min: 0,
    injured: false,
    pac: 0,
    sho: 0,
    pas: 0,
    dri: 0,
    def: 0,
    ...overrides,
  };
}

export function makeMatch(overrides: Partial<Match> & { id: number }): Match {
  return {
    date: '2026-01-01',
    opponent: 'Tegenstander',
    home_away: 'Thuis',
    formation: '4-3-3-aanvallend',
    match_type: 'competitie',
    substitution_scheme_id: 1,
    match_status: 'concept',
    ...overrides,
  };
}
