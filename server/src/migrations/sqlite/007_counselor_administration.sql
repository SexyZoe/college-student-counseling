ALTER TABLE counselor_class_assignments ADD COLUMN assigned_by_user_id TEXT REFERENCES users(id);
ALTER TABLE counselor_class_assignments ADD COLUMN updated_at TEXT;
ALTER TABLE counselor_class_assignments ADD COLUMN ended_at TEXT;

UPDATE users
SET must_change_password = 1,
    auth_version = auth_version + 1
WHERE role = 'counselor';
