INSERT OR IGNORE INTO schools (name, code, address, phone, created_at, updated_at)
VALUES ('Sample School', 'SAMPLE-SCHOOL', '', '', unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR IGNORE INTO users (school_id, username, name, role, password_hash, password_expires_at, auth_version, created_at, updated_at)
VALUES (NULL, 'super-admin', 'Operations Admin', 'super_admin', 'pbkdf2-sha256:100000:UvNcMPtNVXLsR3Mgebw14Q:p_wQ9OgKUsKZiTmwP1Xj1c1Htno3JW5hjP9n4-LAOlQ', unixepoch('now') * 1000 + 604800000, 0, unixepoch('now') * 1000, unixepoch('now') * 1000);