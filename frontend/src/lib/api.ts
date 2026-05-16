export function backendUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:4000';
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

export interface LeaderboardEntry {
  nickname: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  totalScore: number;
  bestScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalAnswered: number;
  winRate: number;
  avgAccuracy: number;
}
