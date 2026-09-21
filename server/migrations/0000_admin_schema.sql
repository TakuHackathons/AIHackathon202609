PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  subjects TEXT NOT NULL DEFAULT '',
  responsibilities TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'general')),
  password_hash TEXT,
  password_expires_at INTEGER,
  auth_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (role = 'super_admin' AND school_id IS NULL) OR
    (role IN ('admin', 'general') AND school_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS users_school ON users(school_id);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT NOT NULL,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  backed_up INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS passkeys_user ON passkeys(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('enroll', 'full')),
  auth_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  auth_version INTEGER,
  session_id TEXT,
  name TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_expiry ON challenges(expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
