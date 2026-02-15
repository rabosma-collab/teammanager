'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '../lib/auth';
import { useTeamContext } from '../contexts/TeamContext';

interface NavbarProps {
  view: string;
  setView: (view: string) => void;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export default function Navbar({
  view,
  setView,
  isAdmin,
  onLogout,
  onToggleSidebar
}: NavbarProps) {
  const router = useRouter();
  const { currentTeam } = useTeamContext();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
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
        </>
      )}

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {!isAdmin && (
          <span className="px-3 py-1.5 bg-gray-700 rounded text-xs sm:text-sm text-gray-300 font-medium">
            Speler
          </span>
        )}
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
