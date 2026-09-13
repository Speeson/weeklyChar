CREATE TABLE character_loot_preferences (
  character_id INTEGER NOT NULL,
  spec_id INTEGER NOT NULL CHECK (spec_id > 0),
  loot_priority TEXT NOT NULL CHECK (loot_priority IN ('primary', 'secondary')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (character_id, spec_id),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX character_loot_preferences_one_primary
  ON character_loot_preferences(character_id)
  WHERE loot_priority = 'primary';

CREATE TABLE planner_user_settings (
  user_id INTEGER PRIMARY KEY,
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
