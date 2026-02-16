import React, { useState, useEffect, useCallback } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import PlayerEditModal, { type PlayerFormData } from './modals/PlayerEditModal';
import InvitePlayerModal from './modals/InvitePlayerModal';

interface ActiveInvite {
  token: string;
  expires_at: string;
}

interface PlayersManageViewProps {
  players: Player[];
  onAddPlayer: (data: PlayerFormData) => Promise<boolean>;
  onUpdatePlayer: (id: number, data: PlayerFormData) => Promise<boolean>;
  onDeletePlayer: (id: number) => Promise<boolean>;
  onRefresh: () => void;
}

export default function PlayersManageView({
  players,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onRefresh
}: PlayersManageViewProps) {
  const { currentTeam } = useTeamContext();
  const [editingPlayer, setEditingPlayer] = useState<Player | null | 'new'>(null);
  const [invitingPlayer, setInvitingPlayer] = useState<Player | null>(null);
  const [linkedPlayerIds, setLinkedPlayerIds] = useState<Set<number>>(new Set());
  const [activeInvites, setActiveInvites] = useState<Map<number, ActiveInvite>>(new Map());
  const [copiedPlayerId, setCopiedPlayerId] = useState<number | null>(null);

  const regularPlayers = players.filter(p => !p.is_guest);

  // Fetch linked players and active invites
  const fetchLinkStatus = useCallback(async () => {
    if (!currentTeam) return;

    // Fetch linked team members
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id')
      .eq('team_id', currentTeam.id)
      .eq('status', 'active')
      .not('player_id', 'is', null);

    if (members) {
      setLinkedPlayerIds(new Set(members.map(m => m.player_id as number)));
    }

    // Fetch active (unused, not expired) invite tokens
    const { data: invites } = await supabase
      .from('invite_tokens')
      .select('player_id, token, expires_at')
      .eq('team_id', currentTeam.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString());

    if (invites) {
      const map = new Map<number, ActiveInvite>();
      for (const inv of invites) {
        // Keep the most recent invite per player
        if (!map.has(inv.player_id) || inv.expires_at > map.get(inv.player_id)!.expires_at) {
          map.set(inv.player_id, { token: inv.token, expires_at: inv.expires_at });
        }
      }
      setActiveInvites(map);
    }
  }, [currentTeam]);

  useEffect(() => {
    fetchLinkStatus();
  }, [fetchLinkStatus]);

  const handleSave = async (data: PlayerFormData) => {
    let success: boolean;
    if (editingPlayer === 'new') {
      success = await onAddPlayer(data);
      if (success) {
        alert('✅ Speler toegevoegd!');
        onRefresh();
      } else {
        alert('❌ Kon speler niet toevoegen');
      }
    } else if (editingPlayer) {
      success = await onUpdatePlayer(editingPlayer.id, data);
      if (success) {
        alert('✅ Speler bijgewerkt!');
      } else {
        alert('❌ Kon speler niet bijwerken');
      }
    }
    setEditingPlayer(null);
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Weet je het zeker dat je ${player.name} wilt verwijderen? Dit verwijdert ook alle gerelateerde opstellingen, wissels en afwezigheden.`)) {
      return;
    }
    const success = await onDeletePlayer(player.id);
    if (success) {
      alert('✅ Speler verwijderd!');
    } else {
      alert('❌ Kon speler niet verwijderen');
    }
  };

  const handleInviteCreated = (_token: string) => {
    fetchLinkStatus();
  };

  const handleCopyLink = async (playerId: number) => {
    const invite = activeInvites.get(playerId);
    if (!invite) return;

    const link = `${window.location.origin}/join/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedPlayerId(playerId);
      setTimeout(() => setCopiedPlayerId(null), 2000);
    } catch {
      alert('Kopiëren mislukt. Probeer het opnieuw.');
    }
  };

  return (
    <div className="p-4 sm:p-8 overflow-y-auto flex-1">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">👥 Spelersbeheer</h2>
        <button
          onClick={() => setEditingPlayer('new')}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm sm:text-base"
        >
          ➕ Nieuwe speler
        </button>
      </div>

      {editingPlayer !== null && (
        <PlayerEditModal
          player={editingPlayer === 'new' ? null : editingPlayer}
          onSave={handleSave}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {invitingPlayer && (
        <InvitePlayerModal
          player={invitingPlayer}
          onClose={() => setInvitingPlayer(null)}
          onInviteCreated={handleInviteCreated}
        />
      )}

      <div className="space-y-6">
        {positionOrder.map(position => {
          const posPlayers = regularPlayers
            .filter(p => p.position === position)
            .sort((a, b) => a.name.localeCompare(b.name));

          if (posPlayers.length === 0) return null;

          return (
            <div key={position}>
              <h3 className="font-bold text-gray-400 mb-2 flex items-center gap-2 text-sm sm:text-base">
                <span>{positionEmojis[position]}</span>
                <span>{position}</span>
                <span className="text-xs opacity-70">({posPlayers.length})</span>
              </h3>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                {posPlayers.map(player => {
                  const isLinked = linkedPlayerIds.has(player.id);
                  const invite = activeInvites.get(player.id);
                  const isCopied = copiedPlayerId === player.id;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm sm:text-base truncate flex items-center gap-2">
                          {player.name}
                          {isLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/40 border border-green-700/50 rounded-full text-xs text-green-400 font-medium">
                              ✅ Gekoppeld
                            </span>
                          ) : invite ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/40 border border-yellow-700/50 rounded-full text-xs text-yellow-400 font-medium">
                              ⏳ Uitgenodigd
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/40 border border-red-700/50 rounded-full text-xs text-red-400 font-medium">
                              🔴 Niet gekoppeld
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                          <span>⚽{player.goals}</span>
                          <span>🎯{player.assists}</span>
                          <span>✅{player.was}x</span>
                          <span>⏱️{player.min}min</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {player.injured && (
                          <span className="text-red-500 text-sm" title="Geblesseerd">🏥</span>
                        )}

                        {/* Invite / copy link actions */}
                        {!isLinked && (
                          invite ? (
                            <button
                              onClick={() => handleCopyLink(player.id)}
                              className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-bold transition-colors ${
                                isCopied
                                  ? 'bg-green-600 hover:bg-green-700'
                                  : 'bg-yellow-600 hover:bg-yellow-700'
                              }`}
                              title={isCopied ? 'Gekopieerd!' : 'Kopieer uitnodigingslink'}
                            >
                              {isCopied ? '✅' : '📋'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setInvitingPlayer(player)}
                              className="px-2 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs sm:text-sm font-bold"
                              title="Uitnodigen"
                            >
                              📧
                            </button>
                          )
                        )}

                        <button
                          onClick={() => setEditingPlayer(player)}
                          className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm font-bold"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(player)}
                          className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm font-bold"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center text-gray-500 text-sm">
        Totaal: {regularPlayers.length} spelers
      </div>
    </div>
  );
}
