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


def normalize_wow_dir(path: str | Path | None) -> Path | None:
    if not path:
        return None

    p = Path(path)
    parts = [part.lower() for part in p.parts]
    if "_retail_" in parts:
        retail_idx = parts.index("_retail_")
        return Path(*p.parts[:retail_idx])
    return p


def is_wow_dir(path: str | Path | None) -> bool:
    wow_dir = normalize_wow_dir(path)
    if not wow_dir:
        return False

    retail = wow_dir / "_retail_"
    return retail.exists() and (
        (retail / "Wow.exe").exists()
        or (retail / "Interface").exists()
        or (retail / "WTF").exists()
    )


def addons_folder_for(wow_dir: str | Path | None) -> str | None:
    normalized = normalize_wow_dir(wow_dir)
    if not normalized:
        return None

    addons = normalized / "_retail_" / "Interface" / "AddOns"
    if addons.exists():
        return str(addons)
    return None


def candidate_wow_dirs(extra_dir: str | Path | None = None) -> list[Path]:
    """Common WoW install locations without scanning whole drives."""
    bases: list[Path] = []
    extra = normalize_wow_dir(extra_dir)
    if extra:
        bases.append(extra)

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


def find_wow_dir(extra_dir: str | Path | None = None) -> str | None:
    for wow_dir in candidate_wow_dirs(extra_dir):
        if is_wow_dir(wow_dir):
            return str(wow_dir)
    return None


def find_addons_folder(extra_dir: str | Path | None = None) -> str | None:
    for wow_dir in candidate_wow_dirs(extra_dir):
        addons = addons_folder_for(wow_dir)
        if addons:
            return addons
    return None


def find_savedvars(extra_dir: str | Path | None = None) -> str | None:
    for wow_dir in candidate_wow_dirs(extra_dir):
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
