CREATE TABLE IF NOT EXISTS auth_sessions (
  jti_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at DATETIME(3),
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  KEY auth_sessions_user_expiry (user_id, expires_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
