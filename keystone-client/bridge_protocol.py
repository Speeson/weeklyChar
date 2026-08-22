from __future__ import annotations

from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = 1
MAX_LINE_BYTES = 1024 * 1024

ERROR_INVALID_JSON = "INVALID_JSON"
ERROR_INVALID_REQUEST = "INVALID_REQUEST"
ERROR_UNSUPPORTED_PROTOCOL_VERSION = "UNSUPPORTED_PROTOCOL_VERSION"
ERROR_UNKNOWN_COMMAND = "UNKNOWN_COMMAND"
ERROR_REQUEST_TOO_LARGE = "REQUEST_TOO_LARGE"
ERROR_INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass(frozen=True)
class ProtocolError(Exception):
    code: str
    message: str
    request_id: str | None = None


def success_response(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "response",
        "id": request_id,
        "ok": True,
        "data": data,
        "error": None,
    }


def error_response(request_id: str | None, code: str, message: str) -> dict[str, Any]:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "response",
        "id": request_id,
        "ok": False,
        "data": None,
        "error": {
            "code": code,
            "message": message,
        },
    }


def event_message(event: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "type": "event",
        "event": event,
        "data": data,
    }


def validate_request(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(ERROR_INVALID_REQUEST, "Request must be a JSON object.")

    request_id = value.get("id") if isinstance(value.get("id"), str) and value.get("id") else None

    protocol_version = value.get("protocolVersion")
    if not isinstance(protocol_version, int):
        raise ProtocolError(ERROR_INVALID_REQUEST, "protocolVersion must be an integer.", request_id)
    if protocol_version != PROTOCOL_VERSION:
        raise ProtocolError(
            ERROR_UNSUPPORTED_PROTOCOL_VERSION,
            f"Unsupported protocolVersion {protocol_version}.",
            request_id,
        )

    if not isinstance(value.get("id"), str) or not value.get("id"):
        raise ProtocolError(ERROR_INVALID_REQUEST, "id must be a non-empty string.")

    if not isinstance(value.get("command"), str) or not value.get("command"):
        raise ProtocolError(ERROR_INVALID_REQUEST, "command must be a non-empty string.", value["id"])

    if "payload" not in value or not isinstance(value.get("payload"), dict):
        raise ProtocolError(ERROR_INVALID_REQUEST, "payload must be a JSON object.", value["id"])

    return value
