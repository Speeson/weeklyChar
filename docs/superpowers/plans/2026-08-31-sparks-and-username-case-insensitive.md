# Spark Bank Tracking and Case-Insensitive Username Implementation Plan

> **For agentic workers:** Execute inline in this session. The user explicitly
> prohibited staging and commits, so every usual commit checkpoint is omitted.

**Goal:** Correct character-owned Spark tracking and enforce case-insensitive
username identity as one reviewable maintenance phase.

**Architecture:** The addon persists a bank snapshot captured only while the
personal bank is accessible; existing JSON pass-through carries the additive
fields to a small tested Web formatter. Worker identity helpers and a D1 NOCASE
unique index establish one canonical comparison contract while stored display
casing remains unchanged.

**Tech Stack:** Lua/WoW Retail API, Python/Lupa runtime tests, TypeScript/Hono,
Cloudflare D1/SQLite, Next.js 16/React 19, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-sparks-and-username-case-insensitive-design.md`

## Global constraints

- Branch `fix/sparks-and-username-case-insensitive` in both repositories.
- Keep all changes unstaged and uncommitted.
- Never count Warband/Account Bank or omit any `GetItemCount` boolean argument.
- Preserve username display casing and stop on production collisions.
- Do not modify KeystoneClient unless pass-through verification fails.
- Do not touch `docs/design/client-teams-inner-panel-approved.png` or
  `docs/keystonesync-selector-piedra-plan.md`.

---

### Task 1: Establish clean baselines

**Files:** No source changes.

- [ ] Run addon runtime, release, and deployment-impact tests.
- [ ] Run Worker typecheck and full tests.
- [ ] Run Web unit tests and build.
- [ ] Stop and report if an unrelated baseline failure prevents trustworthy work.

### Task 2: Addon Spark contract (TDD)

**Files:**
- Modify: `C:/DAM2/KeystoneSync/tests/runtime/lua_harness.py`
- Create: `C:/DAM2/KeystoneSync/tests/runtime/test_spark_bank_tracking.py`
- Modify: `C:/DAM2/KeystoneSync/tests/runtime/test_season2_contract.py`
- Modify: `C:/DAM2/KeystoneSync/KeystoneSync.lua`

**Produces:** `currencies.sparksOfTides` with `quantity`, `itemQuantity`,
`inventoryQuantity`, `totalItemQuantity`, `bankQuantity`,
`bankQuantityKnown`, and optional `bankUpdatedAt`.

- [ ] Add runtime cases for carried only, Reagent Bank only, normal bank only,
  mixed, all banked, account-bank only, unknown state, snapshot preservation,
  refresh while open, and no authoritative close read.
- [ ] Run the focused runtime tests and confirm failures are caused by missing
  explicit calls/state/event behavior.
- [ ] Implement explicit carried/character-owned calls and per-character bank
  snapshot semantics with open-state event handling.
- [ ] Run focused and full addon runtime tests green.

### Task 3: Addon release preparation and documentation

**Files:**
- Modify: `C:/DAM2/KeystoneSync/README.md`
- Create: `C:/DAM2/KeystoneSync/.changes/pending/spark-personal-bank-tracking.json`

- [ ] Document carried, normal bank, Reagent Bank, Account Bank exclusion, and
  last-known availability semantics.
- [ ] Add a Spanish patch changeset predicting addon `0.2.6` without editing the
  released `0.2.5` TOC version.
- [ ] Validate release changes and addon deployment impact.

### Task 4: Username lookup routes (TDD)

**Files:**
- Modify: `keystone-worker/src/db.ts`
- Modify: `keystone-worker/src/routes/auth.ts`
- Modify: `keystone-worker/src/routes/teams.ts`
- Modify: `keystone-worker/tests/fakeD1.js`
- Create: `keystone-worker/tests/usernameIdentityRoutes.test.js`

**Produces:** `normalizeUsernameInput`, `getUserByUsername`, and
`usernameExists` with trimmed `COLLATE NOCASE` identity.

- [ ] Add failing route tests for registration duplicates, login variants and
  wrong passwords, Team target/self/member/pending protections, verification
  resend, rate-limit casing, and preserved display casing.
- [ ] Confirm the tests fail on current case-sensitive queries.
- [ ] Add minimal shared helpers and route integration, including uniqueness-race
  mapping to `Nombre de usuario ya en uso`.
- [ ] Run focused route tests and full Worker tests green.

### Task 5: D1 uniqueness migration (TDD)

**Files:**
- Create: `keystone-worker/migrations/0007_users_username_nocase.sql`
- Create: `keystone-worker/tests/test_username_nocase_migration.py`
- Modify: `keystone-worker/README.md`

- [ ] Add failing SQLite migration tests proving preserved text, IDs, foreign
  keys, successful unique data, and safe failure on `Spee` plus `spee`.
- [ ] Add the NOCASE unique index migration and exact read-only collision query.
- [ ] Run migration tests and local D1 migration application only.

### Task 6: Web Spark formatting (TDD)

**Files:**
- Create: `keystone-web/lib/sparkQuantity.ts`
- Create: `keystone-web/lib/sparkQuantity.test.ts`
- Modify: `keystone-web/app/summary/page.tsx`

**Produces:** A pure formatter returning total and optional positive known-bank
label for the existing compact Summary cell.

- [ ] Add the four required failing formatting cases.
- [ ] Implement the minimal formatter and extend the local currency type.
- [ ] Render primary total plus subdued bank parenthetical without redesigning
  the table, icon, link, or color.
- [ ] Run focused and full Web tests green.

### Task 7: Pipeline and durable documentation

**Files:**
- Modify: `tests/fixtures/savedvariables/season2.lua`
- Modify: `tests/client/test_sync_worker.py`
- Modify: `keystone-worker/tests/keystoneRoutes.test.js`
- Modify: `docs/DATA_CONTRACT.md`
- Modify: `docs/AGENT_CONTEXT.md`

- [ ] Add additive Spark fixture fields and prove Client/Worker JSON pass-through.
- [ ] Document Spark storage semantics and username identity/rollout preflight.
- [ ] Confirm no KeystoneClient source file changed.

### Task 8: Full verification and review

**Files:** All changed files in both repositories.

- [ ] Run all prescribed addon, Worker, Web, migration, release, lint/build, and
  deployment-impact checks.
- [ ] Run code-review and verification-before-completion workflows.
- [ ] Check diffs, protected-file hashes/status, empty staging areas, branches,
  and absence of Python bytecode.
- [ ] Write the SDD final report and deliver the requested 34-point report ending
  with the exact readiness phrase.
