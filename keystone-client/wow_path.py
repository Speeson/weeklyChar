from pathlib import Path


def find_savedvars() -> str | None:
    bases = [
        Path("C:/Program Files (x86)/World of Warcraft"),
        Path("C:/Program Files/World of Warcraft"),
        Path("D:/World of Warcraft"),
        Path("E:/World of Warcraft"),
        Path("D:/Games/World of Warcraft"),
        Path("E:/Games/World of Warcraft"),
    ]
    for wow_dir in bases:
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
