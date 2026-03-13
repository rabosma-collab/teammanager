'use client';

import React, { useState } from 'react';

export default function FeedbackView() {
  const [type, setType] = useState<'bug' | 'wens'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim() }),
      });

      if (!res.ok) throw new Error();
      setStatus('done');
      setTitle('');
      setDescription('');
      setType('bug');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-white mb-1">Feedback</h2>
      <p className="text-sm text-gray-400 mb-6">Meld een bug of dien een wens in. Dit wordt direct opgepakt.</p>

      {status === 'done' ? (
        <div className="bg-green-900/40 border border-green-700 rounded-lg px-4 py-4 text-green-300 text-sm">
          Bedankt! Je melding is opgeslagen.{' '}
          <button
            className="underline text-green-200 ml-1"
            onClick={() => setStatus('idle')}
          >
            Nog een melding indienen
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(['bug', 'wens'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  type === t
                    ? t === 'bug'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {t === 'bug' ? '🐛 Bug' : '💡 Wens'}
              </button>
            ))}
          </div>

          {/* Titel */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Titel</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'Wat gaat er mis?' : 'Wat wil je toevoegen?'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              required
            />
          </div>

          {/* Beschrijving */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Beschrijving</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={
                type === 'bug'
                  ? 'Stap voor stap: wat deed je, wat gebeurde er?'
                  : 'Beschrijf wat je verwacht en waarom het handig zou zijn.'
              }
              rows={5}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none"
              required
            />
          </div>

          {status === 'error' && (
            <p className="text-red-400 text-sm">Er ging iets mis. Probeer het opnieuw.</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending' || !title.trim() || !description.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2.5 rounded-lg text-sm transition-colors"
          >
            {status === 'sending' ? 'Versturen...' : 'Verstuur melding'}
          </button>
        </form>
      )}
    </div>
  );
}
