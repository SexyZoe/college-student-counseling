ALTER TABLE users
  ADD COLUMN phone_encrypted TEXT NULL,
  ADD COLUMN profile_completed TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN profile_consent_at VARCHAR(40) NULL,
  ADD COLUMN auth_version INT NOT NULL DEFAULT 0;
