import React, { useState, useMemo } from 'react';
import { positionEmojis } from '../lib/constants';
import type { Player, TeamSettings } from '../lib/types';

interface StatsViewProps {
  players: Player[];
  isAdmin: boolean;
  onUpdateStat: (id: number, field: string, value: string) => void;
  teamSettings?: TeamSettings | null;
}

type SortKey = 'name' | 'position' | 'injured' | 'goals' | 'assists' | 'wash_count' | 'consumption_count' | 'transport_count' | 'yellow_cards' | 'red_cards' | 'min' | 'played_min';
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
  consumption_count: '🥤 Consumpties',
  transport_count: '🚗 Vervoer',
  yellow_cards: '🟨 Gele kaarten',
  red_cards: '🟥 Rode kaarten',
  min: '🔄 Wissels',
  played_min: '⏱️ Ges. min',
};

const STAT_LABELS_SHORT: Record<string, string> = {
  goals: '⚽ Goals',
  assists: '🅰️ Assists',
  wash_count: '🧼 Was',
  consumption_count: '🥤 Cons.',
  transport_count: '🚗 Verv.',
  yellow_cards: '🟨 Geel',
  red_cards: '🟥 Rood',
  min: '🔄 Wissel',
  played_min: '⏱️ Min',
};

interface EditingCell {
  playerId: number;
  playerName: string;
  field: string;
  value: number;
}

export default function StatsView({ players, isAdmin, onUpdateStat, teamSettings }: StatsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterPosition, setFilterPosition] = useState<PositionFilter>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [mobileStatField, setMobileStatField] = useState<string | null>(null);

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
          cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
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

  const trackGoals          = teamSettings?.track_goals          ?? true;
  const trackAssists        = teamSettings?.track_assists        ?? true;
  const trackMinutes        = teamSettings?.track_minutes        ?? true;
  const trackPlayedMinutes  = teamSettings?.track_played_minutes ?? false;
  const trackCards          = teamSettings?.track_cards          ?? false;
  const trackWasbeurt       = teamSettings?.track_wasbeurt       ?? true;
  const trackConsumpties    = teamSettings?.track_consumpties    ?? true;
  const trackVervoer        = teamSettings?.track_vervoer        ?? true;

  const statFields = useMemo(
    () => (['goals', 'assists', 'wash_count', 'consumption_count', 'transport_count', 'yellow_cards', 'red_cards', 'min', 'played_min'] as const).filter(f => {
      if (f === 'goals')             return trackGoals;
      if (f === 'assists')           return trackAssists;
      if (f === 'yellow_cards' || f === 'red_cards') return trackCards;
      if (f === 'min')               return trackMinutes;
      if (f === 'played_min')        return trackPlayedMinutes;
      if (f === 'wash_count')        return trackWasbeurt;
      if (f === 'consumption_count') return trackConsumpties;
      if (f === 'transport_count')   return trackVervoer;
      return true;
    }),
    [trackGoals, trackAssists, trackCards, trackMinutes, trackPlayedMinutes, trackWasbeurt, trackConsumpties, trackVervoer]
  );

  const columns: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'Speler' },
    { key: 'position', label: 'Positie' },
    { key: 'injured', label: 'Status' },
    ...(trackGoals          ? [{ key: 'goals'            as SortKey, label: 'Goals'       }] : []),
    ...(trackAssists        ? [{ key: 'assists'           as SortKey, label: 'Assists'     }] : []),
    ...(trackWasbeurt       ? [{ key: 'wash_count'        as SortKey, label: '🧼 Was'     }] : []),
    ...(trackConsumpties    ? [{ key: 'consumption_count' as SortKey, label: '🥤 Cons.'   }] : []),
    ...(trackVervoer        ? [{ key: 'transport_count'   as SortKey, label: '🚗 Verv.'   }] : []),
    ...(trackCards          ? [{ key: 'yellow_cards'      as SortKey, label: '🟨 Geel'    }] : []),
    ...(trackCards          ? [{ key: 'red_cards'         as SortKey, label: '🟥 Rood'    }] : []),
    ...(trackMinutes        ? [{ key: 'min'               as SortKey, label: 'Wissel'     }] : []),
    ...(trackPlayedMinutes  ? [{ key: 'played_min'        as SortKey, label: 'Ges. min'   }] : []),
  ];

  // Mobile: active stat (default to first available)
  const activeMobileStat = mobileStatField ?? statFields[0] ?? null;

  const mobileSortedPlayers = useMemo(() => {
    if (!activeMobileStat) return regularPlayers;
    return [...regularPlayers].sort((a, b) => {
      const diff = ((b as unknown as Record<string, number>)[activeMobileStat] ?? 0) - ((a as unknown as Record<string, number>)[activeMobileStat] ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [regularPlayers, activeMobileStat]);

  const sharedHeader = (
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
  );

  const positionFilterBar = (
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
  );

  return (
    <div className="p-4 sm:p-8">
      {sharedHeader}
      {positionFilterBar}

      {/* ── Mobiel: leaderboard ── */}
      <div className="md:hidden">
        {/* Stat-selector pills */}
        {statFields.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {statFields.map(f => (
              <button
                key={f}
                onClick={() => setMobileStatField(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${
                  activeMobileStat === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {STAT_LABELS_SHORT[f] ?? f}
              </button>
            ))}
          </div>
        )}

        {/* Leaderboard lijst */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {mobileSortedPlayers.map((player, index) => {
            const statValue = activeMobileStat ? ((player as unknown as Record<string, number>)[activeMobileStat] ?? 0) : 0;
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 last:border-b-0"
              >
                {/* Rang */}
                <span className="text-gray-500 text-sm font-bold w-6 text-right shrink-0">
                  {index + 1}
                </span>

                {/* Naam + positie */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white truncate">{player.name}</span>
                    {player.injured && <span className="text-red-500 text-xs">🏥</span>}
                  </div>
                  <span className="text-xs text-gray-400">
                    {positionEmojis[player.position]} {player.position}
                  </span>
                </div>

                {/* Stat waarde */}
                {activeMobileStat && (
                  isEditing ? (
                    <button
                      onClick={() => handleCellClick(player.id, player.name, activeMobileStat, statValue)}
                      className="min-w-[2.5rem] px-2 py-1 bg-gray-700 border border-blue-500/60 rounded text-white text-sm font-bold hover:bg-blue-600/30 hover:border-blue-400 transition"
                    >
                      {statValue}
                    </button>
                  ) : (
                    <span className="text-xl font-black text-white tabular-nums w-8 text-right shrink-0">
                      {statValue}
                    </span>
                  )
                )}
              </div>
            );
          })}

          {mobileSortedPlayers.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">Geen spelers gevonden</p>
          )}
        </div>
      </div>

      {/* ── Desktop: tabel ── */}
      <div className="hidden md:block overflow-x-auto pb-1">
        <div className="bg-gray-800 rounded-lg overflow-hidden min-w-max pr-4">
          <table className="w-full">
            <thead className="bg-gray-700 sticky top-0 z-10">
              <tr className="text-left">
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    className={`p-2 sm:p-4 text-sm sm:text-base select-none transition-colors ${
                      !isEditing ? 'cursor-pointer hover:bg-gray-600' : 'cursor-default'
                    } ${i === 0 ? 'sticky left-0 bg-gray-700 z-20' : ''}`}
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
                  <td className="p-2 sm:p-4 font-bold text-sm sm:text-base sticky left-0 bg-gray-800 z-10">
                    {player.name}
                  </td>
                  <td className="p-2 sm:p-4">
                    <span className="text-xs">{positionEmojis[player.position]} {player.position}</span>
                  </td>
                  <td className="p-2 sm:p-4">
                    {player.injured
                      ? <span className="text-red-500" title="Geblesseerd">🏥</span>
                      : <span className="text-green-500">✓</span>
                    }
                  </td>
                  {statFields.map(field => (
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

      {/* Overlay (gedeeld mobiel + desktop) */}
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
        <div className="text-center mb-1">
          <p className="text-gray-400 text-sm">{playerName}</p>
          <p className="font-bold text-white">{STAT_LABELS[field] ?? field}</p>
        </div>

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
