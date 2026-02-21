'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamContext } from '../contexts/TeamContext';
import ProfileModal from './modals/ProfileModal';

interface NavbarProps {
  view: string;
  setView: (view: string) => void;
  isAdmin: boolean;
  onLogout: () => void;
  onToggleSidebar: () => void;
  onPlayerUpdated?: () => void;
}

const ADMIN_VIEWS = ['instructions', 'players-manage', 'matches-manage', 'invites'] as const;

export default function Navbar({
  view,
  setView,
  isAdmin,
  onLogout,
  onToggleSidebar,
  onPlayerUpdated
}: NavbarProps) {
  const { currentTeam, currentPlayerId } = useTeamContext();
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileInitials, setProfileInitials] = useState('?');
  const [showBeheer, setShowBeheer] = useState(false);
  const beheerRef = useRef<HTMLDivElement>(null);

  // Laad avatar van de ingelogde speler
  useEffect(() => {
    (async () => {
      if (!currentPlayerId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setProfileInitials(user.email.substring(0, 2).toUpperCase());
        }
        return;
      }

      const { data } = await supabase
        .from('players')
        .select('name, avatar_url')
        .eq('id', currentPlayerId)
        .single();

      if (data) {
        setProfileAvatar(data.avatar_url ?? null);
        setProfileInitials(data.name ? data.name.substring(0, 2).toUpperCase() : '?');
      }
    })();
  }, [currentPlayerId]);

  const handleProfileSaved = async () => {
    if (currentPlayerId) {
      const { data } = await supabase
        .from('players')
        .select('name, avatar_url')
        .eq('id', currentPlayerId)
        .single();

      if (data) {
        setProfileAvatar(data.avatar_url ?? null);
        setProfileInitials(data.name ? data.name.substring(0, 2).toUpperCase() : '?');
      }
    }
    onPlayerUpdated?.();
  };

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
    <nav className="flex items-stretch bg-gray-800 border-b border-gray-700 select-none">

      {/* Scrollable left side */}
      <div className="flex items-center gap-1.5 sm:gap-3 p-2 sm:p-4 overflow-x-auto flex-1 min-w-0">
        {view === 'pitch' && (
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-700 rounded flex-shrink-0"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {currentTeam && (
          <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-700/50 rounded flex-shrink-0 hidden sm:inline">
            {currentTeam.name}
          </span>
        )}

        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon="🏠" label="Home" />
        <NavButton active={view === 'pitch'} onClick={() => setView('pitch')} icon="⚽" label="Wedstrijd" />
        <NavButton active={view === 'stats'} onClick={() => setView('stats')} icon="📊" label="Ranglijst" />
        <NavButton active={view === 'cards'} onClick={() => setView('cards')} icon="🃏" label="Kaarten" />
      </div>

      {/* Right side: Beheer dropdown + profile + logout — NOT inside the overflow div */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 flex-shrink-0 border-l border-gray-700/50">
        {isAdmin && (
          <div className="relative" ref={beheerRef}>
            <button
              onClick={() => setShowBeheer(v => !v)}
              className={`px-2.5 sm:px-4 py-2 rounded font-bold transition text-xs sm:text-base flex-shrink-0 ${
                beheerActive ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <span className="hidden sm:inline">⚙️ Beheer {showBeheer ? '▲' : '▼'}</span>
              <span className="sm:hidden">⚙️</span>
            </button>

            {showBeheer && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 w-48 py-1">
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
              </div>
            )}
          </div>
        )}

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

        <button
          onClick={onLogout}
          className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium text-sm flex-shrink-0"
        >
          <span className="hidden sm:inline">Uitloggen</span>
          <span className="sm:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </span>
        </button>
      </div>
    </nav>

    {showProfile && (
      <ProfileModal
        onClose={() => setShowProfile(false)}
        onPlayerUpdated={handleProfileSaved}
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
      className={`px-2.5 sm:px-5 py-2 rounded font-bold transition text-xs sm:text-base flex-shrink-0 ${
        active ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
      }`}
    >
      <span className="hidden sm:inline">{icon} {label}</span>
      <span className="sm:hidden">{icon}</span>
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
      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-gray-700 flex items-center gap-2 ${
        active ? 'text-yellow-400 bg-gray-700/50' : 'text-gray-200'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
