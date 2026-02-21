'use client';

import React, { useState, useEffect } from 'react';
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

  // Laad avatar van de ingelogde speler
  useEffect(() => {
    if (!currentPlayerId) {
      // Manager zonder speler koppeling: toon initialen van email
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) {
          setProfileInitials(user.email.substring(0, 2).toUpperCase());
        }
      });
      return;
    }

    supabase
      .from('players')
      .select('name, avatar_url')
      .eq('id', currentPlayerId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileAvatar(data.avatar_url ?? null);
          setProfileInitials(data.name ? data.name.substring(0, 2).toUpperCase() : '?');
        }
      });
  }, [currentPlayerId]);

  const handleProfileSaved = () => {
    // Herlaad de avatar na opslaan
    if (currentPlayerId) {
      supabase
        .from('players')
        .select('name, avatar_url')
        .eq('id', currentPlayerId)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfileAvatar(data.avatar_url ?? null);
            setProfileInitials(data.name ? data.name.substring(0, 2).toUpperCase() : '?');
          }
        });
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

    // Refresh count when switching to/from invites view
    if (view === 'invites' || view === 'players-manage') {
      const interval = setInterval(fetchCount, 10_000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, currentTeam, view]);

  return (
    <>
    <nav className="flex items-center gap-1.5 sm:gap-3 p-2 sm:p-4 bg-gray-800 border-b border-gray-700 select-none overflow-x-auto">
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

      <NavButton active={view === 'pitch'} onClick={() => setView('pitch')} icon="⚽" label="Tactiekveld" />
      <NavButton active={view === 'stats'} onClick={() => setView('stats')} icon="📊" label="Ranglijst" />
      <NavButton active={view === 'cards'} onClick={() => setView('cards')} icon="🃏" label="Kaarten" />

      {isAdmin && (
        <>
          <NavButton active={view === 'instructions'} onClick={() => setView('instructions')} icon="📋" label="Instructies" />
          <NavButton active={view === 'players-manage'} onClick={() => setView('players-manage')} icon="👥" label="Spelers" />
          <NavButton active={view === 'matches-manage'} onClick={() => setView('matches-manage')} icon="📅" label="Wedstrijden" />
          <div className="relative flex-shrink-0">
            <NavButton active={view === 'invites'} onClick={() => setView('invites')} icon="📨" label="Uitnodigingen" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {pendingCount}
              </span>
            )}
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
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
