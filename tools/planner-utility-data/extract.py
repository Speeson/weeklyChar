#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "config.json"
DEFAULT_WORK = HERE / "work"
DEFAULT_GENERATED = HERE / "generated"


class ExtractError(RuntimeError):
    pass


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ExtractError(f"No existe: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ExtractError(f"JSON inválido: {path}: {exc}") from exc


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        encoding="utf-8",
        errors="replace",
    )


def simc_version(simc: Path) -> str:
    proc = run([str(simc), "spell_query=spell.id=1"])
    text = proc.stdout or ""
    for line in text.splitlines():
        if "SimulationCraft" in line:
            return line.strip()
    for line in text.splitlines():
        if line.strip():
            return line.strip()
    return "unknown"


NAME_RE = re.compile(r"^\s*Name\s*:\s*(.*?)\s+\(id=(\d+)\)\s*(.*)$", re.I)
FIELD_RE = re.compile(r"^\s*([A-Za-z][A-Za-z /_-]*?)\s*:\s*(.*)$")
BRACKET_RE = re.compile(r"\[([^\]]+)\]")


def split_spell_blocks(text: str) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] | None = None
    for raw in text.splitlines():
        if NAME_RE.match(raw):
            if current:
                blocks.append(current)
            current = [raw.rstrip()]
        elif current is not None:
            current.append(raw.rstrip())
    if current:
        blocks.append(current)
    return blocks


def parse_number_with_unit(raw: str | None) -> float | None:
    if not raw:
        return None
    s = raw.strip().lower()
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*(ms|msec|milliseconds?|s|sec|secs|seconds?|min|mins|minutes?)?\b", s)
    if not m:
        return None
    value = float(m.group(1))
    unit = m.group(2) or ""
    if unit in ("ms", "msec") or unit.startswith("millisecond"):
        return value / 1000.0
    if unit.startswith("min"):
        return value * 60.0
    return value


def parse_int(raw: str | None) -> int | None:
    if not raw:
        return None
    m = re.search(r"-?\d+", raw)
    return int(m.group(0)) if m else None


def parse_block(lines: list[str], class_id: str, class_name: str, source: str) -> dict[str, Any] | None:
    if not lines:
        return None
    m = NAME_RE.match(lines[0])
    if not m:
        return None

    name = m.group(1).strip()
    spell_id = int(m.group(2))
    tail = m.group(3).strip()
    flags = BRACKET_RE.findall(tail)

    fields: dict[str, str] = {}
    effects: list[str] = []
    current_multiline: str | None = None

    for line in lines[1:]:
        fm = FIELD_RE.match(line)
        if fm:
            key = re.sub(r"\s+", " ", fm.group(1).strip()).lower().replace(" ", "_").replace("/", "_")
            value = fm.group(2).strip()
            fields[key] = value
            current_multiline = key
            continue

        stripped = line.strip()
        if not stripped:
            current_multiline = None
            continue

        if stripped.startswith("#") or current_multiline == "effects":
            effects.append(stripped)
            continue

        if current_multiline in ("description", "tooltip") and current_multiline in fields:
            fields[current_multiline] += " " + stripped

    class_text = fields.get("class")
    school = fields.get("school")
    description = fields.get("description")
    tooltip = fields.get("tooltip")

    cooldown_raw = fields.get("cooldown")
    duration_raw = fields.get("duration")
    charge_cd_raw = fields.get("charge_cooldown")
    charges_raw = fields.get("charges")

    return {
        "spellId": spell_id,
        "name": name,
        "providerClass": class_id,
        "providerClassName": class_name,
        "sources": [source],
        "flags": flags,
        "classText": class_text,
        "school": school,
        "spellLevel": parse_int(fields.get("spell_level")),
        "cooldownSeconds": parse_number_with_unit(cooldown_raw),
        "cooldownRaw": cooldown_raw,
        "durationSeconds": parse_number_with_unit(duration_raw),
        "durationRaw": duration_raw,
        "charges": parse_int(charges_raw),
        "chargesRaw": charges_raw,
        "chargeCooldownSeconds": parse_number_with_unit(charge_cd_raw),
        "chargeCooldownRaw": charge_cd_raw,
        "minRangeRaw": fields.get("min_range"),
        "maxRangeRaw": fields.get("max_range"),
        "description": description,
        "tooltip": tooltip,
        "effects": effects,
        "rawFields": fields,
    }


def merge_record(dst: dict[str, Any], src: dict[str, Any]) -> None:
    for source in src.get("sources", []):
        if source not in dst["sources"]:
            dst["sources"].append(source)

    # Do not use setdefault(..., [dst.pop(...)]) here: Python evaluates the
    # default argument eagerly even when the key already exists.
    if "providerClasses" not in dst:
        legacy_provider = dst.pop("providerClass", None)
        dst["providerClasses"] = [legacy_provider] if legacy_provider else []
    providers = dst["providerClasses"]
    if src["providerClass"] not in providers:
        providers.append(src["providerClass"])

    if "providerClassNames" not in dst:
        legacy_provider_name = dst.pop("providerClassName", None)
        dst["providerClassNames"] = [legacy_provider_name] if legacy_provider_name else []
    provider_names = dst["providerClassNames"]
    if src["providerClassName"] not in provider_names:
        provider_names.append(src["providerClassName"])

    for key in (
        "classText", "school", "spellLevel", "cooldownSeconds", "cooldownRaw",
        "durationSeconds", "durationRaw", "charges", "chargesRaw",
        "chargeCooldownSeconds", "chargeCooldownRaw", "minRangeRaw", "maxRangeRaw",
        "description", "tooltip"
    ):
        if dst.get(key) in (None, "", []) and src.get(key) not in (None, "", []):
            dst[key] = src[key]

    for flag in src.get("flags", []):
        if flag not in dst["flags"]:
            dst["flags"].append(flag)

    if len(src.get("effects", [])) > len(dst.get("effects", [])):
        dst["effects"] = src["effects"]


def normalize_record(rec: dict[str, Any]) -> dict[str, Any]:
    if "providerClass" in rec:
        rec["providerClasses"] = [rec.pop("providerClass")]
    if "providerClassName" in rec:
        rec["providerClassNames"] = [rec.pop("providerClassName")]
    rec["sources"] = sorted(set(rec.get("sources", [])))
    rec["providerClasses"] = sorted(set(rec.get("providerClasses", [])))
    rec["providerClassNames"] = sorted(set(rec.get("providerClassNames", [])))
    rec["flags"] = sorted(set(rec.get("flags", [])))
    return rec


def searchable_text(rec: dict[str, Any]) -> str:
    parts = [
        rec.get("name") or "",
        rec.get("description") or "",
        rec.get("tooltip") or "",
        " ".join(rec.get("effects") or []),
    ]
    return " ".join(parts).lower()


def candidate_reasons(rec: dict[str, Any], config: dict[str, Any]) -> list[dict[str, str]]:
    text = searchable_text(rec)
    reasons: list[dict[str, str]] = []
    seen = set()

    for rule in config.get("candidateRules", []):
        category = rule["category"]
        for term in rule.get("terms", []):
            if term.lower() in text:
                key = (category, term.lower())
                if key not in seen:
                    seen.add(key)
                    reasons.append({"category": category, "matched": term})

    seed_names = {name.lower() for name in config.get("seedNames", [])}
    if (rec.get("name") or "").lower() in seed_names:
        reasons.append({"category": "seed_name", "matched": rec["name"]})

    # Active, non-passive spells with meaningful cooldowns are worth surfacing
    # for manual review even when tooltip keywords are unhelpful.
    flags = " ".join(rec.get("flags") or []).lower()
    cd = rec.get("cooldownSeconds")
    if cd is not None and cd >= 20 and "passive" not in flags:
        reasons.append({"category": "cooldown_review", "matched": f"{cd:g}s cooldown"})

    return reasons


def query_one(simc: Path, expr: str) -> str:
    proc = run([str(simc), f"spell_query={expr}"])
    if proc.returncode != 0:
        raise ExtractError(
            f"SimulationCraft devolvió {proc.returncode} para {expr}\n\n"
            f"{proc.stdout[-5000:]}"
        )
    lowered = (proc.stdout or "").lower()
    if "unknown option" in lowered or "error parsing" in lowered:
        raise ExtractError(f"SimulationCraft rechazó {expr}\n\n{proc.stdout[-5000:]}")
    return proc.stdout or ""


def doctor(simc: Path, config: dict[str, Any]) -> None:
    if not simc.is_file():
        raise ExtractError(f"No existe simc.exe: {simc}")

    print(f"simc:    {simc}")
    print(f"version: {simc_version(simc)}")
    print(f"classes: {len(config['classes'])}")
    print(f"sources: {', '.join(config['sources'])}")
    print()

    # Verify the three source types on Warrior.
    probes = [
        "class_spell.class=Warrior",
        "spec_spell.class=Warrior",
        "talent_spell.class=Warrior",
    ]
    for expr in probes:
        text = query_one(simc, expr)
        blocks = split_spell_blocks(text)
        print(f" OK {expr}: {len(blocks)} spell blocks")
        if not blocks:
            raise ExtractError(f"La consulta {expr} no produjo bloques de hechizos")

    # Verify every configured class token. This catches silent zero-result
    # identifiers such as death_knight vs the SimC token DeathKnight.
    print("\nClass tokens:")
    for cls in config["classes"]:
        expr = f"class_spell.class={cls['simc']}"
        text = query_one(simc, expr)
        blocks = split_spell_blocks(text)
        print(f" OK {cls['id']}: {cls['simc']} -> {len(blocks)} spell blocks")
        if not blocks:
            raise ExtractError(
                f"El identificador SimC de {cls['id']} ({cls['simc']}) "
                "no produjo ningún class_spell"
            )

    print("\nDoctor PASS. El CLI acepta las fuentes y los 13 identificadores de clase.")


def extract(simc: Path, config: dict[str, Any], work: Path, generated: Path) -> tuple[Path, Path]:
    work.mkdir(parents=True, exist_ok=True)
    generated.mkdir(parents=True, exist_ok=True)

    records: dict[int, dict[str, Any]] = {}
    query_stats: list[dict[str, Any]] = []

    for cls in config["classes"]:
        class_dir = work / cls["simc"]
        class_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n=== {cls['name']} ===")

        for source in config["sources"]:
            expr = f"{source}.class={cls['simc']}"
            print(f"  -> {expr}")
            text = query_one(simc, expr)
            raw_file = class_dir / f"{source}.txt"
            raw_file.write_text(text, encoding="utf-8")

            blocks = split_spell_blocks(text)
            parsed = 0
            for block in blocks:
                rec = parse_block(block, cls["id"], cls["name"], source)
                if rec is None:
                    continue
                parsed += 1
                sid = rec["spellId"]
                if sid not in records:
                    records[sid] = rec
                else:
                    merge_record(records[sid], rec)

            query_stats.append({
                "class": cls["id"],
                "source": source,
                "expression": expr,
                "blockCount": len(blocks),
                "parsedCount": parsed,
                "rawFile": str(raw_file),
            })
            print(f"     {parsed} parsed")

    normalized = [normalize_record(rec) for rec in records.values()]
    normalized.sort(key=lambda x: (x["providerClassNames"], x["name"].lower(), x["spellId"]))

    candidates = []
    for rec in normalized:
        reasons = candidate_reasons(rec, config)
        if reasons:
            c = dict(rec)
            c["candidateReasons"] = reasons
            candidates.append(c)

    now = dt.datetime.now(dt.timezone.utc).isoformat()
    version = simc_version(simc)

    raw_payload = {
        "schemaVersion": 1,
        "generatedAtUtc": now,
        "generator": "keystone-planner-utility-extractor",
        "simulationCraft": {"version": version},
        "classes": config["classes"],
        "sources": config["sources"],
        "queryStats": query_stats,
        "spellCount": len(normalized),
        "spells": normalized,
    }

    candidate_payload = {
        "schemaVersion": 1,
        "generatedAtUtc": now,
        "generator": "keystone-planner-utility-extractor",
        "simulationCraft": {"version": version},
        "sourceSpellCount": len(normalized),
        "candidateCount": len(candidates),
        "candidateRules": config["candidateRules"],
        "candidates": candidates,
    }

    raw_path = generated / "midnight-s2-spell-catalog-raw.json"
    candidate_path = generated / "midnight-s2-utility-candidates.json"
    raw_path.write_text(json.dumps(raw_payload, indent=2, ensure_ascii=False), encoding="utf-8")
    candidate_path.write_text(json.dumps(candidate_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nUnique spells: {len(normalized)}")
    print(f"Utility candidates: {len(candidates)}")
    print(f"RAW:        {raw_path}")
    print(f"CANDIDATES: {candidate_path}")
    return raw_path, candidate_path


def main() -> int:
    p = argparse.ArgumentParser(description="Extracts current WoW class/spec/talent spell data from SimulationCraft for Keystone Planner.")
    p.add_argument("--simc", required=True, help="Ruta a simc.exe")
    p.add_argument("--config", default=str(DEFAULT_CONFIG))
    p.add_argument("--work-dir", default=str(DEFAULT_WORK))
    p.add_argument("--generated-dir", default=str(DEFAULT_GENERATED))
    p.add_argument("--doctor", action="store_true")
    args = p.parse_args()

    try:
        simc = Path(args.simc).expanduser().resolve()
        config = read_json(Path(args.config).expanduser().resolve())

        if args.doctor:
            doctor(simc, config)
            return 0

        doctor(simc, config)
        extract(
            simc,
            config,
            Path(args.work_dir).expanduser().resolve(),
            Path(args.generated_dir).expanduser().resolve(),
        )
        return 0
    except ExtractError as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nCancelado.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
