# KeystoneSync Midnight Season 2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Midnight Season 2 contract across addon, client, Worker, and Web without changing the existing architecture or adding a D1 migration.

**Architecture:** Canonical Season 2 data is captured under new semantic keys inside the existing `currencies` JSON block. Web seasonal dungeon metadata is centralized, while the addon retains dynamic dungeon discovery and every downstream hop keeps additive/partial JSON compatibility.

**Tech Stack:** WoW Lua, Python sidecar/unittest, Hono/TypeScript/Cloudflare D1, Next.js 16/React 19/Tailwind, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-midnight-season-2-migration-design.md`

## Global Constraints

- Use the exact canonical keys and IDs from the approved spec.
- Do not relabel Season 1 data as Season 2 or make Season 2 rendering depend on old data keys.
- Preserve addon weekly/transient protections and dynamic `C_ChallengeMode.GetMapTable()` behavior.
- Preserve the current Web layout and visual language.
- Keep icons in a visually consistent 20x20 container and verify them in a real browser.
- Do not add a D1 migration unless a genuine storage blocker is demonstrated.
- Do not commit, push, release, deploy, or run remote migrations.
- The external addon checkout is read-only in this session; implement in a temporary clone and export a patch under `docs/workflow-handoff/addon/`.

---

### Task 1: Addon Season 2 Contract

**Files:**
- Modify in temporary addon clone: `KeystoneSync.lua`, `KeystoneSync.toc`, `README.md`, `.changes/pending/*.json`
- Test in temporary addon clone: `tests/season2/test_season2_contract.py`
- Create handoff: `docs/workflow-handoff/addon/midnight-season-2.patch`

**Interfaces:**
- Consumes: WoW currency/item/quest/aura APIs and existing `KeystoneSyncDB` save flow.
- Produces: canonical Season 2 `currencies` JSON including `sparksOfTides` and `trovehuntersBounty`.

- [ ] Write failing addon contract tests that exercise a Lua test harness with stubbed WoW APIs and assert all canonical IDs/fields, Prey additions, transient preservation, and dynamic map enumeration.
- [ ] Run the focused addon tests and confirm failures are caused by missing Season 2 behavior.
- [ ] Implement the minimal Lua/TOC/README/changeset update while leaving unrelated events and weekly logic intact.
- [ ] Run addon contract, packaging, release, and deploy-impact tests.
- [ ] Export the tested addon diff as `docs/workflow-handoff/addon/midnight-season-2.patch`; do not copy runtime addon files into `weeklyChar`.

### Task 2: Client Contract And Dungeon Display

**Files:**
- Modify: `keystone-client/sidecar/character_service.py`
- Modify: `tests/fixtures/savedvariables/season2.lua`
- Modify: `tests/fixtures/client-payload/basic-sync-payload.json` if used as the Season 2 representative payload
- Modify: `tests/client/test_sync_worker.py`
- Modify: `tests/client/test_character_service.py`

**Interfaces:**
- Consumes: addon `currencies` object and Worker current-keystone response.
- Produces: unchanged JSON pass-through plus Season 2 current-keystone display names/abbreviations.

- [ ] Add failing fixture/contract tests for the canonical currency keys, compound Spark fields, Trovehunter nested state, and Raider.IO-preserving payload construction.
- [ ] Add failing display tests for all eight Season 2 challenge map IDs.
- [ ] Run focused client tests and confirm the expected Season 1 metadata/fixture failures.
- [ ] Update the fixture and client display metadata with no payload normalization or field loss.
- [ ] Run focused client tests and Python compile validation.

### Task 3: Worker JSON Round Trip

**Files:**
- Modify: `keystone-worker/tests/keystoneRoutes.test.js`
- Modify only if proven necessary: `keystone-worker/src/routes/keystones.ts`, `keystone-worker/src/db.ts`

**Interfaces:**
- Consumes: `payload.currencies` as unknown JSON.
- Produces: byte-equivalent logical JSON through `currencies_json` and API reads.

- [ ] Add a failing regression test using a complete Season 2 currencies object with Trovehunter state.
- [ ] Run the focused Worker test; if it already passes, retain it as contract characterization and do not change production Worker code.
- [ ] If it fails, make the smallest JSON pass-through correction and rerun the test.
- [ ] Run Worker typecheck and full tests; verify no migration file was added.

### Task 4: Shared Web Season Metadata

**Files:**
- Create: `keystone-web/lib/season2.ts`
- Create: `keystone-web/lib/season2.test.ts`
- Modify: `keystone-web/package.json`
- Modify: `keystone-web/app/summary/page.tsx`
- Modify: `keystone-web/app/dashboard/page.tsx`
- Modify: `keystone-web/app/teams/[id]/page.tsx`

**Interfaces:**
- Produces: `MIDNIGHT_SEASON_2_DUNGEONS`, ID/name abbreviation lookups, and full-name lookup shared by all active Web pages.

- [ ] Add a failing Node test asserting the exact eight dungeon records and lookup behavior.
- [ ] Run `npm.cmd test` under `keystone-web` and confirm failure because the shared module/script does not exist.
- [ ] Implement the pure shared module and test script, then replace page-local Season 1 tables.
- [ ] Run Web tests and confirm all mappings pass.

### Task 5: Season 2 Currency UI And Settings Compatibility

**Files:**
- Create: `keystone-web/lib/season2Currencies.ts`
- Create: `keystone-web/lib/season2Currencies.test.ts`
- Modify: `keystone-web/app/summary/page.tsx`
- Modify: `keystone-web/app/dashboard/page.tsx`
- Modify: `keystone-web/app/settings/page.tsx`
- Modify: `keystone-web/app/page.tsx`

**Interfaces:**
- Consumes: canonical `Character.currencies` keys.
- Produces: correct Wowhead links/icons and readable Trovehunter completion state.

- [ ] Add failing pure tests for exact Season 2 labels/IDs/icon names and old-to-new visibility settings migration.
- [ ] Run Web tests and confirm failures against current Season 1 metadata.
- [ ] Implement the canonical currency metadata and settings migration without mapping old currency quantities.
- [ ] Update Summary rendering for Spark of Tides and text-based Trovehunter completion; update Dashboard and landing/settings copy.
- [ ] Run Web tests, lint, and build.

### Task 6: Browser And Icon Validation

**Files:**
- Create only if needed for authenticated fixture rendering: focused Playwright fixture/spec under `keystone-web/tests/`
- Create only if live rendering fails: matching Season 2 assets under `keystone-web/public/icons/currencies/`

**Interfaces:**
- Consumes: built Web UI with deterministic Season 2 fixture data.
- Produces: browser evidence for icon artwork, alignment, tooltips, dungeon rows, and responsive layout.

- [ ] Render Summary through the narrowest test-only fixture path without weakening production auth.
- [ ] Inspect all seven specified currency/item icons and all eight portal rows at desktop and narrow widths.
- [ ] Verify links target the exact item/currency/spell IDs and decorative icons have appropriate accessible treatment.
- [ ] Add a local Season 2 fallback only for an icon that demonstrably fails live rendering, then rerun the visual check.
- [ ] Inspect Dashboard and Teams for Season 2 metadata and responsive regressions.

### Task 7: Documentation, Audits, And Final Validation

**Files:**
- Modify: `docs/DATA_CONTRACT.md`
- Modify if durable project state changes: `docs/AGENT_CONTEXT.md`
- Create: `docs/superpowers/sdd/midnight-season-2-migration-final-report.md`

**Interfaces:**
- Documents the final canonical contract, compatibility behavior, validation evidence, and remaining addon handoff limitation.

- [ ] Update current contract documentation without rewriting historical records.
- [ ] Run the active-code Season 1 name/ID/icon-path audit and classify historical-only matches separately.
- [ ] Run all relevant addon-clone, client, Worker, Web, and deployment-impact validations.
- [ ] Review `git diff` and `git status --short`, preserving unrelated untracked skill directories.
- [ ] Write the final SDD report with exact IDs, keys, icon sources, browser evidence, validation results, migration decision, and deployment impact.
