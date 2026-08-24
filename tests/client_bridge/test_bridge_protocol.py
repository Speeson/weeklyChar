from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

from bridge_protocol import (  # noqa: E402
    ERROR_INTERNAL_ERROR,
    ERROR_INVALID_REQUEST,
    ERROR_UNSUPPORTED_PROTOCOL_VERSION,
    MAX_LINE_BYTES,
    PROTOCOL_VERSION,
    ProtocolError,
    error_response,
    event_message,
    success_response,
    validate_request,
)


class BridgeProtocolTests(unittest.TestCase):
    def test_constants(self):
        self.assertEqual(PROTOCOL_VERSION, 1)
        self.assertEqual(MAX_LINE_BYTES, 1024 * 1024)

    def test_success_response_shape(self):
        self.assertEqual(
            success_response("request-1", {"pong": True}),
            {
                "protocolVersion": 1,
                "type": "response",
                "id": "request-1",
                "ok": True,
                "data": {"pong": True},
                "error": None,
            },
        )

    def test_error_response_shape(self):
        self.assertEqual(
            error_response("request-1", ERROR_INTERNAL_ERROR, "Something failed."),
            {
                "protocolVersion": 1,
                "type": "response",
                "id": "request-1",
                "ok": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Something failed.",
                },
            },
        )

    def test_event_message_shape(self):
        self.assertEqual(
            event_message("system.ready", {"capabilities": ["system.ping"]}),
            {
                "protocolVersion": 1,
                "type": "event",
                "event": "system.ready",
                "data": {"capabilities": ["system.ping"]},
            },
        )

    def test_valid_request(self):
        request = {
            "protocolVersion": 1,
            "id": "request-1",
            "command": "system.ping",
            "payload": {},
        }

        self.assertEqual(validate_request(request), request)

    def assertProtocolError(self, value, code, request_id=None):
        with self.assertRaises(ProtocolError) as caught:
            validate_request(value)
        self.assertEqual(caught.exception.code, code)
        self.assertEqual(caught.exception.request_id, request_id)

    def test_invalid_top_level_type(self):
        self.assertProtocolError([], ERROR_INVALID_REQUEST)

    def test_missing_protocol_version(self):
        self.assertProtocolError(
            {"id": "request-1", "command": "system.ping", "payload": {}},
            ERROR_INVALID_REQUEST,
            "request-1",
        )

    def test_wrong_protocol_version(self):
        self.assertProtocolError(
            {"protocolVersion": 2, "id": "request-1", "command": "system.ping", "payload": {}},
            ERROR_UNSUPPORTED_PROTOCOL_VERSION,
            "request-1",
        )

    def test_missing_id(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "command": "system.ping", "payload": {}},
            ERROR_INVALID_REQUEST,
        )

    def test_empty_id(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "id": "", "command": "system.ping", "payload": {}},
            ERROR_INVALID_REQUEST,
        )

    def test_missing_command(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "id": "request-1", "payload": {}},
            ERROR_INVALID_REQUEST,
            "request-1",
        )

    def test_empty_command(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "id": "request-1", "command": "", "payload": {}},
            ERROR_INVALID_REQUEST,
            "request-1",
        )

    def test_payload_not_object(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "id": "request-1", "command": "system.ping", "payload": []},
            ERROR_INVALID_REQUEST,
            "request-1",
        )

    def test_missing_payload_is_invalid(self):
        self.assertProtocolError(
            {"protocolVersion": 1, "id": "request-1", "command": "system.ping"},
            ERROR_INVALID_REQUEST,
            "request-1",
        )


if __name__ == "__main__":
    unittest.main()
