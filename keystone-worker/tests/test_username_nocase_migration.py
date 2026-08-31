import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INITIAL = (ROOT / "migrations" / "0001_initial.sql").read_text(encoding="utf-8")
MIGRATION_PATH = ROOT / "migrations" / "0007_users_username_nocase.sql"


class UsernameNoCaseMigrationTests(unittest.TestCase):
    def make_database(self):
        connection = sqlite3.connect(":memory:")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(INITIAL)
        return connection

    @staticmethod
    def insert_user(connection, username, sync_token):
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash, sync_token) VALUES (?, 'hash', ?)",
            (username, sync_token),
        )
        return cursor.lastrowid

    def migration_sql(self):
        self.assertTrue(MIGRATION_PATH.exists(), "0007 username migration must exist")
        return MIGRATION_PATH.read_text(encoding="utf-8")

    def test_unique_existing_username_keeps_text_ids_and_foreign_keys(self):
        connection = self.make_database()
        user_id = self.insert_user(connection, "Spee", "sync-1")
        character_id = connection.execute(
            "INSERT INTO characters (user_id, name, realm) VALUES (?, 'Speeral', 'Zuljin')",
            (user_id,),
        ).lastrowid
        team_id = connection.execute(
            "INSERT INTO teams (name, invite_code, created_by) VALUES ('Raid', 'code', ?)",
            (user_id,),
        ).lastrowid
        connection.execute(
            "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
            (team_id, user_id),
        )

        connection.executescript(self.migration_sql())

        self.assertEqual(connection.execute(
            "SELECT id, username FROM users"
        ).fetchall(), [(user_id, "Spee")])
        self.assertEqual(connection.execute(
            "SELECT id, user_id FROM characters"
        ).fetchall(), [(character_id, user_id)])
        self.assertEqual(connection.execute(
            "SELECT team_id, user_id FROM team_members"
        ).fetchall(), [(team_id, user_id)])
        self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_user(connection, "sPEE", "sync-2")

    def test_case_only_collision_aborts_without_repairing_accounts(self):
        connection = self.make_database()
        first_id = self.insert_user(connection, "Spee", "sync-1")
        second_id = self.insert_user(connection, "spee", "sync-2")

        with self.assertRaises(sqlite3.IntegrityError):
            connection.executescript(self.migration_sql())

        self.assertEqual(connection.execute(
            "SELECT id, username FROM users ORDER BY id"
        ).fetchall(), [(first_id, "Spee"), (second_id, "spee")])
        indexes = connection.execute("PRAGMA index_list('users')").fetchall()
        self.assertNotIn("users_username_nocase_unique", {row[1] for row in indexes})


if __name__ == "__main__":
    unittest.main()
