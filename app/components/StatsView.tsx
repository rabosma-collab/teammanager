import React, { useState, useMemo } from 'react';
import { positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';

interface StatsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
}

type SortKey = 'name' | 'position' | 'injured' | 'goals' | 'assists' | 'was' | 'min';
type SortDir = 'asc' | 'desc';
type PositionFilter = 'all' | 'Keeper' | 'Verdediger' | 'Middenvelder' | 'Aanvaller';

const positionOrder: Record<string, number> = {
  Keeper: 0,
  Verdediger: 1,
  Middenvelder: 2,
  Aanvaller: 3,
};

const POSITION_FILTERS: { value: PositionFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'Keeper', label: '🧤 Keepers' },
  { value: 'Verdediger', label: '🛡️ Verdedigers' },
  { value: 'Middenvelder', label: '⚙️ Middenvelders' },
  { value: 'Aanvaller', label: '⚡ Aanvallers' },
];

export default function StatsView({ players, isAdmin, onUpdateStat }: StatsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterPosition, setFilterPosition] = useState<PositionFilter>('all');

  const regularPlayers = useMemo(
    () => players.filter(p => !p.is_guest && (filterPosition === 'all' || p.position === filterPosition)),
    [players, filterPosition]
  );

  const sortedPlayers = useMemo(() => {
    const sorted = [...regularPlayers];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'position':
          cmp = (positionOrder[a.position] ?? 99) - (positionOrder[b.position] ?? 99);
          break;
        case 'injured':
          cmp = (a.injured ? 1 : 0) - (b.injured ? 1 : 0);
          break;
        default:
          cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [regularPlayers, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'position' ? 'asc' : 'desc');
    }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Speler' },
    { key: 'position', label: 'Positie' },
    { key: 'injured', label: 'Status' },
    { key: 'goals', label: 'Goals' },
    { key: 'assists', label: 'Assists' },
    { key: 'was', label: 'Was' },
    { key: 'min', label: 'Wissel' },
  ];

  return (
    <div className="p-4 sm:p-8 overflow-x-auto">
      <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">📊 Ranglijst</h2>

      {/* Positie-filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {POSITION_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilterPosition(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${
              filterPosition === f.value
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[600px]">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr className="text-left">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="p-2 sm:p-4 text-sm sm:text-base cursor-pointer select-none hover:bg-gray-600 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIndicator active={sortKey === col.key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map(player => (
              <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                <td className="p-2 sm:p-4 font-bold text-sm sm:text-base">{player.name}</td>
                <td className="p-2 sm:p-4">
                  <span className="text-xs">{positionEmojis[player.position]} {player.position}</span>
                </td>
                <td className="p-2 sm:p-4">
                  {player.injured
                    ? <span className="text-red-500" title="Geblesseerd">🏥</span>
                    : <span className="text-green-500">✓</span>
                  }
                </td>
                <StatCell isAdmin={isAdmin} value={player.goals} field="goals" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.assists} field="assists" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.was} field="was" id={player.id} onUpdate={onUpdateStat} />
                <StatCell isAdmin={isAdmin} value={player.min} field="min" id={player.id} onUpdate={onUpdateStat} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <span className="text-gray-500 text-xs ml-0.5">↕</span>;
  }
  return (
    <span className="text-blue-400 text-xs ml-0.5">
      {dir === 'asc' ? '▲' : '▼'}
    </span>
  );
}

function StatCell({ isAdmin, value, field, id, onUpdate }: {
  isAdmin: boolean;
  value: number;
  field: string;
  id: number;
  onUpdate: (id: number, field: string, value: string) => void;
}) {
  return (
    <td className="p-2 sm:p-4">
      {isAdmin ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onUpdate(id, field, e.target.value)}
          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm touch-manipulation"
        />
      ) : (
        value
      )}
    </td>
  );
}
