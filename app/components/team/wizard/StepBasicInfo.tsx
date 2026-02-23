'use client';

import React from 'react';

const PRESET_COLORS = [
  { hex: '#f59e0b', name: 'Geel' },
  { hex: '#ef4444', name: 'Rood' },
  { hex: '#3b82f6', name: 'Blauw' },
  { hex: '#22c55e', name: 'Groen' },
  { hex: '#f97316', name: 'Oranje' },
  { hex: '#a855f7', name: 'Paars' },
  { hex: '#ec4899', name: 'Roze' },
  { hex: '#ffffff', name: 'Wit' },
];

interface Props {
  name: string;
  color: string;
  onChangeName: (v: string) => void;
  onChangeColor: (v: string) => void;
  onNext: () => void;
  isLoading: boolean;
  error: string | null;
}

export default function StepBasicInfo({ name, color, onChangeName, onChangeColor, onNext, isLoading, error }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Jouw team aanmaken</h2>
        <p className="text-gray-400 text-sm">Geef je team een naam en een kleur.</p>
      </div>

      {/* Teamnaam */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Teamnaam <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          maxLength={50}
          placeholder="bijv. FC Awesome"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-yellow-500 transition"
          autoFocus
        />
        <div className="flex justify-end mt-1 text-xs text-gray-500">{name.length}/50</div>
      </div>

      {/* Kleur */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Teamkleur</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => onChangeColor(c.hex)}
              title={c.name}
              className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c.hex ? 'border-white scale-110' : 'border-gray-600'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => onChangeColor(e.target.value)}
            className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
            title="Eigen kleur kiezen"
          />
          <span className="text-sm text-gray-400 font-mono">{color}</span>
        </div>
      </div>

      {/* Preview */}
      {name.trim() && (
        <div className="p-3 bg-gray-700/50 rounded-xl flex items-center gap-3">
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-bold text-white">{name.trim()}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={isLoading || name.trim().length < 2}
        className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black rounded-xl text-base transition active:scale-95"
      >
        {isLoading ? 'Team aanmaken...' : 'Doorgaan →'}
      </button>
    </div>
  );
}
