ALTER TABLE content_items
  ADD COLUMN media_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  content_item_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  original_name TEXT NOT NULL,
  storage_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (content_item_id) REFERENCES content_items(id)
);

CREATE INDEX IF NOT EXISTS media_assets_content_item
  ON media_assets(content_item_id, created_at);
