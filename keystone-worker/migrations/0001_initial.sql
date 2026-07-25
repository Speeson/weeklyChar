PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  sync_token TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  date_of_birth TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verification_token_hash TEXT,
  email_verification_expires_at TEXT,
  password_reset_token_hash TEXT,
  password_reset_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  realm TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'eu',
  avatar_url TEXT,
  wow_account TEXT,
  rio_score REAL,
  wow_class TEXT,
  ilvl INTEGER,
  vault_json TEXT,
  prey_hunts_json TEXT,
  currencies_json TEXT,
  money_json TEXT,
  mythic_plus_season_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, name, realm, region)
);

CREATE TABLE IF NOT EXISTS keystones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  has_keystone INTEGER NOT NULL DEFAULT 0,
  keystone_level INTEGER,
  keystone_challenge_map_id INTEGER,
  keystone_map_id INTEGER,
  keystone_dungeon TEXT,
  updated_reason TEXT,
  updated_at INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  invited_user_id INTEGER NOT NULL,
  invited_by_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  responded_at TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  attempts_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash ON users(email_verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash ON users(password_reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_sync_token ON users(sync_token);
CREATE INDEX IF NOT EXISTS idx_characters_user_name ON characters(user_id, name);
CREATE INDEX IF NOT EXISTS idx_keystones_character_updated ON keystones(character_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_user_status ON team_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_user_status ON team_invitations(team_id, invited_user_id, status);
