-- Tug of War game database schema
-- SQLite, for local development

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    username        TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    mmr             INTEGER NOT NULL DEFAULT 1000,
    rank_tier       TEXT    NOT NULL DEFAULT 'Bronze',
    wins            INTEGER NOT NULL DEFAULT 0,
    losses          INTEGER NOT NULL DEFAULT 0,
    games_played    INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mode            TEXT    NOT NULL,
    team_size       INTEGER NOT NULL,
    players_json    TEXT    NOT NULL,
    winner_team     TEXT    NOT NULL,
    duration_sec    REAL    NOT NULL,
    mmr_delta_json  TEXT    NOT NULL,
    created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    sid         TEXT    PRIMARY KEY,
    data        TEXT    NOT NULL,
    expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_created  ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_mmr        ON users(mmr DESC);
CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
