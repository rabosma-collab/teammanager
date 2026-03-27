import type { Match, Player, Substitution } from '../lib/types';
import { formationLabels, DEFAULT_GAME_FORMAT, getPositionCategory } from '../lib/constants';

const POSITION_ORDER = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'];
const POSITION_EMOJIS: Record<string, string> = {
  Keeper: '🧤',
  Verdediger: '🛡️',
  Middenvelder: '⚙️',
  Aanvaller: '⚡',
};

export interface WhatsAppTextData {
  match: Match;
  players: Player[];
  fieldOccupants: (Player | null)[];
  matchAbsences: number[];
  teamName?: string;
  gameFormat?: string;
  substitutions?: Substitution[];
  subMomentMinutes?: number[];
  trackWasbeurt?: boolean;
  trackConsumpties?: boolean;
  trackVervoer?: boolean;
  vervoerCount?: number;
  trackAssemblyTime?: boolean;
  trackMatchTime?: boolean;
  trackLocationDetails?: boolean;
  appUrl?: string;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function generateWhatsAppText(data: WhatsAppTextData): string {
  const {
    match,
    players,
    fieldOccupants,
    matchAbsences,
    teamName,
    gameFormat,
    substitutions = [],
    subMomentMinutes = [],
    trackWasbeurt = true,
    trackConsumpties = true,
    trackVervoer = true,
    vervoerCount = 3,
    trackAssemblyTime = false,
    trackMatchTime = false,
    trackLocationDetails = false,
    appUrl,
  } = data;

  const fmt = gameFormat ?? DEFAULT_GAME_FORMAT;
  const getFormationLabel = (formation: string) =>
    formationLabels[fmt]?.[formation] ?? formation;

  const lines: string[] = [];

  // Header
  const homeAway = match.home_away === 'Thuis' ? '🏠 Thuis' : '✈️ Uit';
  const matchTypeLabel = match.match_type === 'oefenwedstrijd' ? ' (oefenwedstrijd)' : '';
  lines.push(`⚽ *${teamName ? teamName.toUpperCase() : 'WEDSTRIJDINFO'}*`);
  lines.push('');
  lines.push(`📅 ${formatDate(match.date)}`);
  lines.push(`${homeAway} vs *${match.opponent}*${matchTypeLabel}`);

  if (trackAssemblyTime && match.assembly_time) {
    lines.push(`🕐 Verzamelen: *${formatTime(match.assembly_time)}*`);
  }
  if (trackMatchTime && match.match_time) {
    lines.push(`⚽ Aanvang: *${formatTime(match.match_time)}*`);
  }
  if (trackLocationDetails && match.location_details) {
    lines.push(`📍 Kleedkamer: *${match.location_details}*`);
  }

  // Opstelling — alleen tonen als gepubliceerd
  if (match.lineup_published) {
    const fieldIds = new Set(fieldOccupants.filter((p): p is Player => p !== null).map(p => p.id));

    const fieldWithCategories = fieldOccupants
      .map((p, idx) => p ? { player: p, category: getPositionCategory(fmt, match.formation, idx) } : null)
      .filter((x): x is { player: Player; category: string } => x !== null);

    const groupedField = POSITION_ORDER.map(pos => ({
      position: pos,
      players: fieldWithCategories.filter(x => x.category === pos).map(x => x.player),
    })).filter(g => g.players.length > 0);

    if (groupedField.length > 0) {
      lines.push('');
      lines.push(`👕 *OPSTELLING* (${getFormationLabel(match.formation)})`);
      for (const group of groupedField) {
        const emoji = POSITION_EMOJIS[group.position] ?? '';
        const names = group.players.map(p => p.name).join(', ');
        lines.push(`${emoji} ${names}`);
      }

      // Bank
      const bankPlayers = players.filter(
        p => !p.is_guest && !fieldIds.has(p.id) && !p.injured && !matchAbsences.includes(p.id)
      );
      if (bankPlayers.length > 0) {
        lines.push(`🪑 Bank: ${bankPlayers.map(p => p.name).join(', ')}`);
      }
    }
  } else {
    lines.push('');
    lines.push('_Opstelling volgt nog_');
  }

  // Wissels — alleen tonen als er wissels zijn en opstelling gepubliceerd
  if (match.lineup_published && substitutions.length > 0) {
    // Sorteer op wisselmoment (substitution_number), dan custom_minute/minute
    const sorted = [...substitutions].sort((a, b) => a.substitution_number - b.substitution_number);
    lines.push('');
    lines.push('🔄 *WISSELS*');
    for (const sub of sorted) {
      const playerOut = players.find(p => p.id === sub.player_out_id);
      const playerIn = players.find(p => p.id === sub.player_in_id);
      if (!playerOut || !playerIn) continue;
      const minute = sub.custom_minute ?? subMomentMinutes[sub.substitution_number - 1] ?? sub.minute;
      lines.push(`Min. ${minute}: ${playerOut.name} → ${playerIn.name}`);
    }
  }

  // Wasbeurt / consumpties
  const taskLines: string[] = [];

  if (trackWasbeurt) {
    const eligible = players
      .filter(p => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a, b) => (a.wash_count - b.wash_count) || a.name.localeCompare(b.name));
    const override = match.wasbeurt_player_id
      ? players.find(p => p.id === match.wasbeurt_player_id && !p.is_guest && !p.injured && !matchAbsences.includes(p.id)) ?? null
      : null;
    const wasbeurtSpeler = override ?? eligible[0] ?? null;
    if (wasbeurtSpeler) taskLines.push(`🧺 Wasbeurt: *${wasbeurtSpeler.name}*`);
  }

  if (trackConsumpties) {
    const eligible = players
      .filter(p => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a, b) => (a.consumption_count - b.consumption_count) || a.name.localeCompare(b.name));
    const override = match.consumpties_player_id
      ? players.find(p => p.id === match.consumpties_player_id && !p.is_guest && !p.injured && !matchAbsences.includes(p.id)) ?? null
      : null;
    const consumptiesSpeler = override ?? eligible[0] ?? null;
    if (consumptiesSpeler) taskLines.push(`🥤 Consumpties: *${consumptiesSpeler.name}*`);
  }

  if (trackVervoer) {
    const eligible = players
      .filter(p => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
      .sort((a, b) => (a.transport_count - b.transport_count) || a.name.localeCompare(b.name));
    const overrideIds: number[] = match.transport_player_ids ?? [];
    const chauffeurs: string[] = [];
    for (let i = 0; i < vervoerCount; i++) {
      const overrideId = overrideIds[i] ?? null;
      let player = null;
      if (overrideId) {
        player = players.find(p => p.id === overrideId && !p.is_guest && !p.injured && !matchAbsences.includes(p.id)) ?? null;
      }
      if (!player) {
        const usedIds = new Set(chauffeurs.map(n => players.find(p => p.name === n)?.id).filter(Boolean));
        player = eligible.find(p => !usedIds.has(p.id)) ?? null;
      }
      if (player) chauffeurs.push(player.name);
    }
    if (chauffeurs.length > 0) taskLines.push(`🚗 Vervoer: *${chauffeurs.join(', ')}*`);
  }

  if (taskLines.length > 0) {
    lines.push('');
    lines.push(...taskLines);
  }

  // Afwezigen
  const injuredPlayers = players.filter(p => !p.is_guest && p.injured);
  const absentPlayers = players.filter(p => !p.is_guest && matchAbsences.includes(p.id) && !p.injured);

  if (injuredPlayers.length > 0 || absentPlayers.length > 0) {
    lines.push('');
    lines.push('❌ *AFWEZIG*');
    for (const p of injuredPlayers) lines.push(`🏥 ${p.name} (geblesseerd)`);
    for (const p of absentPlayers) lines.push(`❌ ${p.name}`);
  }

  lines.push('');
  if (appUrl) {
    lines.push(`📱 Bekijk de opstelling per wisselmoment in de app: ${appUrl}`);
    lines.push('');
  }
  lines.push('_Verstuurd via Team Manager_');

  return lines.join('\n');
}
