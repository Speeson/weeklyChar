import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


class BattleNetAuthMigrationTests(unittest.TestCase):
    def make_database(self):
        connection = sqlite3.connect(":memory:")
        for path in sorted(MIGRATIONS.glob("*.sql")):
            if path.name == "0009_battlenet_auth.sql":
                break
            connection.executescript(path.read_text(encoding="utf-8"))
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def apply_battlenet_migration_like_d1(self, connection):
        script = (MIGRATIONS / "0009_battlenet_auth.sql").read_text(encoding="utf-8")
        statement = ""
        connection.execute("BEGIN")
        try:
            for line in script.splitlines(keepends=True):
                statement += line
                if sqlite3.complete_statement(statement):
                    if statement.strip():
                        connection.execute(statement)
                    statement = ""
            self.assertFalse(statement.strip())
            connection.commit()
        except Exception:
            connection.rollback()
            raise

    def test_existing_users_characters_teams_and_memberships_survive(self):
        db = self.make_database()
        owner_id = db.execute(
            "INSERT INTO users (username, password_hash, sync_token) VALUES ('Owner', 'owner-hash', 'sync-owner')"
        ).lastrowid
        member_id = db.execute(
            "INSERT INTO users (username, password_hash, sync_token) VALUES ('Member', 'member-hash', 'sync-member')"
        ).lastrowid
        character_id = db.execute(
            "INSERT INTO characters (user_id, name, realm) VALUES (?, 'Speeral', 'Zuljin')",
            (owner_id,),
        ).lastrowid
        team_id = db.execute(
            "INSERT INTO teams (name, invite_code, created_by) VALUES ('Raid', 'invite', ?)",
            (owner_id,),
        ).lastrowid
        membership_id = db.execute(
            "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
            (team_id, member_id),
        ).lastrowid
        keystone_id = db.execute(
            "INSERT INTO keystones (character_id, has_keystone, keystone_level) VALUES (?, 1, 12)",
            (character_id,),
        ).lastrowid
        invitation_id = db.execute(
            "INSERT INTO team_invitations (team_id, invited_user_id, invited_by_user_id, expires_at) "
            "VALUES (?, ?, ?, '2099-01-01T00:00:00Z')",
            (team_id, member_id, owner_id),
        ).lastrowid
        db.commit()

        self.apply_battlenet_migration_like_d1(db)

        self.assertEqual(
            db.execute("SELECT id, username, password_hash FROM users ORDER BY id").fetchall(),
            [(owner_id, "Owner", "owner-hash"), (member_id, "Member", "member-hash")],
        )
        self.assertEqual(db.execute("SELECT id, user_id FROM characters").fetchall(), [(character_id, owner_id)])
        self.assertEqual(db.execute("SELECT id, created_by FROM teams").fetchall(), [(team_id, owner_id)])
        self.assertEqual(
            db.execute("SELECT id, team_id, user_id FROM team_members").fetchall(),
            [(membership_id, team_id, member_id)],
        )
        self.assertEqual(
            db.execute("SELECT id, character_id, keystone_level FROM keystones").fetchall(),
            [(keystone_id, character_id, 12)],
        )
        self.assertEqual(
            db.execute(
                "SELECT id, team_id, invited_user_id, invited_by_user_id FROM team_invitations"
            ).fetchall(),
            [(invitation_id, team_id, member_id, owner_id)],
        )
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_nullable_password_identity_constraints_and_cascade(self):
        db = self.make_database()
        self.apply_battlenet_migration_like_d1(db)
        user_id = db.execute(
            "INSERT INTO users (username, password_hash, sync_token) VALUES ('BattleOnly', NULL, 'sync-bnet')"
        ).lastrowid
        db.execute(
            "INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name) "
            "VALUES (?, 'battlenet', 'stable-subject', 'Display#1234')",
            (user_id,),
        )
        self.assertIsNone(db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()[0])
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name) "
                "VALUES (?, 'battlenet', 'other-subject', 'Other#1234')",
                (user_id,),
            )
        other_id = db.execute(
            "INSERT INTO users (username, password_hash, sync_token) VALUES ('Other', 'hash', 'sync-other')"
        ).lastrowid
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name) "
                "VALUES (?, 'battlenet', 'stable-subject', 'Renamed#9999')",
                (other_id,),
            )
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        self.assertEqual(db.execute("SELECT COUNT(*) FROM user_identities").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
