CREATE TABLE talk_records (
  id TEXT PRIMARY KEY,
  counselor_user_id TEXT NOT NULL REFERENCES users(id),
  registry_student_id TEXT REFERENCES registry_students(id),
  client_request_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(counselor_user_id, client_request_id)
);
CREATE INDEX talk_records_owner ON talk_records(counselor_user_id, created_at);
CREATE INDEX talk_records_student ON talk_records(registry_student_id, created_at);
