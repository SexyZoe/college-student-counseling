CREATE TABLE grade_applications (
 id TEXT PRIMARY KEY,
 semester_id TEXT NOT NULL REFERENCES semesters(id),
 counselor_user_id TEXT NOT NULL REFERENCES users(id),
 created_by_user_id TEXT NOT NULL REFERENCES users(id),
 client_request_id TEXT NOT NULL,
 record_json TEXT NOT NULL,
 status TEXT NOT NULL,
 revision INTEGER NOT NULL,
 submitted_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(created_by_user_id,client_request_id)
);
CREATE INDEX grade_applications_owner ON grade_applications(counselor_user_id,semester_id,status);
CREATE TABLE grade_application_versions (
 application_id TEXT NOT NULL REFERENCES grade_applications(id),
 revision INTEGER NOT NULL,
 record_json TEXT NOT NULL,
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 PRIMARY KEY(application_id,revision)
);
