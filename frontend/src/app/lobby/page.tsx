'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket, getSocket } from '@/lib/socket';
import type { LobbyPlayer, MatchData, StoredPlayer } from '@/lib/types';
import AvatarDisplay from '@/components/AvatarDisplay';

interface IncomingChallenge {
  challengeId: string;
  challenger: { socketId: string; nickname: string; avatar: string };
}

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface DmMessage {
  id: string;
  fromSocketId: string;
  fromNickname: string;
  fromAvatar: string;
  message: string;
  timestamp: number;
  mine: boolean;
}

let toastId = 0;

const AVATAR_BG = [
  'bg-purple-900/70',
  'bg-green-900/70',
  'bg-blue-900/70',
  'bg-yellow-900/70',
  'bg-pink-900/70',
  'bg-cyan-900/70',
];

function avatarBg(id: string) {
  return AVATAR_BG[id.charCodeAt(0) % AVATAR_BG.length];
}

export default function LobbyPage() {
  const router = useRouter();
  const [players, setPlayers]         = useState<LobbyPlayer[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [waitingForNickname, setWaitingForNickname] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mySocketId, setMySocketId] = useState<string>('');

  const [conversations, setConversations] = useState<Record<string, DmMessage[]>>({});
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const activeChatRef = useRef<string | null>(null);

  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    let player: StoredPlayer | null = null;
    try {
      const saved = localStorage.getItem('gedda_player');
      if (saved) player = JSON.parse(saved);
    } catch {}

    if (!player?.nickname) { router.replace('/'); return; }

    const socket = connectSocket();

    const updateId = () => setMySocketId(socket.id ?? '');
    socket.on('connect', updateId);
    if (socket.id) updateId();

    const announce = () => {
      updateId();
      socket.emit('join_lobby', { nickname: player!.nickname, avatar: player!.avatar });
    };
    if (socket.connected) announce();
    else socket.once('connect', announce);

    const onLobbyUpdate = (list: LobbyPlayer[]) => {
      setPlayers(list);
      setActiveChat(prev => {
        if (prev && !list.find(p => p.socketId === prev)) {
          activeChatRef.current = null;
          return null;
        }
        return prev;
      });
    };

    const onChallengeIncoming = (data: IncomingChallenge) => {
      setIncomingChallenge(data);
      if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
      challengeTimerRef.current = setTimeout(() => {
        setIncomingChallenge(null);
        addToast('Challenge expired', 'info');
      }, 28_000);
    };

    const onChallengeSent = ({ targetNickname }: { targetNickname: string; challengeId: string }) => {
      setWaitingForNickname(targetNickname);
    };

    const onChallengeRejected = ({ nickname }: { nickname: string }) => {
      setPendingChallengeId(null);
      setWaitingForNickname(null);
      addToast(`${nickname} declined your challenge`, 'error');
    };

    const onChallengeExpired = () => {
      setPendingChallengeId(null);
      setWaitingForNickname(null);
      addToast('Challenge expired', 'info');
    };

    const onChallengeError = (msg: string) => {
      setPendingChallengeId(null);
      setWaitingForNickname(null);
      addToast(msg, 'error');
    };

    const onMatchStart = (data: MatchData) => {
      sessionStorage.setItem(`match_${data.roomId}`, JSON.stringify(data));
      router.push(`/match/${data.roomId}`);
    };

    const onDmReceived = (msg: {
      fromSocketId: string;
      fromNickname: string;
      fromAvatar: string;
      message: string;
      timestamp: number;
    }) => {
      const newMsg: DmMessage = { ...msg, id: `${msg.fromSocketId}-${msg.timestamp}`, mine: false };
      setConversations(prev => ({
        ...prev,
        [msg.fromSocketId]: [...(prev[msg.fromSocketId] ?? []), newMsg],
      }));
      if (activeChatRef.current !== msg.fromSocketId) {
        setUnread(prev => ({ ...prev, [msg.fromSocketId]: (prev[msg.fromSocketId] ?? 0) + 1 }));
        addToast(`💬 ${msg.fromNickname}: ${msg.message.slice(0, 40)}`, 'info');
      }
    };

    socket.on('lobby_update', onLobbyUpdate);
    socket.on('challenge_incoming', onChallengeIncoming);
    socket.on('challenge_sent', onChallengeSent);
    socket.on('challenge_rejected', onChallengeRejected);
    socket.on('challenge_expired', onChallengeExpired);
    socket.on('challenge_error', onChallengeError);
    socket.on('match_start', onMatchStart);
    socket.on('dm_received', onDmReceived);

    return () => {
      socket.off('connect', updateId);
      socket.off('lobby_update', onLobbyUpdate);
      socket.off('challenge_incoming', onChallengeIncoming);
      socket.off('challenge_sent', onChallengeSent);
      socket.off('challenge_rejected', onChallengeRejected);
      socket.off('challenge_expired', onChallengeExpired);
      socket.off('challenge_error', onChallengeError);
      socket.off('match_start', onMatchStart);
      socket.off('dm_received', onDmReceived);
      if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
    };
  }, [router, addToast]);

  const sendChallenge = (targetSocketId: string) => {
    getSocket().emit('send_challenge', { targetSocketId });
    setPendingChallengeId(targetSocketId);
  };

  const cancelChallenge = () => {
    setPendingChallengeId(null);
    setWaitingForNickname(null);
  };

  const respondChallenge = (accept: boolean) => {
    if (!incomingChallenge) return;
    if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current);
    getSocket().emit('respond_challenge', { challengeId: incomingChallenge.challengeId, accept });
    setIncomingChallenge(null);
    if (!accept) addToast('Challenge declined', 'info');
  };

  const openChat = (socketId: string) => {
    activeChatRef.current = socketId;
    setActiveChat(socketId);
    setUnread(prev => ({ ...prev, [socketId]: 0 }));
  };

  const closeChat = () => {
    activeChatRef.current = null;
    setActiveChat(null);
  };

  const sendDm = (toSocketId: string, text: string) => {
    const socket = getSocket();
    const mine: DmMessage = {
      id: `${socket.id}-${Date.now()}`,
      fromSocketId: socket.id ?? '',
      fromNickname: '',
      fromAvatar: '',
      message: text,
      timestamp: Date.now(),
      mine: true,
    };
    setConversations(prev => ({
      ...prev,
      [toSocketId]: [...(prev[toSocketId] ?? []), mine],
    }));
    socket.emit('send_dm', { toSocketId, message: text });
  };

  const onlinePlayers = players.filter(p => p.socketId !== mySocketId);
  const mePlayer = players.find(p => p.socketId === mySocketId);
  const hasPending = !!pendingChallengeId;
  const activeChatPlayer = activeChat ? players.find(p => p.socketId === activeChat) : null;
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className={`w-9 h-9 rounded-full shrink-0 border border-purple-500/40 flex items-center justify-center text-lg
                        ${mePlayer ? avatarBg(mePlayer.socketId) : 'bg-purple-900/40'}`}>
          <AvatarDisplay avatar={mePlayer?.avatar ?? '👤'} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black tracking-[0.2em] uppercase text-white leading-none">IQ Arena</p>
          {mePlayer && (
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{mePlayer.nickname}</p>
          )}
        </div>
        <button className="text-slate-500 hover:text-slate-300 transition-colors text-lg">⚙</button>
      </header>

      {/* Title + stats */}
      <div className="px-5 pb-2">
        <h2 className="text-2xl font-black text-white">Arena Lobby</h2>
        <p className="text-slate-400 text-sm mt-0.5">Challenge contenders to gain XP</p>
      </div>

      {/* Online players count */}
      <div className="px-5 py-3">
        <p className="text-xs text-slate-400 uppercase tracking-[0.15em] mb-1">Online Players</p>
        <p className="text-5xl font-black text-white leading-none">
          {players.length.toLocaleString()}
        </p>
        <div className="mt-3 h-0.5 w-full bg-arena-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(4, (players.length / 10) * 100))}%` }}
          />
        </div>
      </div>

      {/* Waiting banner */}
      {waitingForNickname && (
        <div className="mx-5 mb-3">
          <div className="card border-purple-500/50 bg-purple-500/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              <span className="text-sm text-purple-300">
                Waiting for <strong>{waitingForNickname}</strong>...
              </span>
            </div>
            <button onClick={cancelChallenge} className="text-xs text-slate-400 hover:text-white transition-colors ml-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contenders list */}
      <div className="flex-1 px-5 pt-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.15em] mb-3">
          Contenders Nearby
        </h3>

        {onlinePlayers.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-3xl mb-3">🏟️</div>
            <p className="text-slate-400 text-sm">No contenders online yet.</p>
            <p className="text-slate-500 text-xs mt-1">Share the link to invite others!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {onlinePlayers.map((p) => (
              <PlayerRow
                key={p.socketId}
                player={p}
                onChallenge={() => sendChallenge(p.socketId)}
                onChat={() => openChat(p.socketId)}
                disabled={hasPending || (mePlayer?.inMatch ?? false)}
                isBeingChallenged={pendingChallengeId === p.socketId}
                isChatOpen={activeChat === p.socketId}
                unreadCount={unread[p.socketId] ?? 0}
                bgClass={avatarBg(p.socketId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-40 w-72 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card px-4 py-3 text-sm font-medium animate-fade-in shadow-xl text-center
              ${t.type === 'error'   ? 'border-red-500/50 text-red-300'   :
                t.type === 'success' ? 'border-green-500/50 text-green-300' :
                'border-purple-500/50 text-purple-300'}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm
                      bg-arena-surface/95 backdrop-blur border-t border-arena-border">
        <div className="flex pb-2">
          {([
            { icon: '🏟️', label: 'Lobby',       active: true,  dest: null },
            { icon: '🏆', label: 'Leaderboard', active: false, dest: '/leaderboard' },
            { icon: '🎯', label: 'Training',    active: false, dest: '/training' },
            { icon: '👥', label: 'Social',      active: false, dest: null, badge: totalUnread > 0 ? totalUnread : undefined },
          ] as { icon: string; label: string; active: boolean; dest: string | null; badge?: number }[]).map(({ icon, label, active, dest, badge }) => (
            <button
              key={label}
              onClick={dest ? () => router.push(dest) : label === 'Social' ? () => {
                const first = onlinePlayers[0];
                if (first && activeChat !== first.socketId) openChat(first.socketId);
              } : undefined}
              className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-1 transition-colors
                ${active ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className="relative text-xl leading-none">
                {icon}
                {badge !== undefined && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[9px]
                                   font-bold rounded-full flex items-center justify-center leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Incoming challenge modal */}
      {incomingChallenge && (
        <ChallengeModal
          challenger={incomingChallenge.challenger}
          onAccept={() => respondChallenge(true)}
          onReject={() => respondChallenge(false)}
        />
      )}

      {/* Chat panel */}
      {activeChat && (
        <ChatPanel
          player={activeChatPlayer ?? { socketId: activeChat, nickname: 'Unknown', avatar: '❓', inMatch: false }}
          messages={conversations[activeChat] ?? []}
          onClose={closeChat}
          onSend={(text) => sendDm(activeChat, text)}
        />
      )}
    </div>
  );
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

function PlayerRow({
  player, onChallenge, onChat, disabled, isBeingChallenged, isChatOpen, unreadCount, bgClass,
}: {
  player: LobbyPlayer;
  onChallenge: () => void;
  onChat: () => void;
  disabled: boolean;
  isBeingChallenged: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  bgClass: string;
}) {
  return (
    <div className="card px-4 py-3 flex items-center gap-3 hover:border-purple-500/40 transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-full ${bgClass} border border-purple-500/30
                        flex items-center justify-center text-xl`}>
          <AvatarDisplay avatar={player.avatar} />
        </div>
        {!player.inMatch && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-arena-card" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{player.nickname}</p>
        <p className={`text-xs mt-0.5 font-medium ${player.inMatch ? 'text-yellow-400' : 'text-slate-500'}`}>
          {player.inMatch ? '⚔ IN MATCH' : 'READY TO DUEL'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onChat}
          className={`relative w-8 h-8 rounded-lg border transition-all duration-150 flex items-center justify-center text-sm
            ${isChatOpen
              ? 'border-purple-500 bg-purple-500/20 text-purple-300'
              : 'border-arena-border text-slate-500 hover:border-purple-500/50 hover:text-purple-300'
            }`}
        >
          💬
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px]
                             font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {player.inMatch ? (
          <span className="px-3 py-1.5 text-xs text-slate-500 font-semibold tracking-wide">BUSY</span>
        ) : (
          <button
            onClick={onChallenge}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-150
              ${isBeingChallenged
                ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                : disabled
                  ? 'border-arena-border text-slate-600 cursor-not-allowed'
                  : 'border-purple-500 bg-purple-600/20 text-purple-300 hover:bg-purple-500/30'
              }`}
          >
            {isBeingChallenged ? '⏳ SENT' : 'CHALLENGE'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── ChallengeModal ────────────────────────────────────────────────────────────

function ChallengeModal({
  challenger, onAccept, onReject,
}: {
  challenger: { socketId: string; nickname: string; avatar: string };
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card p-8 max-w-xs w-full text-center animate-fade-in glow-ring">
        <div className="w-16 h-16 rounded-full bg-purple-900/50 border border-purple-500/40
                        flex items-center justify-center text-3xl mx-auto mb-4">
          <AvatarDisplay avatar={challenger.avatar} />
        </div>
        <h2 className="text-xl font-black text-white mb-1">Challenge!</h2>
        <p className="text-slate-300 text-sm mb-1">
          <strong className="text-purple-300">{challenger.nickname}</strong> wants to duel you
        </p>
        <p className="text-slate-500 text-xs mb-6">60 seconds · Arithmetic Battle</p>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 py-3 rounded-xl border border-arena-border text-slate-300
                       hover:border-red-500/60 hover:text-red-400 transition-all duration-150 font-semibold text-sm"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white
                       font-bold transition-all duration-150 text-sm"
          >
            Accept ⚔️
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

function ChatPanel({
  player, messages, onClose, onSend,
}: {
  player: LobbyPlayer;
  messages: DmMessage[];
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-arena-surface border-l border-arena-border
                    flex flex-col z-40 animate-panel-in shadow-2xl">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-arena-border shrink-0">
        <div className="w-9 h-9 rounded-full bg-purple-900/50 border border-purple-500/30
                        flex items-center justify-center text-lg">
          <AvatarDisplay avatar={player.avatar} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{player.nickname}</p>
          <p className={`text-xs ${player.inMatch ? 'text-yellow-400' : 'text-green-400'}`}>
            {player.inMatch ? '⚔ In Match' : '● Online'}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-slate-600 text-xs text-center mt-8">Say hi to {player.nickname}!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.mine ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug break-words
                ${msg.mine
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-arena-card text-slate-200 rounded-bl-sm'
                }`}
            >
              {msg.message}
            </div>
            <span className="text-[10px] text-slate-600 mt-0.5 px-1">{fmt(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-arena-border shrink-0 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message..."
          maxLength={500}
          className="flex-1 bg-arena-bg border border-arena-border rounded-xl px-3 py-2
                     text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500
                     transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed
                     rounded-xl text-sm font-bold text-white transition-colors"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
