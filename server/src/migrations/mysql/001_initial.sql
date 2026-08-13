CREATE TABLE IF NOT EXISTS semesters (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('未开始', '当前学期', '已归档') NOT NULL,
  current_semester_guard TINYINT GENERATED ALWAYS AS (
    CASE WHEN status = '当前学期' THEN 1 ELSE NULL END
  ) STORED,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY one_current_semester (current_semester_guard)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  major VARCHAR(160) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(80) PRIMARY KEY,
  role ENUM('student', 'counselor', 'admin') NOT NULL,
  account_id VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  student_no VARCHAR(80) UNIQUE,
  staff_no VARCHAR(80) UNIQUE,
  class_id VARCHAR(64),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT users_class_fk FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS counselor_class_assignments (
  counselor_user_id VARCHAR(80) NOT NULL,
  class_id VARCHAR(64) NOT NULL,
  semester_id VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (counselor_user_id, class_id, semester_id),
  CONSTRAINT assignments_counselor_fk FOREIGN KEY (counselor_user_id) REFERENCES users(id),
  CONSTRAINT assignments_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT assignments_semester_fk FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  attempt_key VARCHAR(255) PRIMARY KEY,
  failure_count INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS assessment_tasks (
  id VARCHAR(64) PRIMARY KEY,
  assessment_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  semester_id VARCHAR(64) NOT NULL,
  questionnaire_version VARCHAR(64) NOT NULL,
  scoring_version VARCHAR(64) NOT NULL,
  deadline DATE NOT NULL,
  status ENUM('草稿', '未开始', '进行中', '已结束') NOT NULL,
  target_class_id VARCHAR(64),
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT tasks_semester_fk FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT tasks_class_fk FOREIGN KEY (target_class_id) REFERENCES classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS assessment_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id VARCHAR(160) NOT NULL UNIQUE,
  student_user_id VARCHAR(80) NOT NULL,
  student_no VARCHAR(80) NOT NULL,
  class_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(64),
  semester_id VARCHAR(64) NOT NULL,
  assessment_id INT NOT NULL,
  assessment_name VARCHAR(160) NOT NULL,
  raw_score DECIMAL(10,2) NOT NULL,
  max_score DECIMAL(10,2) NOT NULL,
  normalized_risk_score TINYINT UNSIGNED NOT NULL,
  wellbeing_index TINYINT UNSIGNED NOT NULL,
  risk_level ENUM('正常', '关注', '较高风险', '紧急风险') NOT NULL,
  questionnaire_version VARCHAR(64) NOT NULL,
  scoring_version VARCHAR(64) NOT NULL,
  questionnaire_snapshot_json JSON NOT NULL,
  scoring_snapshot_json JSON NOT NULL,
  answer_snapshot_json LONGTEXT NOT NULL,
  triggered_rules_json JSON NOT NULL,
  client_created_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT results_student_fk FOREIGN KEY (student_user_id) REFERENCES users(id),
  CONSTRAINT results_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT results_task_fk FOREIGN KEY (task_id) REFERENCES assessment_tasks(id),
  CONSTRAINT results_semester_fk FOREIGN KEY (semester_id) REFERENCES semesters(id),
  CONSTRAINT results_risk_score_check CHECK (normalized_risk_score BETWEEN 0 AND 100),
  CONSTRAINT results_wellbeing_check CHECK (wellbeing_index BETWEEN 0 AND 100),
  KEY assessment_results_student_time (student_user_id, created_at DESC),
  KEY assessment_results_class_semester (class_id, semester_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS risk_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT UNSIGNED NOT NULL UNIQUE,
  student_user_id VARCHAR(80) NOT NULL,
  class_id VARCHAR(64) NOT NULL,
  semester_id VARCHAR(64) NOT NULL,
  level ENUM('关注', '较高风险', '紧急风险') NOT NULL,
  source VARCHAR(255) NOT NULL,
  summary VARCHAR(1000) NOT NULL,
  status ENUM('待确认', '跟进中', '已关闭') NOT NULL,
  followup_note TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT risk_result_fk FOREIGN KEY (result_id) REFERENCES assessment_results(id),
  CONSTRAINT risk_student_fk FOREIGN KEY (student_user_id) REFERENCES users(id),
  CONSTRAINT risk_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT risk_semester_fk FOREIGN KEY (semester_id) REFERENCES semesters(id),
  KEY risk_events_class_status (class_id, status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id VARCHAR(80),
  action VARCHAR(160) NOT NULL,
  target_type VARCHAR(80) NOT NULL DEFAULT '',
  target_id VARCHAR(160) NOT NULL DEFAULT '',
  details_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT audit_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id),
  KEY audit_logs_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_batch_id VARCHAR(160) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  file_hash CHAR(64) NOT NULL,
  status ENUM('待确认', '校验失败', '已导入', '已回滚') NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  create_count INT NOT NULL DEFAULT 0,
  update_count INT NOT NULL DEFAULT 0,
  unchanged_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  plan_json JSON NOT NULL,
  errors_json JSON NOT NULL,
  created_by_user_id VARCHAR(80) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  applied_at DATETIME(3),
  rolled_back_at DATETIME(3),
  CONSTRAINT import_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  KEY import_batches_created_at (created_at DESC, id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS import_batch_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  sequence_no INT NOT NULL,
  entity_type ENUM('class', 'user', 'assignment') NOT NULL,
  entity_key VARCHAR(255) NOT NULL,
  operation ENUM('create', 'update') NOT NULL,
  before_json JSON,
  after_json JSON NOT NULL,
  CONSTRAINT import_changes_batch_fk FOREIGN KEY (batch_id) REFERENCES import_batches(id),
  UNIQUE KEY import_changes_sequence (batch_id, sequence_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
