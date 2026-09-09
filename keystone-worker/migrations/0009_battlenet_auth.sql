-- Rebuild users because SQLite/D1 cannot alter a NOT NULL constraint in place.
-- Keep the original table name until the replacement is ready so child foreign
-- keys continue to reference `users`, not a temporary renamed table.
-- D1 runs migrations inside an implicit transaction, so `foreign_keys = OFF`
-- cannot take effect. Defer validation and preserve rows affected by existing
-- ON DELETE CASCADE actions while the parent table is replaced.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE battlenet_v1_characters_backup AS SELECT * FROM characters;
CREATE TABLE battlenet_v1_keystones_backup AS SELECT * FROM keystones;
CREATE TABLE battlenet_v1_team_members_backup AS SELECT * FROM team_members;
CREATE TABLE battlenet_v1_team_invitations_backup AS SELECT * FROM team_invitations;

CREATE TABLE users_battlenet_v1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  share_keystone_loot_with_teams INTEGER NOT NULL DEFAULT 1
);

INSERT INTO users_battlenet_v1 (
  id, username, password_hash, sync_token, avatar_url, first_name, last_name,
  email, date_of_birth, email_verified, email_verification_token_hash,
  email_verification_expires_at, password_reset_token_hash,
  password_reset_expires_at, created_at, share_keystone_loot_with_teams
)
SELECT
  id, username, password_hash, sync_token, avatar_url, first_name, last_name,
  email, date_of_birth, email_verified, email_verification_token_hash,
  email_verification_expires_at, password_reset_token_hash,
  password_reset_expires_at, created_at, share_keystone_loot_with_teams
FROM users;

DROP TABLE users;
ALTER TABLE users_battlenet_v1 RENAME TO users;

INSERT INTO characters SELECT * FROM battlenet_v1_characters_backup;
INSERT INTO keystones SELECT * FROM battlenet_v1_keystones_backup;
INSERT INTO team_members SELECT * FROM battlenet_v1_team_members_backup;
INSERT INTO team_invitations SELECT * FROM battlenet_v1_team_invitations_backup;

DROP TABLE battlenet_v1_characters_backup;
DROP TABLE battlenet_v1_keystones_backup;
DROP TABLE battlenet_v1_team_members_backup;
DROP TABLE battlenet_v1_team_invitations_backup;

CREATE INDEX idx_users_email_verification_token_hash ON users(email_verification_token_hash);
CREATE INDEX idx_users_password_reset_token_hash ON users(password_reset_token_hash);
CREATE INDEX idx_users_sync_token ON users(sync_token);
CREATE UNIQUE INDEX users_username_nocase_unique ON users(username COLLATE NOCASE);

CREATE TABLE user_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('battlenet')),
  provider_subject TEXT NOT NULL,
  provider_display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE TABLE oauth_flows (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL CHECK (intent IN ('login_web', 'login_desktop', 'link_account')),
  state_hash TEXT UNIQUE,
  pkce_verifier TEXT,
  initiator_user_id INTEGER,
  desktop_poll_secret_hash TEXT,
  handoff_secret_hash TEXT UNIQUE,
  provider_subject TEXT,
  provider_display_name TEXT,
  result_user_id INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'needs_onboarding', 'ready', 'consumed', 'failed')),
  expires_at TEXT NOT NULL,
  handoff_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  FOREIGN KEY (initiator_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (result_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_identities_user_provider ON user_identities(user_id, provider);
CREATE INDEX idx_oauth_flows_expires_at ON oauth_flows(expires_at);
CREATE INDEX idx_oauth_flows_poll ON oauth_flows(id, desktop_poll_secret_hash);

PRAGMA defer_foreign_keys = OFF;
