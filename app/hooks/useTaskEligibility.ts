import { useMemo } from 'react';
import type { Match, Player, TeamSettings } from '../lib/types';
import { isSelectablePlayer } from '../lib/constants';

interface UseTaskEligibilityParams {
  players: Player[];
  matchAbsences: number[];
  selectedMatch: Match | null;
  teamSettings: TeamSettings | null;
  upcomingConceptMatches: Match[];
  upcomingAbsencesMap: Record<number, number[]>;
}

// Afgeleide taak-toewijzing (wasbeurt/consumpties/vervoer) voor de PitchView-toolbar.
// Puur berekend uit de ingaande waarden; geen side effects.
export function useTaskEligibility({
  players,
  matchAbsences,
  selectedMatch,
  teamSettings,
  upcomingConceptMatches,
  upcomingAbsencesMap,
}: UseTaskEligibilityParams) {
  // Wasbeurt
  const wasbeurtEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p) && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => (a.wash_count - b.wash_count) || a.name.localeCompare(b.name)),
    [players, matchAbsences]
  );
  const wasbeurtOverrideId = selectedMatch?.wasbeurt_player_id ?? null;
  const wasbeurtOverridePlayer = wasbeurtOverrideId
    ? players.find((p: Player) => p.id === wasbeurtOverrideId) ?? null
    : null;
  const wasbeurtDisplayPlayer = wasbeurtOverridePlayer ?? wasbeurtEligible[0] ?? null;
  const wasbeurtIsUnavailable = wasbeurtOverridePlayer
    ? (wasbeurtOverridePlayer.injured || matchAbsences.includes(wasbeurtOverridePlayer.id))
    : false;
  const wasbeurtAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p)).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );

  // Consumpties
  const consumptiesEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p) && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => (a.consumption_count - b.consumption_count) || a.name.localeCompare(b.name)),
    [players, matchAbsences]
  );
  const consumptiesOverrideId = selectedMatch?.consumpties_player_id ?? null;
  const consumptiesOverridePlayer = consumptiesOverrideId
    ? players.find((p: Player) => p.id === consumptiesOverrideId) ?? null
    : null;
  const consumptiesDisplayPlayer = consumptiesOverridePlayer ?? consumptiesEligible[0] ?? null;
  const consumptiesIsUnavailable = consumptiesOverridePlayer
    ? (consumptiesOverridePlayer.injured || matchAbsences.includes(consumptiesOverridePlayer.id))
    : false;
  const consumptiesAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p)).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );

  // Vervoer
  const vervoerCount = teamSettings?.vervoer_count ?? 3;
  // Simuleer cumulatieve transport-count t/m de geselecteerde wedstrijd (zelfde logica als UitslagenView)
  // zodat de auto-selectie verandert wanneer je van wedstrijd wisselt.
  const vervoerEffectiveCounts = useMemo(() => {
    const counts = new Map<number, number>(players.filter((p: Player) => !p.is_guest).map((p: Player) => [p.id, p.transport_count]));
    if (!selectedMatch || !(teamSettings?.track_vervoer ?? true)) return counts;
    for (const match of upcomingConceptMatches) {
      if (match.id === selectedMatch.id) break;
      if (match.home_away === 'Thuis') continue;
      const absentIds = new Set(upcomingAbsencesMap[match.id] ?? []);
      const available = players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p) && !p.injured && !absentIds.has(p.id));
      const eligibleList = [...available].sort((a: Player, b: Player) => ((counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0)) || a.name.localeCompare(b.name));
      const usedIds = new Set<number>();
      // Negeer manuele overrides (transport_player_ids) in de simulatie,
      // zodat een handmatige wijziging niet doorwerkt in andere wedstrijden.
      for (let i = 0; i < vervoerCount; i++) {
        const auto = eligibleList.find((p: Player) => !usedIds.has(p.id)) ?? null;
        if (auto) { counts.set(auto.id, (counts.get(auto.id) ?? 0) + 1); usedIds.add(auto.id); }
      }
    }
    return counts;
  }, [selectedMatch?.id, upcomingConceptMatches, upcomingAbsencesMap, players, vervoerCount, teamSettings?.track_vervoer]);

  const vervoerEligible = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p) && !p.injured && !matchAbsences.includes(p.id))
      .sort((a: Player, b: Player) => ((vervoerEffectiveCounts.get(a.id) ?? a.transport_count) - (vervoerEffectiveCounts.get(b.id) ?? b.transport_count)) || a.name.localeCompare(b.name)),
    [players, matchAbsences, vervoerEffectiveCounts]
  );
  const vervoerOverrideIds: number[] = selectedMatch?.transport_player_ids ?? [];
  const vervoerAllPlayers = useMemo(() =>
    players.filter((p: Player) => !p.is_guest && isSelectablePlayer(p)).sort((a: Player, b: Player) => a.name.localeCompare(b.name)),
    [players]
  );
  // Bereken welke speler per slot daadwerkelijk getoond wordt (override → eligible)
  // Iteratief zodat auto-gekozen spelers uit eerdere slots worden overgeslagen
  const vervoerDisplayPlayers: (Player | null)[] = useMemo(() => {
    const result: (Player | null)[] = [];
    const usedIds = new Set<number>();
    for (let i = 0; i < vervoerCount; i++) {
      const overrideId = vervoerOverrideIds[i] ?? null;
      if (overrideId) {
        const op = players.find((p: Player) => p.id === overrideId) ?? null;
        if (op && !op.injured && !matchAbsences.includes(op.id)) {
          result.push(op);
          usedIds.add(op.id);
          continue;
        }
      }
      const auto = vervoerEligible.find(p => !usedIds.has(p.id)) ?? null;
      result.push(auto);
      if (auto) usedIds.add(auto.id);
    }
    return result;
  }, [vervoerCount, vervoerOverrideIds, vervoerEligible, players, matchAbsences]);

  return {
    wasbeurtEligible,
    wasbeurtOverrideId,
    wasbeurtOverridePlayer,
    wasbeurtDisplayPlayer,
    wasbeurtIsUnavailable,
    wasbeurtAllPlayers,
    consumptiesEligible,
    consumptiesOverrideId,
    consumptiesOverridePlayer,
    consumptiesDisplayPlayer,
    consumptiesIsUnavailable,
    consumptiesAllPlayers,
    vervoerCount,
    vervoerEligible,
    vervoerOverrideIds,
    vervoerAllPlayers,
    vervoerDisplayPlayers,
  };
}
