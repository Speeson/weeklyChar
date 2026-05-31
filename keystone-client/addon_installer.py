import os
import shutil
import sys
from pathlib import Path

import wow_path


ADDON_NAME = "KeystoneSync"
TOC_FILE = f"{ADDON_NAME}.toc"


def _addon_source() -> Path:
    """Returns the path to the bundled addon folder (works both in dev and PyInstaller)."""
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).parent
    return base / "addon" / ADDON_NAME


def find_addons_folder(wow_dir: str | Path | None = None) -> str | None:
    return wow_path.find_addons_folder(wow_dir)


def read_addon_version(toc_path: str | Path) -> str | None:
    path = Path(toc_path)
    if not path.exists():
        return None

    try:
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            if line.lower().startswith("## version:"):
                return line.split(":", 1)[1].strip() or None
    except OSError:
        return None

    return None


def bundled_version() -> str | None:
    return read_addon_version(_addon_source() / TOC_FILE)


def installed_info(addons_path: str | Path | None) -> dict:
    info = {
        "installed": False,
        "corrupt": False,
        "version": None,
        "bundled_version": bundled_version(),
        "path": None,
    }
    if not addons_path:
        return info

    addon_dir = Path(addons_path) / ADDON_NAME
    info["path"] = str(addon_dir)
    if not addon_dir.exists():
        return info

    toc = addon_dir / TOC_FILE
    lua = addon_dir / f"{ADDON_NAME}.lua"
    info["installed"] = True
    info["version"] = read_addon_version(toc)
    info["corrupt"] = not toc.exists() or not lua.exists() or not info["version"]
    return info


def install(addons_path: str) -> str:
    """Copies addon files to addons_path/KeystoneSync. Returns status message."""
    source = _addon_source()
    if not source.exists():
        raise FileNotFoundError(f"Archivos del addon no encontrados en: {source}")

    dest = Path(addons_path) / ADDON_NAME
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source, dest)
    return str(dest)
