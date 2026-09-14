
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("extract_mod", HERE / "extract.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def run():
    base = {
        "spellId": 1,
        "name": "Example",
        "providerClass": "DRUID",
        "providerClassName": "Druid",
        "sources": ["class_spell"],
        "flags": [],
        "effects": [],
    }
    second = {
        "spellId": 1,
        "name": "Example",
        "providerClass": "DRUID",
        "providerClassName": "Druid",
        "sources": ["spec_spell"],
        "flags": [],
        "effects": [],
    }
    third = {
        "spellId": 1,
        "name": "Example",
        "providerClass": "EVOKER",
        "providerClassName": "Evoker",
        "sources": ["talent_spell"],
        "flags": [],
        "effects": [],
    }

    mod.merge_record(base, second)
    mod.merge_record(base, third)
    normalized = mod.normalize_record(base)
    assert normalized["providerClasses"] == ["DRUID", "EVOKER"], normalized
    assert normalized["sources"] == ["class_spell", "spec_spell", "talent_spell"], normalized

    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    by_id = {x["id"]: x["simc"] for x in cfg["classes"]}
    assert by_id["DEATH_KNIGHT"] == "DeathKnight", by_id["DEATH_KNIGHT"]
    assert by_id["DEMON_HUNTER"] == "DemonHunter", by_id["DEMON_HUNTER"]

if __name__ == "__main__":
    run()
    print("PASS")
