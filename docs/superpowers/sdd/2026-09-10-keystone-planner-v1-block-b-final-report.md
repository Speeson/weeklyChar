# Keystone Planner V1 Block B Final Report

## 1. Block A checkpoint

Local commit: `541bd8702fa0d341e4c7458fa80bbcfd27bbe239`

Message: `feat(worker): add Keystone Planner preferences domain`

No push, deployment, release, tag, or remote migration was performed.

## 2. Post-checkpoint working tree

Immediately after the checkpoint, only these pre-existing unrelated paths remained untracked:

- `.playwright-mcp/`
- `docs/CHARACTER-CLIENT.md`
- `docs/design/`
- `docs/keystonesync-selector-piedra-plan.md`
- `keystone-client/tauri-current-characters.png`

None was staged or committed.

## 3. Block B files

Created:

- `keystone-worker/src/keystonePlanner.ts`
- `keystone-worker/tests/keystonePlanner.test.js`
- `docs/superpowers/specs/2026-09-10-keystone-planner-v1-block-b-design.md`
- `docs/superpowers/plans/2026-09-10-keystone-planner-v1-block-b.md`
- this final report

Modified:

- `docs/AGENT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_CONTRACT.md`

No route, schema, migration, Web, Client, or addon file changed in Block B.

## 4. Exact solver input

`solveKeystonePlanner(input: KeystonePlannerInput)` receives:

```ts
type KeystonePlannerInput = {
  participantUserIds: readonly number[] // 2..5, unique
  targetLevel: number                   // integer 1..20
  options: {
    optimizeComposition: boolean
    bloodlust: boolean
    battleRez: boolean
    classBuffs: boolean
    damageSynergy: boolean
  }
  candidates: readonly {
    userId: number
    username: string
    characterId: number
    characterName: string
    specId: number
    lootSpecId: number
    playPreference: 'preferred' | 'available' | 'emergency' | 'disabled'
    objectives: readonly {
      itemId: number
      tier: number
      specId: number
      sourceType: string
      sourceId: number | string
      variantKey: string
      voidcoreState: 'pending' | 'completed_with_voidcore' | 'voidcore_not_checked'
    }[]
  }[]
  stones: readonly {
    characterId: number
    characterName: string
    ownerUserId: number
    ownerUsername: string
    challengeMapId: number
    dungeon: string
    level: number
  }[]
  locks?: readonly (
    | { type: 'assignment', userId: number, characterId: number, specId: number }
    | { type: 'character', userId: number, characterId: number }
    | { type: 'role', userId: number, role: 'tank' | 'healer' | 'dps' }
  )[]
}
```

The Block C adapter must supply normalized, authorized, privacy-filtered candidates. A candidate
with no objectives contributes zero, which represents sharing-disabled data without exposing raw
KeystoneLoot or teaching the solver about authorization.

## 5. Exact solver output

The result status is `ok`, `invalid_input`, `unconfigured_participants`, or
`no_valid_composition`. It always contains:

```ts
{
  status,
  diagnostics: {
    codes: PlannerDiagnosticCode[]
    unconfiguredUserIds: number[]
    lockIssues: string[]
  },
  recommendations: KeystonePlannerRecommendation[] // 0..3
}
```

Each recommendation contains `rank`, stable `fingerprint`, the normalized `stone`, sorted
`assignments`, `vacancies`, `lootSummary`, `levelSummary`, `preferenceSummary`,
`compositionSummary`, and structured `reasonCodes`. Assignments include derived class/role,
played/loot specs, only scoring objectives, and individual resolved capabilities. The composition
summary contains Bloodlust and Battle Rez availability, unique capabilities, four-state damage
profile, DPS affinity counts, both debuff beneficiary counts, and unique class-buff count.

## 6. Algorithm and pruning

The solver removes disabled/unknown candidates, indexes the remainder by selected user, validates
all locks by intersection, and rejects stones whose owner is absent or cannot use the exact holder
character. For each eligible stone, it orders the forced holder first and then users with fewer
candidates. Backtracking selects exactly one candidate per user and prunes role overflow and any
remaining user that cannot fit the remaining role capacity. Since total role capacity is five,
every completed 2–4-player assignment below the caps is exactly completable by its generated
vacancies; every five-player assignment is exactly 1/1/3.

## 7. Complete comparator

One comparator applies this order:

1. `weightedScore DESC` using `keystoneLootTierWeight()` only;
2. `playersWithObjectives DESC`;
3. `abs(stone.level - targetLevel) ASC`;
4. `emergency ASC`, `preferred DESC`, `available DESC`;
5. if `optimizeComposition`, only enabled sub-options participate:
   Bloodlust guaranteed/conditional/none, Battle Rez availability, total damage-debuff
   beneficiaries (then Chaos/Mystic individually), unique class buffs;
6. known tier counts BiS/Must/Nice/Catalyst/Transmog as a final information-preserving tie-break;
7. numeric stone identity and sorted numeric assignment identity.

There is no coverage bonus. Loot always beats level, preferences, and utilities; level beats
preferences/utilities; preferences beat utilities.

## 8. Hunter Bloodlust

Hunter remains a conditional provider from the central catalog. A Hunter-only group reports
`bloodlust: 'conditional'`; the comparator orders guaranteed above conditional above none. Member
capabilities retain the provider condition. No other Hunter penalty exists.

## 9. Null affinity

The Block A catalog is unchanged. Null DPS affinities increment `unknownDpsCount`, never magical or
physical counts, and contribute to neither Chaos Brand nor Mystic Touch beneficiaries. Profiles
are magical/physical when only that known category exists, mixed when both exist, and unknown when
no assigned DPS has a known affinity.

## 10. Incomplete parties

Two through four selected users are valid only below the 1/1/3 caps. Vacancies deterministically
fill the exact missing roles to five. Requested uncovered Bloodlust/Battle Rez can be attached as
capability IDs to a compatible vacancy; no external player or concrete class is invented. Vacancies
have no loot and never affect player coverage.

## 11. Locks

Assignment locks fix user + character + spec; character locks fix user + character; role locks fix
user + derived played role. Multiple locks intersect. A lock for a non-participant or an empty
intersection returns `invalid_input`, `INVALID_LOCK`, and sorted stable `lockIssues`; locks are never
silently ignored. Dungeon filtering remains outside the lock model.

## 12. Tested Top 3 examples

The Top 3 cap test supplies four otherwise equal stones. Target level 10 produces:

1. challenge map 101, level 11
2. challenge map 102, level 12
3. challenge map 103, level 13

The level-14 fourth stone is omitted. Another three-way test returns the same stone with Shaman
guaranteed Bloodlust first, Hunter conditional second, and Rogue/no Bloodlust third. Duplicate
stone + assignment fingerprints collapse to one recommendation.

## 13. Tests

Added 35 solver tests covering full/partial role rules, impossible parties, disabled and emergency
preferences, owner binding, one-user/one-slot, played versus loot spec, loot hierarchy, exact tier
weights, Voidcore, namespace/type filtering, exact-variant deduplication, privacy-zero input,
Bloodlust/Battle Rez toggles and availability, unique capabilities, Chaos/Mystic, null affinity,
four damage profiles, vacancies, all locks, diagnostics, Top 3, deduplication, input-order
independence, and class-buff ranking. The full Node suite passed 172/172. Migration `0010`
regression tests passed 3/3.

## 14. Validation

- `cd keystone-worker; npm run typecheck`: exit 0.
- `cd keystone-worker; npm test`: exit 0; 172 passed, 0 failed.
- `cd keystone-worker; python -m unittest tests.test_keystone_planner_migration`: exit 0; 3 passed.
- `git diff --check`: exit 0; only Git LF-to-CRLF working-copy warnings for tracked docs.

## 15. Deployment Impact

The strict classifier reports Worker build/deploy consideration only. There is no DB, Web, Client,
addon, or release impact and no unknown/outside path. The classifier does not authorize remote
operations.

## 16. Decisions before Block C

Block C must define the authorized Team/D1 adapter that selects current stones, joins owner
preferences, projects only shareable KeystoneLoot objectives, and maps domain diagnostics to HTTP
status/DTO behavior. It must also set input-size limits before invoking the solver and decide the
route-level behavior when all supplied stones are filtered out. No solver ranking or schema
decision remains open. Web-local Devourer correction stays deferred to Block D.
