import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0010_keystone_planner.sql"


class KeystonePlannerMigrationTests(unittest.TestCase):
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
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_schema_has_composite_key_without_duplicated_role(self):
        columns = {row[1]: row for row in self.db.execute("PRAGMA table_info(character_play_preferences)")}
        self.assertEqual(
            set(columns),
            {"character_id", "spec_id", "play_preference", "loot_spec_id", "updated_at"},
        )
        self.assertEqual(columns["character_id"][5], 1)
        self.assertEqual(columns["spec_id"][5], 2)
        self.assertNotIn("role", columns)

    def test_all_four_states_persist_and_character_delete_cascades(self):
        for spec_id, state in enumerate(
            ("preferred", "available", "emergency", "disabled"), start=1
        ):
            self.db.execute(
                """INSERT INTO character_play_preferences
                   (character_id, spec_id, play_preference, loot_spec_id)
                   VALUES (10, ?, ?, ?)""",
                (spec_id, state, spec_id),
            )
        rows = self.db.execute(
            "SELECT play_preference, updated_at FROM character_play_preferences ORDER BY spec_id"
        ).fetchall()
        self.assertEqual([row[0] for row in rows], [
            "preferred", "available", "emergency", "disabled"
        ])
        self.assertTrue(all(row[1] for row in rows))

        self.db.execute("DELETE FROM characters WHERE id = 10")
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM character_play_preferences").fetchone()[0],
            0,
        )

    def test_database_checks_reject_invalid_values_and_duplicate_keys(self):
        self.db.execute(
            """INSERT INTO character_play_preferences
               (character_id, spec_id, play_preference, loot_spec_id)
               VALUES (10, 70, 'preferred', 70)"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO character_play_preferences
                   (character_id, spec_id, play_preference, loot_spec_id)
                   VALUES (10, 70, 'available', 70)"""
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO character_play_preferences
                   (character_id, spec_id, play_preference, loot_spec_id)
                   VALUES (10, 71, 'sometimes', 71)"""
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO character_play_preferences
                   (character_id, spec_id, play_preference, loot_spec_id)
                   VALUES (10, 0, 'disabled', 0)"""
            )


if __name__ == "__main__":
    unittest.main()
