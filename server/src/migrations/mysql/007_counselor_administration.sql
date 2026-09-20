ALTER TABLE counselor_class_assignments
  ADD COLUMN assigned_by_user_id VARCHAR(80) NULL,
  ADD COLUMN updated_at DATETIME(3) NULL,
  ADD COLUMN ended_at DATETIME(3) NULL,
  ADD CONSTRAINT assignments_admin_fk FOREIGN KEY (assigned_by_user_id) REFERENCES users(id);

UPDATE users
SET must_change_password = 1,
    auth_version = auth_version + 1
WHERE role = 'counselor';
