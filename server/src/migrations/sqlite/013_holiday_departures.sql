CREATE TABLE holiday_periods (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
 level_month TEXT NOT NULL, owner_user_id TEXT REFERENCES users(id), created_by_user_id TEXT NOT NULL REFERENCES users(id),
 revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE holiday_evidence (
 id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id), mime_type TEXT NOT NULL,
 record_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE holiday_departures (
 id TEXT PRIMARY KEY, holiday_id TEXT NOT NULL REFERENCES holiday_periods(id),
 registry_student_id TEXT NOT NULL REFERENCES registry_students(id), record_date TEXT NOT NULL,
 record_json TEXT NOT NULL, evidence_id TEXT REFERENCES holiday_evidence(id), revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(holiday_id,registry_student_id,record_date)
);
CREATE INDEX holiday_departure_date ON holiday_departures(holiday_id,record_date);
CREATE TABLE holiday_departure_versions (
 record_id TEXT NOT NULL REFERENCES holiday_departures(id), revision INTEGER NOT NULL,
 record_json TEXT NOT NULL, evidence_id TEXT REFERENCES holiday_evidence(id),
 actor_user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(record_id,revision)
);
