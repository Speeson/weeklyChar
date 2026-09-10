# Keystone Planner V1 — Block D final report

## Checkpoint

- Block C local checkpoint: `221b1c244efd9f9f869d44bfafd5cbcf1289e022` (`feat(worker): expose Keystone Planner API`).
- Immediately after that checkpoint the tracked tree was clean. Preserved unrelated/pre-existing untracked artifacts were `.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`, `docs/keystonesync-selector-piedra-plan.md`, and `keystone-client/tauri-current-characters.png`.
- Block D remains uncommitted as requested. No push, deployment, tag, release, or remote migration was performed.

## Delivered Web structure

- `keystone-web/lib/keystonePlanner.ts` is the Web transport boundary: exact public request/response types, defensive nested parsing, request and full-replacement preference builders, request identities, participant/lock helpers, and exhaustive reason/diagnostic presentation maps.
- `PlannerPreferencesDialog.tsx` owns the current user's global character/spec preferences through `GET /api/me/characters` and `GET/PUT /api/me/planner/preferences`.
- `KeystonePlannerPanel.tsx` is shared by both entry modes. It owns participants, target level, composition preferences, visible locks, abort/stale protection, HTTP/domain states, and recommendation rendering.
- `StoneSelector.tsx` retains its Objectives view, adds the visible session action, and activates the selected-dungeon Planner tab. The Team page only supplies `currentUserId`; it was not redesigned.

## User experience

- Preferences expose exactly `preferred`, `available`, `emergency`, and `disabled` with Spanish labels. Previously absent specs default to disabled and `lootSpecId = specId`; no playable spec is inferred. Active specs may select only another loot spec from the same class. Saving sends the complete owner document, preserves loaded rows not edited (including hidden rows whose class/catalog can no longer be projected), closes the dialog, confirms success, and invalidates old recommendations.
- Characters without `wowClass` are disabled with a KeystoneClient resync message and produce no spec IDs.
- Session planning sends `challengeMapId: null`; stone planning sends the selected canonical dungeon ID. Both use the same component and endpoint.
- Only the current user is selected by default. Calculation requires 2–5 participants, a sixth is disabled, and deselecting a user removes their locks.
- The accessible range is keyboard-operable from 1 through 20, starts at 10, and permanently shows the current value and both endpoints.
- Composition optimization and its four soft subpreferences start enabled. Turning off the master visually/functionally disables the subcontrols while retaining their values.
- Advanced locks support role, character, and character+spec. Every lock is visible, named, removable, and scoped to a selected participant.
- Requests contain only participant IDs, target level, nullable challenge map, five option booleans, and visible locks. React does not send or derive candidates, objectives, stones, roles, capabilities, or scores.

## Result presentation

- Up to three Worker-ranked cards are rendered; rank 1 receives the strongest hierarchy and missing ranks are omitted.
- Each card shows dungeon/abbreviation, real/target level and distance, stone owner/character, the exact five conceptual 1 Tank/1 Healer/3 DPS slots, assignments, and differentiated vacancies with API-provided preferred capabilities.
- Assignments show available Team character avatars, class/spec/role, play preference, loot spec, and only the capability metadata returned by the API.
- Guaranteed and conditional utilities have distinct treatments. Hunter-only conditional Bloodlust is shown as conditional, never as the same green guaranteed state.
- Composition text reads only `compositionSummary`: Bloodlust, Battle Rez, unique capabilities/buffs, Chaos Brand/Mystic Touch beneficiary counts, and translated damage profile. No providers or affinities are recomputed in Web.
- Loot emphasizes players/objectives and BiS/Must/Nice counts rather than raw weighted score. Per-assignment objectives are expandable and reuse the existing tier, icon, Voidcore, and keyboard/touch tooltip presentation.
- Zero objectives use only the neutral phrase “Sin objetivos puntuables para esta recomendación.”
- All 11 current reason codes and 7 diagnostic codes have exhaustive tested Spanish maps. Known lock issue strings are converted to actionable user copy without inventing solver codes.
- The API exposes capability `iconSpellId` but no established directly renderable Web icon URL. Block D deliberately uses accessible metadata text badges, adds no duplicate provider/icon catalog, and performs no N+1 external fetches.

## States and robustness

- `401` redirects to login, `403` stays as an access-lost error, and `404` returns to Teams.
- Parsed `400` diagnostics remain actionable, including invalid locks.
- `422` is a recoverable defensive-volume-limit state with the specified copy.
- `500` and network failures use a generic message and Retry action without exposing raw internal details.
- Zero stones are neutral and have different session/dungeon wording.
- Unconfigured IDs are mapped to Team usernames. The current user receives the owner configuration action; teammate-only cases explain that each player must configure their own preferences.
- No-valid-composition is an informational state and never changes participants, preferences, or locks automatically.
- `AbortController` plus generation/team/dungeon identity prevents closed, changed-context, superseded, or unmounted work from updating the UI.
- Both dialogs are labelled modals with focus entry, Tab containment, Escape, focus return, visible focus styles, labelled controls, live status, and responsive stacked layouts.

## Catalog correction

`Devourer` (`1480`) moved from Evoker to Demon Hunter in the Web catalog. The catalog remains exactly 40 specs and has a regression test.

## Tests added or extended

- `keystonePlanner.test.ts`: valid/malformed response parsing, builders, full replacement/default rows, preserved unavailable-class rows, participant defaults/limit, lock cleanup, request identity, exhaustive enums, capability availability, and damage-profile presentation.
- `wowSpecs.test.ts`: 40-spec and Devourer ownership regression.
- `keystone-planner.spec.ts`: 14 isolated mocked-API scenarios covering both entries, defaults, Top 3 and five slots, objectives/capabilities/conditional utility, existing and first-time preference flows, all four states, alternate loot spec, missing class, five/six participants, keyboard slider, master toggle retention, advanced locks, zero/unconfigured/invalid/no-composition/422/403 states, stale cancellation, 401/404, 500/network retry, mobile, Escape, and focus return.
- Existing Selector tests were updated for the now-active entry while retaining dungeon summary, spec filtering, tooltip, Voidcore, cancellation, empty, mobile, and access-loss coverage.
- Playwright API mocks now match any configured API host, so `.env.local` staging configuration cannot escape to the network.

## Final validation

- Web `npm run lint`: passed, 0 errors/warnings.
- Web `npm test`: passed, 73/73.
- Web `npm run build`: passed with Next.js 16.2.6; all 16 routes/pages generated and `/teams/[id]` remained dynamic.
- Web `npm run test:visual`: passed, 25/25 Chromium scenarios.
- Worker `npm run typecheck`: passed.
- Worker `npm test`: passed, 189/189.
- Worker `python -m unittest tests.test_keystone_planner_migration`: passed, 3/3.
- `git diff --check`: passed.
- Strict Deployment Impact: `WEB=true`; `WORKER=false`, `DB=false`, `CLIENT_BUILD=false`, `CLIENT_RELEASE=false`, `ADDON=false`, `ADDON_RELEASE=false`; no unknown or outside paths.

## Before Block E

No implementation blocker remains. Block E should perform real authenticated Team/browser validation against the deployed Block C API, confirm representative live character preference data and capability metadata, and complete product-level accessibility/visual review. Remote Web deployment is required by impact but was not authorized or performed here.
