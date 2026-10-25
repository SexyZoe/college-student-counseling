CREATE TABLE committee_counselor_headers (
 counselor_user_id TEXT NOT NULL REFERENCES users(id),
 college TEXT NOT NULL,
 record_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(counselor_user_id,college)
);
