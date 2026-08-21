from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


ADDON_NAME = "KeystoneSync"
TOC_FILE = f"{ADDON_NAME}.toc"
SOURCE_ENV = "KEYSTONESYNC_ADDON_SOURCE"


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def default_destination() -> Path:
    return repo_root() / "keystone-client" / "addon" / ADDON_NAME


def resolve_source(value: str | None) -> Path:
    source = value or os.environ.get(SOURCE_ENV)
    if not source:
        raise ValueError(f"Missing addon source. Pass --source or set {SOURCE_ENV}.")
    return Path(source).expanduser().resolve()


def normalize_toc_entry(value: str) -> Path:
    normalized = value.replace("\\", "/").strip()
    rel = Path(*normalized.split("/"))
    if rel.is_absolute() or ".." in rel.parts:
        raise ValueError(f"Invalid path in {TOC_FILE}: {value}")
    return rel


def addon_files(source: Path) -> list[Path]:
    toc = source / TOC_FILE
    if not source.is_dir():
        raise ValueError(f"Addon source does not exist or is not a directory: {source}")
    if not toc.is_file():
        raise ValueError(f"Addon source is missing {TOC_FILE}: {source}")

    files: list[Path] = [Path(TOC_FILE)]
    for raw_line in toc.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        rel = normalize_toc_entry(line)
        if rel not in files:
            files.append(rel)

    missing = [str(rel) for rel in files if not (source / rel).is_file()]
    if missing:
        raise ValueError(f"Addon source is missing required file(s): {', '.join(missing)}")
    return files


def destination_files(destination: Path) -> set[Path]:
    if not destination.exists():
        return set()
    return {
        path.relative_to(destination)
        for path in destination.rglob("*")
        if path.is_file()
    }


def compare(source: Path, destination: Path, expected: list[Path]) -> list[str]:
    errors: list[str] = []
    expected_set = set(expected)
    actual_set = destination_files(destination)

    for rel in expected:
        src = source / rel
        dst = destination / rel
        if not dst.is_file():
            errors.append(f"missing: {rel.as_posix()}")
            continue
        if src.read_bytes() != dst.read_bytes():
            errors.append(f"different: {rel.as_posix()}")

    for rel in sorted(actual_set - expected_set, key=lambda p: p.as_posix()):
        errors.append(f"unexpected: {rel.as_posix()}")

    return errors


def remove_stale(destination: Path, expected: set[Path]) -> None:
    if not destination.exists():
        return

    for path in sorted(destination.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        rel = path.relative_to(destination)
        if path.is_file() and rel not in expected:
            path.unlink()
        elif path.is_dir():
            try:
                path.rmdir()
            except OSError:
                pass


def sync(source: Path, destination: Path, expected: list[Path]) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    expected_set = set(expected)
    remove_stale(destination, expected_set)

    for rel in expected:
        src = source / rel
        dst = destination / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def build_parser(check_only: bool) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Synchronize the KeystoneSync addon bundle from the canonical addon source.",
    )
    parser.add_argument(
        "--source",
        help=f"Path to the canonical {ADDON_NAME} addon directory. May also be set with {SOURCE_ENV}.",
    )
    parser.add_argument(
        "--destination",
        default=str(default_destination()),
        help="Generated client-bundle destination.",
    )
    if not check_only:
        parser.add_argument(
            "--check",
            action="store_true",
            help="Compare source and destination without modifying files.",
        )
    return parser


def main(argv: list[str] | None = None, *, check_only: bool = False) -> int:
    parser = build_parser(check_only)
    args = parser.parse_args(argv)

    try:
        source = resolve_source(args.source)
        destination = Path(args.destination).resolve()
        expected = addon_files(source)
        errors = compare(source, destination, expected)

        if check_only or args.check:
            if errors:
                for error in errors:
                    print(error)
                return 1
            print(f"{ADDON_NAME} bundle is synchronized.")
            return 0

        sync(source, destination, expected)
        final_errors = compare(source, destination, expected)
        if final_errors:
            for error in final_errors:
                print(error)
            return 1
        print(f"Synchronized {len(expected)} file(s) to {destination}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
