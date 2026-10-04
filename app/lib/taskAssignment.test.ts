import { describe, it, expect } from 'vitest';
import {
  upcomingConceptMatches,
  availableForMatch,
  computeUpcomingTasks,
  type TaskSettings,
} from './taskAssignment';
import { makePlayer, makeMatch } from './testFixtures';

describe('upcomingConceptMatches', () => {
  it('houdt alleen aankomende concept-wedstrijden en sorteert op datum', () => {
    const past = makeMatch({ id: 1, date: '2000-01-01' });
    const finished = makeMatch({ id: 2, date: '2099-01-01', match_status: 'afgerond' });
    const laterConcept = makeMatch({ id: 3, date: '2099-06-01' });
    const soonerConcept = makeMatch({ id: 4, date: '2099-02-01' });

    const result = upcomingConceptMatches([past, finished, laterConcept, soonerConcept]);
    expect(result.map(m => m.id)).toEqual([4, 3]);
  });
});

describe('availableForMatch', () => {
  it('sluit gasten, geblesseerden, afwezigen en former-spelers uit', () => {
    const match = makeMatch({ id: 1 });
    const players = [
      makePlayer({ id: 1, name: 'Anna' }),
      makePlayer({ id: 2, name: 'Bram', injured: true }),
      makePlayer({ id: 3, name: 'Cas', is_guest: true }),
      makePlayer({ id: 4, name: 'Daan', status: 'former' }),
      makePlayer({ id: 5, name: 'Eva' }),
    ];
    const absences = { 1: [5] };
    const result = availableForMatch(match, players, absences);
    expect(result.map(p => p.id)).toEqual([1]);
  });
});

describe('computeUpcomingTasks', () => {
  const settings = (over: Partial<TaskSettings>): TaskSettings => ({
    track_wasbeurt: false,
    track_consumpties: false,
    track_vervoer: false,
    vervoer_count: 3,
    ...over,
  });

  it('rouleert de wasbeurt eerlijk over opeenvolgende wedstrijden', () => {
    const players = [
      makePlayer({ id: 1, name: 'Anna' }),
      makePlayer({ id: 2, name: 'Bram' }),
    ];
    const matches = [makeMatch({ id: 1 }), makeMatch({ id: 2 })];
    const result = computeUpcomingTasks(matches, players, {}, settings({ track_wasbeurt: true }));

    expect(result[1].map(t => t.name)).toEqual(['Anna']);
    expect(result[2].map(t => t.name)).toEqual(['Bram']);
  });

  it('respecteert een handmatige wasbeurt-override', () => {
    const players = [
      makePlayer({ id: 1, name: 'Anna' }),
      makePlayer({ id: 2, name: 'Bram' }),
    ];
    const match = makeMatch({ id: 1, wasbeurt_player_id: 2 });
    const result = computeUpcomingTasks([match], players, {}, settings({ track_wasbeurt: true }));
    expect(result[1][0].name).toBe('Bram');
  });

  it('wijst alleen vervoer toe bij uitwedstrijden', () => {
    const players = [
      makePlayer({ id: 1, name: 'Anna' }),
      makePlayer({ id: 2, name: 'Bram' }),
      makePlayer({ id: 3, name: 'Cas' }),
    ];
    const thuis = makeMatch({ id: 1, home_away: 'Thuis' });
    const uit = makeMatch({ id: 2, home_away: 'Uit' });
    const config = settings({ track_vervoer: true, vervoer_count: 2 });

    const result = computeUpcomingTasks([thuis, uit], players, {}, config);
    expect(result[1]).toEqual([]);
    expect(result[2]).toHaveLength(2);
    expect(result[2][0].emoji).toBe('🚗');
    expect(result[2][1].emoji).toBe('🚙');
  });

  it('geeft geen taken wanneer alle trackers uitstaan', () => {
    const players = [makePlayer({ id: 1 })];
    const result = computeUpcomingTasks([makeMatch({ id: 1 })], players, {}, settings({}));
    expect(result[1]).toEqual([]);
  });
});
