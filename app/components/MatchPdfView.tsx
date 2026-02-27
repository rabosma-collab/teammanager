'use client';

import React, { forwardRef } from 'react';
import type { Match, Player, Substitution, PositionInstruction, SubstitutionScheme } from '../lib/types';
import { formationLabels, positionEmojis } from '../lib/constants';

interface MatchPdfViewProps {
  match: Match;
  players: Player[];
  fieldOccupants: (Player | null)[];
  substitutions: Substitution[];
  matchAbsences: number[];
  positionInstructions: PositionInstruction[];
  scheme: SubstitutionScheme | null;
  gameFormat: string;
  teamName?: string;
  teamColor?: string;
}

const POSITION_ORDER = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'];

const MatchPdfView = forwardRef<HTMLDivElement, MatchPdfViewProps>(function MatchPdfView(
  { match, players, fieldOccupants, substitutions, matchAbsences, positionInstructions, scheme, gameFormat, teamName, teamColor },
  ref
) {
  const color = teamColor || '#f59e0b';

  // Basisspelers gegroepeerd per positie
  const fieldPlayers = fieldOccupants.filter((p): p is Player => p !== null);

  const groupedField = POSITION_ORDER.map(pos => ({
    position: pos,
    players: fieldPlayers.filter(p => p.position === pos),
  })).filter(g => g.players.length > 0);

  // Bankspelers: niet op het veld, niet afwezig, niet geblesseerd
  const fieldIds = new Set(fieldPlayers.map(p => p.id));
  const bankPlayers = players.filter(
    p => !p.is_guest && !fieldIds.has(p.id) && !p.injured && !matchAbsences.includes(p.id)
  );

  // Afwezigen & geblesseerden
  const absentPlayers = players.filter(p => !p.is_guest && matchAbsences.includes(p.id));
  const injuredPlayers = players.filter(p => !p.is_guest && p.injured);

  // Wasbeurt: gebruik handmatige override als die beschikbaar is, anders laagste wash_count
  const eligibleForWash = players.filter(
    p => !p.is_guest && !p.injured && !matchAbsences.includes(p.id)
  ).sort((a, b) => (a.wash_count - b.wash_count) || a.name.localeCompare(b.name));
  const overrideWasbeurt = match.wasbeurt_player_id
    ? players.find(p => p.id === match.wasbeurt_player_id && !p.is_guest && !p.injured && !matchAbsences.includes(p.id)) ?? null
    : null;
  const wasbeurtSpeler = overrideWasbeurt ?? eligibleForWash[0] ?? null;

  // Wissels
  const sortedSubs = [...substitutions].sort((a, b) => a.substitution_number - b.substitution_number);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const getMinuteForSub = (sub: Substitution) => {
    if (sub.custom_minute != null) return `${sub.custom_minute}'`;
    if (scheme && scheme.minutes.length > 0) {
      const min = scheme.minutes[sub.substitution_number - 1];
      return min != null ? `${min}'` : '–';
    }
    return '–';
  };

  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        minHeight: '1123px',
        background: '#111827',
        color: '#f9fafb',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: '40px',
        boxSizing: 'border-box',
        position: 'absolute',
        left: '-9999px',
        top: 0,
      }}
    >
      {/* Header */}
      <div style={{ borderLeft: `6px solid ${color}`, paddingLeft: '16px', marginBottom: '32px' }}>
        <div style={{ fontSize: '13px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
          {teamName || 'Team Manager'}
        </div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>
          {match.home_away === 'Thuis' ? '🏠' : '✈️'} vs {match.opponent}
        </div>
        <div style={{ fontSize: '14px', color: '#9ca3af' }}>
          {formatDate(match.date)} · {match.home_away} · {formationLabels[gameFormat]?.[match.formation] ?? match.formation}
        </div>
        {match.goals_for != null && match.goals_against != null && (
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#facc15', marginTop: '6px' }}>
            {match.goals_for} – {match.goals_against}
          </div>
        )}
      </div>

      {/* Opstelling */}
      <SectionHeader color={color} title="Opstelling" />
      <div style={{ marginBottom: '24px' }}>
        {groupedField.map(group => (
          <div key={group.position} style={{ marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '120px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {positionEmojis[group.position] || ''} {group.position}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {group.players.map(p => (
                <PlayerChip key={p.id} name={p.name} color={color} />
              ))}
            </div>
          </div>
        ))}
        {fieldPlayers.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>Geen opstelling ingesteld</div>
        )}
      </div>

      {/* Bank */}
      {bankPlayers.length > 0 && (
        <>
          <SectionHeader color={color} title="Bank" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
            {bankPlayers.map(p => (
              <PlayerChip key={p.id} name={p.name} color="#6b7280" muted />
            ))}
          </div>
        </>
      )}

      {/* Wissels */}
      {sortedSubs.length > 0 && (
        <>
          <SectionHeader color={color} title="Wissels" />
          <div style={{ marginBottom: '24px' }}>
            {sortedSubs.map(sub => {
              const playerOut = players.find(p => p.id === sub.player_out_id);
              const playerIn = players.find(p => p.id === sub.player_in_id);
              return (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#6b7280', width: '36px', flexShrink: 0 }}>{getMinuteForSub(sub)}</span>
                  <span style={{ color: '#f87171' }}>⬇ {playerOut?.name ?? '–'}</span>
                  <span style={{ color: '#4ade80' }}>⬆ {playerIn?.name ?? '–'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Wasbeurt */}
      {wasbeurtSpeler && (
        <>
          <SectionHeader color={color} title="Wasbeurt" />
          <div style={{ marginBottom: '24px', fontSize: '14px', color: '#93c5fd' }}>
            🧺 <strong style={{ color: '#ffffff' }}>{wasbeurtSpeler.name}</strong>
            <span style={{ color: '#6b7280', marginLeft: '8px' }}>({wasbeurtSpeler.wash_count}× gewassen)</span>
          </div>
        </>
      )}

      {/* Afwezigen & geblesseerden */}
      {(absentPlayers.length > 0 || injuredPlayers.length > 0) && (
        <>
          <SectionHeader color={color} title="Afwezigen" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
            {injuredPlayers.map(p => (
              <PlayerChip key={p.id} name={`🏥 ${p.name}`} color="#ef4444" muted />
            ))}
            {absentPlayers.map(p => (
              <PlayerChip key={p.id} name={`❌ ${p.name}`} color="#f97316" muted />
            ))}
          </div>
        </>
      )}

      {/* Positie-instructies */}
      {positionInstructions.length > 0 && (
        <>
          <SectionHeader color={color} title="Positie-instructies" />
          <div style={{ marginBottom: '24px' }}>
            {positionInstructions.slice(0, 4).map(instr => (
              <div key={instr.id} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#d1d5db' }}>{instr.position_name}</div>
                {instr.title && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>{instr.title}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #374151', paddingTop: '16px', marginTop: '16px', fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
        <span>Team Manager</span>
        <span>Gegenereerd op {new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  );
});

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <div style={{ width: '3px', height: '16px', background: color, borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>
        {title}
      </span>
    </div>
  );
}

function PlayerChip({ name, color, muted }: { name: string; color: string; muted?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: 600,
      background: muted ? '#1f2937' : `${color}22`,
      border: `1px solid ${muted ? '#374151' : `${color}66`}`,
      color: muted ? '#9ca3af' : '#f9fafb',
    }}>
      {name}
    </span>
  );
}

export default MatchPdfView;
