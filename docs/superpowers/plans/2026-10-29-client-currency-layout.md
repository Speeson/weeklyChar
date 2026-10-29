# Client Currency Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Give each client user a persistent 16-slot currency layout and compact, legible cards with detail tooltips.

**Architecture:** Keep the catalog and layout operations in focused `src/core/` modules. `CharactersPage` owns the modal and grid; existing character DTOs supply values. No Worker setting is needed.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-client-custom-currencies-design.md`

## Global Constraints

- Exactly 16 slots in two rows of eight; 22 catalog choices, 11 default cards including the flute.
- Per authenticated client user and per installation; save each successful operation immediately.
- Every quantitative card shows an icon, number, and complete title in at most two lines.
- Trovehunter keeps its status icons and moves its explanatory text to the card detail tooltip.
- Do not alter Worker routes or D1 schema for the additive `currencies` map.
- Do not commit, push, publish or deploy without an explicit request.

## Review Focus

- Corrupt or outdated local layout must fall back safely and retain valid slot choices: Task 1 test.
- Switching signed-in users must switch layouts without leaking the prior user's choices: Task 1/Page integration test.
- A full grid must reject click-add without replacing anything; targeted drops still replace: Task 1 test.
- Unknown bank data must not display a false zero: Task 3 test.
- A second tooltip must not cover the currency details or make keyboard focus unusable: Task 3 interaction test.

---

### Task 1: Catalog and layout state

**Files:** Modify `keystone-client/src/core/characterSnapshots.ts`, `keystone-client/src/core/characterSnapshots.test.ts`, `keystone-client/src/core/types.ts`, `keystone-client/src/App.tsx`; create `keystone-client/src/core/currencyLayout.ts`, `keystone-client/src/core/currencyLayout.test.ts`.

**Interfaces:** `CurrencyKey` is the known catalog key; `CurrencyLayout` is a 16-element array of `CurrencyKey | null`. Export `defaultCurrencyLayout()`, `loadCurrencyLayout(username)`, `saveCurrencyLayout(username, layout)`, `addCurrency(layout,key,slot?)`, `moveCurrency(layout,from,to)`, `removeCurrency(layout,slot)` from `currencyLayout.ts`. Pass `auth.username` into `CharactersPage` as `username`.

- [x] Write tests for the 22 unique catalog keys, 11-card default, 8-by-2 slot positions, corrupt/unknown keys, user isolation, first-free click placement, occupied-list replacement, occupied-slot swap, move to empty, removal, and full-grid no-op.
- [x] Run `npm --prefix keystone-client test -- src/core/currencyLayout.test.ts src/core/characterSnapshots.test.ts` and confirm the new assertions fail.
- [x] Implement catalog metadata and pure layout operations; persist a versioned per-username record in local storage with safe fallback when storage is unavailable. Ignore unknown saved keys safely without rendering them.
- [x] Run the two targeted test files and confirm they pass.

### Task 2: Layout editor and character page integration

**Files:** Modify `keystone-client/src/pages/CharactersPage.tsx`, `keystone-client/src/pages/CharactersPage.test.tsx`, `keystone-client/src/App.css`; optionally create `keystone-client/src/components/CurrencyLayoutEditor.tsx` and its test if it keeps `CharactersPage` manageable.

**Interfaces:** `CharactersPage({state,username})` loads the per-user layout; editor receives `layout`, `onLayoutChange`, catalog metadata, and `onClose`. Successful interactions call `saveCurrencyLayout` immediately.

- [x] Write failing interaction tests for open/close, 16 visible slots, scrollable unplaced list, click first-free, list-to-occupied replacement, slot-to-slot swap, removal, restore defaults, keyboard equivalent, and account switching.
- [x] Run `npm --prefix keystone-client test -- src/pages/CharactersPage.test.tsx` and confirm the new assertions fail.
- [x] Implement editor controls, HTML drag/drop and keyboard/click placement; render actual panel by slot index so holes preserve position. Add ES/EN copy.
- [x] Run targeted tests and confirm they pass.

### Task 3: Compact cards and detail tooltips

**Files:** Modify `keystone-client/src/pages/CharactersPage.tsx`, `keystone-client/src/pages/CharactersPage.test.tsx`, `keystone-client/src/App.css`, `keystone-client/src/core/charactersPreview.ts`, `keystone-client/src/core/types.ts`.

**Interfaces:** Card receives catalog metadata plus `CharacterCurrency`; its local tooltip receives cap/location/status rows. Flute quantity is bags + known personal and Warband bank counts and is independent of Bounty status.

- [x] Write failing tests for 22 selectable card types, own flute card and no Bounty flute badge, Bounty icons without status text in card, tooltip text on hover/focus, cap text only in tooltip, missing/last-known bank values, and full titles in ES/EN.
- [x] Run `npm --prefix keystone-client test -- src/pages/CharactersPage.test.tsx` and confirm failures.
- [x] Implement eight equal columns with compact icon/amount and two-line title fitting; move cap, status and location details to a focusable local tooltip and restrict Wowhead hover to a compatible target.
- [x] Run targeted tests, `npm --prefix keystone-client run build`, and the relevant Playwright visual test. Inspect rendered titles at normal and minimum supported window scales; adjust only necessary fonts/spacing.

### Task 4: Contract, release metadata and final verification

**Files:** Modify `docs/DATA_CONTRACT.md`; create one valid `.changes/pending/*.json` for Client behavior. Update existing client fixtures/tests touched by changed defaults.

**Interfaces:** The client keeps forwarding nested `currencies` as before; missing additive keys remain safe.

- [x] Update contract documentation for new addon keys and the account-wide Tender handling, and add a client changeset.
- [x] Run the narrow client test suite and build, plus targeted Python bridge/payload tests; run `python scripts/deploy_impact.py --files <actual changed paths>`.
- [x] Review the diff, status and visual artifacts; report any missing in-game validation separately.
