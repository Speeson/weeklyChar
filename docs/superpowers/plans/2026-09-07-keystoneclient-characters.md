# KeystoneClient Characters Implementation Plan

> **For agentic workers:** Implement inline in dependency order with strict red-green-refactor cycles. Do not dispatch subagents for this plan.

**Goal:** Deliver the approved PNG-faithful, read-only Characters dashboard and talent-tree modal from authoritative WoW snapshots through Addon, Client, Worker/D1, and Web-compatible currency semantics.

**Architecture:** Capture bounded snapshots in the standalone addon, transport and persist three additive JSON blocks, sanitize them through the sidecar/React bridge, and render focused Client components. Central Wowhead link/loader code enriches local content without becoming a data or icon dependency.

**Tech Stack:** WoW Lua APIs, Python 3 sidecar/unittest, Cloudflare Worker/Hono/D1/TypeScript/Vitest, React/Vite/Vitest, Playwright, Tauri 2/Rust, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-09-07-keystoneclient-characters-design.md`

## Global Constraints

- The PNG overrides stale textual layout instructions.
- Work from fetched `origin/main`: weeklyChar `94d0e8e`, addon `4f70d84`.
- Preserve old/missing snapshots and valid data during transient WoW API failures.
- Treat all SavedVariables input and tooltip parameters as untrusted.
- No commit, push, tag, release, deploy, or remote D1 migration.

---

### Task 1: Addon currency and equipment snapshots

**Files:** modify `C:/DAM2/KeystoneSync/KeystoneSync.lua`; add/modify focused tests under `C:/DAM2/KeystoneSync/tests/`.

**Interfaces:** produce `currencies.untaintedManaCrystals` and `equipment = { averageItemLevel, setPieces, items }`; items preserve `itemLink`, variant IDs, gems, enchant identity, icon metadata, quality, and item level.

- [ ] Add failing fixtures/tests for currency 3356, generic cap fields, 16 slots, empty slots, complete links, bonus arrays, gems, enchant IDs, and refresh coalescing.
- [ ] Run the focused addon tests and verify failures are caused by absent capture.
- [ ] Implement safe item-link tokenization isolated behind a single helper and prefer `C_Item.GetItemGem` for gem identity.
- [ ] Capture equipment on initial/manual saves and coalesced equipment events without overwriting a valid snapshot with a transient empty result.
- [ ] Run focused and complete addon tests.

### Task 2: Addon talent and Omnium snapshots

**Files:** modify `C:/DAM2/KeystoneSync/KeystoneSync.lua`; add/modify addon tests.

**Interfaces:** produce `talents = { configId, loadoutName, importString, specId, specName, className, characterLevel, trees }` and `omniumFolio = { systemId, configId, treeIds, trees }`; each tree contains positioned nodes, entries, ranks, choices, subtrees, and real visible edges.

- [ ] Add failing API-mocked tests for active config, every visible entry, node position/rank/choice, directed edges, Hero subtree discovery, import string, system 48 discovery, spec/loadout updates, and transient-empty preservation.
- [ ] Verify the focused tests fail for missing collectors.
- [ ] Implement generic trait tree/entry/edge serialization and classify Class/Spec/Hero from current config/subtree metadata rather than tree order.
- [ ] Discover Omnium config through `C_Traits.GetConfigIDBySystemID(48)`, derive tree IDs, and use 1186 only as a documented fallback.
- [ ] Register only verified trait/spec events and pass them through one debounce/coalescing path.
- [ ] Run focused and complete addon tests.

### Task 3: Sync transport, Worker contract, and D1 persistence

**Files:** modify `keystone-client/sidecar/sync_worker.py`, `tests/client/test_sync_worker.py`, `keystone-worker/src/routes/keystones.ts`, `keystone-worker/src/db.ts`, Worker tests/fixtures; create `keystone-worker/migrations/0008_character_snapshots.sql`.

**Interfaces:** POST `/api/keystones/update` accepts optional `equipment`, `talents`, and `omniumFolio`; owner reads return each parsed block or `null` with one shared character query.

- [ ] Add failing sidecar payload and Worker write/read/backward-compatibility tests using bounded representative fixtures.
- [ ] Run the focused Python and Worker tests and verify expected contract failures.
- [ ] Pass optional snapshots through `sync_worker.py`, add the three nullable D1 JSON columns, validate bounded JSON-compatible input, and use parameterized `INSERT/UPDATE` statements.
- [ ] Extend `CharacterRow`, shared selects, update semantics, and `characterResponse()` once so owner/team consumers avoid N+1 queries.
- [ ] Run local migration, Worker typecheck/tests, and focused sidecar tests.

### Task 4: CharacterService and TypeScript DTO boundary

**Files:** modify `keystone-client/sidecar/character_service.py`, `tests/client/test_character_service.py`, `keystone-client/src/core/types.ts`, `keystone-client/src/core/characters.ts` and tests.

**Interfaces:** `CharacterSummary` exposes safely normalized legacy summary blocks and optional typed `equipment`, `talents`, and `omniumFolio`; unknown keys and unsafe URLs do not cross into React.

- [ ] Add failing cache/API sanitizer tests proving all required existing blocks and the three new snapshots survive while malformed/oversized data is rejected safely.
- [ ] Add failing TypeScript parser tests for full, partial, old, and malformed character payloads.
- [ ] Implement bounded recursive sanitization plus focused typed parsers with positive integer, finite number, string-length, array-length, and safe-icon validation.
- [ ] Verify cache round-trips, Python tests, and TypeScript tests.

### Task 5: Central Wowhead enrichment

**Files:** create `keystone-client/src/core/wowhead.ts`, `keystone-client/src/core/wowhead.test.ts`, `keystone-client/src/components/WowheadTooltip.tsx` and tests; modify `keystone-client/src/main.tsx` or the root provider composition and `vite-env.d.ts`.

**Interfaces:** `wowheadDomainForLanguage(lang)`, `buildWowheadTarget({ type, id, language, options })`, `WowheadTooltipProvider`, and `WowheadTooltip`; only allowlisted typed keys serialize and arrays use `:`.

- [ ] Add failing tests for exact item/spell/currency hrefs, deterministic `data-wowhead`, omitted null/empty values, rejected invalid IDs, gem-as-item, and enchant-ID/spell-ID separation.
- [ ] Verify failures, then implement positive-integer validation and fixed-order serialization for `domain`, `ench`, `gems`, `bonus`, `ilvl`, `lvl`, and `pcs`.
- [ ] Add component/provider tests for one script, pre-load configuration, dynamic refresh, cleanup safety, and local title/fallback content.
- [ ] Implement the provider without changing Tauri CSP and verify frontend tests/build.

### Task 6: Characters dashboard

**Files:** create `keystone-client/src/pages/CharactersPage.tsx`, its stylesheet/components/tests, `keystone-client/src/core/charactersPreview.ts`; modify `App.tsx`, `KeystoneShell.tsx`, i18n resources, theme-safe shared styles, preview routing, and copy medal assets into Client.

**Interfaces:** `CharactersPage` consumes the existing `CharacterState` data source and preserves selected account/realm/character by stable IDs; focused components receive already parsed DTOs.

- [ ] Add failing navigation and page tests for exact tab order, dependent filters, selection preservation, independent character scroll, old-data empty states, one-row 16-slot gear, 4 × 2 dungeons, narrow Vault/Prey, ten visible currencies, and PNG-authoritative Gold placement.
- [ ] Verify failures and implement selection reconciliation plus the approved section composition using existing tokens/class helpers/Season 2 metadata.
- [ ] Add generic cap-state tests for weekly, seasonal-total, owned-total, Coffer 0 + 600/600, and Untainted 143 + 250/250 + 143/1000.
- [ ] Implement local icon/name/value fallback and Wowhead wrappers for gear, gems, reliable enchant spells, and currencies.
- [ ] Add deterministic 7+ character preview data and verify all frontend tests.

### Task 7: Talent and Omnium modal

**Files:** create focused talent-tree/modal React components, CSS, fixtures, and tests under `keystone-client/src/components/` or `pages/characters/`; integrate from `CharactersPage`.

**Interfaces:** `TalentTreeViewport` consumes a classified tree snapshot and normalizes actual `posX/posY`; SVG edges use only serialized `visibleEdges` and render before HTML nodes.

- [ ] Add failing tests for simultaneous Class/Hero/Spec ordering, Hero name/icon, Omnium below, active/inactive directed edges, selected/unselected/choice/rank-2 nodes, every visible spell tooltip, disabled missing snapshot state, and captured import-string copy.
- [ ] Verify failures, then implement deterministic geometry normalization, SVG edges, accessible nodes, local descriptions, and read-only copy behavior.
- [ ] Add the Balance/Elune's Chosen/Omnium preview fixture and verify modal interaction/unit tests.

### Task 8: Web currency parity and durable documentation

**Files:** modify `keystone-web/lib/season2Currencies.ts` and tests/consumers only where needed; update `docs/DATA_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/AGENT_CONTEXT.md`; add required pending changesets in each affected repository.

**Interfaces:** Web recognizes Untainted and the same metadata-driven cap semantics while retaining its existing Wowhead loader strategy.

- [ ] Add failing Web helper tests for Untainted metadata and generic cap state.
- [ ] Implement parity without redesigning unrelated Web pages or duplicating script loaders.
- [ ] Document source APIs, SavedVariables keys, transport/persistence, missing/transient semantics, and migration `0008`.
- [ ] Run Web tests/lint/build and inspect diffs for scope.

### Task 9: Visual, native, and end-to-end verification

**Files:** modify Playwright preview specs/goldens only for new Characters surfaces; create `docs/superpowers/sdd/keystoneclient-characters-final-report.md`.

**Interfaces:** deterministic screenshots at 1672 × 941 prove the PNG structure and modal geometry; report distinguishes automated, manual, unavailable, and externally blocked checks.

- [ ] Add/run Playwright assertions for no dashboard overflow, single-row gear, 4 × 2 dungeons, narrow Vault/Prey, ten currencies, all three trees, Omnium, edge layering, accessible tooltips, and minimum supported size.
- [ ] Inspect screenshots manually against `keystone-client/design/characters-client.png` and record real visual differences.
- [ ] Run complete addon, Worker, Web, Python, Client frontend, Rust, sidecar-build, and real Tauri/NSIS validation where prerequisites permit.
- [ ] In a real Tauri runtime, verify Wowhead item/gem/reliable-enchant/class/spec/Hero/Omnium/currency enrichment without blocking local fallbacks; record network/runtime limitations exactly.
- [ ] Run Deployment Impact, `git diff --check`, code review, and final `git status --short --branch` in both working trees.
- [ ] Write the requested final report with DTOs, exact example strings, tests/build outputs, migration, limitations, visual differences, and both working-tree states.
