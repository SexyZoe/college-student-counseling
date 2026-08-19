CREATE TABLE IF NOT EXISTS auth_sessions (
  jti_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_expiry
ON auth_sessions(user_id, expires_at DESC);
