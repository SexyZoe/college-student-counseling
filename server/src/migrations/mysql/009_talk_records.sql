CREATE TABLE talk_records (
  id VARCHAR(80) PRIMARY KEY,
  counselor_user_id VARCHAR(80) NOT NULL,
  registry_student_id VARCHAR(80) NULL,
  client_request_id VARCHAR(80) NOT NULL,
  record_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY talk_records_request (counselor_user_id, client_request_id),
  INDEX talk_records_owner (counselor_user_id, created_at),
  INDEX talk_records_student (registry_student_id, created_at),
  FOREIGN KEY (counselor_user_id) REFERENCES users(id),
  FOREIGN KEY (registry_student_id) REFERENCES registry_students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
