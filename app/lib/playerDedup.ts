import type { Player } from './types';

// Samengestelde sleutel: gast- en reguliere spelers delen dezelfde id-ruimte niet.
const idKey = (p: Player) => `${p.is_guest ? 'g' : 'r'}_${p.id}`;
const nameKey = (p: Player) => `${p.is_guest ? 'g' : 'r'}_${p.name.toLowerCase().trim()}`;

// Verwijder dubbele spelers op basis van (gast/regulier + id). Behoudt de eerste.
export function dedupePlayersById<T extends Player>(players: T[]): T[] {
  const seen = new Map<string, T>();
  for (const p of players) {
    const k = idKey(p);
    if (!seen.has(k)) seen.set(k, p);
  }
  return Array.from(seen.values());
}

// Dedup op id én daarna op naam (een gast en reguliere speler met dezelfde naam mogen naast elkaar bestaan).
export function dedupePlayersByIdThenName<T extends Player>(players: T[]): T[] {
  const seen = new Set<string>();
  return dedupePlayersById(players).filter(p => {
    const k = nameKey(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
