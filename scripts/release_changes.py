from __future__ import annotations

import argparse
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ALLOWED_TYPES = ("patch", "minor", "major")
ALLOWED_CATEGORIES = ("added", "changed", "fixed", "removed", "security")
TYPE_RANK = {"patch": 0, "minor": 1, "major": 2}
CATEGORY_TITLES = {
    "added": "Novedades",
    "changed": "Cambios",
    "fixed": "Correcciones",
    "removed": "Eliminado",
    "security": "Seguridad",
}
SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


@dataclass(frozen=True)
class Changeset:
    path: Path
    components: tuple[str, ...]
    type: str
    category: str
    summary: str
    details: tuple[str, ...]

    @property
    def name(self) -> str:
        return self.path.name


@dataclass(frozen=True)
class ReleasePlan:
    component: str
    current_version: str
    bump: str
    next_version: str
    changesets: tuple[Changeset, ...]

    @property
    def tag(self) -> str:
        if self.component == "client":
            return f"client-v{self.next_version}"
        return f"v{self.next_version}"

    @property
    def asset(self) -> str:
        if self.component == "client":
            return "KeystoneClientSetup.exe"
        return f"KeystoneSync-v{self.next_version}.zip"


class ChangesetError(ValueError):
    pass


def parse_semver(value: str) -> tuple[int, int, int]:
    match = SEMVER_RE.fullmatch(value.strip())
    if not match:
        raise ChangesetError(f"Invalid semantic version: {value}")
    return tuple(int(part) for part in match.groups())


def bump_version(version: str, bump: str) -> str:
    if bump not in ALLOWED_TYPES:
        raise ChangesetError(f"Invalid bump: {bump}")
    major, minor, patch = parse_semver(version)
    if bump == "major":
        return f"{major + 1}.0.0"
    if bump == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def highest_bump(changesets: Iterable[Changeset]) -> str:
    selected: str | None = None
    for changeset in changesets:
        if selected is None or TYPE_RANK[changeset.type] > TYPE_RANK[selected]:
            selected = changeset.type
    if selected is None:
        raise ChangesetError("No matching changesets")
    return selected


def validate_changeset(path: Path, raw: object) -> Changeset:
    if not isinstance(raw, dict):
        raise ChangesetError(f"{path}: changeset must be a JSON object")

    components = raw.get("components")
    if not isinstance(components, list) or not components or not all(isinstance(item, str) and item for item in components):
        raise ChangesetError(f"{path}: components must be a non-empty string array")

    change_type = raw.get("type")
    if change_type not in ALLOWED_TYPES:
        raise ChangesetError(f"{path}: type must be one of {', '.join(ALLOWED_TYPES)}")

    category = raw.get("category")
    if category not in ALLOWED_CATEGORIES:
        raise ChangesetError(f"{path}: category must be one of {', '.join(ALLOWED_CATEGORIES)}")

    summary = raw.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ChangesetError(f"{path}: summary is required")

    details = raw.get("details")
    if not isinstance(details, list) or not all(isinstance(item, str) and item.strip() for item in details):
        raise ChangesetError(f"{path}: details must be a string array")

    return Changeset(
        path=path,
        components=tuple(components),
        type=change_type,
        category=category,
        summary=summary.strip(),
        details=tuple(item.strip() for item in details),
    )


def load_changesets(root: Path, component: str) -> tuple[Changeset, ...]:
    pending = root / ".changes" / "pending"
    if not pending.exists():
        return ()

    changesets: list[Changeset] = []
    for path in sorted(pending.glob("*.json")):
        with path.open(encoding="utf-8") as handle:
            loaded = json.load(handle)
        changeset = validate_changeset(path, loaded)
        if component in changeset.components:
            changesets.append(changeset)
    return tuple(changesets)


def plan_release(root: Path, component: str, current_version: str, requested_bump: str = "auto") -> ReleasePlan:
    if requested_bump != "auto" and requested_bump not in ALLOWED_TYPES:
        raise ChangesetError(f"Invalid bump: {requested_bump}")

    changesets = load_changesets(root, component)
    if not changesets:
        raise ChangesetError(f"No pending {component} changesets")

    bump = highest_bump(changesets) if requested_bump == "auto" else requested_bump
    next_version = bump_version(current_version, bump)
    return ReleasePlan(component, current_version, bump, next_version, changesets)


def render_notes(plan: ReleasePlan) -> str:
    lines = [
        f"# KeystoneClient {plan.next_version}" if plan.component == "client" else f"# KeystoneSync {plan.next_version}",
        "",
    ]
    by_category: dict[str, list[Changeset]] = {category: [] for category in ALLOWED_CATEGORIES}
    for changeset in plan.changesets:
        by_category[changeset.category].append(changeset)

    for category in ALLOWED_CATEGORIES:
        entries = by_category[category]
        if not entries:
            continue
        lines.extend((f"## {CATEGORY_TITLES[category]}", ""))
        for changeset in entries:
            lines.append(f"- {changeset.summary}")
            for detail in changeset.details:
                lines.append(f"  - {detail}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def write_release_files(root: Path, plan: ReleasePlan, version_file: Path) -> Path:
    version_file.write_text(f"{plan.next_version}\n", encoding="utf-8")
    release_dir = root / ".changes" / "releases" / plan.tag
    release_dir.mkdir(parents=True, exist_ok=False)

    for changeset in plan.changesets:
        shutil.move(str(changeset.path), release_dir / changeset.path.name)

    metadata = {
        "component": plan.component,
        "current_version": plan.current_version,
        "version": plan.next_version,
        "bump": plan.bump,
        "tag": plan.tag,
        "asset": plan.asset,
        "changesets": [changeset.name for changeset in plan.changesets],
    }
    (release_dir / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (release_dir / "release-notes.md").write_text(render_notes(plan), encoding="utf-8")
    return release_dir


def read_version(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Plan and prepare KeystoneSync component releases.")
    sub = parser.add_subparsers(dest="command", required=True)

    plan = sub.add_parser("plan", help="Calculate the next release without modifying files.")
    plan.add_argument("--component", required=True)
    plan.add_argument("--version-file", required=True, type=Path)
    plan.add_argument("--bump", default="auto", choices=("auto", *ALLOWED_TYPES))
    plan.add_argument("--json", action="store_true")
    plan.add_argument("--notes-out", type=Path)

    prepare = sub.add_parser("prepare", help="Consume changesets and update the source version.")
    prepare.add_argument("--component", required=True)
    prepare.add_argument("--version-file", required=True, type=Path)
    prepare.add_argument("--bump", default="auto", choices=("auto", *ALLOWED_TYPES))
    prepare.add_argument("--json", action="store_true")

    return parser


def plan_payload(plan: ReleasePlan) -> dict[str, object]:
    return {
        "component": plan.component,
        "current_version": plan.current_version,
        "bump": plan.bump,
        "next_version": plan.next_version,
        "tag": plan.tag,
        "asset": plan.asset,
        "changesets": [changeset.name for changeset in plan.changesets],
        "release_notes": render_notes(plan),
    }


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = Path.cwd()
    current_version = read_version(args.version_file)
    plan = plan_release(root, args.component, current_version, args.bump)

    if args.command == "prepare":
        write_release_files(root, plan, args.version_file)

    if getattr(args, "notes_out", None):
        args.notes_out.write_text(render_notes(plan), encoding="utf-8")

    if args.json:
        print(json.dumps(plan_payload(plan), indent=2, ensure_ascii=False))
    else:
        print(f"{plan.component} {plan.current_version} -> {plan.next_version} ({plan.bump})")
        print(f"tag: {plan.tag}")
        print(f"asset: {plan.asset}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
