'use client';

import React, { useState, useEffect } from 'react';

interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

const PREVIEW_COUNT = 2;

function ReleaseNotesSection() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then((data: ChangelogEntry[]) => {
        if (!data?.length) return;
        setEntries(data);

        const seen = localStorage.getItem('releaseNotes_lastSeen');
        const newest = data[0].date;

        if (!seen) {
          localStorage.setItem('releaseNotes_lastSeen', newest);
          setLastSeen(newest);
        } else {
          setLastSeen(seen);
          if (seen < newest) setHasUnread(true);
        }
      })
      .catch(() => {});
  }, []);

  const markRead = () => {
    if (!entries.length) return;
    const newest = entries[0].date;
    localStorage.setItem('releaseNotes_lastSeen', newest);
    setLastSeen(newest);
    setHasUnread(false);
    window.dispatchEvent(new Event('releaseNotesRead'));
  };

  if (!entries.length) return null;

  const displayEntries = showAll ? entries : entries.slice(0, PREVIEW_COUNT);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">Wat is er nieuw?</span>
          {hasUnread && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              nieuw
            </span>
          )}
        </div>
        {hasUnread && (
          <button
            onClick={markRead}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
          >
            Alles gezien ✓
          </button>
        )}
      </div>

      <div className="space-y-4">
        {displayEntries.map((entry) => {
          const isNew = lastSeen ? entry.date > lastSeen : false;
          return (
            <div
              key={entry.date}
              className={`rounded-lg px-4 py-3 border ${
                isNew
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-gray-800/50 border-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold ${isNew ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {entry.title}
                </span>
                {isNew && (
                  <span className="text-[10px] bg-yellow-500 text-black font-bold rounded px-1.5 py-0.5 leading-none">
                    NIEUW
                  </span>
                )}
                <span className="text-xs text-gray-500 ml-auto">{entry.date}</span>
              </div>
              <ul className="space-y-1">
                {entry.items.map((item, j) => (
                  <li key={j} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-gray-600 mt-0.5 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {entries.length > PREVIEW_COUNT && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full text-sm text-gray-400 hover:text-gray-200 py-2 transition-colors"
          >
            {showAll ? 'Minder tonen ↑' : `Lees meer (${entries.length - PREVIEW_COUNT} ouder) ↓`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FeedbackView({ isManager = false }: { isManager?: boolean }) {
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
      {isManager && <ReleaseNotesSection />}

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
