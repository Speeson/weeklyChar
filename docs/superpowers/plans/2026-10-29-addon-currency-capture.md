# Addon Currency Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Capture eight new tracked entries in the canonical addon and correct Mistcrest cap semantics.

**Architecture:** Add five currency definitions to the existing `C_CurrencyInfo` loop and three item snapshots beside flute tracking. Preserve old SavedVariables and bank last-known counts. The client/Worker already transport the nested `currencies` map.

**Tech Stack:** WoW Lua, Python unittest and Lua runtime harness.

**Spec:** `E:/Projects/weeklyChar/docs/superpowers/specs/2026-10-29-client-custom-currencies-design.md`

## Global Constraints

- Canonical source is `E:/Projects/KeystoneSync-working`; never add addon runtime files to the Client.
- New IDs 2803, 3392, 1166, 2032, 3316 and item IDs 276547, 276548, 280562 require live game confirmation.
- The two Souls include bags, personal bank and Warband Bank; Venomstone excludes Warband Bank.
- No permanent Mistcrest cap override; do not mistake a balance for a cap.
- Do not commit, push, tag, publish or deploy without explicit request.

## Review Focus

- A bank inaccessible at save time must retain the last trustworthy count: Task 2 test.
- A bank opened for another character must not copy that character's personal bank value: Task 2 test.
- Warband Bank must be counted once in an account aggregate, never once per character: Task 2 contract test.
- A missing `GetCurrencyInfo` result must not silently erase valid state: Task 1 test.
- A lifted Mistcrest cap must not render as current balance/current balance: Task 3 test.

---

### Task 1: Currency API entries

**Files:** Modify `E:/Projects/KeystoneSync-working/KeystoneSync.lua`, `E:/Projects/KeystoneSync-working/tests/runtime/test_season2_contract.py` and/or `test_character_snapshots.py`.

**Interfaces:** `CURRENCIES` gains keys `undercoin`, `remnantOfAnguish`, `timewarpedBadge`, `tradersTender`, `voidlightMarl`; each value remains a `currencies` table entry with `id`, `quantity`, `iconFileID`, and API-supplied cap fields. Add `isAccountWide` when available.

- [x] Write failing harness tests asserting all five IDs, current quantity, icon, account-scope metadata, and safe behavior for missing API data.
- [x] Run `python -m unittest tests.runtime.test_season2_contract tests.runtime.test_character_snapshots` in the addon repo and confirm failures.
- [x] Extend the currency definitions and snapshot fields without changing existing keys.
- [x] Run targeted tests and confirm they pass.

### Task 2: Three physical items

**Files:** Modify `E:/Projects/KeystoneSync-working/KeystoneSync.lua`, `E:/Projects/KeystoneSync-working/tests/runtime/test_spark_bank_tracking.py` and possibly a focused new item test.

**Interfaces:** Add `currencies.afflictedSoul`, `.tormentedSoul`, `.ascendantVenomstone` entries. Reuse the flute location shape (`bagCount`, `bagCountKnown`, `personalBankCount`, `personalBankKnown`, `warbandBankCount`, `warbandBankKnown`, capture timestamps); omit Warband fields for Venomstone.

- [x] Write failing harness tests for bags, character bank, account bank, unknown/last-known values, item icon/ID, and Soulbound bank exclusion.
- [x] Run targeted item tests and confirm failures.
- [x] Extract only the item-counting helper necessary to share flute semantics, then add three item snapshots to `GetCurrencyData`.
- [x] Run targeted item tests and confirm they pass.

### Task 3: Mistcrest cap correction

**Files:** Modify `E:/Projects/KeystoneSync-working/KeystoneSync.lua`, `E:/Projects/KeystoneSync-working/tests/runtime/test_season2_contract.py`.

**Interfaces:** Mistcrest cap fields represent an active WoW cap, not a current balance. Older SavedVariables must not be treated as active cap evidence after a cap lift.

- [ ] Obtain and record live `GetCurrencyInfo` data for all five Mistcrests and compare with a recent SavedVariables snapshot; confirm the cap source/semantics. The local SavedVariables comparison is done; in-game API confirmation remains before release.
- [x] Write failing tests for capless current data, old stale cap data, and a later genuine active cap.
- [x] Implement the narrowest API-driven correction that keeps later real caps visible.
- [x] Run targeted cap tests and confirm they pass.

### Task 4: Release preparation and validation

**Files:** Create a valid `E:/Projects/KeystoneSync-working/.changes/pending/*.json`; inspect `.toc`, update addon docs only for changed durable behavior.

**Interfaces:** Additive `KeystoneSyncDB` shape, no version bump until a release is requested.

- [x] Add a Spanish addon changeset describing new tracked entries and cap correction.
- [x] Run `python -m unittest discover -s tests/runtime` in the addon repo, inspect `.toc` required files and package layout, and run `python scripts/deploy_impact.py --files KeystoneSync.lua .changes/pending/<filename> --json --strict`.
- [x] Review diff/status and record lack of manual WoW validation if the live game is unavailable.
