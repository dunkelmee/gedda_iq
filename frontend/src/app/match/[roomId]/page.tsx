'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import type { MatchData, MatchResult, Question } from '@/lib/types';

type Phase = 'loading' | 'countdown' | 'playing' | 'finished' | 'results';

const ANSWER_FEEDBACK_MS = 420;
const LABELS = ['A', 'B', 'C', 'D'];

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MatchPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');

  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);

  const [streak, setStreak] = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);

  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<number | null>(null);
  const [questionKey, setQuestionKey] = useState(0);

  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentAnswered, setOpponentAnswered] = useState(0);

  const [myResult, setMyResult] = useState<MatchResult | null>(null);
  const [opponentResult, setOpponentResult] = useState<MatchResult | null>(null);

  const [myAvatar, setMyAvatar] = useState('⚡');
  const [myNickname, setMyNickname] = useState('YOU');

  const startTimeRef = useRef<number>(0);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gedda_player');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.avatar) setMyAvatar(p.avatar);
        if (p.nickname) setMyNickname(p.nickname);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let data: MatchData | null = null;
    try {
      const raw = sessionStorage.getItem(`match_${roomId}`);
      if (raw) data = JSON.parse(raw);
    } catch {}

    if (!data) { router.replace('/lobby'); return; }

    setMatchData(data);
    startTimeRef.current = data.startTime;
    setPhase('countdown');
  }, [roomId, router]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const interval = setInterval(() => {
      const remaining = startTimeRef.current - Date.now();
      if (remaining <= 0) {
        setPhase('playing');
        clearInterval(interval);
      } else {
        setCountdown(Math.ceil(remaining / 1000));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      const remaining = startTimeRef.current + 60_000 - Date.now();
      const secs = Math.max(0, Math.ceil(remaining / 1000));
      setTimeLeft(secs);
      if (remaining <= 0) {
        setPhase('finished');
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const onAnswerResult = ({ score: newScore }: { questionIndex: number; correct: boolean; correctAnswer: number; score: number }) => {
      setScore(newScore);
    };

    const onOpponentUpdate = ({ score: os, answeredCount }: { score: number; answeredCount: number }) => {
      setOpponentScore(os);
      setOpponentAnswered(answeredCount);
    };

    const onMatchEnd = ({ myResult: mr, opponentResult: or }: { myResult: MatchResult; opponentResult: MatchResult }) => {
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
      setMyResult(mr);
      setOpponentResult(or);
      setScore(mr.score);
      setCorrect(mr.correct);
      setWrong(mr.wrong);
      setPhase('results');
      sessionStorage.removeItem(`match_${roomId}`);
    };

    socket.on('answer_result', onAnswerResult);
    socket.on('opponent_update', onOpponentUpdate);
    socket.on('match_end', onMatchEnd);

    return () => {
      socket.off('answer_result', onAnswerResult);
      socket.off('opponent_update', onOpponentUpdate);
      socket.off('match_end', onMatchEnd);
    };
  }, [roomId]);

  const handleAnswer = useCallback((choice: number) => {
    if (selectedChoice !== null || phase !== 'playing' || !matchData) return;

    const q = matchData.questions[questionIndex];
    if (!q) return;

    const isCorrect = choice === q.correctAnswer;

    setScore(prev => prev + (isCorrect ? 1 : -2));
    if (isCorrect) {
      setCorrect(prev => prev + 1);
      setStreak(prev => {
        const next = prev + 1;
        setHighestStreak(h => Math.max(h, next));
        return next;
      });
    } else {
      setWrong(prev => prev + 1);
      setStreak(0);
    }

    setSelectedChoice(choice);
    setLastCorrectAnswer(q.correctAnswer);
    getSocket().emit('submit_answer', { roomId, questionIndex, answer: choice });

    answerTimerRef.current = setTimeout(() => {
      setSelectedChoice(null);
      setLastCorrectAnswer(null);
      setQuestionIndex(prev => prev + 1);
      setQuestionKey(prev => prev + 1);
    }, ANSWER_FEEDBACK_MS);
  }, [selectedChoice, phase, matchData, questionIndex, roomId]);

  useEffect(() => {
    if (phase !== 'playing' || !matchData) return;
    const q = matchData.questions[questionIndex];
    if (!q) return;

    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      const idx = map[e.key.toLowerCase()];
      if (idx !== undefined && q.choices[idx] !== undefined) {
        handleAnswer(q.choices[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, matchData, questionIndex, handleAnswer]);

  useEffect(() => {
    return () => {
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    };
  }, []);

  // ── Loading ──
  if (phase === 'loading' || !matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Results ──
  if (phase === 'results' && myResult && opponentResult) {
    return (
      <ResultsScreen
        my={myResult}
        opponent={opponentResult}
        myAvatar={myAvatar}
        highestStreak={highestStreak}
        onLobby={() => router.push('/lobby')}
      />
    );
  }

  // ── Countdown ──
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 max-w-sm mx-auto px-5">
        <div className="text-center">
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-4">Match starting in</p>
          <div className="text-[9rem] font-black text-gradient leading-none animate-pop">{countdown}</div>
        </div>
        <div className="card px-6 py-4 flex items-center gap-4 w-full">
          <div className="w-12 h-12 rounded-full bg-purple-900/50 border border-purple-500/30
                          flex items-center justify-center text-2xl shrink-0">
            {matchData.opponent.avatar}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Your Opponent</p>
            <p className="font-bold text-white text-lg">{matchData.opponent.nickname}</p>
          </div>
        </div>
        <p className="text-slate-600 text-xs">Press A B C D or 1 2 3 4 to answer</p>
      </div>
    );
  }

  // ── Arena ──
  const currentQuestion: Question | undefined = matchData.questions[questionIndex];
  const timerDanger = timeLeft <= 10 && phase === 'playing';
  const timerWarning = timeLeft <= 20 && timeLeft > 10;

  // Score bar: how far left/right the needle sits (50% = tied)
  const scoreDiff = score - opponentScore;
  const myBarPct = Math.max(8, Math.min(92, 50 + Math.max(-30, Math.min(30, scoreDiff)) * (42 / 30)));

  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto px-4">
      {/* Header */}
      <header className="flex items-center gap-3 pt-5 pb-3">
        <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/30
                        flex items-center justify-center text-base shrink-0">
          {myAvatar}
        </div>
        <p className="flex-1 text-xs font-black tracking-[0.2em] uppercase text-white">IQ Arena</p>
        <button className="text-slate-500 hover:text-slate-300 transition-colors">⚙</button>
      </header>

      {/* Timer */}
      <div className="flex justify-center py-3">
        <div className={`flex items-center gap-2 px-5 py-2 rounded-full border transition-colors
          ${timerDanger
            ? 'border-red-500/60 bg-red-500/10 glow-ring animate-timer-pulse'
            : timerWarning
              ? 'border-yellow-500/60 bg-yellow-500/10'
              : 'border-arena-cyan/40 bg-arena-cyan/5 glow-cyan'
          }`}>
          <span className="text-sm">⏱</span>
          <span className={`text-2xl font-black tabular-nums leading-none
            ${timerDanger ? 'text-red-400' : timerWarning ? 'text-yellow-400' : 'text-arena-cyan'}`}>
            {phase === 'finished' ? '00:00' : formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Scores */}
      <div className="pt-1 pb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">You</p>
            <p className="text-3xl font-black text-white leading-none tabular-nums">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wider truncate max-w-[120px]">
              {matchData.opponent.nickname}
            </p>
            <p className="text-3xl font-black text-arena-pink leading-none tabular-nums">{opponentScore}</p>
          </div>
        </div>
        {/* Score bar */}
        <div className="h-1.5 w-full bg-arena-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-arena-cyan transition-all duration-300"
            style={{ width: `${myBarPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-600 mt-1 text-right">{opponentAnswered} answered</p>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        {phase === 'finished' ? (
          <div className="text-center animate-fade-in py-12">
            <div className="text-5xl mb-4">⏱️</div>
            <p className="text-xl font-bold text-white">Time&apos;s up!</p>
            <p className="text-slate-400 text-sm mt-1">Calculating results...</p>
            <div className="mt-4 w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : currentQuestion ? (
          <div key={questionKey} className="animate-slide-in-right">
            {/* Question card */}
            <div className="card p-6 text-center mb-4 relative">
              {streak >= 2 && (
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-arena-gold/20
                                 border border-arena-gold/40 text-arena-gold text-xs font-black
                                 tracking-wider animate-streak-pop">
                  {streak}X STREAK!
                </span>
              )}
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Current Problem</p>
              <p className="text-4xl font-black text-white tracking-tight">
                {currentQuestion.expression}
              </p>
            </div>

            {/* Choices */}
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.choices.map((choice, i) => {
                const isSelected = selectedChoice === choice;
                const isCorrect = lastCorrectAnswer === choice;
                const wasWrong = isSelected && !isCorrect;
                const showRight = selectedChoice !== null && isCorrect;

                return (
                  <button
                    key={`${questionKey}-${i}`}
                    onClick={() => handleAnswer(choice)}
                    disabled={selectedChoice !== null}
                    className={`
                      relative p-5 rounded-2xl border-2 font-black text-3xl tabular-nums
                      flex flex-col items-center justify-center gap-1
                      transition-all duration-100
                      ${selectedChoice === null
                        ? 'border-arena-border bg-arena-card hover:border-purple-500/60 hover:bg-purple-500/10 active:scale-95 cursor-pointer'
                        : showRight
                          ? 'border-green-500 bg-green-500/20 text-green-300'
                          : wasWrong
                            ? 'border-red-500 bg-red-500/20 text-red-300'
                            : 'border-arena-border bg-arena-surface text-slate-600 opacity-50'
                      }
                    `}
                  >
                    <span className={`absolute top-2.5 left-3.5 text-xs font-bold
                      ${selectedChoice === null ? 'text-slate-500' :
                        showRight ? 'text-green-400' :
                        wasWrong ? 'text-red-400' : 'text-slate-600'}`}>
                      {LABELS[i]}
                    </span>
                    <span className="text-white">{choice}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-slate-600 text-xs mt-3">
              Press A B C D or 1 2 3 4
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">All questions answered! Waiting for time...</p>
          </div>
        )}
      </div>

      <div className="pb-6" />
    </div>
  );
}

// ── ResultsScreen ─────────────────────────────────────────────────────────────

function ResultsScreen({
  my, opponent, myAvatar, highestStreak, onLobby,
}: {
  my: MatchResult;
  opponent: MatchResult;
  myAvatar: string;
  highestStreak: number;
  onLobby: () => void;
}) {
  const nav = useRouter();
  const isDraw = my.draw;
  const iWon = my.won;
  const forfeitWin = opponent.forfeit;
  const forfeitLoss = my.forfeit;

  const accuracy = my.accuracy ?? 0;
  const apm = my.answersPerMinute ?? 0;

  const headlineText = forfeitLoss ? 'DEFEAT' : (isDraw ? 'DRAW' : iWon ? 'VICTORY' : 'DEFEAT');
  const headlineClass = (iWon || forfeitWin)
    ? 'text-gradient-victory'
    : isDraw
      ? 'bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent'
      : 'bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent';

  const subText = forfeitWin
    ? 'Opponent disconnected — you win!'
    : forfeitLoss
      ? 'You disconnected'
      : isDraw
        ? 'What a match — dead even!'
        : iWon
          ? `You outscored ${opponent.nickname}`
          : `${opponent.nickname} was faster`;

  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto px-4 pb-24">
      {/* Header */}
      <header className="flex items-center gap-3 pt-5 pb-3">
        <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/30
                        flex items-center justify-center text-base shrink-0">
          {myAvatar}
        </div>
        <p className="flex-1 text-xs font-black tracking-[0.2em] uppercase text-white">IQ Arena</p>
        <button className="text-slate-500 hover:text-slate-300 transition-colors">⚙</button>
      </header>

      {/* Headline */}
      <div className="text-center py-5 animate-fade-in">
        <h2 className={`text-7xl font-black italic leading-none ${headlineClass}`}>
          {headlineText}
        </h2>
        <p className="text-arena-gold text-xs font-bold uppercase tracking-widest mt-3">
          {subText}
        </p>
      </div>

      {/* Total score */}
      <div className="card p-5 mb-3 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white tabular-nums">{my.score}</span>
              <span className="text-sm text-green-400 font-bold">+{Math.max(0, my.score)} XP</span>
            </div>
          </div>
          <span className="text-4xl opacity-60">🏅</span>
        </div>
        <div className="mt-3 h-1 w-full bg-arena-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400"
            style={{ width: `${Math.min(100, Math.max(4, (my.score / 30) * 100))}%` }}
          />
        </div>
      </div>

      {/* Accuracy + APM */}
      <div className="grid grid-cols-2 gap-3 mb-3 animate-fade-in">
        <div className="card p-4 flex flex-col items-center gap-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Accuracy</p>
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e1e58" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke="#22d3ee" strokeWidth="3"
                strokeDasharray={`${accuracy * 0.97} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
              {accuracy}%
            </span>
          </div>
        </div>
        <div className="card p-4 flex flex-col items-center justify-center gap-1">
          <p className="text-xs text-slate-400 uppercase tracking-widest">APM</p>
          <p className="text-4xl font-black text-white tabular-nums">{apm.toFixed(1)}</p>
          <p className="text-xs text-slate-500">Avg. Problems/Min</p>
        </div>
      </div>

      {/* Match Analysis */}
      <div className="card p-4 mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Match Analysis</p>
          <span className="text-slate-500 text-sm">📊</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-cyan pl-3">
            <span className="text-sm text-slate-300">Correct Answers</span>
            <span className="text-lg font-black text-arena-cyan tabular-nums">{my.correct}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-pink pl-3">
            <span className="text-sm text-slate-300">Incorrect Slips</span>
            <span className="text-lg font-black text-arena-pink tabular-nums">{my.wrong}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-gold pl-3">
            <span className="text-sm text-slate-300">Highest Streak</span>
            <span className="text-lg font-black text-arena-gold tabular-nums">{highestStreak}</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 animate-fade-in">
        <button onClick={onLobby} className="btn-outline w-full flex items-center justify-center gap-2">
          ↺ Rematch
        </button>
        <button onClick={onLobby} className="w-full py-4 rounded-xl bg-arena-card border border-arena-border
                                              text-slate-300 font-bold hover:border-slate-500 transition-colors
                                              flex items-center justify-center gap-2">
          🏠 Return to Lobby
        </button>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm
                      bg-arena-surface/95 backdrop-blur border-t border-arena-border">
        <div className="flex pb-2">
          {([
            { icon: '🏟️', label: 'Lobby',       active: false, dest: '/lobby'       },
            { icon: '🏆', label: 'Leaderboard', active: false, dest: '/leaderboard' },
            { icon: '🎯', label: 'Training',    active: false, dest: '/training'    },
            { icon: '👥', label: 'Social',      active: true,  dest: null           },
          ] as { icon: string; label: string; active: boolean; dest: string | null }[]).map(({ icon, label, active, dest }) => (
            <button
              key={label}
              onClick={dest ? () => nav.push(dest) : undefined}
              className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-1 transition-colors
                ${active ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
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
