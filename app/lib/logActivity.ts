import { supabase } from './supabase';

export type ActivityType =
  | 'stat_changed'
  | 'lineup_published'
  | 'lineup_unpublished'
  | 'match_created'
  | 'match_result'
  | 'voting_opened'
  | 'spdw_winner'
  | 'absence_changed'
  | 'announcement_posted';

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
 * Voor absence_changed: samenvoegt binnen 60 seconden voor zelfde actor+match.
 * Voor lineup_published/unpublished: samenvoegt binnen 5 minuten voor zelfde match.
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
        (row: { id: number; payload: Record<string, unknown> }) =>
          (row.payload as Record<string, unknown>).stat === payload.stat
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

    if (type === 'absence_changed' && actorId && matchId) {
      // Altijd maximaal één entry per speler per wedstrijd — geen tijdslimiet.
      // Bij update ook gelezen-status resetten zodat het bericht opnieuw verschijnt.
      const { data: existing } = await supabase
        .from('activity_log')
        .select('id')
        .eq('team_id', teamId)
        .eq('type', 'absence_changed')
        .eq('actor_id', actorId)
        .eq('match_id', matchId)
        .limit(1);
      if (existing?.[0]) {
        await Promise.all([
          supabase.from('activity_log').update({ payload }).eq('id', existing[0].id),
          supabase.from('activity_log_reads').delete().eq('activity_id', existing[0].id),
        ]);
        return;
      }
    }

    if ((type === 'lineup_published' || type === 'lineup_unpublished') && matchId) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('activity_log')
        .select('id')
        .eq('team_id', teamId)
        .in('type', ['lineup_published', 'lineup_unpublished'])
        .eq('match_id', matchId)
        .gte('created_at', fiveMinAgo)
        .limit(1);
      if (recent?.[0]) {
        await supabase
          .from('activity_log')
          .update({ type, payload })
          .eq('id', recent[0].id);
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
