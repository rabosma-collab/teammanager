'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Team, TeamMember, TeamContext as TeamContextType } from '../lib/types';
import { createClientComponentClient } from '../lib/supabase';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function useTeamContext(): TeamContextType {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error('useTeamContext moet binnen een TeamProvider worden gebruikt');
  }
  return ctx;
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userRole, setUserRole] = useState<TeamMember['role'] | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchIdRef = useRef(0);

  const loadTeams = useCallback(async (userId: string) => {
    const fetchId = ++fetchIdRef.current;
    setCurrentUserId(userId);
    setIsLoading(true);

    const { data, error } = await supabase
      .from('team_members')
      .select('team_id, role, player_id, teams:team_id(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (fetchId !== fetchIdRef.current) return;

    if (error) {
      console.error('Fout bij laden teams:', error);
      setIsLoading(false);
      return;
    }

    const rows = data as unknown as Array<{ team_id: string; role: TeamMember['role']; player_id: number | null; teams: Team }>;
    const loadedTeams = rows.map((r) => r.teams);
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
  }, [supabase]);

  const switchTeam = useCallback(async (teamId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('team_members')
      .select('role, player_id, teams:team_id(*)')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      console.error('Fout bij wisselen van team:', error);
      return;
    }

    const row = data as unknown as { role: TeamMember['role']; player_id: number | null; teams: Team };
    setCurrentTeam(row.teams);
    setUserRole(row.role);
    setCurrentPlayerId(row.player_id ?? null);
    localStorage.setItem('selectedTeamId', teamId);
  }, [supabase]);

  const refreshTeam = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadTeams(user.id);
    }
  }, [supabase, loadTeams]);

  // Auth state listener: load teams on sign-in, clear on sign-out
  useEffect(() => {
    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadTeams(user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
  }, [supabase, loadTeams]);

  const isManager = userRole === 'manager';
  const isStaff = userRole === 'staff';

  return (
    <TeamContext.Provider
      value={{ currentTeam, userRole, isManager, isStaff, isLoading, teams, currentPlayerId, currentUserId, switchTeam, refreshTeam }}
    >
      {children}
    </TeamContext.Provider>
  );
}
