from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path


CLIENT_ROOT = Path(__file__).resolve().parents[2] / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

from profile_service import (  # noqa: E402
    PROFILE_INVALID_AVATAR,
    PROFILE_NOT_AUTHENTICATED,
    PROFILE_UPDATE_FAILED,
    ProfileError,
    ProfileService,
)


class FakeRequestError(Exception):
    pass


class FakeResponse:
    def __init__(self, ok=True):
        self.ok = ok


class FakeSession:
    class exceptions:
        RequestException = FakeRequestError

    def __init__(self, *, ok=True, error=False):
        self.ok = ok
        self.error = error
        self.calls = []

    def patch(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise FakeRequestError()
        return FakeResponse(self.ok)


def valid_config():
    return {
        "api_url": "https://api.test",
        "access_token": "access-secret",
        "sync_token": "sync-secret",
        "login_at": time.time(),
        "username": "player",
        "avatar_url": "https://img.test/old.jpg",
    }


class ProfileServiceTests(unittest.TestCase):
    def test_requires_a_valid_session_before_calling_the_api(self):
        session = FakeSession()
        with self.assertRaises(ProfileError) as raised:
            ProfileService(session=session).set_avatar(
                {"api_url": "https://api.test"},
                "https://img.test/new.jpg",
                [{"avatarUrl": "https://img.test/new.jpg"}],
            )
        self.assertEqual(raised.exception.code, PROFILE_NOT_AUTHENTICATED)
        self.assertEqual(session.calls, [])

    def test_updates_only_an_avatar_from_the_character_state(self):
        cfg = valid_config()
        saved = []
        session = FakeSession()
        service = ProfileService(session=session, config_saver=lambda value: saved.append(dict(value)))

        result = service.set_avatar(
            cfg,
            "https://img.test/new.jpg",
            [{"id": "one", "avatarUrl": "https://img.test/new.jpg"}],
        )

        self.assertEqual(result["avatarUrl"], "https://img.test/new.jpg")
        self.assertEqual(saved[0]["avatar_url"], "https://img.test/new.jpg")
        self.assertEqual(session.calls[0][0], "https://api.test/api/me/avatar")
        self.assertEqual(session.calls[0][1]["json"], {"avatarUrl": "https://img.test/new.jpg"})
        self.assertEqual(session.calls[0][1]["headers"], {"Authorization": "Bearer access-secret"})

    def test_rejects_arbitrary_urls_without_calling_the_api(self):
        session = FakeSession()
        with self.assertRaises(ProfileError) as raised:
            ProfileService(session=session).set_avatar(
                valid_config(),
                "https://attacker.test/avatar.jpg",
                [{"avatarUrl": "https://img.test/allowed.jpg"}],
            )
        self.assertEqual(raised.exception.code, PROFILE_INVALID_AVATAR)
        self.assertEqual(session.calls, [])

    def test_failed_update_preserves_the_previous_avatar(self):
        cfg = valid_config()
        session = FakeSession(ok=False)
        with self.assertRaises(ProfileError) as raised:
            ProfileService(session=session).set_avatar(
                cfg,
                "https://img.test/new.jpg",
                [{"avatarUrl": "https://img.test/new.jpg"}],
            )
        self.assertEqual(raised.exception.code, PROFILE_UPDATE_FAILED)
        self.assertEqual(cfg["avatar_url"], "https://img.test/old.jpg")


if __name__ == "__main__":
    unittest.main()
