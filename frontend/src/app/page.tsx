'use client';
// trigger build
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';

const AVATARS = ['⚡', '🔥', '🎮', '🦁', '🐺', '🦊', '🐉', '🎯', '💎', '🌟', '🦅', '🐯'];

export default function LoginPage() {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('⚡');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gedda_player');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.nickname) setNickname(p.nickname);
        if (p.avatar) setAvatar(p.avatar);
      }
    } catch {}
  }, []);

  const handleEnter = () => {
    const name = nickname.trim();
    if (!name) { setError('Enter a nickname to continue'); return; }
    if (name.length < 2) { setError('Nickname must be at least 2 characters'); return; }

    setLoading(true);
    setError('');

    localStorage.setItem('gedda_player', JSON.stringify({ nickname: name, avatar }));

    const socket = connectSocket();

    const doJoin = () => {
      socket.emit('join_lobby', { nickname: name, avatar });
      router.push('/lobby');
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      socket.once('connect_error', () => {
        setLoading(false);
        setError('Cannot connect to server. Is the backend running on port 4000?');
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto px-5">
      {/* Top bar */}
      <header className="flex items-center justify-between pt-6 pb-2">
        <span className="text-xs font-black tracking-[0.2em] uppercase text-white">IQ Arena</span>
        <button className="text-slate-500 hover:text-slate-300 transition-colors text-lg">⚙</button>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center pt-10 pb-8">
        <div className="relative mb-7">
          <div className="w-24 h-24 rounded-full bg-purple-900/40 border border-purple-500/40
                          flex items-center justify-center glow-ring">
            <span className="text-5xl">{avatar}</span>
          </div>
          <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-xl -z-10" />
        </div>

        <h2 className="text-5xl font-black italic leading-tight tracking-tight text-center">
          <span className="text-gradient inline-block py-0.5">BATTLE</span>
          <br />
          <span className="text-gradient inline-block py-0.5">READY</span>
        </h2>
        <p className="text-slate-400 text-sm mt-4 text-center leading-relaxed">
          Prove your mental dominance in the arena.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-6 flex-1">
        {/* Nickname */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.15em] mb-2">
            Choose your nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
            maxLength={20}
            placeholder="Enter Codename"
            className="w-full bg-transparent border border-arena-border rounded-xl px-5 py-4
                       text-white text-lg font-bold placeholder-slate-600 tracking-wider
                       focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40
                       transition-colors"
            disabled={loading}
          />
          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
        </div>

        {/* Avatar picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.15em]">
              Select Avatar
            </label>
            <span className="text-xs text-slate-600">Swipe to browse</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                disabled={loading}
                className={`shrink-0 w-16 h-16 rounded-full border-2 text-2xl
                            flex items-center justify-center transition-all duration-150
                            ${avatar === a
                              ? 'border-purple-500 bg-purple-900/40 glow-ring'
                              : 'border-arena-border bg-arena-surface hover:border-purple-500/50'
                            }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-2 pb-10">
          <button
            onClick={handleEnter}
            disabled={loading || !nickname.trim()}
            className="btn-primary w-full text-base tracking-widest uppercase"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entering Arena...
              </span>
            ) : (
              'Enter Arena →'
            )}
          </button>

          <button className="w-full mt-4 text-slate-500 text-sm hover:text-slate-300 transition-colors text-center">
            ⊙ How to play?
          </button>
        </div>
      </div>
    </div>
  );
}
