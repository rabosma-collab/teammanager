'use client';

import React, { useState, useCallback } from 'react';
import DraggableModal from './DraggableModal';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { useTeamContext } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';

interface InviteStaffModalProps {
  onClose: () => void;
  onInviteCreated: () => void;
}

export default function InviteStaffModal({ onClose, onInviteCreated }: InviteStaffModalProps) {
  const { currentTeam } = useTeamContext();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvite = useCallback(async () => {
    if (!displayName.trim()) {
      setError('Voer een naam in voor het staflid');
      return;
    }
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
          player_id: null,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          invite_type: 'staff',
          display_name: displayName.trim(),
        })
        .select('token')
        .single();

      if (insertError) throw insertError;

      setToken(data.token);
      onInviteCreated();
    } catch (err) {
      console.error('Fout bij aanmaken staflid-uitnodiging:', err);
      setError('Kon uitnodiging niet aanmaken. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }, [currentTeam, displayName, onInviteCreated]);

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

  return (
    <DraggableModal onClose={onClose} className="w-[calc(100vw-2rem)] max-w-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🧑‍💼 Staflid uitnodigen</h2>
          <button onClick={onClose} className="text-2xl hover:text-red-500">✕</button>
        </div>

        {!token && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2 text-gray-300">Naam staflid</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateInvite()}
                placeholder="Bijv. Jan Koets"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Dit staflid krijgt dezelfde rechten als een speler (geen speelminuten, wel stemmen).
              </p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={generateInvite}
              disabled={loading || !displayName.trim()}
              className="w-full p-3 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Aanmaken...' : '📨 Link aanmaken'}
            </button>
          </>
        )}

        {token && (
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">🧑‍💼</span>
              <div>
                <p className="font-bold">{displayName}</p>
                <p className="text-sm text-gray-400">Staflid</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-gray-400">Uitnodigingslink</label>
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-gray-300 break-all select-all">
                {inviteLink}
              </div>
            </div>

            <button
              onClick={handleCopy}
              className={`w-full p-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
                copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {copied ? <><span>✅</span><span>Gekopieerd!</span></> : <><span>📋</span><span>Link kopiëren</span></>}
            </button>

            <p className="text-xs text-gray-500 text-center">Deze link is geldig voor 7 dagen</p>
          </div>
        )}

        <button onClick={onClose} className="w-full p-3 rounded-lg font-bold bg-gray-600 hover:bg-gray-700 mt-4">
          Sluiten
        </button>
      </div>
    </DraggableModal>
  );
}
