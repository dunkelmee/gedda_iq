'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Question generation (client-side port of gameEngine.js) ──────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildAddSubChoices(correct: number): number[] {
  const wrongSet = new Set<number>();
  const offsets = shuffle([1, -1, 2, -2, 9, -9, 10, -10, 11, -11, 3, -3, 20, -20]);
  for (const offset of offsets) {
    const v = correct + offset;
    if (v > 0 && v !== correct && !wrongSet.has(v)) {
      wrongSet.add(v);
      if (wrongSet.size === 3) break;
    }
  }
  if (wrongSet.size < 3) {
    const s = String(correct);
    if (s.length === 2) {
      const swapped = parseInt(s[1] + s[0]);
      if (swapped > 0 && swapped !== correct && !wrongSet.has(swapped)) wrongSet.add(swapped);
    }
  }
  let fb = correct + 4;
  while (wrongSet.size < 3) {
    if (!wrongSet.has(fb) && fb !== correct && fb > 0) wrongSet.add(fb);
    fb++;
  }
  return shuffle([correct, ...wrongSet]);
}

function buildMulChoices(a: number, b: number, correct: number): number[] {
  const wrongSet = new Set<number>();
  const candidates = shuffle([
    (a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1),
    correct + a, correct - a, correct + b, correct - b,
    correct + 10, correct - 10, correct + 1, correct - 1,
  ]);
  for (const v of candidates) {
    if (v > 0 && v !== correct && !wrongSet.has(v)) {
      wrongSet.add(v);
      if (wrongSet.size === 3) break;
    }
  }
  let fb = correct + 3;
  while (wrongSet.size < 3) {
    if (!wrongSet.has(fb) && fb !== correct && fb > 0) wrongSet.add(fb);
    fb++;
  }
  return shuffle([correct, ...wrongSet]);
}

interface Question {
  expression: string;
  correctAnswer: number;
  choices: number[];
}

function nextQuestion(): Question {
  if (Math.random() < 0.33) {
    const a = rand(12, 29);
    const b = rand(2, 9);
    const correct = a * b;
    return { expression: `${a} × ${b} = ?`, correctAnswer: correct, choices: buildMulChoices(a, b, correct) };
  }
  const isAdd = Math.random() < 0.5;
  let a = rand(10, 99);
  let b = rand(10, 99);
  if (!isAdd && a < b) [a, b] = [b, a];
  const correct = isAdd ? a + b : a - b;
  return {
    expression: isAdd ? `${a} + ${b} = ?` : `${a} − ${b} = ?`,
    correctAnswer: correct,
    choices: buildAddSubChoices(correct),
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ANSWER_FEEDBACK_MS = 420;
const LABELS = ['A', 'B', 'C', 'D'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<'playing' | 'results'>('playing');
  const [question, setQuestion] = useState<Question>(() => nextQuestion());
  const [questionKey, setQuestionKey] = useState(0);

  const [score, setScore]               = useState(0);
  const [correct, setCorrect]           = useState(0);
  const [wrong, setWrong]               = useState(0);
  const [answered, setAnswered]         = useState(0);
  const [streak, setStreak]             = useState(0);
  const [highestStreak, setHighestStreak] = useState(0);

  const [selectedChoice, setSelectedChoice]     = useState<number | null>(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<number | null>(null);

  const [myAvatar, setMyAvatar] = useState('⚡');

  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gedda_player');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.avatar) setMyAvatar(p.avatar);
      }
    } catch {}
  }, []);

  useEffect(() => () => { if (answerTimerRef.current) clearTimeout(answerTimerRef.current); }, []);

  const handleAnswer = useCallback((choice: number) => {
    if (selectedChoice !== null || phase !== 'playing') return;

    const isCorrect = choice === question.correctAnswer;

    setScore(prev => prev + (isCorrect ? 1 : -2));
    setAnswered(prev => prev + 1);

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
    setLastCorrectAnswer(question.correctAnswer);

    answerTimerRef.current = setTimeout(() => {
      setSelectedChoice(null);
      setLastCorrectAnswer(null);
      setQuestion(nextQuestion());
      setQuestionKey(k => k + 1);
    }, ANSWER_FEEDBACK_MS);
  }, [selectedChoice, phase, question]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
      const idx = map[e.key.toLowerCase()];
      if (idx !== undefined && question.choices[idx] !== undefined) handleAnswer(question.choices[idx]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, handleAnswer]);

  // ── Results ──
  if (phase === 'results') {
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col max-w-sm mx-auto px-4 pb-24">
        <header className="flex items-center gap-3 pt-5 pb-3">
          <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/30
                          flex items-center justify-center text-base shrink-0">
            {myAvatar}
          </div>
          <p className="flex-1 text-xs font-black tracking-[0.2em] uppercase text-white">IQ Arena</p>
        </header>

        <div className="text-center py-6 animate-fade-in">
          <h2 className="text-6xl font-black italic leading-none text-gradient">DONE</h2>
          <p className="text-slate-400 text-sm mt-3">Session complete</p>
        </div>

        <div className="card p-5 mb-3 animate-fade-in">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Score</p>
          <p className="text-4xl font-black text-white tabular-nums">{score}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 animate-fade-in">
          <div className="card p-4 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Accuracy</p>
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e1e58" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#22d3ee" strokeWidth="3"
                  strokeDasharray={`${accuracy * 0.97} 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                {accuracy}%
              </span>
            </div>
          </div>
          <div className="card p-4 flex flex-col items-center justify-center gap-1">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Answered</p>
            <p className="text-4xl font-black text-white tabular-nums">{answered}</p>
          </div>
        </div>

        <div className="card p-4 mb-4 animate-fade-in">
          <p className="text-sm font-bold text-white mb-3">Session Breakdown</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-cyan pl-3">
              <span className="text-sm text-slate-300">Correct</span>
              <span className="text-lg font-black text-arena-cyan tabular-nums">{correct}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-pink pl-3">
              <span className="text-sm text-slate-300">Incorrect</span>
              <span className="text-lg font-black text-arena-pink tabular-nums">{wrong}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-l-2 border-arena-gold pl-3">
              <span className="text-sm text-slate-300">Best Streak</span>
              <span className="text-lg font-black text-arena-gold tabular-nums">{highestStreak}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 animate-fade-in">
          <button
            onClick={() => {
              setPhase('playing');
              setScore(0); setCorrect(0); setWrong(0);
              setAnswered(0); setStreak(0); setHighestStreak(0);
              setSelectedChoice(null); setLastCorrectAnswer(null);
              setQuestion(nextQuestion()); setQuestionKey(0);
            }}
            className="btn-primary w-full"
          >
            Train Again
          </button>
          <button onClick={() => router.push('/lobby')}
            className="btn-outline w-full">
            ← Back to Lobby
          </button>
        </div>

        <BottomNav active="training" router={router} />
      </div>
    );
  }

  // ── Playing ──
  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto px-4 pb-24">
      <header className="flex items-center gap-3 pt-5 pb-3">
        <div className="w-8 h-8 rounded-full bg-purple-900/50 border border-purple-500/30
                        flex items-center justify-center text-base shrink-0">
          {myAvatar}
        </div>
        <p className="flex-1 text-xs font-black tracking-[0.2em] uppercase text-white">Training</p>
        <button
          onClick={() => setPhase('results')}
          className="text-xs font-bold text-slate-400 hover:text-white transition-colors px-3 py-1.5
                     border border-arena-border rounded-lg"
        >
          End Session
        </button>
      </header>

      {/* Live stats bar */}
      <div className="flex items-center gap-3 px-1 pb-4 pt-1">
        <div className="flex-1 card px-3 py-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Score</p>
          <p className="text-xl font-black text-white tabular-nums leading-none mt-0.5">{score}</p>
        </div>
        <div className="flex-1 card px-3 py-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Correct</p>
          <p className="text-xl font-black text-arena-cyan tabular-nums leading-none mt-0.5">{correct}</p>
        </div>
        <div className="flex-1 card px-3 py-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Wrong</p>
          <p className="text-xl font-black text-arena-pink tabular-nums leading-none mt-0.5">{wrong}</p>
        </div>
        <div className="flex-1 card px-3 py-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Streak</p>
          <p className={`text-xl font-black tabular-nums leading-none mt-0.5
            ${streak >= 3 ? 'text-arena-gold' : 'text-white'}`}>{streak}</p>
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div key={questionKey} className="animate-slide-in-right">
          <div className="card p-6 text-center mb-4 relative">
            {streak >= 2 && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-arena-gold/20
                               border border-arena-gold/40 text-arena-gold text-xs font-black
                               tracking-wider animate-streak-pop">
                {streak}X STREAK!
              </span>
            )}
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Current Problem</p>
            <p className="text-4xl font-black text-white tracking-tight">{question.expression}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {question.choices.map((choice, i) => {
              const isSelected = selectedChoice === choice;
              const isCorrect  = lastCorrectAnswer === choice;
              const wasWrong   = isSelected && !isCorrect;
              const showRight  = selectedChoice !== null && isCorrect;

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
                      wasWrong  ? 'text-red-400'   : 'text-slate-600'}`}>
                    {LABELS[i]}
                  </span>
                  <span className="text-white">{choice}</span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-slate-600 text-xs mt-3">Press A B C D or 1 2 3 4</p>
        </div>
      </div>

      <BottomNav active="training" router={router} />
    </div>
  );
}

// ── BottomNav ─────────────────────────────────────────────────────────────────

function BottomNav({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) {
  const tabs = [
    { icon: '🏟️', label: 'Lobby',       dest: '/lobby'       },
    { icon: '🏆', label: 'Leaderboard', dest: '/leaderboard' },
    { icon: '🎯', label: 'Training',    dest: '/training'    },
    { icon: '👥', label: 'Social',      dest: null           },
  ];
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm
                    bg-arena-surface/95 backdrop-blur border-t border-arena-border">
      <div className="flex pb-2">
        {tabs.map(({ icon, label, dest }) => (
          <button
            key={label}
            onClick={dest ? () => router.push(dest) : undefined}
            className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-1 transition-colors
              ${label.toLowerCase() === active ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
