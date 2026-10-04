import { describe, it, expect } from 'vitest';
import { dedupePlayersById, dedupePlayersByIdThenName } from './playerDedup';
import { makePlayer } from './testFixtures';

describe('dedupePlayersById', () => {
  it('verwijdert dubbele ids en behoudt de eerste', () => {
    const a = makePlayer({ id: 1, name: 'Anna' });
    const aDup = makePlayer({ id: 1, name: 'Anna (kopie)' });
    const b = makePlayer({ id: 2, name: 'Bram' });
    const result = dedupePlayersById([a, aDup, b]);
    expect(result.map(p => p.id)).toEqual([1, 2]);
    expect(result[0].name).toBe('Anna');
  });

  it('laat een gast en reguliere speler met hetzelfde id naast elkaar bestaan', () => {
    const regular = makePlayer({ id: 1, name: 'Anna', is_guest: false });
    const guest = makePlayer({ id: 1, name: 'Anna', is_guest: true });
    const result = dedupePlayersById([regular, guest]);
    expect(result).toHaveLength(2);
  });
});

describe('dedupePlayersByIdThenName', () => {
  it('verwijdert spelers met dezelfde naam binnen hetzelfde type', () => {
    const a = makePlayer({ id: 1, name: 'Anna' });
    const aSameName = makePlayer({ id: 2, name: 'anna ' });
    const result = dedupePlayersByIdThenName([a, aSameName]);
    expect(result.map(p => p.id)).toEqual([1]);
  });

  it('behoudt gelijknamige gast- en reguliere spelers', () => {
    const regular = makePlayer({ id: 1, name: 'Anna', is_guest: false });
    const guest = makePlayer({ id: 2, name: 'Anna', is_guest: true });
    const result = dedupePlayersByIdThenName([regular, guest]);
    expect(result).toHaveLength(2);
  });
});
