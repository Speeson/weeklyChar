# KeystoneClient Final UI and Tier Data Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved compact context menu, avatar selection marker, total dungeon rating chip, Raider.IO tier breakdown, and produce a verified portable v13 client.

**Architecture:** Keep presentation changes inside the React client. Extend the existing optional equipment snapshot with normalized `tierPieces`, populated by the sidecar from Raider.IO's already-requested `gear.items[*].tier` field and persisted through the existing Worker JSON column. Preserve remote tier metadata when the local addon equipment snapshot is merged.

**Tech Stack:** React 19, TypeScript, Vitest, Playwright, Python sidecar/unittest, Tauri 2/Rust, Hono Worker/D1.

**Spec:** `docs/superpowers/specs/2026-09-11-keystoneclient-final-ui-data-polish-design.md`

## Global Constraints

- Preserve all unrelated dirty-worktree changes.
- Use tests before implementation for each behavior.
- Do not create an installer, commit, push, deploy, tag, or migrate remote D1.
- Keep all new data optional and backward compatible; no D1 schema migration.

---

### Task 1: Normalize and preserve Raider.IO tier-piece metadata

**Files:**
- Modify: `keystone-client/sidecar/sync_worker.py`
- Modify: `keystone-client/sidecar/character_service.py`
- Modify: `tests/client/test_sync_worker.py`
- Modify: `tests/client/test_character_service.py`
- Modify: `keystone-client/src/core/types.ts`

1. Add failing Python tests proving mixed `gear.items[*].tier` values become sorted `{tier, count}` entries and malformed/absent values are ignored.
2. Add a failing merge test proving remote `equipment.tierPieces` survives replacement by a local addon equipment snapshot.
3. Run the focused tests and confirm the new assertions fail.
4. Implement a small tier normalizer, extend `_fetch_raiderio`, merge `tierPieces` into outgoing equipment without mutating SavedVariables input, and preserve this field in character snapshot merging.
5. Add the optional TypeScript `EquipmentSnapshot.tierPieces` contract.
6. Re-run focused Python tests.

### Task 2: Display tier breakdown and total Mythic+ rating

**Files:**
- Modify: `keystone-client/src/pages/CharactersPage.tsx`
- Modify: `keystone-client/src/pages/CharactersPage.test.tsx`
- Modify: `keystone-client/src/App.css`

1. Add failing component tests for mixed-tier labels, legacy generic set-piece fallback, rating precedence, missing rating, and ES/EN labels.
2. Run the focused Vitest file and confirm failure.
3. Render `N Set pieces (Txx)` segments when tier data exists; retain the generic aggregate otherwise.
4. Add an in-flow rating chip to the right side of the Dungeons header with safe internal padding and no negative offsets.
5. Run the focused component tests.

### Task 3: Correct the avatar selection indicator

**Files:**
- Modify: `keystone-client/src/App.tsx`
- Modify: `keystone-client/src/App.test.tsx`
- Modify: `keystone-client/src/App.css`

1. Add a failing test asserting the selected indicator is a sibling at the right edge of the selected avatar card, not a descendant of the portrait.
2. Run the focused test and confirm failure.
3. Move the themed confirmation icon out of `AvatarChoice`, render it at card level, and style it as a rounded yellow square.
4. Re-run the focused test.

### Task 4: Replace the WebView context menu

**Files:**
- Create: `keystone-client/src/components/ClientContextMenu.tsx`
- Create: `keystone-client/src/components/ClientContextMenu.test.tsx`
- Modify: `keystone-client/src/App.tsx`
- Modify: `keystone-client/src/App.css`
- Modify: `keystone-client/src/core/i18n.tsx`

1. Add failing tests for the four approved actions, viewport clamping, Escape/outside-click dismissal, and action dismissal.
2. Run the focused test and confirm failure.
3. Implement an accessible fixed-position compact menu and global `contextmenu` suppression while the authenticated shell is active.
4. Wire actions to manual synchronization/navigation, avatar picker, settings modal, and tray minimization using existing application commands.
5. Add Spanish and English strings, then re-run focused context-menu and App tests.

### Task 5: Contract documentation, regression validation, and v13 portable

**Files:**
- Modify: `docs/DATA_CONTRACT.md`
- Modify: `docs/CHARACTER-CLIENT.md`
- Modify: `docs/AGENT_CONTEXT.md`
- Modify: `.changes/pending/keystoneclient-exact-stone-planner.json`
- Create: `keystone-client/artifacts/KeystoneClient-0.9.0-final-polish-v13-portable/KeystoneClient.exe`
- Create: `keystone-client/artifacts/KeystoneClient-0.9.0-final-polish-v13-portable/keystone-client-core.exe`

1. Document the optional `tierPieces` field, its Raider.IO provenance, fallback behavior, rating chip, custom menu, and avatar selection behavior.
2. Run client Python/bridge tests, client frontend tests/build/visual tests, Rust formatting/check/tests, and Worker typecheck/tests if the persisted contract required Worker source changes.
3. Review the final diff for scope and correctness.
4. Run `python scripts/deploy_impact.py --files <changed-paths>` and report its required actions without performing remote operations.
5. Build the clean sidecar and Tauri executable without bundles, assemble the v13 portable folder, calculate SHA-256 hashes, and verify its contents. Do not launch it while v12 owns the single-instance lock.
