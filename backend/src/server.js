'use strict';
// trigger build
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { generateQuestions } = require('./gameEngine');
const { init, updatePlayerStats, getLeaderboard } = require('./stats');

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 4000;
const MATCH_DURATION_MS = 60_000;
const PRE_MATCH_DELAY_MS = 3_500;
const QUESTION_COUNT = 80;

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/leaderboard', async (_, res) => {
  try {
    res.json(await getLeaderboard());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ── In-memory state ──────────────────────────────────────────────────────────

/** @type {Map<string, { socketId: string, nickname: string, avatar: string, inMatch: boolean }>} */
const lobby = new Map();

/** @type {Map<string, { challengeId: string, challengerSocketId: string, challengedSocketId: string }>} */
const challenges = new Map();

// Track the active outgoing challenge per socket
const activeChallengeBySocket = new Map();

/**
 * @typedef {{ socketId: string, nickname: string, avatar: string, score: number, correct: number, wrong: number, questionIndex: number, finished: boolean }} RoomPlayer
 * @type {Map<string, { roomId: string, players: Record<string, RoomPlayer>, questions: any[], startTime: number, timer: any, ended: boolean }>}
 */
const rooms = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function broadcastLobby() {
  io.emit('lobby_update', Array.from(lobby.values()));
}

function endMatch(roomId, forfeitSocketId = null) {
  const room = rooms.get(roomId);
  if (!room || room.ended) return;
  room.ended = true;
  clearTimeout(room.timer);

  const [p1, p2] = Object.values(room.players);

  let winnerId = null;
  if (forfeitSocketId) {
    winnerId = [p1, p2].find(p => p.socketId !== forfeitSocketId)?.socketId ?? null;
  } else if (p1.score > p2.score) {
    winnerId = p1.socketId;
  } else if (p2.score > p1.score) {
    winnerId = p2.socketId;
  }

  const buildResult = (player) => {
    const forfeited = player.socketId === forfeitSocketId;
    const answered = forfeited ? 0 : player.questionIndex;
    const correct = forfeited ? 0 : player.correct;
    return {
      socketId: player.socketId,
      nickname: player.nickname,
      avatar: player.avatar,
      score: forfeited ? 0 : player.score,
      correct,
      wrong: forfeited ? 0 : player.wrong,
      answered,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      answersPerMinute: answered, // match is exactly 60s so this equals per-minute
      won: player.socketId === winnerId,
      draw: winnerId === null,
      forfeit: forfeited,
    };
  };

  const r1 = buildResult(p1);
  const r2 = buildResult(p2);
  io.to(p1.socketId).emit('match_end', { myResult: r1, opponentResult: r2 });
  io.to(p2.socketId).emit('match_end', { myResult: r2, opponentResult: r1 });

  updatePlayerStats(r1).catch(err => console.error('stats update failed:', err));
  updatePlayerStats(r2).catch(err => console.error('stats update failed:', err));

  // Restore lobby presence
  [p1.socketId, p2.socketId].forEach(id => {
    const lp = lobby.get(id);
    if (lp) lp.inMatch = false;
  });

  rooms.delete(roomId);
  broadcastLobby();
}

// ── Socket handlers ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] connected: ${socket.id}`);

  socket.on('join_lobby', ({ nickname, avatar }) => {
    lobby.set(socket.id, {
      socketId: socket.id,
      nickname: String(nickname ?? 'Anon').trim().slice(0, 20) || 'Anon',
      avatar: String(avatar ?? '🎮').slice(0, 4),
      inMatch: false,
    });
    broadcastLobby();
  });

  socket.on('send_challenge', ({ targetSocketId }) => {
    if (targetSocketId === socket.id) return;
    const challenger = lobby.get(socket.id);
    const target = lobby.get(targetSocketId);

    if (!challenger || !target) return socket.emit('challenge_error', 'Player not found');
    if (target.inMatch) return socket.emit('challenge_error', 'Player is in a match');

    // Cancel previous outgoing challenge
    const prevId = activeChallengeBySocket.get(socket.id);
    if (prevId) {
      challenges.delete(prevId);
      activeChallengeBySocket.delete(socket.id);
    }

    const challengeId = uuidv4();
    challenges.set(challengeId, {
      challengeId,
      challengerSocketId: socket.id,
      challengedSocketId: targetSocketId,
    });
    activeChallengeBySocket.set(socket.id, challengeId);

    io.to(targetSocketId).emit('challenge_incoming', {
      challengeId,
      challenger: { socketId: socket.id, nickname: challenger.nickname, avatar: challenger.avatar },
    });
    socket.emit('challenge_sent', { targetNickname: target.nickname, challengeId });

    // Auto-expire after 30 s
    setTimeout(() => {
      if (challenges.has(challengeId)) {
        challenges.delete(challengeId);
        activeChallengeBySocket.delete(socket.id);
        socket.emit('challenge_expired', { challengeId });
      }
    }, 30_000);
  });

  socket.on('respond_challenge', ({ challengeId, accept }) => {
    const challenge = challenges.get(challengeId);
    if (!challenge) return;
    challenges.delete(challengeId);
    activeChallengeBySocket.delete(challenge.challengerSocketId);

    const challenger = lobby.get(challenge.challengerSocketId);
    const challenged = lobby.get(challenge.challengedSocketId);
    if (!challenger || !challenged) return;

    if (!accept) {
      io.to(challenge.challengerSocketId).emit('challenge_rejected', { nickname: challenged.nickname });
      return;
    }

    // Create match room
    const roomId = uuidv4();
    const questions = generateQuestions(QUESTION_COUNT);
    const startTime = Date.now() + PRE_MATCH_DELAY_MS;

    rooms.set(roomId, {
      roomId,
      players: {
        [challenge.challengerSocketId]: {
          socketId: challenge.challengerSocketId,
          nickname: challenger.nickname,
          avatar: challenger.avatar,
          score: 0, correct: 0, wrong: 0, questionIndex: 0, finished: false,
        },
        [challenge.challengedSocketId]: {
          socketId: challenge.challengedSocketId,
          nickname: challenged.nickname,
          avatar: challenged.avatar,
          score: 0, correct: 0, wrong: 0, questionIndex: 0, finished: false,
        },
      },
      questions,
      startTime,
      timer: null,
      ended: false,
    });

    challenger.inMatch = true;
    challenged.inMatch = true;

    io.sockets.sockets.get(challenge.challengerSocketId)?.join(roomId);
    io.sockets.sockets.get(challenge.challengedSocketId)?.join(roomId);

    const base = { roomId, questions, startTime };
    io.to(challenge.challengerSocketId).emit('match_start', {
      ...base,
      opponent: { socketId: challenged.socketId, nickname: challenged.nickname, avatar: challenged.avatar },
    });
    io.to(challenge.challengedSocketId).emit('match_start', {
      ...base,
      opponent: { socketId: challenger.socketId, nickname: challenger.nickname, avatar: challenger.avatar },
    });

    broadcastLobby();

    // Server-side match timer (adds buffer for network latency)
    const room = rooms.get(roomId);
    room.timer = setTimeout(() => endMatch(roomId), PRE_MATCH_DELAY_MS + MATCH_DURATION_MS + 3_000);
  });

  socket.on('submit_answer', ({ roomId, questionIndex, answer }) => {
    const room = rooms.get(roomId);
    if (!room || room.ended) return;

    const player = room.players[socket.id];
    if (!player || player.finished) return;
    if (questionIndex !== player.questionIndex) return;

    const question = room.questions[questionIndex];
    if (!question || !question.choices.includes(answer)) return;

    const correct = answer === question.correctAnswer;
    if (correct) { player.score += 1; player.correct += 1; }
    else          { player.score -= 2; player.wrong += 1; }
    player.questionIndex += 1;

    socket.emit('answer_result', {
      questionIndex,
      correct,
      correctAnswer: question.correctAnswer,
      score: player.score,
    });

    // Live opponent update
    const opId = Object.keys(room.players).find(id => id !== socket.id);
    if (opId) io.to(opId).emit('opponent_update', { score: player.score, answeredCount: player.questionIndex });

    if (player.questionIndex >= room.questions.length) {
      player.finished = true;
      if (Object.values(room.players).every(p => p.finished)) endMatch(roomId);
    }
  });

  socket.on('send_dm', ({ toSocketId, message }) => {
    const from = lobby.get(socket.id);
    if (!from || !lobby.has(toSocketId)) return;
    const text = String(message ?? '').trim().slice(0, 500);
    if (!text) return;
    io.to(toSocketId).emit('dm_received', {
      fromSocketId: socket.id,
      fromNickname: from.nickname,
      fromAvatar: from.avatar,
      message: text,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`[-] disconnected: ${socket.id}`);
    const prevId = activeChallengeBySocket.get(socket.id);
    if (prevId) { challenges.delete(prevId); activeChallengeBySocket.delete(socket.id); }

    for (const [roomId, room] of rooms) {
      if (room.players[socket.id] && !room.ended) endMatch(roomId, socket.id);
    }
    lobby.delete(socket.id);
    broadcastLobby();
  });
});

init()
  .then(() => httpServer.listen(PORT, () => console.log(`Gedda IQ backend listening on :${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
