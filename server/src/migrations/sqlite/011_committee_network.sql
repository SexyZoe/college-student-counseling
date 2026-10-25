CREATE TABLE committee_classes (
 id TEXT PRIMARY KEY,
 semester_id TEXT NOT NULL REFERENCES semesters(id),
 counselor_user_id TEXT NOT NULL REFERENCES users(id),
 college TEXT NOT NULL,
 campus TEXT NOT NULL,
 name TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(semester_id,college,campus,name)
);
CREATE INDEX committee_class_owner ON committee_classes(counselor_user_id,semester_id);
CREATE TABLE committee_members (
 id TEXT PRIMARY KEY,
 class_id TEXT NOT NULL REFERENCES committee_classes(id),
 record_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX committee_member_class ON committee_members(class_id);
CREATE TABLE committee_colleges (
 college TEXT PRIMARY KEY,
 record_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
