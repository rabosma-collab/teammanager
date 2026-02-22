import React, { useState, useEffect, useCallback, useRef } from 'react';
import { positionOrder, positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import PlayerEditModal, { type PlayerFormData } from './modals/PlayerEditModal';
import InvitePlayerModal from './modals/InvitePlayerModal';
import InviteStaffModal from './modals/InviteStaffModal';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface PlayerAccount {
  userId: string;
  role: 'manager' | 'player' | 'staff';
}

interface ActiveInvite {
  token: string;
  expires_at: string;
}

interface StaffMember {
  memberId: string;
  userId: string;
  role: 'manager' | 'staff';
  displayName: string | null;
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
  const [showStaffInviteModal, setShowStaffInviteModal] = useState(false);
  const [playerAccounts, setPlayerAccounts] = useState<Map<number, PlayerAccount>>(new Map());
  const [activeInvites, setActiveInvites] = useState<Map<number, ActiveInvite>>(new Map());
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [copiedPlayerId, setCopiedPlayerId] = useState<number | null>(null);
  const [togglingPlayerId, setTogglingPlayerId] = useState<number | null>(null);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);
  const [removingStaffId, setRemovingStaffId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const regularPlayers = players.filter(p => !p.is_guest);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const fetchLinkStatus = useCallback(async () => {
    if (!currentTeam) return;

    // Fetch linked players
    const { data: members } = await supabase
      .from('team_members')
      .select('player_id, user_id, role')
      .eq('team_id', currentTeam.id)
      .eq('status', 'active')
      .not('player_id', 'is', null);

    if (members) {
      const map = new Map<number, PlayerAccount>();
      for (const m of members) {
        map.set(m.player_id as number, {
          userId: m.user_id,
          role: m.role as 'manager' | 'player' | 'staff',
        });
      }
      setPlayerAccounts(map);
    }

    // Fetch staff members (member_type='staff', no player_id)
    const { data: staffData } = await supabase
      .from('team_members')
      .select('id, user_id, role, display_name')
      .eq('team_id', currentTeam.id)
      .eq('status', 'active')
      .eq('member_type', 'staff');

    if (staffData) {
      setStaffMembers(staffData.map((m: any) => ({
        memberId: m.id,
        userId: m.user_id,
        role: m.role as 'manager' | 'staff',
        displayName: m.display_name ?? null,
      })));
    }

    // Fetch active invite tokens
    const { data: invites } = await supabase
      .from('invite_tokens')
      .select('player_id, token, expires_at')
      .eq('team_id', currentTeam.id)
      .eq('invite_type', 'player')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString());

    if (invites) {
      const map = new Map<number, ActiveInvite>();
      for (const inv of invites) {
        if (inv.player_id == null) continue;
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
    if (!confirm(`Weet je het zeker dat je ${player.name} wilt verwijderen? Dit verwijdert ook alle gerelateerde opstellingen, wissels en afwezigheden.`)) return;
    const success = await onDeletePlayer(player.id);
    if (success) alert('✅ Speler verwijderd!');
    else alert('❌ Kon speler niet verwijderen');
  };

  const handleInviteCreated = useCallback((_token: string) => {
    fetchLinkStatus();
  }, [fetchLinkStatus]);

  const handleStaffInviteCreated = useCallback(() => {
    setShowStaffInviteModal(false);
    fetchLinkStatus();
  }, [fetchLinkStatus]);

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

  const handleToggleRole = async (playerId: number, playerName: string) => {
    const account = playerAccounts.get(playerId);
    if (!account || !currentTeam) return;

    const newRole = account.role === 'manager' ? 'player' : 'manager';

    if (newRole === 'player') {
      const managerCount = Array.from(playerAccounts.values()).filter((a: PlayerAccount) => a.role === 'manager').length
        + staffMembers.filter(s => s.role === 'manager').length;
      if (managerCount <= 1) {
        showToast('Er moet minimaal 1 manager in het team blijven', 'error');
        return;
      }
    }

    if (newRole === 'manager') {
      if (!confirm(`Geef ${playerName} manager rechten? Ze kunnen dan alles bewerken.`)) return;
    } else {
      if (!confirm(`${playerName} kan dan alleen nog lezen, niet bewerken. Doorgaan?`)) return;
    }

    setTogglingPlayerId(playerId);
    const previousRole = account.role;
    setPlayerAccounts(prev => {
      const next = new Map(prev);
      next.set(playerId, { ...account, role: newRole });
      return next;
    });

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('team_id', currentTeam.id)
        .eq('user_id', account.userId);

      if (error) throw error;

      showToast(
        newRole === 'manager' ? `${playerName} is nu manager` : `${playerName} is nu speler`,
        'success'
      );
    } catch {
      setPlayerAccounts(prev => {
        const next = new Map(prev);
        next.set(playerId, { ...account, role: previousRole });
        return next;
      });
      showToast('Kon rol niet wijzigen. Probeer het opnieuw.', 'error');
    } finally {
      setTogglingPlayerId(null);
    }
  };

  const handleToggleStaffRole = async (staff: StaffMember) => {
    if (!currentTeam) return;

    const newRole = staff.role === 'manager' ? 'staff' : 'manager';

    if (newRole === 'staff') {
      const managerCount = Array.from(playerAccounts.values()).filter(a => a.role === 'manager').length
        + staffMembers.filter(s => s.role === 'manager').length;
      if (managerCount <= 1) {
        showToast('Er moet minimaal 1 manager in het team blijven', 'error');
        return;
      }
      if (!confirm(`${staff.displayName ?? 'Staflid'} kan dan alleen nog lezen, niet bewerken. Doorgaan?`)) return;
    } else {
      if (!confirm(`Geef ${staff.displayName ?? 'staflid'} manager rechten? Ze kunnen dan alles bewerken.`)) return;
    }

    setTogglingStaffId(staff.memberId);
    setStaffMembers(prev => prev.map(s => s.memberId === staff.memberId ? { ...s, role: newRole } : s));

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', staff.memberId);

      if (error) throw error;

      showToast(
        newRole === 'manager'
          ? `${staff.displayName ?? 'Staflid'} is nu manager`
          : `${staff.displayName ?? 'Staflid'} is nu staflid`,
        'success'
      );
    } catch {
      setStaffMembers(prev => prev.map(s => s.memberId === staff.memberId ? { ...s, role: staff.role } : s));
      showToast('Kon rol niet wijzigen. Probeer het opnieuw.', 'error');
    } finally {
      setTogglingStaffId(null);
    }
  };

  const handleRemoveStaff = async (staff: StaffMember) => {
    if (!currentTeam) return;
    if (!confirm(`${staff.displayName ?? 'Staflid'} verwijderen uit het team?`)) return;

    setRemovingStaffId(staff.memberId);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'inactive' })
        .eq('id', staff.memberId);

      if (error) throw error;

      setStaffMembers(prev => prev.filter(s => s.memberId !== staff.memberId));
      showToast(`${staff.displayName ?? 'Staflid'} verwijderd`, 'success');
    } catch {
      showToast('Kon staflid niet verwijderen', 'error');
    } finally {
      setRemovingStaffId(null);
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

      {showStaffInviteModal && (
        <InviteStaffModal
          onClose={() => setShowStaffInviteModal(false)}
          onInviteCreated={handleStaffInviteCreated}
        />
      )}

      {/* Spelers per positie */}
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
                  const account = playerAccounts.get(player.id);
                  const isLinked = !!account;
                  const isManager = account?.role === 'manager';
                  const invite = activeInvites.get(player.id);
                  const isCopied = copiedPlayerId === player.id;
                  const isToggling = togglingPlayerId === player.id;

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm sm:text-base truncate flex items-center gap-2 flex-wrap">
                          {player.name}
                          {isLinked ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/40 border border-green-700/50 rounded-full text-xs text-green-400 font-medium">
                                ✅ Gekoppeld
                              </span>
                              {isManager && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/40 border border-yellow-600/50 rounded-full text-xs text-yellow-300 font-medium">
                                  👑 Manager
                                </span>
                              )}
                            </>
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
                        {player.injured && <span className="text-red-500 text-sm" title="Geblesseerd">🏥</span>}

                        {isLinked && (
                          <button
                            onClick={() => handleToggleRole(player.id, player.name)}
                            disabled={isToggling}
                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isManager ? 'bg-yellow-600' : 'bg-gray-600'}`}
                            title={isManager ? 'Manager rechten uitschakelen' : 'Manager rechten inschakelen'}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isManager ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        )}

                        {!isLinked && (
                          invite ? (
                            <button
                              onClick={() => handleCopyLink(player.id)}
                              className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-bold transition-colors ${isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
                            >
                              {isCopied ? '✅' : '📋'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setInvitingPlayer(player)}
                              className="px-2 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs sm:text-sm font-bold"
                            >
                              📧
                            </button>
                          )
                        )}

                        <button onClick={() => setEditingPlayer(player)} className="px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm font-bold">✏️</button>
                        <button onClick={() => handleDelete(player)} className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs sm:text-sm font-bold">🗑️</button>
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

      {/* ── Stafleden ── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl sm:text-2xl font-bold">🧑‍💼 Stafleden</h2>
          <button
            onClick={() => setShowStaffInviteModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded font-bold text-sm"
          >
            ➕ Staflid uitnodigen
          </button>
        </div>

        {staffMembers.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-500 text-sm border border-gray-700">
            Nog geen stafleden. Klik op "Staflid uitnodigen" om iemand toe te voegen.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {staffMembers.map(staff => {
              const isManager = staff.role === 'manager';
              const isToggling = togglingStaffId === staff.memberId;
              const isRemoving = removingStaffId === staff.memberId;

              return (
                <div
                  key={staff.memberId}
                  className="flex items-center gap-3 p-3 sm:p-4 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm sm:text-base truncate flex items-center gap-2 flex-wrap">
                      {staff.displayName ?? <span className="text-gray-500 italic">Onbekend</span>}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 rounded-full text-xs text-blue-300 font-medium">
                        🧑‍💼 Staflid
                      </span>
                      {isManager && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-900/40 border border-yellow-600/50 rounded-full text-xs text-yellow-300 font-medium">
                          👑 Manager
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Manager toggle */}
                    <button
                      onClick={() => handleToggleStaffRole(staff)}
                      disabled={isToggling}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isManager ? 'bg-yellow-600' : 'bg-gray-600'}`}
                      title={isManager ? 'Manager rechten uitschakelen' : 'Manager rechten inschakelen'}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isManager ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveStaff(staff)}
                      disabled={isRemoving}
                      className="px-2 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-xs sm:text-sm font-bold"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in flex items-center gap-2 ${
                toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
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
