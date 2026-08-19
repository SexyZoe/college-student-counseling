PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('未开始', '当前学期', '已归档')),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_current_semester
ON semesters(status) WHERE status = '当前学期';

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  major TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student', 'counselor', 'admin')),
  account_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  student_no TEXT UNIQUE,
  staff_no TEXT UNIQUE,
  class_id TEXT REFERENCES classes(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counselor_class_assignments (
  counselor_user_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (counselor_user_id, class_id, semester_id)
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  attempt_key TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_tasks (
  id TEXT PRIMARY KEY,
  assessment_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  questionnaire_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('草稿', '未开始', '进行中', '已结束')),
  target_class_id TEXT REFERENCES classes(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessment_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  student_user_id TEXT NOT NULL REFERENCES users(id),
  student_no TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id),
  task_id TEXT REFERENCES assessment_tasks(id),
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  assessment_id INTEGER NOT NULL,
  assessment_name TEXT NOT NULL,
  raw_score REAL NOT NULL,
  max_score REAL NOT NULL,
  normalized_risk_score INTEGER NOT NULL CHECK (normalized_risk_score BETWEEN 0 AND 100),
  wellbeing_index INTEGER NOT NULL CHECK (wellbeing_index BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('正常', '关注', '较高风险', '紧急风险')),
  questionnaire_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  questionnaire_snapshot_json TEXT NOT NULL,
  scoring_snapshot_json TEXT NOT NULL,
  answer_snapshot_json TEXT NOT NULL,
  triggered_rules_json TEXT NOT NULL,
  client_created_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS assessment_results_student_time
ON assessment_results(student_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS assessment_results_class_semester
ON assessment_results(class_id, semester_id, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL UNIQUE REFERENCES assessment_results(id),
  student_user_id TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  level TEXT NOT NULL CHECK (level IN ('关注', '较高风险', '紧急风险')),
  source TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('待确认', '跟进中', '已关闭')),
  followup_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS risk_events_class_status
ON risk_events(class_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_batch_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('待确认', '校验失败', '已导入', '已回滚')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  create_count INTEGER NOT NULL DEFAULT 0,
  update_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  plan_json TEXT NOT NULL DEFAULT '{}',
  errors_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  applied_at TEXT,
  rolled_back_at TEXT
);

CREATE INDEX IF NOT EXISTS import_batches_created_at
ON import_batches(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS import_batch_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES import_batches(id),
  sequence_no INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('class', 'user', 'assignment')),
  entity_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
  before_json TEXT,
  after_json TEXT NOT NULL,
  UNIQUE (batch_id, sequence_no)
);
