import { describe, it, expect } from 'vitest';
import { computePodium } from './votingCalculations';

describe('computePodium', () => {
  const names = new Map<number, string>([
    [1, 'Anna'],
    [2, 'Bram'],
    [3, 'Cas'],
    [4, 'Daan'],
  ]);

  it('kent 5/3/2 credits toe aan plek 1, 2 en 3', () => {
    const podium = computePodium({ 1: 6, 2: 4, 3: 2 }, names);
    expect(podium.map(p => [p.rank, p.player_id, p.credits])).toEqual([
      [1, 1, 5],
      [2, 2, 3],
      [3, 3, 2],
    ]);
  });

  it('negeert spelers zonder stemmen', () => {
    const podium = computePodium({ 1: 3, 2: 0, 3: 1 }, names);
    expect(podium.map(p => p.player_id)).toEqual([1, 3]);
  });

  it('geeft gelijke stemmen dezelfde rang en credits', () => {
    const podium = computePodium({ 1: 5, 2: 5, 3: 3 }, names);
    expect(podium[0]).toMatchObject({ rank: 1, player_id: 1, credits: 5 });
    expect(podium[1]).toMatchObject({ rank: 1, player_id: 2, credits: 5 });
    // Rang 2 wordt overgeslagen; de volgende speler valt op rang 3.
    expect(podium[2]).toMatchObject({ rank: 3, player_id: 3, credits: 2 });
  });

  it('stopt bij rang > 3 (gedeelde plekken duwen anderen eruit)', () => {
    const podium = computePodium({ 1: 5, 2: 3, 3: 3, 4: 1 }, names);
    expect(podium.map(p => p.player_id)).toEqual([1, 2, 3]);
    // Speler 4 valt buiten het podium omdat 2 en 3 samen rang 2 delen.
    expect(podium.find(p => p.player_id === 4)).toBeUndefined();
  });

  it('gebruikt een fallback-naam als de speler onbekend is', () => {
    const podium = computePodium({ 99: 2 }, new Map());
    expect(podium[0].player_name).toBe('Speler 99');
  });

  it('koppelt stemmers aan de juiste speler', () => {
    const voters = new Map<number, string[]>([[1, ['Bram', 'Cas']]]);
    const podium = computePodium({ 1: 2 }, names, voters);
    expect(podium[0].voters).toEqual(['Bram', 'Cas']);
  });

  it('geeft een leeg podium bij geen stemmen', () => {
    expect(computePodium({}, names)).toEqual([]);
  });
});
