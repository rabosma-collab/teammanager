'use client';

import React, { useEffect } from 'react';
import type { ActivityLogItem } from '../hooks/useActivityLog';
import ActivityItem from './ActivityItem';

interface Props {
  open: boolean;
  onClose: () => void;
  activities: ActivityLogItem[];
  loading: boolean;
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
}

export default function ActivitySlideOver({
  open,
  onClose,
  activities,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  unreadCount,
}: Props) {
  // Sluit bij Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base">Activiteit</h2>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full px-1">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Alles gelezen
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-700/50">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              Laden...
            </div>
          )}

          {!loading && activities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm">Nog geen activiteit</p>
            </div>
          )}

          {!loading && activities.map((item) => (
            <ActivityItem key={item.id} item={item} onRead={onMarkAsRead} />
          ))}
        </div>
      </div>
    </>
  );
}
