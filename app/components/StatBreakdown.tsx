'use client';

import React, { useEffect, useRef } from 'react';
import type { StatBreakdownData } from '../hooks/useStatBreakdown';

const STAT_LABELS: Record<string, string> = {
  goals: '⚽ Goals',
  assists: '🅰️ Assists',
  wash_count: '🧼 Wasbeurten',
  consumption_count: '🥤 Consumpties',
  transport_count: '🚗 Vervoer',
  yellow_cards: '🟨 Gele kaarten',
  red_cards: '🟥 Rode kaarten',
  min: '🔄 Wissels',
  played_min: '⏱️ Gespeelde min',
};

const STAT_UNIT: Record<string, string> = {
  goals: '⚽',
  assists: '🅰️',
  wash_count: '🧼',
  consumption_count: '🥤',
  transport_count: '🚗',
  yellow_cards: '🟨',
  red_cards: '🟥',
  min: '🔄',
  played_min: 'min',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function formatScore(goalsFor: number | null, goalsAgainst: number | null) {
  if (goalsFor == null || goalsAgainst == null) return '–';
  return `${goalsFor}-${goalsAgainst}`;
}

function scoreColor(goalsFor: number | null, goalsAgainst: number | null) {
  if (goalsFor == null || goalsAgainst == null) return 'text-gray-400';
  if (goalsFor > goalsAgainst) return 'text-green-400';
  if (goalsFor < goalsAgainst) return 'text-red-400';
  return 'text-yellow-400';
}

interface Props {
  data: StatBreakdownData | null;
  loading: boolean;
  onClose: () => void;
}

export default function StatBreakdown({ data, loading, onClose }: Props) {
  const open = loading || data !== null;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const label = data ? (STAT_LABELS[data.stat] ?? data.stat) : '';
  const unit = data ? (STAT_UNIT[data.stat] ?? '') : '';

  // Summary stats
  const homeEntries = data?.entries.filter(e => e.homeAway === 'Thuis') ?? [];
  const awayEntries = data?.entries.filter(e => e.homeAway === 'Uit') ?? [];
  const homeTotal = homeEntries.reduce((s, e) => s + e.value, 0);
  const awayTotal = awayEntries.reduce((s, e) => s + e.value, 0);
  const matchCount = data?.entries.length ?? 0;
  const avg = matchCount > 0 ? ((data?.total ?? 0) / matchCount).toFixed(1) : '0';

  return (
    <>
      {/* ── Mobile: Bottom sheet ── */}
      <div className="md:hidden">
        <MobileBottomSheet open={open} onClose={onClose}>
          {loading ? (
            <LoadingSkeleton />
          ) : data && (
            <>
              <div className="text-center mb-4">
                <p className="text-gray-400 text-sm">{data.playerName}</p>
                <p className="font-bold text-white text-lg">{label}</p>
                <p className="text-3xl font-black text-white mt-1">{data.total}</p>
              </div>

              {data.entries.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">Geen bijdragen dit seizoen</p>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {data.entries.map((entry) => (
                    <div
                      key={entry.matchId}
                      className="flex items-center gap-3 px-3 py-2.5 bg-gray-700/50 rounded-lg"
                    >
                      <span className="text-xs text-gray-400 w-14 shrink-0">{formatDate(entry.date)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white truncate block">
                          {entry.opponent}
                          <span className="text-gray-500 ml-1 text-xs">({entry.homeAway === 'Thuis' ? 'T' : 'U'})</span>
                        </span>
                      </div>
                      <span className={`text-xs font-semibold w-8 text-center ${scoreColor(entry.goalsFor, entry.goalsAgainst)}`}>
                        {formatScore(entry.goalsFor, entry.goalsAgainst)}
                      </span>
                      <span className="text-white font-bold text-sm w-8 text-right shrink-0">
                        {entry.value}{data.stat === 'played_min' ? '' : ''} {unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </MobileBottomSheet>
      </div>

      {/* ── Desktop: Slide-over panel ── */}
      <div className="hidden md:block">
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />

        {/* Panel */}
        <div
          className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
            <div>
              <p className="text-gray-400 text-sm">{data?.playerName}</p>
              <h2 className="font-bold text-lg text-white">{label}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="p-5">
              <LoadingSkeleton />
            </div>
          ) : data && (
            <div className="flex-1 overflow-y-auto">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 p-5">
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-white">{data.total}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Totaal</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-white">{avg}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Gem./wedstrijd</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-white">{matchCount}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Wedstrijden</p>
                </div>
              </div>

              {/* Home/away split */}
              {(homeTotal > 0 || awayTotal > 0) && (
                <div className="flex gap-3 px-5 pb-4">
                  <div className="flex-1 bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">🏠 Thuis</span>
                    <span className="font-bold text-white">{homeTotal}</span>
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">✈️ Uit</span>
                    <span className="font-bold text-white">{awayTotal}</span>
                  </div>
                </div>
              )}

              {/* Match list */}
              <div className="px-5 pb-5">
                {data.entries.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">Geen bijdragen dit seizoen</p>
                ) : (
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 border-b border-gray-700">
                      <span className="text-xs text-gray-500 font-semibold uppercase">Wedstrijd</span>
                      <span className="text-xs text-gray-500 font-semibold uppercase">Score</span>
                      <span className="text-xs text-gray-500 font-semibold uppercase text-right">{STAT_LABELS[data.stat]?.split(' ')[0] ?? ''}</span>
                    </div>
                    {data.entries.map((entry) => (
                      <div
                        key={entry.matchId}
                        className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-3 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-700/30 transition"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-white block truncate">
                            {entry.opponent}
                            <span className="text-gray-500 ml-1.5 text-xs">({entry.homeAway === 'Thuis' ? 'T' : 'U'})</span>
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                        </div>
                        <span className={`text-sm font-semibold ${scoreColor(entry.goalsFor, entry.goalsAgainst)}`}>
                          {formatScore(entry.goalsFor, entry.goalsAgainst)}
                        </span>
                        <span className="text-white font-bold text-right min-w-[2.5rem]">
                          {entry.value} {unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Mobile Bottom Sheet ── */
function MobileBottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60) onClose();
    touchStartY.current = null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div
          className="bg-gray-800 rounded-t-2xl p-4 pb-8 shadow-2xl max-h-[80vh] flex flex-col"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4 shrink-0" />
          <div className="overflow-y-auto flex-1">
            {children}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-semibold transition shrink-0"
          >
            Sluiten
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-1/2 mx-auto" />
      <div className="h-10 bg-gray-700 rounded w-1/3 mx-auto" />
      <div className="space-y-2 mt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 bg-gray-700 rounded" />
        ))}
      </div>
    </div>
  );
}
