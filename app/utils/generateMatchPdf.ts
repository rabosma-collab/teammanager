import type { Match, Player, Substitution, PositionInstruction, SubstitutionScheme } from '../lib/types';
import { formationLabels, DEFAULT_GAME_FORMAT } from '../lib/constants';

const POSITION_ORDER = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'];
const POSITION_EMOJIS: Record<string, string> = {
  Keeper: '🧤', Verdediger: '🛡️', Middenvelder: '⚙️', Aanvaller: '⚡',
};

export interface MatchPdfData {
  match: Match;
  players: Player[];
  fieldOccupants: (Player | null)[];
  substitutions: Substitution[];
  matchAbsences: number[];
  positionInstructions: PositionInstruction[];
  scheme: SubstitutionScheme | null;
  teamName?: string;
  teamColor?: string;
  gameFormat?: string;
}

export function generateMatchPdf(data: MatchPdfData): void {
  const { match, players, fieldOccupants, substitutions, matchAbsences, positionInstructions, scheme, teamName, teamColor, gameFormat } = data;
  const color = teamColor || '#f59e0b';
  const fmt = gameFormat ?? DEFAULT_GAME_FORMAT;
  const getFormationLabel = (formation: string) => formationLabels[fmt]?.[formation] ?? formation;

  const fieldPlayers = fieldOccupants.filter((p): p is Player => p !== null);
  const fieldIds = new Set(fieldPlayers.map(p => p.id));

  const groupedField = POSITION_ORDER.map(pos => ({
    position: pos,
    players: fieldPlayers.filter(p => p.position === pos),
  })).filter(g => g.players.length > 0);

  const bankPlayers = players.filter(
    p => !p.is_guest && !fieldIds.has(p.id) && !p.injured && !matchAbsences.includes(p.id)
  );
  const absentPlayers = players.filter(p => !p.is_guest && matchAbsences.includes(p.id));
  const injuredPlayers = players.filter(p => !p.is_guest && p.injured);

  const eligibleForWash = players
    .filter(p => !p.is_guest && !p.injured && !matchAbsences.includes(p.id))
    .sort((a, b) => (a.wash_count - b.wash_count) || a.name.localeCompare(b.name));
  const wasbeurtSpeler = eligibleForWash[0] ?? null;

  const sortedSubs = [...substitutions].sort((a, b) => a.substitution_number - b.substitution_number);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const getMinuteForSub = (sub: Substitution): string => {
    if (sub.custom_minute != null) return `${sub.custom_minute}'`;
    if (scheme && scheme.minutes.length > 0) {
      const min = scheme.minutes[sub.substitution_number - 1];
      return min != null ? `${min}'` : '–';
    }
    return '–';
  };

  const chip = (name: string, accent: string, muted = false) =>
    `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;background:${muted ? '#1f2937' : accent + '22'};border:1px solid ${muted ? '#374151' : accent + '66'};color:${muted ? '#9ca3af' : '#f9fafb'};margin:2px">${name}</span>`;

  const sectionHeader = (title: string) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:20px 0 10px">
      <div style="width:3px;height:16px;background:${color};border-radius:2px;flex-shrink:0"></div>
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af">${title}</span>
    </div>`;

  const generatedDate = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Wedstrijdrapport – ${match.opponent}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #111827;
    color: #f9fafb;
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 40px;
    max-width: 794px;
    margin: 0 auto;
  }
  @media print {
    body { padding: 20px; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- Printknop -->
<div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
  <button onclick="window.close()" style="padding:8px 18px;background:#374151;color:#f9fafb;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">
    ← Terug
  </button>
  <button onclick="window.print()" style="padding:8px 18px;background:${color};color:#111827;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">
    🖨️ Afdrukken / Opslaan als PDF
  </button>
</div>

<!-- Header -->
<div style="border-left:6px solid ${color};padding-left:16px;margin-bottom:32px">
  <div style="font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">
    ${teamName || 'Team Manager'}
  </div>
  <div style="font-size:28px;font-weight:900;color:#ffffff;margin-bottom:4px">
    ${match.home_away === 'Thuis' ? '🏠' : '✈️'} vs ${match.opponent}
  </div>
  <div style="font-size:14px;color:#9ca3af">
    ${formatDate(match.date)} · ${match.home_away} · ${getFormationLabel(match.formation)}
  </div>
  ${match.goals_for != null && match.goals_against != null
    ? `<div style="font-size:22px;font-weight:900;color:#facc15;margin-top:6px">${match.goals_for} – ${match.goals_against}</div>`
    : ''}
</div>

<!-- Opstelling -->
${sectionHeader('Opstelling')}
${groupedField.length > 0
  ? groupedField.map(group => `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">
      <div style="width:120px;flex-shrink:0;font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding-top:4px">
        ${POSITION_EMOJIS[group.position] || ''} ${group.position}
      </div>
      <div>${group.players.map(p => chip(p.name, color)).join('')}</div>
    </div>`).join('')
  : '<div style="color:#6b7280;font-size:13px">Geen opstelling ingesteld</div>'
}

${bankPlayers.length > 0 ? `
${sectionHeader('Bank')}
<div style="margin-bottom:4px">${bankPlayers.map(p => chip(p.name, '#6b7280', true)).join('')}</div>
` : ''}

${(sortedSubs.length > 0 || scheme) ? `
${sectionHeader('Wissels')}
${scheme ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:8px">Schema: <strong style="color:#d1d5db">${scheme.name}</strong>${scheme.minutes.length > 0 ? ' · minuten: ' + scheme.minutes.map(m => m + "'").join(', ') : ' (vrije wissels)'}</div>` : ''}
${sortedSubs.length > 0 ? sortedSubs.map(sub => {
  const out = players.find(p => p.id === sub.player_out_id);
  const inn = players.find(p => p.id === sub.player_in_id);
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px">
    <span style="color:#6b7280;width:36px;flex-shrink:0">${getMinuteForSub(sub)}</span>
    <span style="color:#f87171">⬇ ${out?.name ?? '–'}</span>
    <span style="color:#4ade80">⬆ ${inn?.name ?? '–'}</span>
  </div>`;
}).join('') : '<div style="font-size:12px;color:#6b7280">Nog geen spelers toegewezen aan wissels</div>'}
` : ''}

${wasbeurtSpeler ? `
${sectionHeader('Wasbeurt')}
<div style="font-size:14px;color:#93c5fd;margin-bottom:4px">
  🧺 <strong style="color:#ffffff">${wasbeurtSpeler.name}</strong>
  <span style="color:#6b7280;margin-left:8px">(${wasbeurtSpeler.wash_count}× gewassen)</span>
</div>
` : ''}

${(absentPlayers.length > 0 || injuredPlayers.length > 0) ? `
${sectionHeader('Afwezigen')}
<div style="margin-bottom:4px">
  ${injuredPlayers.map(p => chip(`🏥 ${p.name}`, '#ef4444', true)).join('')}
  ${absentPlayers.map(p => chip(`❌ ${p.name}`, '#f97316', true)).join('')}
</div>
` : ''}

${positionInstructions.length > 0 ? `
${sectionHeader('Positie-instructies')}
${positionInstructions.map(instr => {
  const tipRow = (emoji: string, label: string, items: string[]) =>
    items.length > 0
      ? `<div style="margin-top:4px;font-size:11px;color:#9ca3af"><span style="margin-right:4px">${emoji}</span><strong style="color:#d1d5db">${label}:</strong> ${items.join(' · ')}</div>`
      : '';
  return `<div style="margin-bottom:14px;padding:10px 12px;background:#1f2937;border-radius:8px;border:1px solid #374151">
    <div style="font-size:13px;font-weight:700;color:#f9fafb;margin-bottom:2px">${instr.position_name}</div>
    ${instr.title ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:4px;font-style:italic">${instr.title}</div>` : ''}
    ${tipRow('💡', 'Algemeen', instr.general_tips || [])}
    ${tipRow('⚽', 'Met bal', instr.with_ball || [])}
    ${tipRow('🛡️', 'Zonder bal', instr.without_ball || [])}
  </div>`;
}).join('')}
` : ''}

<!-- Footer -->
<div style="border-top:1px solid #374151;padding-top:16px;margin-top:32px;font-size:11px;color:#6b7280;display:flex;justify-content:space-between">
  <span>Team Manager</span>
  <span>Gegenereerd op ${generatedDate}</span>
</div>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Kan geen venster openen. Sta pop-ups toe voor deze pagina.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
