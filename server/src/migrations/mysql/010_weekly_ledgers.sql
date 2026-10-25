CREATE TABLE weekly_calendars (
  semester_id VARCHAR(80) PRIMARY KEY,
  first_monday DATE NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  FOREIGN KEY(semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE weekly_records (
  id VARCHAR(80) PRIMARY KEY,
  registry_student_id VARCHAR(80) NOT NULL,
  counselor_user_id VARCHAR(80) NOT NULL,
  semester_id VARCHAR(80) NOT NULL,
  week_start DATE NOT NULL,
  record_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY weekly_student_week(registry_student_id,week_start),
  INDEX weekly_records_owner(counselor_user_id,week_start),
  FOREIGN KEY(registry_student_id) REFERENCES registry_students(id),
  FOREIGN KEY(counselor_user_id) REFERENCES users(id),
  FOREIGN KEY(semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE weekly_record_versions (
  record_id VARCHAR(80) NOT NULL,
  revision INT NOT NULL,
  record_json LONGTEXT NOT NULL,
  actor_user_id VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY(record_id,revision),
  FOREIGN KEY(record_id) REFERENCES weekly_records(id),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
