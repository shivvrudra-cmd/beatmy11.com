-- Daily leaderboard (docs/plans/daily-leaderboard.md). NOT APPLIED to production: the owner
-- applies it after agreeing to store display names:
--   npx wrangler d1 migrations apply beatmy11 --remote
--
-- One row per browser per day per format: the first result sent is the one that counts.
-- `player` is a random id made in the browser (not a login, not linked to a person).
-- `name` is optional free text typed by the player (cleaned, at most 20 characters).
-- No IP, user agent, cookie or account is stored.
--
-- To remove an entry (for example an offensive name):
--   UPDATE daily_scores SET name = NULL WHERE day = '2026-10-05' AND name = '...';
--   DELETE FROM daily_scores WHERE day = '2026-10-05' AND format = 'test' AND player = '...';
CREATE TABLE daily_scores (
  day          TEXT NOT NULL,
  format       TEXT NOT NULL,
  player       TEXT NOT NULL,
  xi_hash      TEXT NOT NULL,
  score        REAL NOT NULL,
  series_user  INTEGER NOT NULL,
  series_house INTEGER NOT NULL,
  draws        INTEGER NOT NULL,
  name         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (day, format, player)
);
CREATE INDEX daily_scores_board ON daily_scores (day, format, score DESC, created_at);
