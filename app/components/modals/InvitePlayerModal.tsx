'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import type { Player } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { useTeamContext } from '../../contexts/TeamContext';
import { positionEmojis } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';

interface InvitePlayerModalProps {
  player: Player;
  onClose: () => void;
  onInviteCreated: (token: string) => void;
}

export default function InvitePlayerModal({ player, onClose, onInviteCreated }: InvitePlayerModalProps) {
  const { currentTeam } = useTeamContext();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvite = useCallback(async () => {
    if (!currentTeam) {
      setError('Geen team geselecteerd');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        setError('Je moet ingelogd zijn om een uitnodiging te maken');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error: insertError } = await supabase
        .from('invite_tokens')
        .insert({
          team_id: currentTeam.id,
          player_id: player.id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();

      if (insertError) {
        throw insertError;
      }

      setToken(data.token);
      onInviteCreated(data.token);
    } catch (err) {
      console.error('Fout bij aanmaken uitnodiging:', err);
      setError('Kon uitnodiging niet aanmaken. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }, [currentTeam, player.id, onInviteCreated]);

  useEffect(() => {
    generateInvite();
  }, [generateInvite]);

  const inviteLink = token ? `${window.location.origin}/join/${token}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.warning('Kopiëren mislukt. Selecteer de link handmatig.');
    }
  };

  const emoji = positionEmojis[player.position] ?? '⚽';

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📨 Speler uitnodigen</h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500">✕</button>
        </div>

        {/* Player info */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4 flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <p className="text-lg font-bold">{player.name}</p>
            <p className="text-sm text-gray-400">{player.position}</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-6">
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-gray-400">Uitnodiging aanmaken...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-3">
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
            <button
              onClick={generateInvite}
              className="w-full p-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
              Opnieuw proberen
            </button>
          </div>
        )}

        {/* Success state with link */}
        {token && !loading && !error && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-400">Uitnodigingslink</label>
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-gray-300 break-all select-all">
                {inviteLink}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className={`w-full p-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
                copied
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {copied ? (
                <>
                  <span>✅</span>
                  <span>Gekopieerd!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Link kopiëren</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Deze link is geldig voor 7 dagen
            </p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full p-3 rounded-lg font-bold bg-gray-600 hover:bg-gray-700 mt-4"
        >
          Sluiten
        </button>
      </div>
    </DraggableModal>
  );
}
