'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Team, TeamMember, TeamContext as TeamContextType } from '../lib/types';
import { supabase } from '../lib/supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useTeamSettings } from '../hooks/useTeamSettings';
import { useFetchGuard } from '../hooks/useFetchGuard';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function useTeamContext(): TeamContextType {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useTeamContext moet binnen een TeamProvider worden gebruikt');
  }
  return ctx;
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { settings: teamSettings, fetchSettings } = useTeamSettings();
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userRole, setUserRole] = useState<TeamMember['role'] | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchGuard = useFetchGuard();

  const loadTeams = useCallback(async (userId: string) => {
    const fetchId = fetchGuard.begin();
    setCurrentUserId(userId);
    setIsLoading(true);

    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, role, player_id, teams:team_id(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!fetchGuard.isCurrent(fetchId)) return;

    if (error) {
      console.error('Fout bij laden teams:', error);
      setIsLoading(false);
      return;
    }

    const rows = data as unknown as Array<{ team_id: string; role: TeamMember['role']; player_id: number | null; teams: Team }>;
    const allTeams = rows.map((r) => r.teams);
    const loadedTeams = allTeams.filter((t) => t.status === 'active' || !t.status);
    setTeams(loadedTeams);

    // Restore previously selected team or pick the first one
    const savedTeamId = typeof window !== 'undefined'
      ? localStorage.getItem('selectedTeamId')
      : null;

    const savedTeam = savedTeamId
      ? loadedTeams.find((t) => t.id === savedTeamId)
      : null;

    const activeTeam = savedTeam ?? loadedTeams[0] ?? null;
    setCurrentTeam(activeTeam);

    const activeRow = activeTeam ? rows.find((r) => r.team_id === activeTeam.id) : null;
    setUserRole(activeRow?.role ?? null);
    setCurrentPlayerId(activeRow?.player_id ?? null);

    setIsLoading(false);
  }, [fetchGuard]);

  const switchTeam = useCallback(async (teamId: string) => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from('team_members')
      .select('role, player_id, teams:team_id(*)')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      console.error('Fout bij wisselen van team:', error);
      setIsLoading(false);
      return;
    }

    const row = data as unknown as { role: TeamMember['role']; player_id: number | null; teams: Team };
    setCurrentTeam(row.teams);
    setUserRole(row.role);
    setCurrentPlayerId(row.player_id ?? null);
    localStorage.setItem('selectedTeamId', teamId);
    setIsLoading(false);
  }, []);

  const refreshTeam = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadTeams(user.id);
    }
  }, [loadTeams]);

  // Auth state listener: load teams on sign-in, clear on sign-out
  useEffect(() => {
    // Initial load
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (data.user) {
        // Session-only mode: sign out if browser was closed (sessionStorage cleared)
        const rememberMe = localStorage.getItem('tm_remember_me');
        const sessionAlive = sessionStorage.getItem('tm_session_alive');
        if (rememberMe === 'false' && !sessionAlive) {
          localStorage.removeItem('tm_remember_me');
          supabase.auth.signOut();
          setIsLoading(false);
          return;
        }
        sessionStorage.setItem('tm_session_alive', '1');
        loadTeams(data.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          loadTeams(session.user.id);
        } else {
          setCurrentTeam(null);
          setTeams([]);
          setUserRole(null);
          setCurrentUserId(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadTeams]);

  const isManager = userRole === 'manager';
  const isStaff = userRole === 'staff';

  // Laad teaminstellingen automatisch wanneer het actieve team verandert
  useEffect(() => {
    if (currentTeam?.id) {
      fetchSettings(currentTeam.id);
    }
  }, [currentTeam?.id, fetchSettings]);

  const refreshTeamSettings = useCallback(async () => {
    if (currentTeam?.id) {
      await fetchSettings(currentTeam.id);
    }
  }, [currentTeam?.id, fetchSettings]);

  return (
    <TeamContext.Provider
      value={{ currentTeam, userRole, isManager, isStaff, isLoading, teams, currentPlayerId, currentUserId, teamSettings, switchTeam, refreshTeam, refreshTeamSettings }}
    >
      {children}
    </TeamContext.Provider>
  );
}
