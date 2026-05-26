import os
import shutil
import sys
from pathlib import Path


ADDON_NAME = "KeystoneSync"


def _addon_source() -> Path:
    """Returns the path to the bundled addon folder (works both in dev and PyInstaller)."""
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)
    else:
        base = Path(__file__).parent
    return base / "addon" / ADDON_NAME


def find_addons_folder() -> str | None:
    bases = [
        Path("C:/Program Files (x86)/World of Warcraft"),
        Path("C:/Program Files/World of Warcraft"),
        Path("D:/World of Warcraft"),
        Path("E:/World of Warcraft"),
        Path("D:/Games/World of Warcraft"),
        Path("E:/Games/World of Warcraft"),
    ]
    for wow_dir in bases:
        addons = wow_dir / "_retail_" / "Interface" / "AddOns"
        if addons.exists():
            return str(addons)
    return None


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
