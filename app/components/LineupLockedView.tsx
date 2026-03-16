"use client";

import React from 'react';
import type { Match } from '../lib/types';

interface LineupLockedViewProps {
  match: Match | null;
}

export default function LineupLockedView({ match }: LineupLockedViewProps) {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Pitch container — zelfde afmetingen als PitchView */}
      <div className="relative w-full max-w-[420px] sm:max-w-[500px] lg:w-[580px] aspect-[3/4] bg-green-900 border-4 border-white/20 rounded-2xl overflow-hidden flex-shrink-0">

        {/* Veld lijnen (decoratief, gedempt) */}
        <div className="absolute inset-0 opacity-20">
          {/* Middenlijn */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
          {/* Middencirkel */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white" />
          {/* Middenpunt */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
          {/* Strafschopgebied boven */}
          <div className="absolute top-0 left-[20%] right-[20%] h-[18%] border-b border-x border-white" />
          {/* Doelgebied boven */}
          <div className="absolute top-0 left-[34%] right-[34%] h-[8%] border-b border-x border-white" />
          {/* Strafschopgebied onder */}
          <div className="absolute bottom-0 left-[20%] right-[20%] h-[18%] border-t border-x border-white" />
          {/* Doelgebied onder */}
          <div className="absolute bottom-0 left-[34%] right-[34%] h-[8%] border-t border-x border-white" />
        </div>

        {/* Donkere overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

        {/* Centered kaart */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl select-none">🔒</div>
          <div className="text-white font-black text-xl leading-tight">
            Opstelling nog niet beschikbaar
          </div>
          {match && (
            <div className="text-gray-300 text-sm">
              {match.opponent} &middot;{' '}
              {new Date(match.date).toLocaleDateString('nl-NL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
          )}
          <div className="text-gray-400 text-xs mt-1">
            De manager maakt de opstelling binnenkort bekend
          </div>
        </div>
      </div>
    </div>
  );
}
