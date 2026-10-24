CREATE TABLE counselor_profiles (
  user_id VARCHAR(80) PRIMARY KEY,
  contact VARCHAR(100) NOT NULL DEFAULT '',
  college VARCHAR(100) NOT NULL DEFAULT '',
  updated_at DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE registry_students (
  id VARCHAR(80) PRIMARY KEY,
  counselor_user_id VARCHAR(80) NOT NULL,
  record_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX registry_students_owner (counselor_user_id, created_at),
  FOREIGN KEY (counselor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE registry_imports (
  id VARCHAR(80) PRIMARY KEY,
  actor_user_id VARCHAR(80) NOT NULL,
  counselor_user_id VARCHAR(80) NOT NULL,
  preview_json LONGTEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'preview',
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  result_json TEXT,
  FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (counselor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
