'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import { useToast } from '../contexts/ToastContext';

const MAX_CHARS = 300;
const EXPIRY_DAYS = 7;

interface Announcement {
  id: number;
  message: string;
  created_at: string;
  expires_at: string;
}

export default function MededelingenView() {
  const { currentTeam } = useTeamContext();
  const toast = useToast();
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchCurrent = useCallback(async () => {
    if (!currentTeam) return;
    const { data } = await supabase
      .from('announcements')
      .select('id, message, created_at, expires_at')
      .eq('team_id', currentTeam.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrent(data ?? null);
  }, [currentTeam?.id]);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const handlePost = async () => {
    if (!currentTeam || !message.trim()) return;
    setLoading(true);
    try {
      // Remove old announcements for this team first
      await supabase.from('announcements').delete().eq('team_id', currentTeam.id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('announcements').insert({
        team_id: currentTeam.id,
        message: message.trim(),
        expires_at: expiresAt.toISOString(),
        created_by: user?.id,
      });

      if (error) throw error;
      setMessage('');
      await fetchCurrent();
    } catch (err) {
      console.error('Fout bij plaatsen mededeling:', err);
      toast.error('Er ging iets mis, probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    setLoading(true);
    await supabase.from('announcements').delete().eq('id', current.id);
    setCurrent(null);
    setLoading(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-6">📣 Mededelingen</h2>

        {/* Actieve mededeling */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Huidige mededeling</h3>
          {current ? (
            <div>
              <div className="bg-blue-900/40 border border-blue-700/60 rounded-lg p-3 mb-3">
                <p className="text-sm sm:text-base text-blue-100 leading-relaxed">{current.message}</p>
                <p className="text-xs text-blue-400/70 mt-2">
                  Geplaatst op {new Date(current.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}vervalt {new Date(current.expires_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded-lg font-bold text-sm transition touch-manipulation"
              >
                🗑️ Verwijder mededeling
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Geen actieve mededeling.</p>
          )}
        </div>

        {/* Nieuwe mededeling */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
            {current ? 'Vervang mededeling' : 'Nieuwe mededeling'}
          </h3>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Typ een bericht voor het team..."
            rows={4}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${message.length >= MAX_CHARS ? 'text-red-400' : 'text-gray-500'}`}>
              {message.length}/{MAX_CHARS} tekens
            </span>
            <button
              onClick={handlePost}
              disabled={loading || !message.trim()}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition touch-manipulation active:scale-95"
            >
              {loading ? 'Bezig...' : '📣 Plaatsen'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Mededeling is {EXPIRY_DAYS} dagen zichtbaar voor alle teamleden.</p>
        </div>
      </div>
    </div>
  );
}
