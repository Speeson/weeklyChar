# KeystoneLoot V2-B Design

## Objective

Add an owner-only, per-character KeystoneLoot objective drawer to the Characters page. Consume the V2-A allowlisted owner endpoint with runtime validation, server-side dungeon/spec filters, bounded pagination, and stale-request protection.

## Approved architecture

`keystone-web/lib/keystoneLootObjectives.ts` owns response validation and display-only labels, fallbacks, freshness, request construction, pagination merging, and request identities. Dungeon names continue coming from `season2.ts`; specialization names/options continue coming from `wowSpecs.ts`.

`KeystoneLootObjectivesDrawer.tsx` is a focused Client Component using native `<dialog>`. It opens from an exact character-row button, shows character/realm/class context, requests only `/api/me/characters/:id/keystone-loot/objectives`, and handles every product status separately from recoverable HTTP/schema errors. Filters reset pagination and request the server; `Cargar más` consumes the opaque cursor. Abort plus exact request identity prevents character/filter/close races.

Desktop uses a right-side drawer; mobile uses a full-width/full-height sheet. Focus moves into the modal and returns to its trigger. Escape, backdrop, keyboard navigation, accessible labels, live loading/error announcements, visible textual statuses, 44 px controls, and scrolling are preserved.

## Verification

- Web helper/parser and structural UI tests.
- Web production build, TypeScript, and lint comparison against the known baseline.
- Worker typecheck and complete tests as V2-A regression.
- Responsive review at 1440×1100 and 390×844, strict deployment impact, and `git diff --check`.

## Out of scope

Team/planner objective UI, Settings wording, Worker/D1 changes, addon/client changes, versioning, commits for V2-B, push, deployment, remote migration, secrets, releases, and V2-C.
