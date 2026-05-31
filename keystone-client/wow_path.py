import os
from pathlib import Path


def _unique_paths(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    unique: list[Path] = []

    for path in paths:
        key = str(path).lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)

    return unique


def candidate_wow_dirs() -> list[Path]:
    """Common WoW install locations without scanning whole drives."""
    bases: list[Path] = []

    for env_name in ("ProgramFiles(x86)", "ProgramFiles"):
        env_value = os.environ.get(env_name)
        if env_value:
            bases.append(Path(env_value) / "World of Warcraft")

    for drive in "CDEFGHIJKLMNOPQRSTUVWXYZ":
        bases.extend(
            [
                Path(f"{drive}:/World of Warcraft"),
                Path(f"{drive}:/Games/World of Warcraft"),
                Path(f"{drive}:/Program Files (x86)/World of Warcraft"),
                Path(f"{drive}:/Program Files/World of Warcraft"),
            ]
        )

    return _unique_paths(bases)


def find_wow_dir() -> str | None:
    for wow_dir in candidate_wow_dirs():
        retail = wow_dir / "_retail_"
        if retail.exists() and (
            (retail / "Wow.exe").exists()
            or (retail / "Interface").exists()
            or (retail / "WTF").exists()
        ):
            return str(wow_dir)
    return None


def find_addons_folder() -> str | None:
    for wow_dir in candidate_wow_dirs():
        addons = wow_dir / "_retail_" / "Interface" / "AddOns"
        if addons.exists():
            return str(addons)
    return None


def find_savedvars() -> str | None:
    for wow_dir in candidate_wow_dirs():
        account_dir = wow_dir / "_retail_" / "WTF" / "Account"
        if not account_dir.exists():
            continue
        for account in account_dir.iterdir():
            if not account.is_dir():
                continue
            sv = account / "SavedVariables" / "KeystoneSync.lua"
            if sv.exists():
                return str(sv)
    return None
