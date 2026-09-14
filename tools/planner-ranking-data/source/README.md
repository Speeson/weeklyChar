# Keystone Planner Ranking Data

Source datasets used to extend the Keystone Planner ranking **after the existing Battle Rez priority**.

These files are research / reproducibility inputs. The Worker should not depend on this `tools/` directory at runtime.

## Location

Place this file and the datasets under:

```text
tools/planner-ranking-data/source/
```

Expected contents:

```text
tools/planner-ranking-data/source/
├── README.md
├── midnight-s2-buff-impact-full.json
├── midnight-s2-utility-catalog-canonical.json
├── midnight-s2-dungeon-mechanics.json
└── midnight-s2-dungeon-utility-relevance.json
```

---

## Scope

The current Keystone Planner already correctly handles the higher-priority rules, including:

- valid group composition: **1 Tank + 1 Healer + 3 DPS**
- current preference / lock rules
- KeystoneLoot / item-target priorities
- exact keystone owner / holder rules
- Bloodlust priority
- Battle Rez priority

These datasets are **not** intended to replace or reorder any of that logic.

They support the equivalence strata that come **after Battle Rez**. Within the same active
composition stratum, the existing loot score and tier counts return to the foreground:

```text
existing solver priorities
↓
Bloodlust
↓
Battle Rez
↓
offensive equivalence band
↓
defensive equivalence band (Advanced)
↓
dungeon-utility equivalence band (Advanced)
↓
existing loot score and loot tiers
↓
exact offensive gain
↓
stable deterministic tie-break
```

Quick recommends **classes**. Advanced recommends **exact specializations**.

In Quick, specs are only internal data used to:

1. identify how the already-known DPS characters react to a class buff, and
2. determine whether a utility is available for a class in the role being filled.

Advanced uses the exact eligible spec to project bidirectional offensive interactions, group
defense and dungeon utility. Neither mode is an absolute class/spec tier list: all values are
marginal to the known party and the selected dungeon.

---

# 1. `midnight-s2-buff-impact-full.json`

Raw SimulationCraft buff-impact dataset.

Generated with:

```text
SimulationCraft 1210-01
WoW 12.1.0.69587 Live
git build: midnight c1935b9
iterations: 5000
40% single-target / 60% 8-target AoE weighting
```

The dataset measures the relative effect of raid/class buffs on each simulated DPS spec.

## Production use

The candidate is a **class**.

The recipients are the **known DPS specs already present in the planned group**.

Example:

```text
candidate Warrior
→ provides Battle Shout

known DPS:
Frost DK
Windwalker Monk
Frost Mage

lookup Battle Shout impact for those 3 recipients
→ clamp negative simulation noise to 0
→ average the recipient gains
→ classOffensiveGainPct
```

Do **not** use absolute DPS, tier lists, rankings, or the candidate's own expected DPS.

Do **not** add recipient percentages together and call the result party DPS.

Use the mean normalized uplift across known DPS recipients.

If two candidate classes add different missing buffs in a multi-vacancy composition, combine the new unique buff effects for the known recipients without double-counting an already-present buff.

### Production offensive providers

Use only these six offensive class capabilities:

```text
Warrior      → BATTLE_SHOUT
Mage         → ARCANE_INTELLECT
Druid        → MARK_OF_THE_WILD
Shaman       → SKYFURY
Demon Hunter → CHAOS_BRAND
Monk         → MYSTIC_TOUCH
```

### Hunter's Mark

`HUNTERS_MARK` may remain in the raw SimulationCraft artifact for reproducibility, but it is **intentionally excluded from production composition scoring**.

Reason: in Mythic+ most total damage is dealt across multi-target pulls, while Hunter's Mark affects only one marked target at a time. It should not be treated as equivalent to the six persistent class-wide offensive buffs/debuffs above.

Therefore:

```text
Hunter → no offensive-class-buff contribution in this scoring layer
```

Hunter can still rank through the already-existing Bloodlust logic and through defensive / dungeon utility.

### Missing SimC profiles

Some DPS specs do not have exact profiles in the selected SimC build.

Fallback estimates may be produced from a matching archetype, but provenance must remain explicit:

```ts
source: "simc" | "archetype_estimate"
confidence: "high" | "medium" | "low"
```

Never label estimated data as exact SimC output.

---

# 2. `midnight-s2-utility-catalog-canonical.json`

Canonical class-composition utility catalog for Midnight Season 2.

Contains the curated abilities/capabilities that can influence composition value, together with:

- class
- internal eligible specs
- capability category
- availability type
- conditions
- defensive/secondary tier
- redundancy / stacking policy
- SimulationCraft metadata when available

Examples of availability:

```text
baseline
spec_only
class_talent
spec_talent
choice_talent
hero_talent
pet_conditional
racial
spec_access
```

## Mode-sensitive recommendation identity

Quick displays and ranks classes. Advanced displays and ranks exact specs.

For Quick, the candidate class and vacancy role determine which internal specs are eligible.
For Advanced, only the selected exact role-compatible spec contributes spec-specific utility.

Examples:

```text
Warrior + Tank vacancy
→ Protection is the only eligible internal spec

Warrior + DPS vacancy
→ Arms / Fury are eligible

Monk + Healer vacancy
→ Mistweaver

Death Knight + DPS vacancy
→ Frost / Unholy
```

A utility is:

- **guaranteed** if all role-compatible internal specs provide it, or the role forces the one spec that provides it;
- **conditional** if only some compatible specs provide it;
- unavailable if it belongs only to specs incompatible with the vacancy role.

Talents, hero talents and pet-dependent abilities must also receive an availability discount rather than being treated as guaranteed.

## Personal defensives

Personal-only survivability is intentionally excluded from composition utility.

Examples that should not earn composition points:

```text
Ice Block
Blur
Barkskin
Astral Shift
Shield Wall
Anti-Magic Shell
```

The goal is to measure what the candidate class contributes to the **group**, not how durable that class is personally.

---

# 3. `midnight-s2-dungeon-mechanics.json`

Evidence / traceability dataset for Midnight Season 2 dungeon utility.

Contains the researched mechanics that justify the relevance matrix, including fields such as:

```text
severity
frequency
recoveryOnly
routeDependence
confidence
sourceIds
responses
```

This file is primarily for:

- auditability
- debugging
- future updates
- explaining why a capability has a particular relevance score

It is **not required as a large runtime dependency** if the compact relevance artifact contains all production data needed by the solver.

A utility that mainly recovers a failed avoidable mechanic should not receive the same value as utility required for an unavoidable recurring mechanic.

---

# 4. `midnight-s2-dungeon-utility-relevance.json`

Compact production-oriented relevance matrix.

Each contextual capability receives a relevance score per dungeon:

```text
0 = no meaningful supported use
1 = niche / recovery-only / route-dependent
2 = useful or repeatedly relevant
3 = core / frequent / critical
```

The intended conceptual calculation is:

```text
contextualUtility =
    baseCapabilityValue
  × (dungeonRelevance / 3)
  × availabilityFactor
  × marginalCoverageFactor
```

The final implementation may use equivalent deterministic integer/fixed-point math if that fits the existing solver better.

## Redundancy

Do not award full value repeatedly for duplicate coverage.

Examples:

```text
Devotion Aura + Devotion Aura
→ one effective persistent coverage

Atrophic Poison + Atrophic Poison
→ no duplicate full value

Bloodlust + Bloodlust
→ coverage already satisfied by existing higher-priority logic

AMZ + Darkness
→ distinct defensives, both retain value with diminishing returns

Leg Sweep + Capacitor Totem
→ both useful, but additional stop coverage should have diminishing returns
```

Use the canonical catalog's stacking/redundancy policy.

---

# Offensive equivalence bands

Tiny SimC differences must not turn one class into the only "correct" answer.

After all existing higher-priority constraints are equal, candidate classes/combinations are grouped into offensive equivalence bands.

Initial policy:

```text
equivalenceWindow =
  max(
    0.5 percentage points,
    25% of the best offensive gain
  )
```

Example:

```text
best = 4.80%

window = max(0.50, 1.20)
       = 1.20 percentage points

top offensive band:
4.80% → 3.60%
```

Therefore:

```text
Warrior 4.80%
Shaman  4.55%
Druid   4.20%
```

can remain in the same offensive band.

A candidate at `2.10%` would be in a lower band.

Advanced groups defensive value and dungeon utility into their own semantic equivalence bands
inside the offensive band. The existing loot score and loot tiers then differentiate options inside
the same active set of composition bands; exact offensive gain is only a later tie-break.

---

# Ranking integration rule

Do not rebuild the Keystone Planner solver.

Locate the existing ranking/comparison pipeline and preserve every current priority through Battle Rez.

Append the new criteria **after the current Battle Rez comparison**.

Conceptually:

```text
existing rank tuple / comparator
  ...
  bloodlust
  battleRez
  + offensiveBand
  + defensiveBand (Advanced)
  + dungeonUtilityBand (Advanced)
  + existingLootScore
  + existingLootTiers
  + sameArmorLootSharingTieBreak
  + exactOffensiveGain
  + stableTieBreak
```

Do not collapse all priorities into one global point total.

Higher-level rules must remain lexicographically dominant over lower-level scoring.

---

# Top recommendations

Quick output remains class recommendations; Advanced output carries exact spec IDs and names.

Return the configured Top N recommendations as unique class combinations in Quick and unique
spec combinations in Advanced.

For multi-vacancy recommendations:

```text
Warrior + Monk
```

and:

```text
Monk + Warrior
```

are the same combination and must not appear twice.

Multiple classes with similar offensive contribution should be allowed to appear as valid alternatives.

The result is not intended to be a class tier list.

---

# Explainability

Where practical, keep debug / DTO metadata explaining the recommendation.

Example:

```ts
{
  classId: "WARRIOR",

  offensiveGainPct: 0.048,
  offensiveBand: 0,

  offensiveReasons: [
    "Battle Shout: estimated +4.8% uplift to known DPS"
  ],

  defensiveReasons: [
    "Rallying Cry"
  ],

  dungeonUtilityReasons: [
    "Interrupt relevance: 3/3",
    "AoE stop relevance: 3/3"
  ]
}
```

The UI does not need to expose every field immediately, but the calculation should be inspectable and testable.

---

# Runtime / repository policy

These source files belong under:

```text
tools/planner-ranking-data/source/
```

They are versioned source/research artifacts.

Do not make the Worker read these files dynamically from `tools/` at runtime.

Instead, normalize or generate a compact typed production representation in the existing Planner/Worker architecture.

Prefer the project's existing module/data layout after inspecting the codebase rather than forcing a new folder structure unnecessarily.

Do not modify the raw source datasets merely to make the implementation easier.

Preserve them as reproducibility inputs.

---

# Minimum regression coverage

At minimum, the implementation should verify:

- existing role/composition priorities are unchanged
- KeystoneLoot/item priority remains unchanged
- exact keystone holder rules remain unchanged
- existing Bloodlust priority remains unchanged
- existing Battle Rez priority remains unchanged
- duplicate class buff gives zero new offensive gain
- Hunter's Mark is ignored by offensive composition scoring
- negative SimC noise scores as zero
- candidate absolute DPS is never used
- known-party recipient specs drive offensive gain
- missing recipient profiles use deterministic estimated fallback with provenance
- close offensive gains enter the same equivalence band
- clearly different gains enter different bands
- defensive utility breaks ties inside an offensive band
- dungeon relevance changes class utility value appropriately
- duplicate utility coverage receives zero/diminishing marginal value as configured
- role-incompatible spec-only utility is not awarded to a class
- pet/talent/hero conditional utility is not treated as guaranteed
- multi-vacancy class combinations do not double-count duplicate buffs/utilities
- class-combination permutations are deduplicated
- final ranking is deterministic
- no absolute DPS tier-list data enters the scorer
