CREATE TABLE committee_counselor_headers (
 counselor_user_id VARCHAR(80) NOT NULL,
 college VARCHAR(100) NOT NULL,
 record_json LONGTEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 updated_at DATETIME(3) NOT NULL,
 PRIMARY KEY(counselor_user_id,college),
 FOREIGN KEY(counselor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
