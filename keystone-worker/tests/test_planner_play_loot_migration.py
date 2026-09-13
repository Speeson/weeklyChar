import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


class PlannerPlayLootMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(
            """
            CREATE TABLE users (id INTEGER PRIMARY KEY);
            CREATE TABLE characters (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT INTO users (id) VALUES (1);
            INSERT INTO characters (id, user_id) VALUES (10, 1);
            """
        )
        self.db.executescript((MIGRATIONS / "0010_keystone_planner.sql").read_text(encoding="utf-8"))
        self.db.executescript(
            """
            INSERT INTO character_play_preferences
              (character_id, spec_id, play_preference, loot_spec_id)
            VALUES
              (10, 65, 'available', 65),
              (10, 66, 'preferred', 66),
              (10, 70, 'disabled', 70);
            """
        )
        self.db.executescript((MIGRATIONS / "0011_planner_play_loot_separation.sql").read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_existing_play_preferences_start_with_no_implicit_loot_interest(self):
        rows = self.db.execute(
            "SELECT spec_id, loot_priority FROM character_loot_preferences ORDER BY spec_id"
        ).fetchall()
        self.assertEqual(rows, [])

    def test_one_primary_is_enforced_and_owner_deletion_cascades(self):
        self.db.execute(
            "INSERT INTO character_loot_preferences (character_id, spec_id, loot_priority) VALUES (10, 66, 'primary')"
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO character_loot_preferences (character_id, spec_id, loot_priority) VALUES (10, 71, 'primary')"
            )
        self.db.execute(
            "INSERT INTO planner_user_settings (user_id, onboarding_completed) VALUES (1, 1)"
        )
        self.db.execute("DELETE FROM users WHERE id = 1")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM character_loot_preferences").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM planner_user_settings").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
