ALTER TABLE content_items
  ADD COLUMN media_json JSON NULL;

UPDATE content_items SET media_json = JSON_ARRAY() WHERE media_json IS NULL;

ALTER TABLE content_items
  MODIFY media_json JSON NOT NULL;

CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(80) NOT NULL,
  content_item_id BIGINT UNSIGNED,
  kind ENUM('image', 'video') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(100) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT media_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT media_content_fk FOREIGN KEY (content_item_id) REFERENCES content_items(id),
  KEY media_assets_content_item (content_item_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
