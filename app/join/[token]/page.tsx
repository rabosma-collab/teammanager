'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../lib/auth';
import { useTeamContext } from '../../contexts/TeamContext';
import { positionEmojis } from '../../lib/constants';

interface InviteData {
  token: string;
  team_id: string;
  player_id: number | null;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  max_uses: number | null;
  use_count: number | null;
  invite_type: 'player' | 'staff';
  display_name: string | null;
  team: { id: string; name: string };
  player: { id: number; name: string; position: string } | null;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'not_authenticated'; invite: InviteData }
  | { kind: 'confirm'; invite: InviteData }
  | { kind: 'already_member'; invite: InviteData }
  | { kind: 'accepting' }
  | { kind: 'success'; teamName: string }
  | { kind: 'error'; message: string };

const STORAGE_KEY = 'inviteToken';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { refreshTeam } = useTeamContext();
  const token = params.token as string;

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const acceptingRef = useRef(false);

  const validateToken = useCallback(async () => {
    setState({ kind: 'loading' });

    // 1. Fetch invite token with team and optional player details
    const { data: invite, error } = await supabase
      .from('invite_tokens')
      .select('token, team_id, player_id, created_by, expires_at, used_at, max_uses, use_count, invite_type, display_name, team:teams!team_id(id, name), player:players(id, name, position)')
      .eq('token', token)
      .single();

    if (error || !invite) {
      setState({ kind: 'invalid' });
      return;
    }

    const inviteType = (invite as any).invite_type ?? 'player';

    const inviteData: InviteData = {
      ...invite,
      invite_type: inviteType,
      display_name: (invite as any).display_name ?? null,
      team: Array.isArray(invite.team) ? invite.team[0] : invite.team,
      player: inviteType === 'player'
        ? (Array.isArray(invite.player) ? invite.player[0] ?? null : invite.player ?? null)
        : null,
    } as InviteData;

    // Check that team exists
    if (!inviteData.team) {
      setState({ kind: 'invalid' });
      return;
    }

    // For player invites: require player record
    if (inviteType === 'player' && !inviteData.player) {
      setState({ kind: 'invalid' });
      return;
    }

    // 2. Check expired
    if (new Date(inviteData.expires_at) < new Date()) {
      setState({ kind: 'expired' });
      return;
    }

    // 3. Check used
    if (inviteData.used_at !== null) {
      setState({ kind: 'used' });
      return;
    }

    // 4. Check max_uses
    if (
      inviteData.max_uses !== null &&
      inviteData.use_count !== null &&
      inviteData.use_count >= inviteData.max_uses
    ) {
      setState({ kind: 'used' });
      return;
    }

    // 5. Auth check
    const user = await getCurrentUser();
    if (!user) {
      setState({ kind: 'not_authenticated', invite: inviteData });
      return;
    }

    // 6. Already a member?
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', inviteData.team_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      setState({ kind: 'already_member', invite: inviteData });
      return;
    }

    setState({ kind: 'confirm', invite: inviteData });
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const handleAccept = async () => {
    if (state.kind !== 'confirm') return;
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    const { invite } = state;

    setState({ kind: 'accepting' });

    try {
      const user = await getCurrentUser();
      if (!user) {
        setState({ kind: 'error', message: 'Je sessie is verlopen. Log opnieuw in.' });
        return;
      }

      const role = invite.invite_type === 'staff' ? 'staff' : 'player';

      // Insert team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: invite.team_id,
          user_id: user.id,
          role,
          player_id: invite.player_id ?? null,
          status: 'active',
          invited_by: invite.created_by,
        });

      if (memberError) throw memberError;

      // Mark token as used
      await supabase
        .from('invite_tokens')
        .update({ used_at: new Date().toISOString(), used_by: user.id })
        .eq('token', token);

      localStorage.removeItem(STORAGE_KEY);
      await refreshTeam();

      setState({ kind: 'success', teamName: invite.team.name });
      localStorage.setItem('onboarding', 'true');
      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      console.error('Fout bij accepteren uitnodiging:', err);
      acceptingRef.current = false;
      setState({ kind: 'error', message: 'Er ging iets mis bij het accepteren. Probeer het opnieuw.' });
    }
  };

  const handleLoginRedirect = () => {
    localStorage.setItem(STORAGE_KEY, token);
    router.push('/login');
  };

  const handleRegisterRedirect = () => {
    localStorage.setItem(STORAGE_KEY, token);
    router.push('/register');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-3xl font-bold text-white">Team Manager</h1>
        </div>

        {state.kind === 'loading' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Uitnodiging controleren...</p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-3">Ongeldige uitnodiging</h2>
            <p className="text-gray-400 mb-6">Deze uitnodigingslink is ongeldig of bestaat niet meer.</p>
            <Link href="/login" className="inline-block w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Naar inloggen
            </Link>
          </div>
        )}

        {state.kind === 'expired' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold text-white mb-3">Uitnodiging verlopen</h2>
            <p className="text-gray-400 mb-6">Deze uitnodigingslink is verlopen. Vraag je teammanager om een nieuwe uitnodiging.</p>
            <Link href="/login" className="inline-block w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Naar inloggen
            </Link>
          </div>
        )}

        {state.kind === 'used' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-3">Uitnodiging al gebruikt</h2>
            <p className="text-gray-400 mb-6">Deze uitnodigingslink is al gebruikt. Vraag je teammanager om een nieuwe uitnodiging als dit niet klopt.</p>
            <Link href="/login" className="inline-block w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Naar inloggen
            </Link>
          </div>
        )}

        {state.kind === 'not_authenticated' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📨</div>
              <h2 className="text-2xl font-bold text-white mb-2">Je bent uitgenodigd!</h2>
              <p className="text-gray-400">Log in of maak een account aan om lid te worden.</p>
            </div>
            <InviteDetails invite={state.invite} />
            <div className="space-y-3 mt-6">
              <button onClick={handleLoginRedirect} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold text-base transition active:scale-[0.98]">
                Inloggen
              </button>
              <button onClick={handleRegisterRedirect} className="w-full py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white font-bold text-base transition active:scale-[0.98]">
                Registreren
              </button>
            </div>
          </div>
        )}

        {state.kind === 'confirm' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📨</div>
              <h2 className="text-2xl font-bold text-white mb-2">Je bent uitgenodigd!</h2>
              <p className="text-gray-400">
                {state.invite.invite_type === 'staff'
                  ? 'Je wordt toegevoegd als staflid.'
                  : 'Bevestig dat jij deze speler bent.'}
              </p>
            </div>
            <InviteDetails invite={state.invite} />
            <div className="mt-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <p className="text-white text-center font-medium">
                {state.invite.invite_type === 'staff'
                  ? <>Word staflid van <strong>{state.invite.team.name}</strong>?</>
                  : <>Koppel je account aan <strong>{state.invite.player?.name}</strong>?</>}
              </p>
            </div>
            <div className="space-y-3 mt-6">
              <button onClick={handleAccept} className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold text-base transition active:scale-[0.98]">
                {state.invite.invite_type === 'staff' ? 'Ja, ik word staflid' : 'Ja, dat ben ik'}
              </button>
              <button onClick={() => router.push('/')} className="w-full py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white font-bold text-base transition active:scale-[0.98]">
                Nee, verkeerde persoon
              </button>
            </div>
          </div>
        )}

        {state.kind === 'already_member' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-3">Je bent al lid van dit team</h2>
            <p className="text-gray-400 mb-6">
              Je bent al lid van <strong className="text-white">{state.invite.team.name}</strong>. Je kunt direct naar de app gaan.
            </p>
            <Link href="/" className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Naar Team Manager
            </Link>
          </div>
        )}

        {state.kind === 'accepting' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-600 border-t-green-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Uitnodiging accepteren...</p>
          </div>
        )}

        {state.kind === 'success' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-3">Welkom bij het team!</h2>
            <p className="text-gray-400 mb-6">
              Je bent nu lid van <strong className="text-white">{state.teamName}</strong>. Je wordt doorgestuurd...
            </p>
            <Link href="/" className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Naar Team Manager
            </Link>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-700 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-3">Er ging iets mis</h2>
            <p className="text-gray-400 mb-6">{state.message}</p>
            <button onClick={validateToken} className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition active:scale-[0.98]">
              Opnieuw proberen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InviteDetails({ invite }: { invite: InviteData }) {
  const isStaff = invite.invite_type === 'staff';

  return (
    <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 space-y-3">
      {/* Team */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏟️</span>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Team</p>
          <p className="text-white font-bold">{invite.team.name}</p>
        </div>
      </div>

      <div className="border-t border-gray-600" />

      {/* Player or Staff */}
      {isStaff ? (
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧑‍💼</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Rol</p>
            <p className="text-white font-bold">{invite.display_name ?? 'Staflid'}</p>
            <p className="text-sm text-gray-400">Staflid</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-2xl">{positionEmojis[invite.player?.position ?? ''] ?? '⚽'}</span>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Speler</p>
            <p className="text-white font-bold">{invite.player?.name}</p>
            <p className="text-sm text-gray-400">{invite.player?.position}</p>
          </div>
        </div>
      )}
    </div>
  );
}
