# Keystone Stone Selector S3 Web Design

## Objective and scope

S3 replaces the exposed Team-level `Planificar piedra` modal with a Web-only, inline
`Selector de piedra`. It consumes the approved S1 aggregate endpoint and the S2 tooltip-safe
metadata without changing Worker behavior. Client Teams, composition planning, deployment,
remote migrations, and releases remain deferred.

## Current-surface audit

The existing Team header combines navigation, filters, view controls, Team identity, planner,
invitation, and leave actions. The planner then opens a large modal, selects only owned stones,
and presents recommendation cards under `Composición recomendada`. Baseline Playwright inspection
at 1440px confirmed that this disconnects dungeon selection from the Team roster and makes the
header denser than necessary.

S3 removes `KeystonePlanner` from the normal Team flow. Its recommendation API and non-visual
helpers may remain for future work, but no visible or hidden control calls `/recommendations`.
The existing owner and Team `Ver objetivos` drawers remain and gain the shared item tooltip.

## Component boundaries

- `lib/keystoneSelector.ts` owns the strict aggregate DTO parser, request paths and identities,
  tier grouping, spec filtering, and Team-detail stone-count derivation.
- `app/teams/[id]/StoneSelector.tsx` owns dungeon selection, abort/generation request safety,
  inline loading/error/empty states, character expansion, spec selection, and the grouped grid.
- `app/components/KeystoneLootItemTooltip.tsx` owns one portal-based tooltip/popover interaction
  for Selector tiles and existing objective rows.
- `KeystoneLootObjectiveList.tsx` keeps its established row layout while delegating tooltip
  content and interaction to the shared component.
- The Team page renders `StoneSelector` between the Team header and member cards and no longer
  renders `KeystonePlanner` or recommendation-derived highlighting.

## Contract and request lifecycle

The parser projects only documented fields, ignores unknown additive keys, validates expected
Team/dungeon identity, positive IDs, safe strings and HTTPS URLs, bounded arrays, non-negative
counters, stat names, spec IDs, and Voidcore states. It never accepts raw KeystoneLoot or Blizzard
payloads.

Selecting a dungeon updates the control immediately, aborts the previous request, increments the
exact request identity, and loads:

```text
GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary
```

Only the current identity may update state. HTTP 401 routes to login; 403 explains lost Team
access; 404 follows existing missing-Team semantics; malformed and transient failures remain
inside the Selector panel with retry. Closing or unmounting aborts work and invalidates identity.

All eight buttons come from `MIDNIGHT_SEASON_2_DUNGEONS`, never from owned stones. Their initial
counts are derived from the already weekly-reset-filtered `currentKeystone` values in Team detail;
the selected aggregate response supplies its authoritative detailed availability and refreshes the
selected count.

## Layout and presentation

The Selector is a full-width dark surface below the Team header. At desktop widths all eight
dungeons are immediately scannable in one compact grid row where space allows. Mobile uses a
horizontal scroll strip with stable-width controls. Available stones use the existing yellow/gold
Poison accent, while `×0` remains subdued, enabled, focusable, and labelled beyond color.

The selected control connects visually to one inline bordered panel. Its header contains only the
active `Objetivos` tab, a semantically disabled `Planificar piedra · Próximamente` tab, and close.
Loading uses a compact fixed-height skeleton. Summary counts lead into server-ordered character
cards in one or two columns.

Characters start collapsed. Cards show avatar/fallback, class-accented name, owner, objective and
tier counts, and spec context. Multiple specs use compact chips only when needed; selecting a chip
filters by the objective's `specIds` without changing the top-level deduplicated total. Expanded
actionable items are grouped as Best in Slot, Must have, Nice to have, Catalyst, Transmog, and
Other. Completed Voidcore items appear in a separate subdued section.

## Shared tooltip

The tooltip trigger is a native button. Mouse hover and keyboard focus open it; click/tap toggles
a dismissible popover; Escape and outside click close it. A fixed-position React portal to
`document.body` avoids drawer/panel clipping and clamps placement to the viewport. Focus styling
and visible labels ensure color is never the only signal.

Content uses S2-safe fields only: name, icon, slot, class/subclass, stat names, source dungeon,
spec context, tier, and Voidcore state. Missing values are omitted rather than invented. No numeric
stats or raw response data are displayed.

## Responsive and motion behavior

Desktop uses a full-width panel and dense cards. Mobile preserves a scrollable dungeon strip,
single-column cards, wrapping item grids, minimum touch targets, and viewport-clamped popovers
without horizontal page overflow. Transitions are restrained, and reduced-motion disables
nonessential motion.

## Test and visual strategy

Test-first coverage includes strict parser accept/reject behavior, all eight pool entries, stone
counts, request identity, safe paths, tier grouping including Other, spec filtering, completed
Voidcore separation, and additive tooltip fields on owner/Team parsers. Source-level assertions
protect semantic controls, removed planner exposure, abort handling, disabled future tab, shared
tooltip reuse, and privacy boundaries.

A project-local Playwright harness mocks only HTTP responses and exercises the real Next page for
closed/open, `×0`, switching and stale response protection, loading, empty, multi-character,
single/multi-spec, expanded grids, completed items, tooltip keyboard/touch behavior, lost access,
long names, and desktop/mobile screenshots. Screenshots are inspected during implementation rather
than accepted as automatic proof.
