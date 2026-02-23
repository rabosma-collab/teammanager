'use client';

import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface Props {
  teamId: string;
  defaultFormation: string;
  onNext: () => void;
  onSkip: () => void;
  onMatchCreated: () => void;
}

export default function StepMatch({ teamId, defaultFormation, onNext, onSkip, onMatchCreated }: Props) {
  const [date, setDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [homeAway, setHomeAway] = useState<'thuis' | 'uit'>('thuis');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!date || !opponent.trim()) {
      setError('Vul een datum en tegenstander in');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('matches').insert({
      team_id: teamId,
      date,
      opponent: opponent.trim(),
      home_away: homeAway,
      formation: defaultFormation,
      match_status: 'concept',
      substitution_scheme_id: null,
    });

    setSaving(false);
    if (insertError) {
      setError('Kon wedstrijd niet aanmaken: ' + insertError.message);
      return;
    }

    setSaved(true);
    onMatchCreated();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black mb-1">Eerste wedstrijd inplannen</h2>
        <p className="text-gray-400 text-sm">Plan alvast je eerste wedstrijd in. Je kan dit ook later doen via Beheer → Wedstrijden.</p>
      </div>

      {!saved ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Tegenstander</label>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="bijv. FC Utrecht"
              maxLength={60}
              className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Thuis / Uit</label>
            <div className="flex gap-2">
              {(['thuis', 'uit'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setHomeAway(opt)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${
                    homeAway === opt
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {opt === 'thuis' ? '🏠 Thuis' : '✈️ Uit'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
          >
            {saving ? 'Opslaan...' : '✅ Wedstrijd aanmaken'}
          </button>
        </div>
      ) : (
        <div className="p-4 bg-green-900/30 border border-green-700 rounded-xl text-green-300 text-sm font-medium">
          ✅ Wedstrijd aangemaakt: <strong>{opponent}</strong> op {new Date(date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} ({homeAway})
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95"
        >
          Doorgaan →
        </button>
        {!saved && (
          <button
            onClick={onSkip}
            className="px-4 py-3 text-gray-400 hover:text-gray-200 font-medium text-sm transition"
          >
            Sla over
          </button>
        )}
      </div>
    </div>
  );
}
