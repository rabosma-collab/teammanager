import React from 'react';

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
  onLogin,
  onLogout,
  onToggleSidebar
}: NavbarProps) {
  return (
    <nav className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-800 border-b border-gray-700 select-none">
      {view === 'pitch' && (
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-gray-700 rounded"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <NavButton active={view === 'pitch'} onClick={() => setView('pitch')} icon="⚽" label="Tactiekveld" />
      <NavButton active={view === 'stats'} onClick={() => setView('stats')} icon="📊" label="Ranglijst" />

      {isAdmin && (
        <NavButton active={view === 'instructions'} onClick={() => setView('instructions')} icon="📋" label="Instructies" />
      )}

      {!isAdmin ? (
        <button
          onClick={onLogin}
          className="ml-auto px-3 sm:px-6 py-2 bg-yellow-500 text-black rounded font-bold hover:bg-yellow-400 text-sm sm:text-base"
        >
          <span className="hidden sm:inline">🔒 Admin</span>
          <span className="sm:hidden">🔒</span>
        </button>
      ) : (
        <button
          onClick={onLogout}
          className="ml-auto px-3 sm:px-6 py-2 bg-red-500 rounded font-bold hover:bg-red-600 text-sm sm:text-base"
        >
          <span className="hidden sm:inline">🔓 Logout</span>
          <span className="sm:hidden">🔓</span>
        </button>
      )}
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
      className={`px-3 sm:px-6 py-2 rounded font-bold transition text-sm sm:text-base ${
        active ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
      }`}
    >
      <span className="hidden sm:inline">{icon} {label}</span>
      <span className="sm:hidden">{icon}</span>
    </button>
  );
}