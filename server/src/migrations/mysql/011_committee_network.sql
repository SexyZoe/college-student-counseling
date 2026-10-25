CREATE TABLE committee_classes (
 id VARCHAR(80) PRIMARY KEY,
 semester_id VARCHAR(64) NOT NULL,
 counselor_user_id VARCHAR(80) NOT NULL,
 college VARCHAR(100) NOT NULL,
 campus VARCHAR(100) NOT NULL,
 name VARCHAR(150) NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY committee_class_unique(semester_id,college,campus,name),
 INDEX committee_class_owner(counselor_user_id,semester_id),
 FOREIGN KEY(semester_id) REFERENCES semesters(id),
 FOREIGN KEY(counselor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE committee_members (
 id VARCHAR(80) PRIMARY KEY,
 class_id VARCHAR(80) NOT NULL,
 record_json LONGTEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 INDEX committee_member_class(class_id),
 FOREIGN KEY(class_id) REFERENCES committee_classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE committee_colleges (
 college VARCHAR(100) PRIMARY KEY,
 record_json LONGTEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
