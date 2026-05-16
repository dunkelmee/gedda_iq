'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { LeaderboardEntry } from '@/lib/api';
import AvatarDisplay from '@/components/AvatarDisplay';

const AVATAR_BG = [
  'bg-purple-900/70',
  'bg-green-900/70',
  'bg-blue-900/70',
  'bg-yellow-900/70',
  'bg-pink-900/70',
  'bg-cyan-900/70',
];

function avatarBg(nickname: string) {
  return AVATAR_BG[nickname.charCodeAt(0) % AVATAR_BG.length];
}

const RANK_COLORS = ['text-arena-gold', 'text-slate-300', 'text-amber-600'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myNickname, setMyNickname] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gedda_player');
      if (saved) setMyNickname(JSON.parse(saved).nickname ?? '');
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetch('/api/leaderboard')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: LeaderboardEntry[]) => {
        if (!cancelled) { setEntries(data); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setError('Could not load leaderboard.'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4">
        <button
          onClick={() => router.push('/lobby')}
          className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
        >
          ←
        </button>
        <p className="flex-1 text-xs font-black tracking-[0.2em] uppercase text-white">IQ Arena</p>
        <button className="text-slate-500 hover:text-slate-300 transition-colors text-lg">⚙</button>
      </header>

      {/* Title */}
      <div className="px-5 pb-4">
        <h2 className="text-2xl font-black text-white">Leaderboard</h2>
        <p className="text-slate-400 text-sm mt-0.5">All-time rankings by wins</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card p-10 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-slate-500 text-xs mt-1">Is the backend running?</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-3xl mb-3">🏆</div>
            <p className="text-slate-400 text-sm">No matches played yet.</p>
            <p className="text-slate-500 text-xs mt-1">Complete a match to appear here!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => {
              const isMe = entry.nickname.toLowerCase() === myNickname.toLowerCase();
              return (
                <div
                  key={entry.nickname}
                  className={`card px-4 py-3 flex items-center gap-3 transition-colors
                    ${isMe ? 'border-purple-500/60 bg-purple-500/5' : 'hover:border-arena-border/80'}`}
                >
                  {/* Rank */}
                  <div className="w-8 shrink-0 text-center">
                    {i < 3 ? (
                      <span className="text-lg leading-none">{RANK_MEDALS[i]}</span>
                    ) : (
                      <span className={`text-sm font-black tabular-nums ${i < 3 ? RANK_COLORS[i] : 'text-slate-500'}`}>
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full ${avatarBg(entry.nickname)} shrink-0
                                  border border-purple-500/30 flex items-center justify-center text-lg`}>
                    <AvatarDisplay avatar={entry.avatar} />
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>
                        {entry.nickname}
                      </p>
                      {isMe && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 shrink-0">YOU</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {entry.totalGames} game{entry.totalGames !== 1 ? 's' : ''} · {entry.avgAccuracy}% acc
                    </p>
                  </div>

                  {/* W/L */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white tabular-nums">
                      <span className="text-green-400">{entry.wins}</span>
                      <span className="text-slate-600">-</span>
                      <span className="text-red-400">{entry.losses}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{entry.winRate}% win rate</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm
                      bg-arena-surface/95 backdrop-blur border-t border-arena-border">
        <div className="flex pb-2">
          {([
            { icon: '🏟️', label: 'Lobby',       path: '/lobby' },
            { icon: '🏆', label: 'Leaderboard', path: '/leaderboard' },
            { icon: '🎯', label: 'Training',    path: null },
            { icon: '👥', label: 'Social',      path: null },
          ] as { icon: string; label: string; path: string | null }[]).map(({ icon, label, path: dest }) => (
            <button
              key={label}
              onClick={dest ? () => router.push(dest) : undefined}
              className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-1 transition-colors
                ${dest === '/leaderboard' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
