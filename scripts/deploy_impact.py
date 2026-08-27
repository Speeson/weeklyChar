from __future__ import annotations

import argparse
import json
import posixpath
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from release_changes import ChangesetError, validate_changeset


DIMENSIONS = (
    "web",
    "worker",
    "db",
    "client_build",
    "client_release",
    "addon",
    "addon_release",
)

EXTERNAL_ADDON_RELEASE = ("addon", "addon_release")


@dataclass
class Impact:
    reasons: dict[str, list[str]] = field(default_factory=lambda: {key: [] for key in DIMENSIONS})
    known_no_impact_paths: list[str] = field(default_factory=list)
    unknown_paths: list[str] = field(default_factory=list)
    outside_paths: list[str] = field(default_factory=list)

    @property
    def dimensions(self) -> dict[str, bool]:
        return {key: bool(self.reasons[key]) for key in DIMENSIONS}

    def add(self, dimensions: Iterable[str], path: str) -> None:
        for dimension in dimensions:
            if path not in self.reasons[dimension]:
                self.reasons[dimension].append(path)

    def no_impact(self, path: str) -> None:
        if path not in self.known_no_impact_paths:
            self.known_no_impact_paths.append(path)

    def unknown(self, path: str) -> None:
        if path not in self.unknown_paths:
            self.unknown_paths.append(path)

    def outside(self, path: str) -> None:
        if path not in self.outside_paths:
            self.outside_paths.append(path)

    def as_json(self) -> dict[str, object]:
        return {
            **self.dimensions,
            "reasons": self.reasons,
            "known_no_impact_paths": self.known_no_impact_paths,
            "unknown_paths": self.unknown_paths,
            "outside_paths": self.outside_paths,
        }


def normalize_path(raw_path: str, repo_root: Path | None = None) -> tuple[str | None, bool]:
    value = raw_path.strip().strip('"').strip("'").replace("\\", "/")
    if not value:
        return None, False

    path = Path(value)
    if path.is_absolute():
        root = (repo_root or Path.cwd()).resolve()
        try:
            value = path.resolve().relative_to(root).as_posix()
        except ValueError:
            return value, True

    while value.startswith("./"):
        value = value[2:]

    normalized = posixpath.normpath(value)
    if normalized in ("", "."):
        return None, False
    if normalized.startswith("../") or normalized == ".." or normalized.startswith("/"):
        return normalized, True
    return normalized, False


def classify_paths(paths: Iterable[str], *, addon_changed: bool = False, repo_root: Path | None = None) -> Impact:
    impact = Impact()
    root = (repo_root or Path.cwd()).resolve()

    if addon_changed:
        impact.add(EXTERNAL_ADDON_RELEASE, "<external:addon>")

    for raw_path in paths:
        path, outside = normalize_path(raw_path, root)
        if path is None:
            continue
        if outside:
            impact.outside(path)
            continue
        classify_path(path, impact, repo_root=root)

    return impact


def classify_path(path: str, impact: Impact, *, repo_root: Path | None = None) -> None:
    if classify_pending_changeset(path, impact, repo_root=repo_root or Path.cwd()):
        return

    if is_known_no_impact(path):
        impact.no_impact(path)
        return

    if path.startswith("keystone-worker/migrations/"):
        impact.add(("worker", "db"), path)
        return

    if path.startswith("keystone-worker/src/"):
        impact.add(("worker",), path)
        return

    if is_worker_config(path):
        impact.add(("worker",), path)
        return

    if path.startswith("keystone-web/"):
        if is_web_product_path(path):
            impact.add(("web",), path)
        else:
            impact.unknown(path)
        return

    if path.startswith("keystone-client-next/"):
        if is_tauri_test_or_output(path):
            impact.no_impact(path)
        else:
            impact.add(("client_build", "client_release"), path)
        return

    if path == "scripts/build_client_sidecar.py":
        impact.add(("client_build", "client_release"), path)
        return

    if path == "scripts/tauri_release.py":
        impact.no_impact(path)
        return

    if path.startswith("keystone-client/"):
        if is_client_release_path(path):
            impact.add(("client_build", "client_release"), path)
        elif is_client_build_only_path(path):
            impact.add(("client_build",), path)
        else:
            impact.unknown(path)
        return

    impact.unknown(path)


def classify_pending_changeset(path: str, impact: Impact, *, repo_root: Path) -> bool:
    if posixpath.dirname(path) != ".changes/pending" or not path.endswith(".json"):
        return False

    changeset_path = repo_root.joinpath(*path.split("/"))
    if not changeset_path.exists():
        impact.no_impact(path)
        return True

    try:
        with changeset_path.open(encoding="utf-8") as handle:
            changeset = validate_changeset(changeset_path, json.load(handle))
    except (ChangesetError, json.JSONDecodeError, OSError, UnicodeError):
        impact.unknown(path)
        return True

    if "client" in changeset.components:
        impact.add(("client_release",), path)
    else:
        impact.no_impact(path)
    return True


def is_known_no_impact(path: str) -> bool:
    exact = {
        ".gitignore",
        "AGENTS.md",
        "LICENSE",
        "README.md",
        "RELEASE_WORKFLOW.md",
        "release-assets/KeystoneSync-v0.1.13.zip",
        "keystone-worker/README.md",
        "keystone-web/AGENTS.md",
        "keystone-web/CLAUDE.md",
        "keystone-web/README.md",
        "keystone-client/README.md",
        "keystone-client/.gitignore",
        "keystone-client/addon/README.md",
        "keystone-client/addon/KeystoneSync/KeystoneSync.lua",
        "keystone-client/addon/KeystoneSync/KeystoneSync.toc",
        "scripts/check_addon_sync.py",
        "scripts/deploy_impact.py",
        "scripts/release_changes.py",
        "scripts/release_state.py",
        "scripts/sync_addon.py",
        "scripts/validate_addon.py",
    }
    prefixes = (
        ".github/",
        ".agents/",
        ".changes/",
        "docs/",
        "tests/",
        "keystone-worker/tests/",
        "keystone-client/build/",
        "keystone-client/dist/",
        "keystone-client/installer/output/",
        "keystone-client/design/",
        "keystone-client/node_modules/",
        "keystone-client/test-results/",
        "keystone-client/playwright-report/",
        "keystone-client/tests/",
        "keystone-client/src/generated/",
        "keystone-client/src-tauri/binaries/",
        "keystone-client/src-tauri/target/",
        "KeystoneSync/",
        "keystone-api/",
        "keystone-sync-client/",
    )
    name = posixpath.basename(path)
    return (
        path in exact
        or any(path.startswith(prefix) for prefix in prefixes)
        or (path.startswith("keystone-client/src/") and ".test." in name)
    )


def is_worker_config(path: str) -> bool:
    exact = {
        "keystone-worker/package.json",
        "keystone-worker/package-lock.json",
        "keystone-worker/tsconfig.json",
        "keystone-worker/tsconfig.test.json",
        "keystone-worker/wrangler.jsonc",
    }
    return path in exact


def is_web_product_path(path: str) -> bool:
    exact = {
        "keystone-web/eslint.config.mjs",
        "keystone-web/next.config.ts",
        "keystone-web/package.json",
        "keystone-web/package-lock.json",
        "keystone-web/postcss.config.mjs",
        "keystone-web/tsconfig.json",
    }
    prefixes = (
        "keystone-web/app/",
        "keystone-web/data/",
        "keystone-web/lib/",
        "keystone-web/public/",
    )
    return path in exact or any(path.startswith(prefix) for prefix in prefixes)


def is_client_release_path(path: str) -> bool:
    exact = {
        "keystone-client/bg.jpg",
        "keystone-client/icon.ico",
        "keystone-client/KeystoneClient.exe",
        "keystone-client/requirements.txt",
        "keystone-client/sidecar/requirements.txt",
        "keystone-client/installer/KeystoneClient.iss",
        "keystone-client/package.json",
        "keystone-client/package-lock.json",
        "keystone-client/index.html",
        "keystone-client/vite.config.ts",
        "keystone-client/tsconfig.json",
        "keystone-client/tsconfig.node.json",
        "keystone-client/playwright.config.ts",
    }
    historical_python = {
        "addon_installer.py",
        "addon_service.py",
        "addon_updater.py",
        "auth.py",
        "auth_service.py",
        "bridge_main.py",
        "bridge_protocol.py",
        "character_service.py",
        "config.py",
        "installer_window.py",
        "main.py",
        "main_window.py",
        "profile_service.py",
        "settings_service.py",
        "sync_service.py",
        "sync_worker.py",
        "tray_app.py",
        "wow_path.py",
        "wow_service.py",
    }
    prefixes = (
        "keystone-client/src/",
        "keystone-client/src-tauri/",
    )
    return (
        path in exact
        or path in {f"keystone-client/{name}" for name in historical_python}
        or (path.startswith("keystone-client/sidecar/") and path.endswith(".py"))
        or any(path.startswith(prefix) for prefix in prefixes)
    )


def is_client_bridge_migration_path(path: str) -> bool:
    exact = {
        "keystone-client/auth_service.py",
        "keystone-client/addon_service.py",
        "keystone-client/bridge_main.py",
        "keystone-client/bridge_protocol.py",
        "keystone-client/settings_service.py",
        "keystone-client/sync_service.py",
        "keystone-client/wow_service.py",
    }
    return path in exact


def is_tauri_test_or_output(path: str) -> bool:
    output_prefixes = (
        "keystone-client-next/dist/",
        "keystone-client-next/node_modules/",
        "keystone-client-next/src-tauri/target/",
        "keystone-client-next/tests/",
    )
    name = posixpath.basename(path)
    return (
        path.startswith(output_prefixes)
        or ".test." in name
        or "/test/" in path
        or path == "keystone-client-next/README.md"
    )


def is_client_build_only_path(path: str) -> bool:
    exact = {
        "keystone-client/build.bat",
        "keystone-client/build_installer.bat",
        "keystone-client/VERSION",
        "keystone-client/installer/version.ini",
    }
    return path in exact


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Classify KeystoneSync deployment, build, and release impact.")
    parser.add_argument("--files", nargs="*", default=[], help="Changed repository paths to classify.")
    parser.add_argument("--stdin", action="store_true", help="Read newline-separated changed paths from stdin.")
    parser.add_argument("--allow-empty", action="store_true", help="Allow an empty changed-path set.")
    parser.add_argument(
        "--addon-changed",
        action="store_true",
        help="Represent a change in the external canonical Speeson/KeystoneSync addon repository.",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when unknown or outside paths are present.")
    return parser


def read_stdin_paths() -> list[str]:
    return [line.rstrip("\n") for line in sys.stdin if line.strip()]


def render_text(impact: Impact) -> str:
    lines = ["Deployment impact:"]
    dimensions = impact.dimensions
    for dimension in DIMENSIONS:
        lines.append(f"{dimension.upper()}={str(dimensions[dimension]).lower()}")
        for path in impact.reasons[dimension]:
            lines.append(f"  - {path}")

    if impact.unknown_paths:
        lines.append("UNKNOWN_PATHS:")
        for path in impact.unknown_paths:
            lines.append(f"  - {path}")

    if impact.outside_paths:
        lines.append("OUTSIDE_PATHS:")
        for path in impact.outside_paths:
            lines.append(f"  - {path}")

    if impact.known_no_impact_paths:
        lines.append("KNOWN_NO_PRODUCT_IMPACT:")
        for path in impact.known_no_impact_paths:
            lines.append(f"  - {path}")

    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    paths = list(args.files)
    if args.stdin:
        paths.extend(read_stdin_paths())

    if not paths and not args.addon_changed and not args.allow_empty:
        parser.error("provide --files, --stdin, or --addon-changed")

    impact = classify_paths(paths, addon_changed=args.addon_changed, repo_root=Path.cwd())

    if args.json:
        print(json.dumps(impact.as_json(), indent=2, sort_keys=True))
    else:
        print(render_text(impact))

    if args.strict and (impact.unknown_paths or impact.outside_paths):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
