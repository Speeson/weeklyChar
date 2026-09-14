#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--raw", default="generated/midnight-s2-spell-catalog-raw.json")
    p.add_argument("--candidates", default="generated/midnight-s2-utility-candidates.json")
    args = p.parse_args()

    raw = load(Path(args.raw))
    candidates = load(Path(args.candidates))
    errors = []

    if raw.get("schemaVersion") != 1 or candidates.get("schemaVersion") != 1:
        errors.append("schemaVersion inválido")

    version = (raw.get("simulationCraft") or {}).get("version", "")
    if "SimulationCraft" not in version:
        errors.append("Falta versión de SimulationCraft")

    classes = raw.get("classes") or []
    if len(classes) != 13:
        errors.append(f"Esperaba 13 clases; hay {len(classes)}")

    stats = raw.get("queryStats") or []
    if len(stats) != 39:
        errors.append(f"Esperaba 39 consultas (13 x 3); hay {len(stats)}")

    empty_queries = [s["expression"] for s in stats if not s.get("parsedCount")]
    if empty_queries:
        errors.append("Consultas sin resultados: " + ", ".join(empty_queries))

    spells = raw.get("spells") or []
    ids = [s.get("spellId") for s in spells]
    if len(ids) != len(set(ids)):
        errors.append("Hay spellId duplicados en RAW")
    if len(spells) < 100:
        errors.append(f"Demasiado pocos hechizos: {len(spells)}")

    cs = candidates.get("candidates") or []
    cids = [s.get("spellId") for s in cs]
    if len(cids) != len(set(cids)):
        errors.append("Hay spellId duplicados en candidates")
    if len(cs) < 20:
        errors.append(f"Demasiado pocos candidatos: {len(cs)}")

    raw_ids = set(ids)
    missing = [sid for sid in cids if sid not in raw_ids]
    if missing:
        errors.append(f"Candidatos no presentes en RAW: {missing[:10]}")

    if errors:
        print("VALIDATION FAIL")
        for e in errors:
            print(" -", e)
        return 2

    print("VALIDATION PASS")
    print(f" SimC:       {version}")
    print(f" Classes:    {len(classes)}")
    print(f" Queries:    {len(stats)}")
    print(f" Spells:     {len(spells)}")
    print(f" Candidates: {len(cs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
