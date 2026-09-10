# Keystone Planner V1 Block B Design

## Scope

Block B adds a pure deterministic Worker domain solver. It receives normalized participants,
candidate assignments, stones, objectives, options, and locks. It does not read D1, expose HTTP,
authorize users, or format presentation copy.

## Domain contract

- `solveKeystonePlanner(input)` accepts 2–5 unique participant user IDs, target level 1–20,
  normalized playable candidates, normalized stones, composition options, and optional locks.
- A candidate carries played `specId`, separate `lootSpecId`, preference, and already privacy-filtered
  objectives. Missing objectives therefore means zero loot, including sharing-disabled users.
- Played role, class, damage affinity, and capabilities are derived from `wowComposition.ts`.
- Results use an explicit status: `ok`, `invalid_input`, `unconfigured_participants`, or
  `no_valid_composition`, with structured diagnostics and at most three recommendations.

## Solver

Candidates are indexed per selected user after removing disabled and unknown specs. Locks are
validated and intersected before search. Each stone is rejected unless its owner participates and
has a playable candidate on the exact holder character.

Backtracking assigns one candidate per selected user. It prunes role overflow immediately and
checks that remaining users can still fit the remaining 1/1/3 capacity. Complete assignments are
valid only when their partial role counts can be completed with vacancies to exactly 1/1/3.

## Ranking

One central comparator applies, in order:

1. weighted objective score descending;
2. players with objectives descending;
3. absolute target-level distance ascending;
4. emergency count ascending, preferred count descending, available count descending;
5. when composition optimization and the relevant option are enabled: Bloodlust availability,
   Battle Resurrection availability, damage-debuff beneficiary count, then unique class buffs;
6. known tier counts and a stable stone/assignment lexical key.

Tier counts are only a final deterministic tie-break, so they cannot overtake level, preferences,
or enabled utilities. There is no numeric coverage bonus. Utilities never overtake loot, level, or
preferences.

## Composition semantics

Unique capabilities collapse in the aggregate but remain on each assignment. Availability is
`guaranteed`, `conditional`, or `none`, allowing Hunter-only Bloodlust to remain conditional and
future conditional Battle Resurrection providers without a DTO redesign.

Only assigned DPS determine damage profile and Chaos Brand/Mystic Touch beneficiaries. Unknown
affinity is neutral. Incomplete groups receive role vacancies; uncovered requested major utilities
are attached as capability IDs to compatible vacancies without naming a class.

## Determinism and identity

Loot objective identity matches the Selector namespace: source type, typed source ID, item ID, and
variant key. Duplicate representations keep the stronger tier. Recommendation identity is stone
plus sorted assignments. Input ordering cannot affect ranking or fingerprints.
