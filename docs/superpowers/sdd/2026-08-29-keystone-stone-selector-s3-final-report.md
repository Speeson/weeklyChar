# Stone Selector S3 final report

Date: 2026-08-29  
Branch: `feature/keystone-stone-selector`  
Worktree: `C:\DAM2\weeklyChar-keystone-stone-selector`

## Phase boundary

- Approved S2 commit: `f17c3af9daf0060f72c33a9719fb4d29f41099a4`
  (`feat(worker): enrich KeystoneLoot item metadata`). No push occurred.
- S3 is a Web runtime change plus documentation, tests, and a deployment-classifier coverage
  correction. It changes no Worker business logic, D1 schema, Client, addon, version, or release
  metadata.
- All S3 changes remain unstaged and uncommitted.

## Implemented Web design

- The Team header's exposed `Planificar piedra` action and the old
  `Composición recomendada` visual flow are removed. `KeystonePlanner.tsx` and
  `KeystonePlannerObjectivePanel.tsx` are deleted; isolated recommendation helpers remain for the
  deferred planner.
- `StoneSelector.tsx` sits in normal document flow between Team actions/errors and existing member
  cards. Its horizontal strip always uses all eight entries from `lib/season2.ts`, shows current
  Team-detail counts, and keeps `×0` entries enabled and keyboard reachable.
- Selecting a dungeon opens one inline panel. Switching updates the same panel; close aborts and
  collapses it. The header contains only active `Objetivos`, disabled
  `Planificar piedra · Próximamente`, and close.
- The panel renders server summary counts, availability, server-ordered collapsed character cards,
  tier chips, optional multi-spec chips, compact semantic tier grids, and a collapsed/subdued
  completed-Voidcore section. Single-spec cards avoid redundant filter chrome.
- Desktop uses an eight-column dungeon strip and up to two character columns. Mobile uses a
  horizontally scrollable strip, one-column cards, wrapping item groups, and bounded touch
  popovers. Reduced-motion utilities suppress nonessential movement.

## Contract and request lifecycle

- `lib/keystoneSelector.ts` defines and strictly projects the S1 aggregate DTO. It verifies exact
  Team/dungeon identity, safe scalar/array bounds, S2 metadata, availability consistency, and
  character count consistency while ignoring additive unknown fields.
- The Selector performs one request to
  `/api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary`; no per-character requests and
  no `/recommendations` requests are made.
- AbortController plus Team/dungeon/generation identity prevents stale responses from updating the
  UI. `401` routes to login, `403` clears results and explains access loss, `404` follows existing
  Team redirect semantics, and malformed/unavailable responses remain local recoverable errors.
- Worker order is preserved and Web performs no privacy reconstruction, scoring, composition, or
  Voidcore counting decisions.

## Shared tooltip

- `KeystoneLootItemTooltip.tsx` portals to `document.body`, avoiding drawer/panel clipping. It is
  used directly by Selector tiles and by the shared `KeystoneLootObjectiveList`, which covers both
  owner and Team objective drawers.
- Safe presentation includes item name/icon, slot, class/subclass, stat names, source dungeon,
  spec context, tier, and Voidcore state. Numeric stat quantities and raw snapshot fields are never
  rendered. Missing metadata falls back to `Objeto #<itemId>`, a generic icon, and an unavailable
  metadata hint.
- Desktop supports hover and keyboard focus. Click/tap pins or dismisses the popover; outside
  pointer and Escape close it. Triggers are native buttons with visible focus and accessible names.

## Visual review

`ui-ux-pro-max` was not available in this environment. The fallback was an audit of the existing
Team visual language plus iterative Playwright rendering and direct screenshot inspection.

Reviewed states covered all requested scenarios: Selector closed; all eight dungeons; mixed
`×0`/`×1`/`×2`; selected dungeon; scoped loading; full summary; multiple character cards;
single-spec expanded card; multi-spec expanded card; grouped item grid; completed Voidcore;
keyboard tooltip; missing-metadata fallback; empty dungeon; long member/character names; disabled
planner tab; access-lost error; mobile strip; mobile expanded items; and touch tooltip bounds.

The first inspection removed excessive desktop vertical depth by laying semantic groups into a
responsive two/three-column grid while retaining mobile scan order. Test fixtures were also made
explicitly empty for the zero-result state, touch-enabled for tap behavior, and missing-metadata
aware. The final desktop and mobile captures were inspected after those adjustments.

## Validation evidence

- Baseline Web tests before S3: 48 passed.
- Final `npm test`: 58 passed, 0 failed, 0 skipped.
- Final `npm run build`: passed under Next.js 16.2.6, including TypeScript and all 14 generated
  routes/pages.
- Changed-file ESLint: 0 errors, 6 pre-existing Team-page warnings.
- Full `npm run lint`: unchanged repository baseline, 13 errors and 25 warnings; no S3-created
  errors. These unrelated historical findings remain outside S3.
- Final `npm run test:visual`: 5 passed, 0 failed; this is the complete configured Web Playwright
  suite and all tests target the changed Team surface. No unrelated visual failures or snapshot
  updates occurred.
- Deployment-impact tests: 46 passed. The classifier now recognizes Web Playwright/config/test
  harness paths as known no-product-impact, matching the existing Worker/Client test-path model.
- S3 incremental strict impact: Web true; Worker, DB, Client build/release, addon/release false;
  unknown and outside paths empty.
- Cumulative strict impact versus `origin/main`: Web, Worker, and DB true; Client build/release and
  addon/release false; unknown and outside paths empty. Worker/DB are the committed S1/S2 impact.
- Final repository checks are recorded at handoff; staging must remain empty and S3 uncommitted.

## Deferred work / S4 boundary

No contract blocker was found for S4. The Client bridge can consume the existing S1 DTO, but must
retain the Client architecture boundary (React to core request to Tauri/bridge to Python sidecar to
Worker), keep bearer tokens out of React, and add its own strict aggregate projection. The Client
Teams UI, team switching, vertical Selector, Client tooltip, and all composition-planner behavior
remain deferred and require separate approval.
