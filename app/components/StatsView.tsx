import React, { useState, useMemo } from 'react';
import { positionEmojis } from '../lib/constants';
import type { Player } from '../lib/types';

interface StatsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
}

type SortKey = 'name' | 'position' | 'injured' | 'goals' | 'assists' | 'wash_count' | 'yellow_cards' | 'red_cards' | 'min';
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

const STAT_LABELS: Record<string, string> = {
  goals: '⚽ Goals',
  assists: '🅰️ Assists',
  wash_count: '🧼 Wasbeurten',
  yellow_cards: '🟨 Gele kaarten',
  red_cards: '🟥 Rode kaarten',
  min: '🔄 Wissels',
};

interface EditingCell {
  playerId: number;
  playerName: string;
  field: string;
  value: number;
}

export default function StatsView({ players, isAdmin, onUpdateStat }: StatsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterPosition, setFilterPosition] = useState<PositionFilter>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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
    if (isEditing) return;
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'position' ? 'asc' : 'desc');
    }
  };

  const handleCellClick = (playerId: number, playerName: string, field: string, value: number) => {
    if (!isEditing) return;
    setEditingCell({ playerId, playerName, field, value });
  };

  const handleOverlayStep = (delta: number) => {
    if (!editingCell) return;
    const newValue = Math.max(0, editingCell.value + delta);
    onUpdateStat(editingCell.playerId, editingCell.field, String(newValue));
    setEditingCell({ ...editingCell, value: newValue });
  };

  const handleOverlayClose = () => setEditingCell(null);

  const toggleEditMode = () => {
    setIsEditing(e => !e);
    setEditingCell(null);
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Speler' },
    { key: 'position', label: 'Positie' },
    { key: 'injured', label: 'Status' },
    { key: 'goals', label: 'Goals' },
    { key: 'assists', label: 'Assists' },
    { key: 'wash_count', label: '🧼 Was' },
    { key: 'yellow_cards', label: '🟨 Geel' },
    { key: 'red_cards', label: '🟥 Rood' },
    { key: 'min', label: 'Wissel' },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">📊 Ranglijst</h2>
        {isAdmin && (
          <button
            onClick={toggleEditMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${
              isEditing
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {isEditing ? '✓ Klaar' : '✏️ Bewerken'}
          </button>
        )}
      </div>

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

      <div className="overflow-x-auto pb-1">
        <div className="bg-gray-800 rounded-lg overflow-hidden min-w-max pr-4">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr className="text-left">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`p-2 sm:p-4 text-sm sm:text-base select-none transition-colors ${
                      !isEditing ? 'cursor-pointer hover:bg-gray-600' : 'cursor-default'
                    }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {!isEditing && <SortIndicator active={sortKey === col.key} dir={sortDir} />}
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
                  {(['goals', 'assists', 'wash_count', 'yellow_cards', 'red_cards', 'min'] as const).map(field => (
                    <StatCell
                      key={field}
                      isEditing={isEditing}
                      value={player[field] ?? 0}
                      field={field}
                      playerId={player.id}
                      playerName={player.name}
                      onCellClick={handleCellClick}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overlay */}
      {editingCell && (
        <StatEditOverlay
          playerName={editingCell.playerName}
          field={editingCell.field}
          value={editingCell.value}
          onStep={handleOverlayStep}
          onClose={handleOverlayClose}
        />
      )}
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

function StatCell({ isEditing, value, field, playerId, playerName, onCellClick }: {
  isEditing: boolean;
  value: number;
  field: string;
  playerId: number;
  playerName: string;
  onCellClick: (playerId: number, playerName: string, field: string, value: number) => void;
}) {
  return (
    <td className="p-2 sm:p-4">
      {isEditing ? (
        <button
          onClick={() => onCellClick(playerId, playerName, field, value)}
          className="min-w-[2.5rem] px-2 py-1 bg-gray-700 border border-blue-500/60 rounded text-white text-sm font-bold hover:bg-blue-600/30 hover:border-blue-400 transition cursor-pointer"
        >
          {value}
        </button>
      ) : (
        <span className="text-sm sm:text-base">{value}</span>
      )}
    </td>
  );
}

function StatEditOverlay({ playerName, field, value, onStep, onClose }: {
  playerName: string;
  field: string;
  value: number;
  onStep: (delta: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-xs shadow-2xl border border-gray-700"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-1">
          <p className="text-gray-400 text-sm">{playerName}</p>
          <p className="font-bold text-white">{STAT_LABELS[field] ?? field}</p>
        </div>

        {/* Value + controls */}
        <div className="flex items-center justify-center gap-6 my-6">
          <button
            onClick={() => onStep(-1)}
            disabled={value <= 0}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-3xl font-bold transition flex items-center justify-center"
          >
            −
          </button>

          <span className="text-5xl font-black text-white w-16 text-center tabular-nums">
            {value}
          </span>

          <button
            onClick={() => onStep(1)}
            className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white text-3xl font-bold transition flex items-center justify-center"
          >
            +
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition"
        >
          Klaar
        </button>
      </div>
    </div>
  );
}
