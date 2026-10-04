import { describe, it, expect } from 'vitest';
import {
  computeSubMomentMinutes,
  displayScore,
  isSelectablePlayer,
  getPositionCategory,
  normalizeFormation,
  computeLineupForPeriod,
} from './constants';
import type { Substitution } from './types';
import { makePlayer } from './testFixtures';

describe('computeSubMomentMinutes', () => {
  it('verdeelt N momenten over N+1 gelijke stukken', () => {
    expect(computeSubMomentMinutes(3, 60)).toEqual([15, 30, 45]);
    expect(computeSubMomentMinutes(1, 90)).toEqual([45]);
    expect(computeSubMomentMinutes(2, 90)).toEqual([30, 60]);
  });

  it('geeft een lege lijst bij 0 of minder momenten', () => {
    expect(computeSubMomentMinutes(0, 90)).toEqual([]);
    expect(computeSubMomentMinutes(-1, 90)).toEqual([]);
  });
});

describe('displayScore', () => {
  it('toont eigen team links bij een thuiswedstrijd', () => {
    expect(displayScore(3, 1, 'Thuis')).toEqual({ left: 3, right: 1 });
  });

  it('draait de volgorde om bij een uitwedstrijd', () => {
    expect(displayScore(3, 1, 'Uit')).toEqual({ left: 1, right: 3 });
  });

  it('gaat om met ontbrekende scores', () => {
    expect(displayScore(null, undefined, 'Thuis')).toEqual({ left: null, right: null });
  });
});

describe('isSelectablePlayer', () => {
  it('sluit guest- en former-spelers uit', () => {
    expect(isSelectablePlayer({ status: 'guest' })).toBe(false);
    expect(isSelectablePlayer({ status: 'former' })).toBe(false);
  });

  it('beschouwt active en onbekende status als selecteerbaar', () => {
    expect(isSelectablePlayer({ status: 'active' })).toBe(true);
    expect(isSelectablePlayer({})).toBe(true);
  });
});

describe('getPositionCategory', () => {
  it('kent de juiste categorie toe in 11v11 (4-3-3)', () => {
    const cats = Array.from({ length: 11 }, (_, i) =>
      getPositionCategory('11v11', '4-3-3-aanvallend', i)
    );
    expect(cats).toEqual([
      'Keeper',
      'Verdediger', 'Verdediger', 'Verdediger', 'Verdediger',
      'Middenvelder', 'Middenvelder', 'Middenvelder',
      'Aanvaller', 'Aanvaller', 'Aanvaller',
    ]);
  });

  it('heeft geen keeper in 4v4', () => {
    expect(getPositionCategory('4v4', '2-2', 0)).toBe('Verdediger');
    expect(getPositionCategory('4v4', '2-2', 2)).toBe('Middenvelder');
  });
});

describe('normalizeFormation', () => {
  it('valt terug op de standaard bij een onbekende formatie', () => {
    expect(normalizeFormation('bestaat-niet', '11v11')).toBe('4-3-3-aanvallend');
    expect(normalizeFormation(null, '11v11')).toBe('4-3-3-aanvallend');
  });

  it('laat een geldige formatie ongewijzigd', () => {
    expect(normalizeFormation('4-4-2-plat', '11v11')).toBe('4-4-2-plat');
  });
});

describe('computeLineupForPeriod', () => {
  const p1 = makePlayer({ id: 1 });
  const p2 = makePlayer({ id: 2 });
  const p3 = makePlayer({ id: 3 });
  const all = [p1, p2, p3];
  const baseLineup = [p1, p2];

  const sub = (overrides: Partial<Substitution>): Substitution => ({
    id: 1,
    match_id: 1,
    substitution_number: 1,
    minute: 45,
    player_out_id: 1,
    player_in_id: 3,
    player_out_is_guest: false,
    player_in_is_guest: false,
    custom_minute: null,
    is_extra: false,
    ...overrides,
  });

  it('geeft de startopstelling terug voor periode 1', () => {
    expect(computeLineupForPeriod(baseLineup, [sub({})], all, 1)).toEqual(baseLineup);
  });

  it('past wissels toe tot aan de gevraagde periode', () => {
    const result = computeLineupForPeriod(baseLineup, [sub({})], all, 2);
    expect(result.map(p => p?.id)).toEqual([3, 2]);
  });

  it('negeert extra wissels', () => {
    const result = computeLineupForPeriod(baseLineup, [sub({ is_extra: true })], all, 2);
    expect(result.map(p => p?.id)).toEqual([1, 2]);
  });

  it('zet een onbekende inkomende speler op null', () => {
    const result = computeLineupForPeriod(baseLineup, [sub({ player_in_id: 999 })], all, 2);
    expect(result.map(p => p?.id ?? null)).toEqual([null, 2]);
  });
});
