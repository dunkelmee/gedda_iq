'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_stats (
      nickname_key   TEXT    PRIMARY KEY,
      nickname       TEXT    NOT NULL,
      avatar         TEXT    NOT NULL DEFAULT '',
      wins           INTEGER NOT NULL DEFAULT 0,
      losses         INTEGER NOT NULL DEFAULT 0,
      draws          INTEGER NOT NULL DEFAULT 0,
      total_games    INTEGER NOT NULL DEFAULT 0,
      total_score    INTEGER NOT NULL DEFAULT 0,
      best_score     INTEGER NOT NULL DEFAULT 0,
      total_correct  INTEGER NOT NULL DEFAULT 0,
      total_wrong    INTEGER NOT NULL DEFAULT 0,
      total_answered INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function updatePlayerStats(result) {
  if (result.forfeit) return;

  await pool.query(
    `INSERT INTO player_stats
       (nickname_key, nickname, avatar, wins, losses, draws,
        total_games, total_score, best_score, total_correct, total_wrong, total_answered)
     VALUES ($1,$2,$3,$4,$5,$6, 1,$7,$7,$8,$9,$10)
     ON CONFLICT (nickname_key) DO UPDATE SET
       nickname       = EXCLUDED.nickname,
       avatar         = EXCLUDED.avatar,
       wins           = player_stats.wins           + EXCLUDED.wins,
       losses         = player_stats.losses         + EXCLUDED.losses,
       draws          = player_stats.draws          + EXCLUDED.draws,
       total_games    = player_stats.total_games    + 1,
       total_score    = player_stats.total_score    + EXCLUDED.total_score,
       best_score     = GREATEST(player_stats.best_score, EXCLUDED.best_score),
       total_correct  = player_stats.total_correct  + EXCLUDED.total_correct,
       total_wrong    = player_stats.total_wrong    + EXCLUDED.total_wrong,
       total_answered = player_stats.total_answered + EXCLUDED.total_answered`,
    [
      result.nickname.toLowerCase(),
      result.nickname,
      result.avatar,
      result.won ? 1 : 0,
      (!result.won && !result.draw) ? 1 : 0,
      result.draw ? 1 : 0,
      result.score,
      result.correct,
      result.wrong,
      result.answered,
    ],
  );
}

async function getLeaderboard(limit = 100) {
  const { rows } = await pool.query(
    `SELECT
       nickname,
       avatar,
       wins,
       losses,
       draws,
       total_games    AS "totalGames",
       total_score    AS "totalScore",
       best_score     AS "bestScore",
       total_correct  AS "totalCorrect",
       total_wrong    AS "totalWrong",
       total_answered AS "totalAnswered",
       CASE WHEN total_games    > 0
            THEN ROUND((wins::numeric          / total_games)    * 100)
            ELSE 0 END AS "winRate",
       CASE WHEN total_answered > 0
            THEN ROUND((total_correct::numeric / total_answered) * 100)
            ELSE 0 END AS "avgAccuracy"
     FROM player_stats
     ORDER BY
       wins       DESC,
       CASE WHEN total_games > 0
            THEN wins::numeric / total_games
            ELSE 0 END DESC,
       best_score DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

module.exports = { init, updatePlayerStats, getLeaderboard };
