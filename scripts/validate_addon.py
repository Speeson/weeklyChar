from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import sync_addon


ADDON_NAME = "KeystoneSync"
TOC_FILE = f"{ADDON_NAME}.toc"
METADATA_RE = re.compile(r"^##\s*([^:]+):\s*(.*)$")


def parse_toc(addon_dir: Path) -> tuple[dict[str, str], list[Path]]:
    toc = addon_dir / TOC_FILE
    if not toc.is_file():
        raise ValueError(f"Missing {TOC_FILE}: {addon_dir}")

    metadata: dict[str, str] = {}
    files: list[Path] = []
    for raw_line in toc.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        metadata_match = METADATA_RE.match(line)
        if metadata_match:
            metadata[metadata_match.group(1).strip()] = metadata_match.group(2).strip()
            continue
        if line.startswith("#"):
            continue
        files.append(sync_addon.normalize_toc_entry(line))

    return metadata, files


def validate_addon_dir(addon_dir: Path) -> list[str]:
    errors: list[str] = []

    if not addon_dir.is_dir():
        return [f"missing addon directory: {addon_dir}"]
    if addon_dir.name != ADDON_NAME:
        errors.append(f"addon directory must be named {ADDON_NAME}: {addon_dir}")

    try:
        metadata, files = parse_toc(addon_dir)
    except Exception as exc:
        return [str(exc)]

    for key in ("Interface", "Title", "Version", "SavedVariables"):
        if not metadata.get(key):
            errors.append(f"missing .toc metadata: {key}")

    interface = metadata.get("Interface", "")
    if interface and not interface.isdigit():
        errors.append("Interface metadata must be numeric")

    version = metadata.get("Version", "")
    if version and not re.fullmatch(r"\d+\.\d+\.\d+", version):
        errors.append("Version metadata should use MAJOR.MINOR.PATCH format")

    saved_variables = metadata.get("SavedVariables", "")
    if "KeystoneSyncDB" not in [value.strip() for value in saved_variables.split(",")]:
        errors.append("SavedVariables metadata must include KeystoneSyncDB")

    if not files:
        errors.append(f"{TOC_FILE} does not list any load files")

    for rel in files:
        path = addon_dir / rel
        if not path.is_file():
            errors.append(f"missing .toc file entry: {rel.as_posix()}")

    if (addon_dir / ".git").exists():
        errors.append("generated addon bundle must not contain a nested .git directory")

    for path in addon_dir.rglob("*"):
        if "__pycache__" in path.parts:
            errors.append(f"unexpected Python cache in addon package: {path.relative_to(addon_dir).as_posix()}")

    return errors


def validate_source_sync(source: Path, addon_dir: Path) -> list[str]:
    expected = sync_addon.addon_files(source)
    return sync_addon.compare(source, addon_dir, expected)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate the bundled KeystoneSync addon package.")
    parser.add_argument(
        "--addon-dir",
        default=str(sync_addon.default_destination()),
        help="Addon directory to validate. Defaults to the generated KeystoneClient bundle.",
    )
    parser.add_argument(
        "--source",
        help="Optional canonical addon source. When supplied, also checks bundled-copy divergence.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    addon_dir = Path(args.addon_dir).resolve()
    errors = validate_addon_dir(addon_dir)

    if args.source:
        try:
            errors.extend(validate_source_sync(Path(args.source).expanduser().resolve(), addon_dir))
        except Exception as exc:
            errors.append(str(exc))

    if errors:
        for error in errors:
            print(error)
        return 1

    print(f"{ADDON_NAME} addon package is valid: {addon_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
