import { describe, it, expect } from 'vitest';
import { generateAutoLineup, type AutoLineupConfig } from './autoLineup';
import { makePlayer } from './testFixtures';

const baseConfig: AutoLineupConfig = {
  basis: 'bench_minutes',
  rotateGoalkeeper: true,
  positionMode: 'off',
  gameFormat: '5v5',
  formation: '2-2',
  periods: 1,
  matchDuration: 40,
};

const fieldIds = (lineup: (ReturnType<typeof makePlayer> | null)[]) =>
  lineup.filter((p): p is NonNullable<typeof p> => p !== null).map(p => p.id);

describe('generateAutoLineup', () => {
  it('zet precies genoeg spelers op het veld en laat de bank leeg', () => {
    const players = Array.from({ length: 5 }, (_, i) => makePlayer({ id: i + 1 }));
    const [period] = generateAutoLineup(players, baseConfig);

    expect(fieldIds(period.lineup)).toHaveLength(5);
    expect(period.bench).toHaveLength(0);
    expect(period.subs).toHaveLength(0);
  });

  it('plaatst overtollige spelers op de bank', () => {
    const players = Array.from({ length: 7 }, (_, i) => makePlayer({ id: i + 1 }));
    const [period] = generateAutoLineup(players, baseConfig);

    expect(fieldIds(period.lineup)).toHaveLength(5);
    expect(period.bench).toHaveLength(2);
  });

  it('sluit geblesseerde spelers volledig uit', () => {
    const players = [
      ...Array.from({ length: 5 }, (_, i) => makePlayer({ id: i + 1 })),
      makePlayer({ id: 99, injured: true }),
    ];
    const [period] = generateAutoLineup(players, baseConfig);

    const everyone = [...fieldIds(period.lineup), ...period.bench.map(p => p.id)];
    expect(everyone).not.toContain(99);
  });

  it('laat elke bankspeler in periode 2 het veld op komen', () => {
    const players = Array.from({ length: 7 }, (_, i) => makePlayer({ id: i + 1 }));
    const result = generateAutoLineup(players, { ...baseConfig, periods: 2 });

    const benchP1 = result[0].bench.map(p => p.id).sort();
    const fieldP2 = fieldIds(result[1].lineup);

    expect(result[1].subs).toHaveLength(2);
    for (const id of benchP1) {
      expect(fieldP2).toContain(id);
    }
    expect(result[1].bench).toHaveLength(2);
  });

  it('geeft spelers met de meeste bankminuten voorrang om te starten', () => {
    const players = [
      ...Array.from({ length: 5 }, (_, i) => makePlayer({ id: i + 1, min: 0 })),
      makePlayer({ id: 6, min: 50 }),
    ];
    const [period] = generateAutoLineup(players, baseConfig);

    expect(fieldIds(period.lineup)).toContain(6);
    expect(period.bench.map(p => p.id)).not.toContain(6);
  });

  it('is deterministisch bij herhaalde runs', () => {
    const players = Array.from({ length: 7 }, (_, i) => makePlayer({ id: i + 1 }));
    const a = generateAutoLineup(players, { ...baseConfig, periods: 2 });
    const b = generateAutoLineup(players, { ...baseConfig, periods: 2 });
    expect(a.map(p => fieldIds(p.lineup))).toEqual(b.map(p => fieldIds(p.lineup)));
  });
});
