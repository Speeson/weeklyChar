# Keystone Planner V1 Block A Design

## Objective

Add the Planner's owner-scoped character/spec preference storage and the Worker-owned WoW
composition catalog. This delivery establishes validated domain data only; it does not plan,
score, rank, or render parties.

## Approved design

`character_play_preferences` stores one row per `(character_id, spec_id)` with
`play_preference`, `loot_spec_id`, and `updated_at`. The four allowed states are enforced in
both D1 and the request validator. `lootSpecId` defaults to `specId`; role is never persisted.
The character foreign key cascades on deletion.

`GET /api/me/planner/preferences` returns the authenticated owner's rows in deterministic
character/spec order. `PUT /api/me/planner/preferences` accepts one strict
`{ preferences: [...] }` replacement document, validates the complete payload before writing,
then atomically deletes the owner's old rows and inserts the new set with a D1 batch. Both routes
require a KeystoneSync JWT; sync tokens are rejected. The response derives each role from the
catalog.

The Worker composition catalog owns all Retail spec IDs, canonical English class names, roles,
conservative DPS `physical`/`magical` affinity, and the initial unique capabilities. Capability
providers are class/spec metadata, not route conditionals. Conditional providers such as Hunter
Bloodlust through a suitable pet are represented explicitly. Ambiguous hybrid damage profiles
remain `null` instead of receiving guessed percentages or affinity.

## Architecture

- `keystone-worker/migrations/0010_keystone_planner.sql` owns the additive table.
- `keystone-worker/src/wowComposition.ts` is the single Worker source of truth for specs, roles,
  damage profiles, capabilities, spell metadata, and provider resolution.
- `keystone-worker/src/plannerPreferences.ts` owns strict payload validation and preference DTOs.
- `keystone-worker/src/routes/me.ts` owns the two JWT-only owner routes and D1 persistence.
- Existing `shareKeystoneLootWithTeams`, raw KeystoneLoot access, Team routes, Selector behavior,
  and every Web/Client surface remain unchanged.

The catalog was checked on 2026-09-10 against Blizzard's current class pages and official
Devourer announcement, with current ability/provider details cross-checked against Warcraft Wiki
where Blizzard does not publish a compact composition-utility table.

## Verification

- `cd keystone-worker; npm run typecheck`
- `cd keystone-worker; npm test`
- `cd keystone-worker; npm run d1:migrate:local`
- `python scripts/deploy_impact.py --files <changed-paths>`
- `git diff --check`
- `git status --short -uall`

## Out of scope

- Composition candidate generation or solver constraints.
- Loot, target-level, preference, utility, or damage-synergy scoring.
- Planner Team endpoint, Top 3, locks, vacancies, or explanations.
- Web UI, `StoneSelector`, Web catalog correction, or KeystoneClient.
- Remote migrations, deployment, release, push, or commit.
