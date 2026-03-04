import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';

export interface ActivityLogItem {
  id: number;
  type: string;
  actor_id: number | null;
  subject_id: number | null;
  match_id: number | null;
  payload: Record<string, unknown>;
  created_at: string;
  is_read: boolean;
}

export function useActivityLog() {
  const { currentTeam } = useTeamContext();
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!currentTeam) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('activity_log')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!logs) return;

      const ids = logs.map((l: { id: number }) => l.id);

      const { data: reads } = ids.length
        ? await supabase
            .from('activity_log_reads')
            .select('activity_id')
            .eq('user_id', user.id)
            .in('activity_id', ids)
        : { data: [] };

      const readSet = new Set((reads ?? []).map((r: { activity_id: number }) => r.activity_id));

      const items: ActivityLogItem[] = logs.map((l: Omit<ActivityLogItem, 'is_read'>) => ({
        ...l,
        is_read: readSet.has(l.id),
      }));

      setActivities(items);
      setUnreadCount(items.filter((i) => !i.is_read).length);
    } catch (e) {
      console.error('[useActivityLog] fetchActivities:', e);
    } finally {
      setLoading(false);
    }
  }, [currentTeam]);

  const markAsRead = useCallback(async (activityId: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('activity_log_reads').upsert(
      { user_id: user.id, activity_id: activityId },
      { onConflict: 'user_id,activity_id', ignoreDuplicates: true }
    );

    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, is_read: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const unread = activities.filter((a) => !a.is_read);
    if (unread.length === 0) return;

    await supabase.from('activity_log_reads').upsert(
      unread.map((a) => ({ user_id: user.id, activity_id: a.id })),
      { onConflict: 'user_id,activity_id', ignoreDuplicates: true }
    );

    setActivities((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnreadCount(0);
  }, [activities]);

  return { activities, unreadCount, loading, fetchActivities, markAsRead, markAllAsRead };
}
