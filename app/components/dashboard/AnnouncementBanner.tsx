'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTeamContext } from '../../contexts/TeamContext';

interface Announcement {
  id: number;
  message: string;
  expires_at: string;
}

const PREVIEW_LENGTH = 120;

export default function AnnouncementBanner() {
  const { currentTeam, isManager } = useTeamContext();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    if (!currentTeam) return;
    const { data } = await supabase
      .from('announcements')
      .select('id, message, expires_at')
      .eq('team_id', currentTeam.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnnouncement(data ?? null);
  }, [currentTeam?.id]);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  const handleDelete = async () => {
    if (!announcement) return;
    await supabase.from('announcements').delete().eq('id', announcement.id);
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <div className="mb-4 flex items-start gap-3 bg-blue-900/40 border border-blue-700/60 rounded-xl p-3 sm:p-4">
      <span className="text-lg flex-shrink-0 mt-0.5">📣</span>
      <div className="flex-1">
        <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
          {expanded || announcement.message.length <= PREVIEW_LENGTH
            ? announcement.message
            : announcement.message.slice(0, PREVIEW_LENGTH).trimEnd() + '…'}
        </p>
        {announcement.message.length > PREVIEW_LENGTH && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-xs text-blue-400 hover:text-blue-200 transition-colors"
          >
            {expanded ? 'Minder tonen' : 'Lees verder'}
          </button>
        )}
      </div>
      {isManager && (
        <button
          onClick={handleDelete}
          className="flex-shrink-0 text-blue-400 hover:text-red-400 text-lg p-1 transition-colors"
          title="Mededeling verwijderen"
        >
          ✕
        </button>
      )}
    </div>
  );
}
