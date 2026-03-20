'use client';

import React from 'react';
import type { ActivityLogItem } from '../hooks/useActivityLog';

const TYPE_ICON: Record<string, string> = {
  stat_changed:         '🃏',
  lineup_published:     '📋',
  lineup_unpublished:   '📋',
  lineup_changed:       '📋',
  match_created:        '📅',
  match_result:         '⚽',
  match_cancelled:      '❌',
  match_rescheduled:    '📅',
  voting_opened:        '🗳️',
  vote_cast:            '🗳️',
  spdw_winner:          '🏆',
  absence_changed:      '👤',
  announcement_posted:  '📣',
  player_added:         '👤',
  player_joined:        '🎉',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} u geleden`;
  const days = Math.floor(hours / 24);
  return `${days} d geleden`;
}

function buildText(type: string, payload: Record<string, unknown>): string {
  const p = payload;
  switch (type) {
    case 'stat_changed': {
      const actor = p.actor_name as string ?? 'Iemand';
      const subject = p.subject_name as string ?? 'een speler';
      const stat = (p.stat as string ?? '').toUpperCase();
      const from = p.from as number;
      const to = p.to as number;
      const dir = (to > from) ? 'verhoogde' : 'verlaagde';
      const isSelf = actor === subject;
      return isSelf
        ? `${actor} ${dir} zijn ${stat} van ${from} naar ${to}`
        : `${actor} ${dir} ${subject}'s ${stat} van ${from} naar ${to}`;
    }
    case 'lineup_published': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      return `Opstelling voor ${opp} (${ha}) is bekendgemaakt`;
    }
    case 'lineup_unpublished': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      return `Opstelling voor ${opp} (${ha}) is ingetrokken`;
    }
    case 'announcement_posted': {
      const preview = p.preview as string ?? '';
      return preview ? `Nieuwe mededeling: "${preview}"` : 'Nieuwe mededeling geplaatst';
    }
    case 'match_created': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      const date = p.date ? new Date(p.date as string).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
      return `Nieuwe wedstrijd: ${opp} (${ha})${date ? ` op ${date}` : ''}`;
    }
    case 'match_result': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      const gf = p.goals_for ?? '?';
      const ga = p.goals_against ?? '?';
      return `Uitslag: ${ha === 'thuis' ? 'Wij' : opp} ${gf}–${ga} ${ha === 'thuis' ? opp : 'Wij'}`;
    }
    case 'voting_opened': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      return `Stem op de SPDW van ${opp} (${ha})`;
    }
    case 'vote_cast': {
      const actor = p.actor_name as string ?? 'Iemand';
      const votedFor = p.voted_for_name as string ?? 'een speler';
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      return `${actor} stemde op ${votedFor} als SPDW (${opp} ${ha})`;
    }
    case 'spdw_winner': {
      const name = p.subject_name as string ?? 'Onbekend';
      return `${name} is verkozen tot Speler van de Week!`;
    }
    case 'absence_changed': {
      const actor = p.actor_name as string ?? 'Iemand';
      const available = p.available as boolean;
      const opp = p.opponent as string ?? 'de wedstrijd';
      return available
        ? `${actor} is beschikbaar voor ${opp}`
        : `${actor} heeft zich afgemeld voor ${opp}`;
    }
    case 'lineup_changed': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      return `Opstelling voor ${opp} (${ha}) is gewijzigd`;
    }
    case 'match_cancelled': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      const date = p.date ? new Date(p.date as string).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
      return `Wedstrijd ${opp} (${ha})${date ? ` op ${date}` : ''} is afgelast`;
    }
    case 'match_rescheduled': {
      const opp = p.opponent as string ?? 'onbekend';
      const ha = (p.home_away as string) === 'thuis' ? 'thuis' : 'uit';
      const newDate = p.new_date ? new Date(p.new_date as string).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '';
      return `Wedstrijd ${opp} (${ha}) verzet naar ${newDate || 'nieuwe datum'}`;
    }
    case 'player_added': {
      const name = p.player_name as string ?? 'Nieuwe speler';
      return `${name} is toegevoegd aan de selectie`;
    }
    case 'player_joined': {
      const name = p.player_name as string ?? 'Een speler';
      return `${name} heeft de uitnodiging geaccepteerd`;
    }
    default:
      return type;
  }
}

interface Props {
  item: ActivityLogItem;
  onRead: (id: number) => void;
}

export default function ActivityItem({ item, onRead }: Props) {
  const icon = TYPE_ICON[item.type] ?? '📌';
  const text = buildText(item.type, item.payload);

  return (
    <button
      onClick={() => !item.is_read && onRead(item.id)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-700/50 ${
        item.is_read ? '' : 'bg-blue-900/10'
      }`}
    >
      <span className="text-lg mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${item.is_read ? 'text-gray-300' : 'text-white font-medium'}`}>
          {text}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{relativeTime(item.created_at)}</p>
      </div>
      {!item.is_read && (
        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
      )}
    </button>
  );
}
