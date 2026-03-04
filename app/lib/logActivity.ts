import { supabase } from './supabase';

export type ActivityType =
  | 'stat_changed'
  | 'lineup_published'
  | 'match_created'
  | 'match_result'
  | 'voting_opened'
  | 'spdw_winner'
  | 'absence_changed';

interface LogActivityOptions {
  teamId: string;
  type: ActivityType;
  actorId?: number | null;
  subjectId?: number | null;
  matchId?: number | null;
  payload: Record<string, unknown>;
}

/**
 * Schrijft een activiteit naar de activity_log tabel.
 * Voor stat_changed: samenvoegt wijzigingen van dezelfde actor+subject+stat binnen 5 minuten.
 * Fire-and-forget: await niet verplicht op de kritieke pad.
 */
export async function logActivity(options: LogActivityOptions): Promise<void> {
  const { teamId, type, actorId, subjectId, matchId, payload } = options;

  try {
    if (type === 'stat_changed' && subjectId && payload.stat) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Zoek bestaand recent log voor zelfde actor + subject + stat
      let query = supabase
        .from('activity_log')
        .select('id, payload')
        .eq('team_id', teamId)
        .eq('type', 'stat_changed')
        .eq('subject_id', subjectId)
        .gte('created_at', fiveMinAgo);

      if (actorId) query = query.eq('actor_id', actorId);

      const { data: existing } = await query.limit(20);

      const match = (existing ?? []).find(
        (row) => (row.payload as Record<string, unknown>).stat === payload.stat
      );

      if (match) {
        // Update alleen de 'to' waarde — behoud originele 'from'
        await supabase
          .from('activity_log')
          .update({ payload: { ...match.payload, to: payload.to } })
          .eq('id', match.id);
        return;
      }
    }

    await supabase.from('activity_log').insert({
      team_id: teamId,
      type,
      actor_id: actorId ?? null,
      subject_id: subjectId ?? null,
      match_id: matchId ?? null,
      payload,
    });
  } catch (e) {
    // Logging is non-critical — stil mislukken
    console.warn('[logActivity] failed:', e);
  }
}
