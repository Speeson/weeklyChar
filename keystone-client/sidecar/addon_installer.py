from __future__ import annotations

import re
import shutil
from pathlib import Path

import wow_path


ADDON_NAME = "KeystoneSync"
TOC_FILE = f"{ADDON_NAME}.toc"
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


def find_addons_folder(wow_dir: str | Path | None = None) -> str | None:
    return wow_path.find_addons_folder(wow_dir)


def _normalize_toc_entry(value: str) -> Path:
    normalized = value.replace("\\", "/").strip()
    rel = Path(*normalized.split("/"))
    if rel.is_absolute() or ".." in rel.parts or (rel.parts and re.fullmatch(r"[A-Za-z]:", rel.parts[0])):
        raise ValueError(f"Invalid path in {TOC_FILE}: {value}")
    return rel


def read_toc_metadata(toc_path: str | Path) -> tuple[dict[str, str], list[Path]]:
    metadata: dict[str, str] = {}
    files: list[Path] = []
    path = Path(toc_path)
    if not path.is_file():
        raise FileNotFoundError(f"Missing {TOC_FILE}: {path}")

    for raw_line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("##"):
            key, _, value = line[2:].partition(":")
            metadata[key.strip()] = value.strip()
            continue
        if line.startswith("#"):
            continue
        files.append(_normalize_toc_entry(line))

    return metadata, files


def read_addon_version(toc_path: str | Path) -> str | None:
    try:
        metadata, _ = read_toc_metadata(toc_path)
    except Exception:
        return None
    return metadata.get("Version") or None


def validate_addon_dir(addon_dir: str | Path, expected_version: str | None = None) -> str:
    addon = Path(addon_dir)
    if not addon.is_dir():
        raise ValueError(f"Missing addon directory: {addon}")
    if addon.name != ADDON_NAME:
        raise ValueError(f"Addon directory must be named {ADDON_NAME}: {addon}")

    metadata, files = read_toc_metadata(addon / TOC_FILE)
    version = metadata.get("Version", "")
    if not version:
        raise ValueError(f"{TOC_FILE} is missing Version metadata")
    if not SEMVER_RE.fullmatch(version):
        raise ValueError(f"{TOC_FILE} Version must use MAJOR.MINOR.PATCH")
    if expected_version and version != expected_version:
        raise ValueError(f"{TOC_FILE} Version {version} does not match expected {expected_version}")

    saved_variables = metadata.get("SavedVariables", "")
    if "KeystoneSyncDB" not in [value.strip() for value in saved_variables.split(",")]:
        raise ValueError(f"{TOC_FILE} SavedVariables must include KeystoneSyncDB")
    if not files:
        raise ValueError(f"{TOC_FILE} does not list any addon files")
    for rel in files:
        if not (addon / rel).is_file():
            raise ValueError(f"Missing .toc file entry: {rel.as_posix()}")

    return version


def installed_info(addons_path: str | Path | None) -> dict:
    info = {
        "installed": False,
        "corrupt": False,
        "invalid_version": False,
        "version": None,
        "path": None,
        "status": "not_installed",
    }
    if not addons_path:
        return info

    addon_dir = Path(addons_path) / ADDON_NAME
    info["path"] = str(addon_dir)
    if not addon_dir.exists():
        return info

    info["installed"] = True
    version = read_addon_version(addon_dir / TOC_FILE)
    info["version"] = version
    try:
        validate_addon_dir(addon_dir)
    except ValueError as exc:
        if version and not SEMVER_RE.fullmatch(version):
            info["invalid_version"] = True
            info["status"] = "installed_version_invalid"
        else:
            info["corrupt"] = True
            info["status"] = "corrupt"
        info["error"] = str(exc)
        return info

    info["status"] = "installed_valid"
    return info


def install_from_source(addons_path: str | Path, source_path: str | Path, expected_version: str | None = None) -> str:
    """Safely replace addons_path/KeystoneSync from source_path with rollback."""
    source = Path(source_path)
    validate_addon_dir(source, expected_version=expected_version)

    addons = Path(addons_path)
    addons.mkdir(parents=True, exist_ok=True)
    dest = addons / ADDON_NAME
    backup = addons / f"{ADDON_NAME}.backup"

    if backup.exists():
        shutil.rmtree(backup)

    moved_existing = False
    if dest.exists():
        shutil.move(str(dest), str(backup))
        moved_existing = True

    try:
        shutil.copytree(source, dest)
        validate_addon_dir(dest, expected_version=expected_version)
    except Exception:
        if dest.exists():
            shutil.rmtree(dest)
        if moved_existing and backup.exists():
            shutil.move(str(backup), str(dest))
        raise

    if backup.exists():
        shutil.rmtree(backup)
    return str(dest)
