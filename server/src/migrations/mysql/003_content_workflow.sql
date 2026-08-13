CREATE TABLE IF NOT EXISTS content_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type ENUM('civics', 'psychoeducation') NOT NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '',
  summary VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status ENUM('待审核', '已发布', '已退回') NOT NULL,
  author_user_id VARCHAR(80) NOT NULL,
  reviewer_user_id VARCHAR(80),
  review_note VARCHAR(500) NOT NULL DEFAULT '',
  published_at DATETIME(3),
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT content_author_fk FOREIGN KEY (author_user_id) REFERENCES users(id),
  CONSTRAINT content_reviewer_fk FOREIGN KEY (reviewer_user_id) REFERENCES users(id),
  KEY content_items_status_time (status, type, updated_at DESC),
  KEY content_items_author_time (author_user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
