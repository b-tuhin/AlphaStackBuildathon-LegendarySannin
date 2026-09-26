PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  phone                 TEXT NOT NULL UNIQUE,
  email_address         TEXT NOT NULL UNIQUE,
  display_name          TEXT,
  password_hash         TEXT,
  must_change_password  INTEGER NOT NULL DEFAULT 0,
  tos_accepted_at       TEXT,
  aliases               TEXT NOT NULL DEFAULT '[]',
  created_via           TEXT NOT NULL DEFAULT 'app',
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Threads: 1:1 (participant_a/participant_b) OR group (is_group=1, participants JSON array)
CREATE TABLE IF NOT EXISTS threads (
  id              TEXT PRIMARY KEY,
  is_group        INTEGER NOT NULL DEFAULT 0,
  participant_a   TEXT,
  participant_b   TEXT,
  participants    TEXT,
  group_name      TEXT,
  subject_root    TEXT,
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_threads_participants ON threads (participant_a, participant_b);
CREATE INDEX IF NOT EXISTS idx_threads_group ON threads (is_group, participants);

CREATE TABLE IF NOT EXISTS emails (
  id             TEXT PRIMARY KEY,
  thread_id      TEXT NOT NULL REFERENCES threads(id),
  message_id     TEXT UNIQUE,
  in_reply_to    TEXT,
  from_address   TEXT NOT NULL,
  to_address     TEXT NOT NULL,
  subject        TEXT,
  body_text      TEXT,
  body_html      TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  attachments    TEXT NOT NULL DEFAULT '[]',
  folder         TEXT NOT NULL DEFAULT 'home',
  is_read        INTEGER NOT NULL DEFAULT 0,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  is_spam        INTEGER NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'api',
  edited_at      TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails (thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_to     ON emails (to_address);
CREATE INDEX IF NOT EXISTS idx_emails_from   ON emails (from_address);
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails (in_reply_to);

CREATE TABLE IF NOT EXISTS device_registrations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  platform    TEXT NOT NULL,
  push_token  TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, push_token)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  phone        TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS password_resets (
  phone      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  token      TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  disk_path     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_id ON attachments (id);
