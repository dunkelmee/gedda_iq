export interface LobbyPlayer {
  socketId: string;
  nickname: string;
  avatar: string;
  inMatch: boolean;
}

export interface Question {
  id: number;
  expression: string;
  correctAnswer: number;
  choices: number[];
}

export interface MatchData {
  roomId: string;
  questions: Question[];
  startTime: number;
  opponent: {
    socketId: string;
    nickname: string;
    avatar: string;
  };
}

export interface MatchResult {
  socketId: string;
  nickname: string;
  avatar: string;
  score: number;
  correct: number;
  wrong: number;
  answered: number;
  accuracy: number;
  answersPerMinute: number;
  won: boolean;
  draw: boolean;
  forfeit: boolean;
}

export interface StoredPlayer {
  nickname: string;
  avatar: string;
}
