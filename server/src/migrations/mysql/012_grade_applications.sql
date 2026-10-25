CREATE TABLE grade_applications (
 id VARCHAR(80) PRIMARY KEY,
 semester_id VARCHAR(64) NOT NULL,
 counselor_user_id VARCHAR(80) NOT NULL,
 created_by_user_id VARCHAR(80) NOT NULL,
 client_request_id VARCHAR(80) NOT NULL,
 record_json LONGTEXT NOT NULL,
 status VARCHAR(20) NOT NULL,
 revision INT NOT NULL,
 submitted_at DATETIME(3),
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY grade_application_request(created_by_user_id,client_request_id),
 INDEX grade_applications_owner(counselor_user_id,semester_id,status),
 FOREIGN KEY(semester_id) REFERENCES semesters(id),
 FOREIGN KEY(counselor_user_id) REFERENCES users(id),
 FOREIGN KEY(created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE grade_application_versions (
 application_id VARCHAR(80) NOT NULL,
 revision INT NOT NULL,
 record_json LONGTEXT NOT NULL,
 actor_user_id VARCHAR(80) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(application_id,revision),
 FOREIGN KEY(application_id) REFERENCES grade_applications(id),
 FOREIGN KEY(actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
