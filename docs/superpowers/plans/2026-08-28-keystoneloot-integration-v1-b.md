# KeystoneLoot Integration V1-B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the approved V1-A KeystoneLoot snapshot through KeystoneClient, Worker, D1, and the authenticated owner character API without exposing it through teams.

**Architecture:** KeystoneClient conditionally adds the field only when the SavedVariables key exists and corrects `slpp`'s Lua-array mapping only at known V1-A array fields. A focused Worker validator protects an additive JSON-text D1 column; response shaping includes the parsed block only when an explicit owner-read option is enabled.

**Tech Stack:** Python 3 `unittest`/SLPP/requests, TypeScript/Hono, Cloudflare D1/Wrangler, Node test runner, React/Vite/Tauri/Rust build tooling.

**Spec:** `docs/superpowers/specs/2026-08-28-keystoneloot-integration-v1-b-design.md`

## Global Constraints

- Preserve the V1-A representation; do not enrich, score, reorder, or cap numeric tiers at 5.
- Omitted `keystoneLoot` preserves server data; present valid blocks replace it authoritatively.
- `GET /api/me/characters` includes `keystoneLoot`; team responses omit the key entirely.
- Keep `/api/me/characters/enrich` outside the KeystoneLoot write surface.
- Add migration `0002`; do not edit `0001` as a substitute and do not run remote migrations.
- Do not implement V1-C, any KeystoneLoot Web UI, or V2 item/object display.
- Do not bump versions, commit V1-B, push, merge, tag, release, or deploy.

---

### Task 1: Client presence-sensitive transport

**Files:**
- Create: `tests/fixtures/savedvariables/keystoneloot.lua`
- Create: `tests/fixtures/savedvariables/keystoneloot-empty.lua`
- Create: `tests/fixtures/savedvariables/keystoneloot-unavailable.lua`
- Create: `tests/fixtures/client-payload/keystoneloot-sync-payload.json`
- Modify: `tests/client/test_sync_worker.py`
- Modify: `keystone-client/sidecar/sync_worker.py`

**Interfaces:**
- Consumes: decoded per-character SavedVariables dictionaries.
- Produces: `payload["keystoneLoot"]` only when `"keystoneLoot" in entry`, with empty or contiguous one-based known Lua-array fields represented as JSON arrays.

- [ ] Add literal fixtures and failing tests proving a complete supported block deep-equals the expected HTTP payload, empty favorites remain `[]`, an unavailable state survives unchanged, and an old fixture omits the HTTP property entirely.
- [ ] Run `python -m unittest tests.client.test_sync_worker -v` and verify failure is caused by the absent conditional transport.
- [ ] Add a small copy helper that changes only empty or contiguous one-based dictionaries
  at `favorites`, `voidcore.usedItems`, `favorite.bonusIds`, and `favorite.gems` into lists,
  then conditionally add:

  ```python
  if "keystoneLoot" in entry:
      payload["keystoneLoot"] = _keystone_loot_for_json(entry["keystoneLoot"])
  ```

- [ ] Rerun the focused Client tests and compile `keystone-client/sidecar/sync_worker.py`.

### Task 2: Worker validator and contract boundaries

**Files:**
- Create: `keystone-worker/src/keystoneLoot.ts`
- Modify: `keystone-worker/tests/keystoneRoutes.test.js`
- Modify: `keystone-worker/src/routes/keystones.ts`

**Interfaces:**
- Produces: `validateKeystoneLoot(value: unknown): string | null` and exported limit constants.
- Consumes: optional `KeystoneUpdateRequest.keystoneLoot?: unknown`.

- [ ] Add failing route tests for explicit null, invalid state/flags, invalid item/spec/tier/source types, invalid Voidcore fields, 2,001 favorites, 2,001 used item IDs, 65 bonus IDs, 65 gems, and a block exceeding 256 KiB. Assert HTTP 400 and no stored-column mutation.
- [ ] Run the focused Worker tests and confirm each new case is accepted or mishandled before the validator exists.
- [ ] Implement plain-object, safe-integer, bounded-string, integer-array, favorite, Voidcore, state/flag, supported-field, and UTF-8 serialized-size checks. Permit unknown additive fields but validate every known field when present.
- [ ] Validate before character lookup/creation in the sync route and return `jsonError(c, 400, "Datos de KeystoneLoot no válidos: ...")` on failure.
- [ ] Rerun Worker typecheck and focused tests.

### Task 3: D1 persistence and fake alignment

**Files:**
- Create: `keystone-worker/migrations/0002_keystone_loot.sql`
- Modify: `keystone-worker/src/types.ts`
- Modify: `keystone-worker/src/routes/keystones.ts`
- Modify: `keystone-worker/tests/fakeD1.js`
- Modify: `keystone-worker/tests/keystoneRoutes.test.js`

**Interfaces:**
- Adds: `CharacterRow.keystone_loot_json: string | null`.
- Persists: omitted property as bound `null`/SQL preservation; present valid property as `jsonDump(payload.keystoneLoot)`/replacement.

- [ ] Add failing tests for first persistence, later replacement by `favorites: []`, replacement by `not_installed`, and preservation when omitted.
- [ ] Run Worker tests and confirm the fake/production SQL cannot yet store the block.
- [ ] Add `ALTER TABLE characters ADD COLUMN keystone_loot_json TEXT;`, extend the row type, append the column assignment/binding, and mirror the nullable column plus binding order in Fake D1.
- [ ] Rerun Worker typecheck/tests, then run `npm run d1:migrate:local` under `keystone-worker`.

### Task 4: Owner read and team privacy

**Files:**
- Modify: `keystone-worker/src/db.ts`
- Modify: `keystone-worker/src/routes/me.ts`
- Modify: `keystone-worker/tests/fakeD1.js`
- Modify: `keystone-worker/tests/keystoneRoutes.test.js`

**Interfaces:**
- Adds: `CharacterResponseOptions = { includeKeystoneLoot?: boolean }`.
- Changes: `characterResponse(character, latest, options = {})` and `charactersForUser(env, userId, options = {})`.

- [ ] Add a failing round-trip assertion that owner characters deep-equal the original fixture block, plus a team endpoint regression asserting `"keystoneLoot"` is absent from every member character.
- [ ] Add the minimal Fake D1 team/membership query support and generate a real access token in the endpoint test.
- [ ] Include parsed `keystoneLoot` only when `includeKeystoneLoot === true`; call the shared user-character helper with that option from `/api/me/characters`, leaving team calls on the false default.
- [ ] Assert missing or invalid SQL JSON returns owner `keystoneLoot: null`; verify `/enrich` contains no KeystoneLoot field or SQL binding.
- [ ] Rerun Worker typecheck and the full Worker test suite.

### Task 5: Documentation and Client changeset

**Files:**
- Modify: `docs/DATA_CONTRACT.md`
- Modify: `docs/ARCHITECTURE.md`
- Rewrite: `docs/keystone-loot-integration-todo.md`
- Create: `.changes/pending/keystoneloot-integration-v1-b.json`

**Interfaces:**
- Documents: V1-A source contract, conditional Client transport, Worker validation/limits, D1 storage, owner-only read, team non-exposure, and pending V1-C/V2 scope.

- [ ] Replace obsolete direct-SavedVariables/key/tier/team-exposure assumptions in the TODO with the public API v2 V1-A architecture and V1-B completion state; keep V1-C and V2 explicitly pending.
- [ ] Update the durable data contract and architecture flow, including omission versus authoritative-empty semantics and the unchanged `/enrich` boundary.
- [ ] Add a Spanish Client patch changeset with `components: ["client"]`; leave `keystone-client/VERSION` unchanged.
- [ ] Run release tests and inspect the documentation diff for contradictions.

### Task 6: Full validation, builds, and handoff evidence

**Files:**
- Review all V1-B changes; generated build artifacts remain ignored/uncommitted.

**Interfaces:**
- Produces: fresh validation evidence, local artifact paths, strict impact JSON, and a representative four-hop round trip.

- [ ] Run Python compile checks, Client and bridge suites, Worker typecheck/tests, local D1 migration, deploy-impact tests, release tests, Client frontend tests/build/visual tests, Rust fmt/check/tests, and `python scripts/build_client_sidecar.py --clean`.
- [ ] Build the local NSIS installer with `npm --prefix keystone-client run tauri:build -- --bundles nsis`; do not sign, publish, or stage generated binaries.
- [ ] Generate the representative SavedVariables -> Client JSON -> D1 JSON -> owner JSON evidence from the real fixtures/tests and verify semantic deep equality.
- [ ] Run strict deploy impact with every changed path and confirm actual dimensions/unknown paths; investigate any difference from the expected Client/Worker/DB-only impact.
- [ ] Use the code-review and verification-before-completion checklists, run `git diff --check`, inspect `git diff`/`git status --short`, confirm no version bump or V1-C/Web changes, and leave every V1-B source change uncommitted.
