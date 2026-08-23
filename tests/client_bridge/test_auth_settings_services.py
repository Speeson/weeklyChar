from __future__ import annotations

import json
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import requests


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

import auth_service  # noqa: E402
import config as config_module  # noqa: E402
import settings_service  # noqa: E402


class FakeResponse:
    def __init__(self, *, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload
        self.ok = 200 <= status_code < 300

    def json(self):
        if isinstance(self._payload, BaseException):
            raise self._payload
        return self._payload


class FakeHttp:
    def __init__(self, *, post_result=None, get_result=None, post_error=None, get_error=None):
        self.post_result = post_result
        self.get_result = get_result
        self.post_error = post_error
        self.get_error = get_error
        self.post = mock.Mock(side_effect=self._post)
        self.get = mock.Mock(side_effect=self._get)
        self.exceptions = requests.exceptions

    def _post(self, *args, **kwargs):
        if self.post_error:
            raise self.post_error
        return self.post_result

    def _get(self, *args, **kwargs):
        if self.get_error:
            raise self.get_error
        return self.get_result


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.saved_cfg = None
        self.save_patcher = mock.patch(
            "auth_service.config_module.save", side_effect=self._capture_save
        )
        self.save_patcher.start()

    def tearDown(self) -> None:
        if self.save_patcher is not None:
            self.save_patcher.stop()

    def _capture_save(self, cfg: dict) -> None:
        self.saved_cfg = json.loads(json.dumps(cfg))

    def base_config(self) -> dict:
        return {
            "api_url": "https://api-keystonesync.esgarpe.dev",
            "sync_token": None,
            "access_token": None,
            "username": None,
            "avatar_url": None,
            "login_at": None,
            "wow_install_path": "C:/Games/World of Warcraft",
            "wow_accounts_selected": ["A"],
            "start_minimized": True,
            "minimize_on_close": False,
            "lang": "es",
            "custom_key": "preserve",
        }

    def test_successful_login_persists_tokens_but_returns_safe_state(self) -> None:
        cfg = self.base_config()
        http = FakeHttp(
            post_result=FakeResponse(status_code=200, payload={"accessToken": "access"}),
            get_result=FakeResponse(
                    status_code=200,
                    payload={
                        "syncToken": "sync",
                        "username": "player",
                        "avatarUrl": "https://cdn/avatar.png",
                    },
                ),
        )
        with mock.patch("auth_service._http_client", return_value=http):
            state = auth_service.login(cfg, " player ", "password")

        self.assertEqual(
            state,
            {"authenticated": True, "username": "player", "avatarUrl": "https://cdn/avatar.png"},
        )
        self.assertNotIn("sync_token", state)
        self.assertNotIn("access_token", state)
        self.assertEqual(self.saved_cfg["sync_token"], "sync")
        self.assertEqual(self.saved_cfg["access_token"], "access")
        self.assertEqual(self.saved_cfg["username"], "player")
        self.assertNotIn("password", json.dumps(self.saved_cfg))
        http.post.assert_called_once_with(
            "https://api-keystonesync.esgarpe.dev/api/auth/login",
            json={"username": "player", "password": "password"},
            timeout=10,
        )
        http.get.assert_called_once_with(
            "https://api-keystonesync.esgarpe.dev/api/me",
            headers={"Authorization": "Bearer access"},
            timeout=10,
        )

    def test_invalid_credentials_are_stable_error(self) -> None:
        http = FakeHttp(
            post_result=FakeResponse(status_code=401, payload={"detail": "Usuario inválido."})
        )
        with mock.patch("auth_service._http_client", return_value=http):
            with self.assertRaises(auth_service.AuthError) as caught:
                auth_service.login(self.base_config(), "player", "password")

        self.assertEqual(caught.exception.code, auth_service.AUTH_INVALID_CREDENTIALS)
        self.assertEqual(caught.exception.message, "Usuario inválido.")

    def test_connection_failure_is_stable_error(self) -> None:
        http = FakeHttp(post_error=requests.exceptions.ConnectionError("secret host detail"))
        with mock.patch("auth_service._http_client", return_value=http):
            with self.assertRaises(auth_service.AuthError) as caught:
                auth_service.login(self.base_config(), "player", "password")

        self.assertEqual(caught.exception.code, auth_service.AUTH_CONNECTION_ERROR)
        self.assertNotIn("secret host detail", caught.exception.message)

    def test_malformed_login_response_is_stable_error(self) -> None:
        http = FakeHttp(post_result=FakeResponse(status_code=200, payload={}))
        with mock.patch("auth_service._http_client", return_value=http):
            with self.assertRaises(auth_service.AuthError) as caught:
                auth_service.login(self.base_config(), "player", "password")

        self.assertEqual(caught.exception.code, auth_service.AUTH_INVALID_RESPONSE)

    def test_me_failure_is_stable_error(self) -> None:
        http = FakeHttp(
            post_result=FakeResponse(status_code=200, payload={"accessToken": "access"}),
            get_result=FakeResponse(status_code=401, payload={"detail": "bad token"}),
        )
        with mock.patch("auth_service._http_client", return_value=http):
            with self.assertRaises(auth_service.AuthError) as caught:
                auth_service.login(self.base_config(), "player", "password")

        self.assertEqual(caught.exception.code, auth_service.AUTH_INVALID_RESPONSE)

    def test_registration_posts_complete_contract_without_persisting_credentials(self) -> None:
        cfg = self.base_config()
        http = FakeHttp(
            post_result=FakeResponse(
                status_code=201,
                payload={
                    "username": "newplayer",
                    "email": "new@example.com",
                    "emailVerified": False,
                    "message": "Cuenta creada. Revisa tu email para verificarla.",
                },
            )
        )
        payload = {
            "firstName": "New",
            "lastName": "Player",
            "email": "new@example.com",
            "username": "newplayer",
            "password": "secret1",
            "confirmPassword": "secret1",
            "dateOfBirth": "1990-05-14",
        }

        with mock.patch("auth_service._http_client", return_value=http):
            result = auth_service.register(cfg, payload)

        self.assertEqual(result["username"], "newplayer")
        self.assertFalse(result["emailVerified"])
        self.assertIsNone(self.saved_cfg)
        http.post.assert_called_once_with(
            "https://api-keystonesync.esgarpe.dev/api/auth/register",
            json=payload,
            timeout=10,
        )

    def test_logout_clears_session_only_and_preserves_settings(self) -> None:
        cfg = self.base_config()
        cfg.update(
            {
                "sync_token": "sync",
                "access_token": "access",
                "username": "player",
                "avatar_url": "avatar",
                "login_at": time.time(),
                "cached_characters": [{"name": "Char"}],
            }
        )

        state = auth_service.logout(cfg)

        self.assertEqual(state, {"authenticated": False, "username": None, "avatarUrl": None})
        self.assertIsNone(self.saved_cfg["sync_token"])
        self.assertIsNone(self.saved_cfg["access_token"])
        self.assertIsNone(self.saved_cfg["login_at"])
        self.assertEqual(self.saved_cfg["cached_characters"], [])
        self.assertEqual(self.saved_cfg["wow_install_path"], "C:/Games/World of Warcraft")
        self.assertEqual(self.saved_cfg["wow_accounts_selected"], ["A"])
        self.assertEqual(self.saved_cfg["custom_key"], "preserve")

    def test_config_file_schema_remains_legacy_compatible(self) -> None:
        self.save_patcher.stop()
        self.save_patcher = None
        original_dir = config_module._DIR
        original_file = config_module._FILE
        with tempfile.TemporaryDirectory() as tmp:
            try:
                config_module._DIR = Path(tmp) / "KeystoneClient"
                config_module._FILE = config_module._DIR / "config.json"
                cfg = config_module.load()
                cfg["sync_token"] = "sync"
                cfg["access_token"] = "access"
                cfg["username"] = "player"
                cfg["avatar_url"] = "avatar"
                cfg["login_at"] = time.time()
                cfg["custom_key"] = "preserved"
                config_module.save(cfg)

                loaded = config_module.load()
            finally:
                config_module._DIR = original_dir
                config_module._FILE = original_file

        self.assertEqual(loaded["custom_key"], "preserved")
        self.assertTrue(config_module.is_session_valid(loaded))


class SettingsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.saved_cfg = None
        self.save_patcher = mock.patch(
            "settings_service.config_module.save", side_effect=self._capture_save
        )
        self.save_patcher.start()

    def tearDown(self) -> None:
        self.save_patcher.stop()

    def _capture_save(self, cfg: dict) -> None:
        self.saved_cfg = json.loads(json.dumps(cfg))

    def test_get_settings_exposes_safe_whitelist_only(self) -> None:
        cfg = {
            "start_minimized": True,
            "minimize_on_close": False,
            "lang": "en",
            "sync_token": "sync",
            "access_token": "access",
        }

        settings = settings_service.get_settings(cfg)

        self.assertEqual(
            settings,
            {"startMinimized": True, "minimizeOnClose": False, "lang": "en"},
        )
        self.assertNotIn("sync_token", settings)
        self.assertNotIn("access_token", settings)

    def test_update_settings_is_partial_and_preserves_unrelated_keys(self) -> None:
        cfg = {
            "start_minimized": False,
            "minimize_on_close": False,
            "lang": "es",
            "sync_token": "sync",
            "unknown_future_key": {"x": 1},
        }

        settings = settings_service.update_settings(
            cfg, {"startMinimized": True, "lang": "en"}
        )

        self.assertEqual(
            settings,
            {"startMinimized": True, "minimizeOnClose": False, "lang": "en"},
        )
        self.assertEqual(self.saved_cfg["sync_token"], "sync")
        self.assertEqual(self.saved_cfg["unknown_future_key"], {"x": 1})

    def test_update_rejects_unknown_field(self) -> None:
        with self.assertRaises(settings_service.SettingsError):
            settings_service.update_settings({"lang": "es"}, {"sync_token": "x"})

    def test_update_rejects_wrong_type(self) -> None:
        with self.assertRaises(settings_service.SettingsError):
            settings_service.update_settings({"lang": "es"}, {"startMinimized": "yes"})


if __name__ == "__main__":
    unittest.main()
