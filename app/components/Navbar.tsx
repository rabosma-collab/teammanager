'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import ProfileModal from './modals/ProfileModal';

interface NavbarProps {
  view: string;
  setView: (view: string) => void;
  isAdmin: boolean;
  onLogout: () => void;
  onPlayerUpdated?: () => void;
  unreadCount?: number;
  onBellClick?: () => void;
}

const ADMIN_VIEWS = ['mededelingen', 'instructions', 'players-manage', 'matches-manage', 'invites', 'team-settings', 'season-settings', 'feedback'] as const;

export default function Navbar({
  view,
  setView,
  isAdmin,
  onLogout,
  onPlayerUpdated,
  unreadCount = 0,
  onBellClick,
}: NavbarProps) {
  const router = useRouter();
  const { currentTeam, currentPlayerId, teams, switchTeam, userRole } = useTeamContext();
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileInitials, setProfileInitials] = useState('?');
  const [showBeheer, setShowBeheer] = useState(false);
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);
  const beheerRef = useRef<HTMLDivElement>(null);
  const teamSwitcherRef = useRef<HTMLDivElement>(null);

  // Ref zodat de auth-listener altijd de meest recente versie aanroept (geen stale closure)
  const loadProfileInfoRef = useRef<() => Promise<void>>(async () => {});

  // Laad avatar: players tabel is de primary source (altijd up-to-date na upload),
  // user_metadata is fallback voor gebruikers zonder spelerrecord.
  const loadProfileInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let avatar: string | null = user.user_metadata?.avatar_url ?? null;
    let initials = user.email?.substring(0, 2).toUpperCase() ?? '?';

    if (currentPlayerId) {
      const { data } = await supabase
        .from('players')
        .select('name, avatar_url')
        .eq('id', currentPlayerId)
        .single();
      if (data?.name) initials = data.name.substring(0, 2).toUpperCase();
      // Players tabel is primary source — voorkomt stale user_metadata na token refresh
      if (data?.avatar_url) avatar = data.avatar_url;
    }

    setProfileInitials(initials);
    setProfileAvatar(avatar);
  };

  // Update ref op elke render zodat de auth-listener nooit een stale closure aanroept
  loadProfileInfoRef.current = loadProfileInfo;

  useEffect(() => { loadProfileInfo(); }, [currentPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase initialiseert de sessie asynchroon vanuit localStorage. Als loadProfileInfo()
  // wordt aangeroepen vóórdat de sessie klaar is, geeft getUser() null terug en verdwijnt
  // de avatar. INITIAL_SESSION wordt gefired zodra de sessie hersteld is — dan opnieuw laden.
  // Gebruik de ref zodat altijd de meest recente loadProfileInfo (met correcte currentPlayerId) wordt aangeroepen.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        loadProfileInfoRef.current();
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProfileSaved = async () => {
    await loadProfileInfo();
    onPlayerUpdated?.();
  };

  // Check onboarding flag — auto-open ProfileModal for new players after invite accept
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('onboarding') === 'true') {
      localStorage.removeItem('onboarding');
      setTimeout(() => {
        setIsOnboarding(true);
        setShowProfile(true);
      }, 500);
    }
  }, []);

  // Fetch pending invites count
  useEffect(() => {
    if (!isAdmin || !currentTeam) {
      setPendingCount(0);
      return;
    }

    const fetchCount = () => {
      supabase
        .from('invite_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentTeam.id)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .then(({ count }: { count: number | null }) => setPendingCount(count ?? 0));
    };

    fetchCount();

    if (view === 'invites' || view === 'players-manage') {
      const interval = setInterval(fetchCount, 10_000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, currentTeam, view]);

  // Sluit Beheer-dropdown bij klik buiten
  useEffect(() => {
    if (!showBeheer) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (beheerRef.current && !beheerRef.current.contains(e.target as Node)) {
        setShowBeheer(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBeheer]);

  // Sluit team-switcher dropdown bij klik buiten
  useEffect(() => {
    if (!showTeamSwitcher) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (teamSwitcherRef.current && !teamSwitcherRef.current.contains(e.target as Node)) {
        setShowTeamSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTeamSwitcher]);

  const beheerActive = (ADMIN_VIEWS as readonly string[]).includes(view);

  const navigateTo = (target: string) => {
    setView(target);
    setShowBeheer(false);
  };

  return (
    <>
    {/*
      Nav is split in two parts:
      1. Left: scrollable tabs (overflow-x-auto)
      2. Right: Beheer + profile + logout (flex-shrink-0, no overflow, so dropdown is not clipped)
      This split is needed because overflow-x:auto also sets overflow-y:auto (CSS spec),
      which would clip the absolute-positioned Beheer dropdown.
    */}
    <nav className="flex items-stretch bg-gray-900 border-b border-gray-800 select-none min-h-[52px]">

      {/* Scrollable left side */}
      <div className="flex items-stretch gap-0 overflow-x-auto flex-1 min-w-0 pl-1 sm:pl-2">
        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Home" />
        <NavButton active={view === 'pitch'} onClick={() => setView('pitch')} icon="⚽" label="Wedstrijd" />
        <NavButton active={view === 'uitslagen'} onClick={() => setView('uitslagen')} icon="📋" label="Uitslagen" />
        <NavButton active={view === 'stats'} onClick={() => setView('stats')} icon="📊" label="Ranglijst" />
        <NavButton active={view === 'cards'} onClick={() => setView('cards')} icon="🃏" label="Kaarten" />
      </div>

      {/* Right side: team-switcher + Beheer + profile + logout — NOT inside the overflow div */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 flex-shrink-0 border-l border-gray-800">

        {/* Team-switcher — hier staat het dropdown BUITEN de overflow-x:auto container */}
        <div className="relative" ref={teamSwitcherRef}>
          <button
            onClick={() => setShowTeamSwitcher(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 font-display font-semibold uppercase tracking-wide px-2 py-1.5 hover:bg-gray-800 rounded transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentTeam?.color || '#f59e0b' }}
            />
            <span className="hidden sm:block max-w-[110px] truncate">
              {currentTeam ? currentTeam.name : 'Geen team'}
            </span>
            <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTeamSwitcher && (
            <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 w-56 py-1">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={async () => {
                    await switchTeam(team.id);
                    setShowTeamSwitcher(false);
                    setView('dashboard');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 transition hover:bg-gray-800 ${
                    team.id === currentTeam?.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: team.color || '#f59e0b' }}
                  />
                  <span className="flex-1 truncate font-medium">{team.name}</span>
                  {team.id === currentTeam?.id && (
                    <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-gray-700 mt-1 pt-1">
                <button
                  onClick={() => { setShowTeamSwitcher(false); router.push('/team/new'); }}
                  className="w-full text-left px-3 py-2.5 text-sm text-yellow-400 hover:bg-gray-800 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nieuw team aanmaken
                </button>
              </div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="relative" ref={beheerRef}>
            <button
              onClick={() => setShowBeheer(v => !v)}
              className={`px-2.5 sm:px-3 py-1.5 rounded font-display font-semibold uppercase tracking-wide transition text-xs flex-shrink-0 ${
                beheerActive
                  ? 'bg-yellow-500 text-gray-900'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span className="hidden sm:inline">Beheer {showBeheer ? '▲' : '▼'}</span>
              <span className="sm:hidden">⚙</span>
            </button>

            {showBeheer && (
              <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 w-48 py-1">
                <BeheerItem
                  icon="⚙️"
                  label="Teaminstellingen"
                  active={view === 'team-settings'}
                  onClick={() => navigateTo('team-settings')}
                />
                <BeheerItem
                  icon="🗓️"
                  label="Seizoen"
                  active={view === 'season-settings'}
                  onClick={() => navigateTo('season-settings')}
                />
                <div className="border-t border-gray-800 my-1" />
                <BeheerItem
                  icon="📣"
                  label="Mededelingen"
                  active={view === 'mededelingen'}
                  onClick={() => navigateTo('mededelingen')}
                />
                <BeheerItem
                  icon="📋"
                  label="Instructies"
                  active={view === 'instructions'}
                  onClick={() => navigateTo('instructions')}
                />
                <BeheerItem
                  icon="👥"
                  label="Spelers"
                  active={view === 'players-manage'}
                  onClick={() => navigateTo('players-manage')}
                />
                <BeheerItem
                  icon="📅"
                  label="Wedstrijden"
                  active={view === 'matches-manage'}
                  onClick={() => navigateTo('matches-manage')}
                />
                <div className="relative">
                  <BeheerItem
                    icon="📨"
                    label="Uitnodigingen"
                    active={view === 'invites'}
                    onClick={() => navigateTo('invites')}
                  />
                  {pendingCount > 0 && (
                    <span className="absolute top-1 right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 pointer-events-none">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <div className="border-t border-gray-800 my-1" />
                <BeheerItem
                  icon="💬"
                  label="Feedback"
                  active={view === 'feedback'}
                  onClick={() => navigateTo('feedback')}
                />
              </div>
            )}
          </div>
        )}

        {/* Bel-icoon met ongelezen-badge */}
        <button
          onClick={onBellClick}
          className="relative p-2 hover:bg-gray-800 rounded transition-colors flex-shrink-0"
          title="Activiteit"
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full px-0.5 pointer-events-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profielknop */}
        <button
          onClick={() => setShowProfile(true)}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-gray-600 hover:border-yellow-500 transition-colors flex-shrink-0 focus:outline-none"
          title="Mijn profiel"
        >
          {profileAvatar ? (
            <img src={profileAvatar} alt="Profiel" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-yellow-500 flex items-center justify-center">
              <span className="text-black font-black text-xs">{profileInitials}</span>
            </div>
          )}
        </button>
      </div>
    </nav>

    {showProfile && (
      <ProfileModal
        onClose={() => { setShowProfile(false); setIsOnboarding(false); }}
        onPlayerUpdated={handleProfileSaved}
        onLogout={onLogout}
        welcomeMode={isOnboarding}
      />
    )}
  </>
  );
}

function NavButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 sm:px-4 py-0 font-display font-semibold uppercase tracking-wide transition-colors text-xs sm:text-sm flex-shrink-0 flex items-center gap-1.5 h-full ${
        active
          ? 'text-yellow-400'
          : 'text-gray-500 hover:text-gray-200'
      }`}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{icon}</span>
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 rounded-t" />
      )}
    </button>
  );
}

function BeheerItem({ icon, label, active, onClick }: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-gray-800 flex items-center gap-2 ${
        active ? 'text-yellow-400' : 'text-gray-300'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
