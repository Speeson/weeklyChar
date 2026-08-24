from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any


LOGICAL_SIDECAR_NAME = "keystone-client-core"
DEFAULT_TARGET_ENV = "TAURI_TARGET_TRIPLE"


class SidecarBuildError(RuntimeError):
    pass


def repository_root() -> Path:
    return Path(__file__).resolve().parents[1]


def extension_for_platform(platform: str = sys.platform) -> str:
    return ".exe" if platform == "win32" else ""


def physical_sidecar_filename(
    logical_name: str, target_triple: str, platform: str = sys.platform
) -> str:
    return f"{logical_name}-{target_triple}{extension_for_platform(platform)}"


def determine_target_triple(explicit_target: str | None = None) -> str:
    if explicit_target:
        return explicit_target

    env_target = os.environ.get(DEFAULT_TARGET_ENV)
    if env_target:
        return env_target

    completed = subprocess.run(
        [rustc_executable(), "--print", "host-tuple"],
        check=True,
        capture_output=True,
        text=True,
    )
    target = completed.stdout.strip()
    if not target:
        raise SidecarBuildError("rustc did not report a target triple.")
    return target


def rustc_executable() -> str:
    discovered = shutil.which("rustc")
    if discovered:
        return discovered

    cargo_home = Path(os.environ.get("CARGO_HOME", Path.home() / ".cargo"))
    candidate = cargo_home / "bin" / ("rustc.exe" if sys.platform == "win32" else "rustc")
    if candidate.exists():
        return str(candidate)

    raise SidecarBuildError("rustc was not found on PATH or in the Cargo home.")


def pyinstaller_command(
    *,
    python_executable: str,
    repo_root: Path,
    temp_dir: Path,
) -> list[str]:
    sidecar_dir = repo_root / "keystone-client" / "sidecar"
    return [
        python_executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",
        "--hidden-import",
        "requests",
        "--name",
        LOGICAL_SIDECAR_NAME,
        "--paths",
        str(sidecar_dir),
        "--add-data",
        f"{repo_root / 'keystone-client' / 'VERSION'}{os.pathsep}.",
        "--distpath",
        str(temp_dir / "dist"),
        "--workpath",
        str(temp_dir / "build"),
        "--specpath",
        str(temp_dir / "spec"),
        str(sidecar_dir / "bridge_main.py"),
    ]


def copy_sidecar_output(source: Path, destination: Path) -> None:
    if not source.exists():
        raise SidecarBuildError(f"PyInstaller output was not created: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def sidecar_sources(repo_root: Path) -> list[Path]:
    sidecar_dir = repo_root / "keystone-client" / "sidecar"
    return [
        *sorted(sidecar_dir.glob("*.py")),
        sidecar_dir / "requirements.txt",
        repo_root / "keystone-client" / "VERSION",
        repo_root / "scripts" / "build_client_sidecar.py",
    ]


def sidecar_needs_rebuild(output_path: Path, sources: list[Path]) -> bool:
    if not output_path.exists():
        return True
    output_mtime = output_path.stat().st_mtime
    return any(source.stat().st_mtime > output_mtime for source in sources)


def _enqueue_lines(stream, lines: queue.Queue[str]) -> None:
    try:
        for line in stream:
            lines.put(line)
    finally:
        lines.put("")


def _read_json_line(lines: queue.Queue[str], timeout: float) -> dict[str, Any]:
    try:
        line = lines.get(timeout=timeout)
    except queue.Empty as exc:
        raise SidecarBuildError("Timed out waiting for sidecar stdout.") from exc
    if line == "":
        raise SidecarBuildError("Sidecar exited before producing expected output.")
    try:
        return json.loads(line)
    except json.JSONDecodeError as exc:
        raise SidecarBuildError(f"Sidecar stdout was not valid JSON: {line!r}") from exc


def _send_request(process: subprocess.Popen[str], request_id: str, command: str) -> None:
    if process.stdin is None:
        raise SidecarBuildError("Sidecar stdin pipe was not available.")
    process.stdin.write(
        json.dumps(
            {
                "protocolVersion": 1,
                "id": request_id,
                "command": command,
                "payload": {},
            },
            separators=(",", ":"),
        )
        + "\n"
    )
    process.stdin.flush()


def smoke_sidecar(binary_path: Path) -> dict[str, Any]:
    appdata_dir = tempfile.TemporaryDirectory()
    env = os.environ.copy()
    env["APPDATA"] = appdata_dir.name
    process = subprocess.Popen(
        [str(binary_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env=env,
    )

    assert process.stdout is not None
    stdout_lines: queue.Queue[str] = queue.Queue()
    stdout_thread = threading.Thread(
        target=_enqueue_lines, args=(process.stdout, stdout_lines), daemon=True
    )
    stdout_thread.start()

    try:
        ready = _read_json_line(stdout_lines, timeout=10)
        if ready.get("type") != "event" or ready.get("event") != "system.ready":
            raise SidecarBuildError(f"Unexpected ready event: {ready}")

        requests = [
            ("1", "system.ping"),
            ("2", "system.get_state"),
            ("3", "system.ping"),
        ]
        responses: list[dict[str, Any]] = []
        for request_id, command in requests:
            _send_request(process, request_id, command)
            response = _read_json_line(stdout_lines, timeout=5)
            if response.get("type") != "response" or response.get("id") != request_id:
                raise SidecarBuildError(f"Unexpected response for {command}: {response}")
            if response.get("ok") is not True:
                raise SidecarBuildError(f"Sidecar command failed for {command}: {response}")
            responses.append(response)

        if responses[0].get("data") != {"pong": True}:
            raise SidecarBuildError(f"Unexpected ping response: {responses[0]}")
        expected_state = {
            "protocolVersion": 1,
            "bridge": "ready",
            "auth": {"authenticated": False, "username": None, "avatarUrl": None},
            "settings": {
                "startMinimized": False,
                "minimizeOnClose": False,
                "lang": "es",
            },
            "wow": {
                "install": {
                    "detected": False,
                    "installPath": None,
                    "retailPath": None,
                    "addonsPath": None,
                },
                "accounts": [],
                "selectedAccounts": [],
                "configurationComplete": False,
            },
            "sync": {
                "running": False,
                "state": "idle",
                "lastSyncAt": None,
                "lastSuccessAt": None,
                "lastError": None,
                "selectedAccounts": 0,
            },
            "characters": {
                "characters": [],
                "refreshing": False,
                "source": "none",
                "lastRefreshAt": None,
                "lastError": None,
            },
            "addon": {
                "installed": False,
                "installedVersion": None,
                "latestVersion": None,
                "state": "not-installed",
                "cacheAvailable": False,
                "lastCheckAt": None,
                "source": None,
                "message": "",
                "operation": None,
            },
        }
        if responses[1].get("data") != expected_state:
            raise SidecarBuildError(f"Unexpected get_state response: {responses[1]}")
        if responses[2].get("data") != {"pong": True}:
            raise SidecarBuildError(f"Unexpected second ping response: {responses[2]}")

        if process.stdin is not None:
            process.stdin.close()
        exit_code = process.wait(timeout=5)
        if exit_code != 0:
            raise SidecarBuildError(f"Sidecar exited with code {exit_code}.")

        return {
            "ready": "PASS",
            "ping": "PASS",
            "get_state": "PASS",
            "second_ping": "PASS",
            "eof": "PASS",
        }
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        appdata_dir.cleanup()


def build_sidecar(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = repository_root()
    target_triple = determine_target_triple(args.target)
    temp_dir = repo_root / ".tmp" / "client-sidecar"
    if args.clean and temp_dir.exists():
        shutil.rmtree(temp_dir)

    output_dir = Path(args.output_dir) if args.output_dir else (
        repo_root / "keystone-client" / "src-tauri" / "binaries"
    )
    output_path = output_dir / physical_sidecar_filename(
        LOGICAL_SIDECAR_NAME, target_triple, sys.platform
    )
    rebuilt = args.clean or sidecar_needs_rebuild(output_path, sidecar_sources(repo_root))
    if rebuilt:
        command = pyinstaller_command(
            python_executable=sys.executable,
            repo_root=repo_root,
            temp_dir=temp_dir,
        )
        subprocess.run(command, check=True)

        temp_output = (
            temp_dir
            / "dist"
            / f"{LOGICAL_SIDECAR_NAME}{extension_for_platform(sys.platform)}"
        )
        copy_sidecar_output(temp_output, output_path)

    smoke = {"status": "SKIPPED"}
    if not args.skip_smoke:
        smoke = smoke_sidecar(output_path)

    return {
        "sidecar": LOGICAL_SIDECAR_NAME,
        "target": target_triple,
        "output": str(output_path),
        "rebuilt": rebuilt,
        "smoke": smoke,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build KeystoneClient Tauri sidecar.")
    parser.add_argument("--target", help="Rust target triple override.")
    parser.add_argument("--clean", action="store_true", help="Force a clean sidecar rebuild.")
    parser.add_argument("--output-dir", help="Override final Tauri binaries directory.")
    parser.add_argument("--skip-smoke", action="store_true", help="Skip executable smoke test.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        result = build_sidecar(parse_args(argv or sys.argv[1:]))
    except (SidecarBuildError, subprocess.CalledProcessError, OSError) as exc:
        print(f"sidecar build failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
