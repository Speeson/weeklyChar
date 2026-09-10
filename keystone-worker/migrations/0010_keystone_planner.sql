CREATE TABLE character_play_preferences (
  character_id INTEGER NOT NULL,
  spec_id INTEGER NOT NULL CHECK (spec_id > 0),
  play_preference TEXT NOT NULL CHECK (
    play_preference IN ('preferred', 'available', 'emergency', 'disabled')
  ),
  loot_spec_id INTEGER NOT NULL CHECK (loot_spec_id > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (character_id, spec_id),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);
