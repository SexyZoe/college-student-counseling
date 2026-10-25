CREATE TABLE weekly_calendars (
  semester_id TEXT PRIMARY KEY REFERENCES semesters(id),
  first_monday TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE weekly_records (
  id TEXT PRIMARY KEY,
  registry_student_id TEXT NOT NULL REFERENCES registry_students(id),
  counselor_user_id TEXT NOT NULL REFERENCES users(id),
  semester_id TEXT NOT NULL REFERENCES semesters(id),
  week_start TEXT NOT NULL,
  record_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(registry_student_id,week_start)
);
CREATE INDEX weekly_records_owner ON weekly_records(counselor_user_id,week_start);
CREATE TABLE weekly_record_versions (
  record_id TEXT NOT NULL REFERENCES weekly_records(id),
  revision INTEGER NOT NULL,
  record_json TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(record_id,revision)
);
