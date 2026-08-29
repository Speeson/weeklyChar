# Stone Selector S5 final report

## Scope and architecture

S4 was revalidated at its approved baselines and committed as
`58b54d2b0b5101f9d0e44157186cf2d1bc45de62` (`feat(client): add Teams stone selector bridge`).
No push followed. S5 is finalized in the local phase commit containing this report.

S5 adds the first-class `Equipos` / `Teams` route between Sync and Addon. `App` owns route and
session-expiry transitions; `TeamsPage` receives an injected `TeamsDataSource`; the live source
uses only the S4 `teams.list`, `teams.get`, and `teams.keystone_selector` bridge commands. React
contains no direct Worker fetch, bearer token, invite code, raw KeystoneLoot, vault, or account
access.

One Team renders as a heading. Multiple Teams use a native, keyboard-accessible select; switching
invalidates pending Selector work, clears the dungeon, and reloads detail. Lost Team access removes
that Team and advances to the next valid selection. An empty Team list presents a Web action through
the existing native `openWeb` path and does not implement Team creation.

The upper dashboard is a bounded horizontal member strip with usernames, character avatars or
initial fallbacks, class-colored names, and compact current keystones. No member avatar is invented.
All eight verified Season 2 dungeons are shown in a compact vertical rail. Counts are derived locally
from the selected Team detail by `challengeMapId`; there is no eight-request fan-out. Zero-count
dungeons remain enabled after detail loads. The selected rail entry is a larger, brighter, rounded
card with its own border and Poison glow. A clean gap separates it from the independently rounded
objectives panel, which exposes local prompt/loading/error/empty/populated states, a close action,
and a visible disabled Planner.

Each explicit dungeon click starts one bridge request. Request generations protect Team detail and
Selector state from late results. The dashboard and rail remain present during the local result
skeleton. `SESSION_EXPIRED` returns to the existing login flow. Server totals and character order
are preserved. Cards start collapsed; multi-spec cards expose an All filter plus spec chips, while
single-spec cards avoid redundant controls. Actionable items are grouped BiS, Must, Nice, Catalyst,
Transmog, then Other; completed Voidcore items remain in a subdued disclosure.

`TeamItemTooltip` is a `document.body` portal supporting hover, focus, click pinning, outside click,
and Escape. It renders item name/fallback, icon/fallback, slot/class/subclass, qualitative stat names,
source dungeon, specs, tier, and Voidcore state. Numeric stats are never rendered. Fixed-frame
coordinates use the live `frame width / 1672` scale and are clamped to the viewport; this was checked
at both 1672×941 and 940×529.

## Preview, i18n, and visual review

`core/teamsPreview.ts` centralizes development-only data-source injection. The deterministic
scenarios are `teams-default`, `teams-multiple`, `teams-empty`, `teams-selector-full`,
`teams-selector-multispec`, `teams-selector-empty`, `teams-selector-loading`, and
`teams-selector-error`. They cover five members, multiple characters, long names, x0/x1/x2 counts,
multi-spec objectives, all tier groups, completed/unchecked Voidcore, icon metadata, and missing
metadata. `?lang=en` makes preview language deterministic. Visible strings use the shared ES/EN
catalog; the English header is `Sync | Teams | Addon`.

`ui-ux-pro-max` was unavailable in this session, so the fallback used the existing Poison design
system plus iterative Playwright capture and direct image inspection. The early default capture
validated the dashboard/rail proportions but the first interaction pass exposed a pre-detail click
race and an unanchored item indicator. The final pass gates rail clicks only while Team detail is
loading, anchors item indicators to their tiles, retains zero-count accessibility afterward, and
adds viewport-clamped scaled tooltip coverage. Final captures were inspected for one/multiple/no
Team, native switcher focus, five-member density, long names, all eight counts, initial/available/x0
states, loading/error/empty results, multiple cards, multi/single-spec expansion, tier grids,
completed Voidcore, regular/fallback/missing-metadata tooltips, Spanish, English, and minimum scale.
The native select popup itself is drawn by the OS and is not captured by browser screenshots; its
focus, selection, and keyboard semantics are tested instead.

Header regression inspection confirmed the third tab does not overlap Settings, profile, Minimize,
or Close at 1672×941 or 940×529. Body scroll remains disabled and result/member scrolling is local.
Reduced-motion rules disable new skeleton and chevron animation.

## Validation

- Frontend before S5: 155/155.
- Frontend after S5: 174/174 across 35 files.
- TypeScript/Vite production build: pass.
- Rust format/check: pass; Rust tests 23/23.
- Python compileall: pass; Client tests 87/87.
- Client bridge tests: 59/59.
- Clean PyInstaller build: pass; ready, ping, get_state, second_ping, and EOF smoke all pass.
- Focused Teams Playwright: 3/3 pass, including the 26 requested review concerns across combined
  deterministic captures.
- Full Playwright: 147/149 pass after selectively normalizing only the 24 reviewed and authorized
  baselines for the new Teams navigation and current 0.6.4 Client version. The only remaining
  failures are two stale changelog assertions expecting 0.6.3 although the current bundled release
  is 0.6.4. All three new Teams tests and the adapted multi-idle-tab geometry test pass.
- Direct source audit: no `fetch`, Authorization/Bearer, or token access exists in `TeamsPage`, its
  tooltip, or preview source.

## Release and impact

The existing pending Client changeset was extended into one coherent bridge-plus-UI release note;
it was not consumed and no version changed. Incremental strict impact is Client build/release only:
Web, Worker, DB, addon, and addon release are false; unknown/outside paths are empty. Cumulative
S1–S5 strict impact is Web, Worker, DB, Client build, and Client release; addon and addon release are
false; unknown/outside paths are empty.

No push, PR, merge, deploy, remote migration, release, tag, version bump, addon write, or remote
operation occurred. S5 review and the authorized selective snapshot normalization are complete.
S6 begins with the two stale changelog expectations and the full release-readiness matrix; the future
composition Planner and cross-surface seasonal-package consolidation remain deferred.
