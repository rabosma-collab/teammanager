import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import { getCurrentUser } from '../lib/auth';
import { positionEmojis } from '../lib/constants';

interface InviteRow {
  id: string;
  token: string;
  player_id: number;
  created_at: string;
  expires_at: string;
  player: { name: string; position: string };
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function InvitesManageView() {
  const { currentTeam } = useTeamContext();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const [now, setNow] = useState(Date.now());

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Tick every minute for countdown updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchInvites = useCallback(async () => {
    if (!currentTeam) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('invite_tokens')
      .select('id, token, player_id, created_at, expires_at, player:players!player_id(name, position)')
      .eq('team_id', currentTeam.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvites(
        data.map(d => ({
          ...d,
          player: Array.isArray(d.player) ? d.player[0] : d.player,
        })) as InviteRow[]
      );
    }
    setLoading(false);
  }, [currentTeam]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCopy = async (invite: InviteRow) => {
    const link = `${window.location.origin}/join/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Kopiëren mislukt', 'error');
    }
  };

  const handleRevoke = async (invite: InviteRow) => {
    if (!confirm(`Uitnodiging voor ${invite.player.name} intrekken? De link werkt dan niet meer.`)) return;

    setActionId(invite.id);
    try {
      const { error } = await supabase
        .from('invite_tokens')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (error) throw error;

      setInvites(prev => prev.filter(i => i.id !== invite.id));
      showToast(`Uitnodiging voor ${invite.player.name} ingetrokken`, 'success');
    } catch {
      showToast('Kon uitnodiging niet intrekken', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleResend = async (invite: InviteRow) => {
    if (!currentTeam) return;

    setActionId(invite.id);
    try {
      const user = await getCurrentUser();
      if (!user) {
        showToast('Je moet ingelogd zijn', 'error');
        return;
      }

      // Expire old token
      await supabase
        .from('invite_tokens')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', invite.id);

      // Create new token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: newInvite, error } = await supabase
        .from('invite_tokens')
        .insert({
          team_id: currentTeam.id,
          player_id: invite.player_id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .select('id, token, player_id, created_at, expires_at')
        .single();

      if (error || !newInvite) throw error ?? new Error('Geen uitnodiging ontvangen');

      // Replace old invite with new one in the list
      setInvites(prev =>
        [
          {
            ...newInvite,
            player: invite.player,
          } as InviteRow,
          ...prev.filter(i => i.id !== invite.id),
        ]
      );

      // Copy new link to clipboard
      const link = `${window.location.origin}/join/${newInvite.token}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopiedId(newInvite.id);
        setTimeout(() => setCopiedId(null), 2000);
        showToast(`Nieuwe uitnodiging voor ${invite.player.name} aangemaakt en gekopieerd`, 'success');
      } catch {
        showToast(`Nieuwe uitnodiging voor ${invite.player.name} aangemaakt`, 'success');
      }
    } catch {
      showToast('Kon uitnodiging niet vernieuwen', 'error');
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCountdown = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return 'Verlopen';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}u`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}u ${minutes}m`;
    return `${minutes}m`;
  };

  const getCountdownColor = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now;
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return 'text-red-400';
    if (hours < 72) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">📨 Uitnodigingen</h2>
        <span className="text-sm text-gray-400">
          {invites.length} uitstaand{invites.length !== 1 ? 'e' : ''}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Uitnodigingen laden...</p>
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-300 mb-2">Geen uitstaande uitnodigingen</h3>
          <p className="text-gray-500 text-sm">
            Ga naar Spelers beheer om spelers uit te nodigen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map(invite => {
            const emoji = positionEmojis[invite.player.position] ?? '⚽';
            const isCopied = copiedId === invite.id;
            const isActing = actionId === invite.id;

            return (
              <div
                key={invite.id}
                className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Player info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{emoji}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base truncate">{invite.player.name}</p>
                    <p className="text-xs text-gray-400">{invite.player.position}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 sm:flex-shrink-0">
                  <span>Aangemaakt: {formatDate(invite.created_at)}</span>
                  <span className="flex items-center gap-1">
                    Verloopt:
                    <span className={`font-bold ${getCountdownColor(invite.expires_at)}`}>
                      {getCountdown(invite.expires_at)}
                    </span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(invite)}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                      isCopied
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    title="Kopieer link"
                  >
                    {isCopied ? '✅ Gekopieerd' : '📋 Link'}
                  </button>
                  <button
                    onClick={() => handleResend(invite)}
                    disabled={isActing}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-xs font-bold transition-colors"
                    title="Nieuwe uitnodiging aanmaken"
                  >
                    🔄 Vernieuw
                  </button>
                  <button
                    onClick={() => handleRevoke(invite)}
                    disabled={isActing}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-xs font-bold transition-colors"
                    title="Uitnodiging intrekken"
                  >
                    ✕ Intrekken
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
                toast.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <span>{toast.type === 'success' ? '✅' : '❌'}</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
