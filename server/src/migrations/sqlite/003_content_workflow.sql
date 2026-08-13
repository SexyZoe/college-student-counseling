CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('civics', 'psychoeducation')),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('待审核', '已发布', '已退回')),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  reviewer_user_id TEXT REFERENCES users(id),
  review_note TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS content_items_status_time
ON content_items(status, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS content_items_author_time
ON content_items(author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_created_at
ON audit_logs(created_at DESC, id DESC);
