# Keystone Planner V1 — Block D Web design

## Scope

Block D exposes the existing Worker planner contract in the team Web view. It adds owner preference configuration, participant and option selection, explicit locks, and Top 3 recommendation rendering. React only builds and validates transport data; the Worker remains authoritative for candidate eligibility, roles, capabilities, scoring, privacy, diagnostics, and ranking.

## Integration

- `lib/keystonePlanner.ts` owns public request/response types, strict defensive parsing, request building, request identities, and exhaustive Spanish presentation maps for the fixed reason and diagnostic enums.
- `PlannerPreferencesDialog` loads `GET /api/me/characters` and `GET /api/me/planner/preferences`, models every class spec as one of the four supported preference states, and saves one full replacement with `PUT /api/me/planner/preferences`.
- `KeystonePlannerPanel` is the single planning surface used from the team header (session mode) and the selected dungeon panel (stone mode). It receives only team/member/current-user data plus an optional dungeon ID.
- `StoneSelector` keeps the existing Objectives behavior and activates its Planner tab. Selecting another dungeon, changing mode, closing, or recalculating invalidates pending requests.
- The team header opens the same panel in session mode (`challengeMapId: null`).

## Interaction states

The planner starts with only the current user selected, target level 10, composition optimization enabled, and all four composition preferences enabled. It requires 2–5 participants and keeps at most five. Deselecting a participant removes that user's locks.

Advanced controls retain the four suboption values while composition optimization is off. Locks are visible removable rows and can constrain assignment, character, or role only when enough member character/spec information is available.

Every calculation has an `AbortController` and immutable request identity. Only the latest request for the current team, dungeon mode, and generation may update the UI.

## Response and error presentation

- `401`: redirect to the existing login route.
- `403`: inline access-lost state.
- `404`: redirect to the existing Teams list.
- `400`: show parsed server diagnostics or a defensive invalid-request message.
- `422`: recoverable no-solution message: “No hay una composición válida con estas restricciones. Ajusta participantes, preferencias o locks e inténtalo de nuevo.”
- `500`, malformed response, or network error: generic retryable failure.

An empty eligible-stone set is distinct from invalid composition. Session mode explains that the selected participants have no eligible stones; dungeon mode explains that nobody has that dungeon stone. Unconfigured users are named from team membership. Only the current user receives a configuration action; teammates receive neutral guidance. Privacy is never inferred from missing objectives.

## Recommendation cards

Cards render only values supplied by the Worker: stone owner/character, actual and target levels, assignments, vacancies, public capabilities, composition summaries, reason codes, and public objectives. The first recommendation is visually emphasized. Conditional capabilities have a distinct warning treatment. Objectives reuse the current tier styling, item icon, and tooltip components; an empty objective set uses the neutral copy “Sin objetivos puntuables para esta recomendación.”

The API currently supplies a capability spell ID but no resolved icon URL. Block D therefore renders accessible text capability badges and does not invent an image URL or add a Worker dependency.

## Accessibility and responsive behavior

Both dialogs use labelled `role="dialog"`, move focus inside on open, close with Escape, and restore focus to their trigger. All inputs have visible labels, toggles expose checked state, removable locks have explicit names, the range exposes min/max/current value, live status is announced, and cards collapse to one column on narrow viewports.

## Validation

Unit tests cover parsing, builders, enum presentation, stale identity rejection, full preference replacement, defaults, participant limits, locks, and the 40-spec catalog regression. Playwright covers both entries, configuration, calculation states, stale cancellation, diagnostics, empty/unconfigured/no-solution states, Top 3 output, accessibility, mobile layout, and HTTP handling.
