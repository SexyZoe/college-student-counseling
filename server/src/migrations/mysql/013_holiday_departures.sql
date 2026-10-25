CREATE TABLE holiday_periods (
 id VARCHAR(80) PRIMARY KEY, name VARCHAR(100) NOT NULL, start_date VARCHAR(10) NOT NULL, end_date VARCHAR(10) NOT NULL,
 level_month VARCHAR(7) NOT NULL, owner_user_id VARCHAR(80), created_by_user_id VARCHAR(80) NOT NULL,
 revision INT NOT NULL DEFAULT 1, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(owner_user_id) REFERENCES users(id), FOREIGN KEY(created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE holiday_evidence (
 id VARCHAR(80) PRIMARY KEY, owner_user_id VARCHAR(80) NOT NULL, mime_type VARCHAR(30) NOT NULL,
 record_json LONGTEXT NOT NULL, created_at DATETIME(3) NOT NULL, FOREIGN KEY(owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE holiday_departures (
 id VARCHAR(80) PRIMARY KEY, holiday_id VARCHAR(80) NOT NULL, registry_student_id VARCHAR(80) NOT NULL,
 record_date VARCHAR(10) NOT NULL, record_json LONGTEXT NOT NULL, evidence_id VARCHAR(80), revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY holiday_student_date(holiday_id,registry_student_id,record_date), INDEX holiday_departure_date(holiday_id,record_date),
 FOREIGN KEY(holiday_id) REFERENCES holiday_periods(id), FOREIGN KEY(registry_student_id) REFERENCES registry_students(id), FOREIGN KEY(evidence_id) REFERENCES holiday_evidence(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE holiday_departure_versions (
 record_id VARCHAR(80) NOT NULL, revision INT NOT NULL, record_json LONGTEXT NOT NULL, evidence_id VARCHAR(80),
 actor_user_id VARCHAR(80) NOT NULL, created_at DATETIME(3) NOT NULL, PRIMARY KEY(record_id,revision),
 FOREIGN KEY(record_id) REFERENCES holiday_departures(id), FOREIGN KEY(evidence_id) REFERENCES holiday_evidence(id), FOREIGN KEY(actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
