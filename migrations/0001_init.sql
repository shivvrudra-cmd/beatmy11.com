-- One row per distinct drafted XI (xi_hash dedupes repeat submissions).
-- No IP, user agent, cookie or account id is stored.
CREATE TABLE drafts (
  xi_hash      TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  user_score   REAL NOT NULL,
  house_score  REAL NOT NULL,
  series_user  INTEGER NOT NULL,
  series_house INTEGER NOT NULL,
  draws        INTEGER NOT NULL
);
CREATE INDEX drafts_created_at ON drafts (created_at);

-- Daily counters for simple events (e.g. "shared").
CREATE TABLE events (
  day   TEXT NOT NULL,
  name  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
