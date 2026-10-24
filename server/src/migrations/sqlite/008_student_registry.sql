CREATE TABLE counselor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  contact TEXT NOT NULL DEFAULT '',
  college TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE TABLE registry_students (
  id TEXT PRIMARY KEY,
  counselor_user_id TEXT NOT NULL REFERENCES users(id),
  record_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX registry_students_owner ON registry_students(counselor_user_id, created_at);
CREATE TABLE registry_imports (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  counselor_user_id TEXT NOT NULL REFERENCES users(id),
  preview_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  result_json TEXT
);
