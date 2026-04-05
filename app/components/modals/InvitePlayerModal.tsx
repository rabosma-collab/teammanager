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
  const [existingAccountCount, setExistingAccountCount] = useState<number>(0);
  const [displayName, setDisplayName] = useState<string>(player.name);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Haal op hoeveel accounts al gekoppeld zijn aan deze speler
  useEffect(() => {
    if (!currentTeam) return;
    setLoadingAccounts(true);
    supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', currentTeam.id)
      .eq('player_id', player.id)
      .eq('status', 'active')
      .then(({ count }: { count: number | null }) => {
        const n = count ?? 0;
        setExistingAccountCount(n);
        // Bij eerste account: default = spelernaam. Bij extra account: leeg laten
        setDisplayName(n === 0 ? player.name : '');
        setLoadingAccounts(false);
      });
  }, [currentTeam, player.id, player.name]);

  const generateInvite = useCallback(async () => {
    if (!currentTeam) {
      setError('Geen team geselecteerd');
      return;
    }

    // Bij extra account: naam is verplicht
    if (existingAccountCount > 0 && !displayName.trim()) {
      setError('Vul een herkenbare naam in voor dit account.');
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

      const nameToSave = displayName.trim() || player.name;

      const { data, error: insertError } = await supabase
        .from('invite_tokens')
        .insert({
          team_id: currentTeam.id,
          player_id: player.id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          display_name: nameToSave,
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
  }, [currentTeam, player.id, player.name, displayName, existingAccountCount, onInviteCreated]);

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
  const isExtraAccount = existingAccountCount > 0;

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

        {loadingAccounts ? (
          <div className="text-center py-4">
            <div className="inline-block w-6 h-6 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Melding bij extra account */}
            {isExtraAccount && (
              <div className="bg-blue-900/40 border border-blue-700/50 rounded-lg p-3 mb-4 text-sm text-blue-300">
                ✅ {player.name} heeft al {existingAccountCount} account{existingAccountCount > 1 ? 's' : ''} gekoppeld.
                Je maakt nu een uitnodiging aan voor een extra persoon.
              </div>
            )}

            {/* display_name veld */}
            {!token && (
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1 text-gray-300">
                  Naam voor dit account
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={isExtraAccount ? 'bijv. Vader Tim of Moeder Tim' : player.name}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  {isExtraAccount
                    ? 'Vul een herkenbare naam in zodat je de accounts uit elkaar kunt houden in het spelersbeheer, bijv. "Vader Tim" of "Moeder Tim".'
                    : 'Dit is de naam die verschijnt in het spelersbeheer. Pas dit aan als meerdere mensen inloggen namens deze speler, bijv. "Vader Tim" of "Moeder Tim".'}
                </p>
              </div>
            )}

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
                  className="w-full p-3 rounded-lg font-display font-bold bg-yellow-500 hover:bg-yellow-400 text-gray-900 uppercase tracking-wide"
                >
                  Opnieuw proberen
                </button>
              </div>
            )}

            {/* Aanmaken knop (voor genereren) */}
            {!token && !loading && !error && (
              <button
                onClick={generateInvite}
                disabled={isExtraAccount && !displayName.trim()}
                className="w-full p-3 rounded-lg font-display font-bold bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 uppercase tracking-wide mb-2"
              >
                Uitnodigingslink aanmaken
              </button>
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
                      : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
                  }`}
                >
                  {copied ? (
                    <><span>✅</span><span>Gekopieerd!</span></>
                  ) : (
                    <><span>📋</span><span>Link kopiëren</span></>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Deze link is geldig voor 7 dagen
                </p>
              </div>
            )}
          </>
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
