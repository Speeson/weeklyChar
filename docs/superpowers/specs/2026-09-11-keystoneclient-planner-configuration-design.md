# KeystoneClient Planner configuration and visual refinement design

## Objective

Complete the exact-stone Planner flow in KeystoneClient so each user configures which of their
characters and specializations they can play, the Team selects only the people available for the
run, and the Worker automatically calculates the best character, specialization and role assignment
for the selected stone.

This design supersedes the participant and role-lock controls described for the left Planner column
in the 2026-09-10 exact-stone design. It does not change the existing Team selector component.

## Product rules

- Availability is selected manually from the existing member strip because not every Team member
  participates in every run.
- At most five members may be selected in Planner mode.
- Selecting a stone always selects and pins its owner.
- Every selected member is a required participant. The Planner chooses that member's best eligible
  character, played specialization and derived role automatically.
- The normal Planner UI exposes no role, character or assignment locks. Requests send `locks: []`.
- The Worker remains the sole owner of composition generation, scoring and ranking.

## Own-character configuration

### Entry points

The Planner exposes a persistent **Configurar mis personajes** action. When the authenticated user
enters **Planificar piedra** without at least one valid, non-disabled preference, the same editor
opens automatically as a blocking modal.

The modal blocks interaction with the Planner only. The user may leave Planificar piedra or navigate
elsewhere in the Client, but cannot select a Planner run or calculate a Top 5 until configuration is
valid. “First use” is not stored as a separate flag: an empty or no-longer-valid preference set is
the source of truth.

### Editor layout

Use the approved **cards by character** layout:

- one compact row per currently synchronized character owned by the authenticated user;
- character avatar, name, realm and class identity remain in a fixed block on the left;
- up to three equal specialization cards share the remaining row width;
- each specialization card is collapsed by default and expands on activation to reveal its
  availability and loot-specialization selectors;
- the specialization's role is derived from the Worker-owned catalog and is never manually chosen;
- each row chooses `preferred`, `available`, `emergency` or `disabled`;
- each enabled row chooses a loot specialization belonging to the same class;
- existing preferences prefill the editor;
- new rows begin disabled and default their loot specialization to the played specialization when
  enabled;
- saving requires at least one enabled row across the user's characters.

Saving uses the existing owner-scoped `PUT /api/me/planner/preferences` replacement contract. Other
members cannot view or edit the user's detailed preference values.

If a synchronized character has an unknown class, it remains visible with a recoverable explanation
but cannot produce editable specialization rows. A failed save keeps the modal contents and shows an
inline error. Session expiration returns to the existing login flow.

## Team readiness and member selection

Team detail gains one additive privacy-safe boolean per member:

```ts
plannerConfigured: boolean
```

It is true only when that user currently owns at least one character with a valid non-disabled
Planner preference. It reveals no character, specialization, loot specialization or preference
priority.

The existing Team selector remains unchanged. The member strip is aligned to the selector's current
50 px trigger height and preserves its visual language. Its behavior depends on the active feature:

- Objectives mode keeps the current filtering behavior and permits every member.
- Planner mode treats the strip as run availability, caps selection at five, pins the selected
  stone owner and marks unconfigured members as unavailable.
- An unconfigured non-owner cannot be selected and exposes a concise “Sin configurar” state.
- A stone owned by an unconfigured member remains visible, but cannot be planned; it explains that
  its owner must configure their characters.
- If the authenticated user is unconfigured, the blocking own-character modal takes precedence.

The member selection remains the single source of participant IDs. The left column does not repeat
participants, availability controls or role selectors.

## Left Planner column

Keep the approved approximately 320 px composition. Its first element is a full-width
**Configurar mis personajes** action, without a redundant section heading or tagline. The remaining
controls preserve this order:

1. **Nivel mínimo** in a themed inset panel, with a polished range track, thumb and numeric value.
   It only filters visible stones and never affects scoring.
2. **Piedras disponibles** as full-width cards. Each card shows the existing local Season dungeon
   artwork on the left, keystone level, owner character and owner username. No crown or generic gem
   appears here.
3. **Prioridades del grupo** as four rows: Heroísmo, Resurrección en combate, Buffos de clase and
   Sinergias de daño. Each row shows a readable 38–40 px ability icon, label, short description and
   a compact switch aligned right.
4. **Calcular Top 5** as the explicit final action.

Capability artwork uses locally bundled copies of the selected World of Warcraft spell artwork:
Heroism, Rebirth, Arcane Intellect and Chaos Brand. The Client must not require a live Wowhead page
to render. Controls use existing theme variables and `color-mix`, with adequate inner spacing, so
light, dark and future themes retain contrast and neither icon nor switch touches a card edge.

## Top 5 previews and accordion

Five equal, elongated recommendation cards divide and fill the complete result height. Each preview lays
out five compact assignment cards and includes a dedicated disclosure button using the same chevron,
border and rotation behavior as the existing Team selector.

Each assignment card contains:

- the current official World of Warcraft Tank, Healer or Damage role artwork in a rounded square at
  the upper left;
- a circular character avatar above the character name;
- the character name in its canonical class color;
- class and played specialization beneath the name, replacing the redundant role text;
- a class-tinted border, surface and restrained glow that work in every Client theme;
- a larger gold group-leader crown at the upper right only for the exact stone owner.

Role artwork is bundled locally from the current Blizzard LFG role-icon atlas family rather than
approximated with generic shield, heart or swords icons. Role remains available through accessible
text even though the visible label is removed.

Opening a recommendation preserves the approved exclusive accordion and Tank/Healer-over-three-DPS
layout. Expanded assignment cards use the same role, avatar, class-color and crown grammar as their
preview counterparts, followed by objectives, buffs, utilities and ranking information.

## Data flow

The Client preserves its private path:

```text
React → typed core request → Tauri JSONL bridge → Python sidecar → Worker
```

Required additions are:

- owner preference GET/PUT commands and defensive DTO parsing in the Client core and sidecar;
- owned-character data projected to the editor without exposing bearer tokens to React;
- additive `plannerConfigured` parsing on Team detail;
- mode-aware member selection and blocking-modal state in Teams UI.

No D1 migration is required because `character_play_preferences` and its owner-scoped Worker routes
already exist. Existing preference validation, class/spec validation and atomic replacement remain
authoritative.

## Error and empty states

- Own configuration missing: blocking editor in Planner mode.
- Other member missing configuration: disabled member card with status.
- Stone owner missing configuration: stone visible but Planner action unavailable with explanation.
- Fewer than two selected configured users: calculate disabled with selection guidance.
- Two to four selected users: preserve the current partial-composition result and vacancies.
- Five selected users: produce the ranked complete Top 5 when a valid 1/1/3 assignment exists.
- Stale stone, no valid composition, invalid response and network/session errors retain explicit,
  recoverable states.

## Accessibility and responsive behavior

- Modal focus is trapped while open; Escape cannot silently bypass required configuration inside
  Planner, but navigation away remains possible through the normal application navigation.
- Every preference field has a character/spec-specific accessible name.
- Unconfigured, selected, pinned and disabled states never rely only on color.
- Official role images have hidden duplicate visuals and an accessible role label on the card.
- All controls have keyboard focus states and at least the Client's existing minimum hit target.
- Validate at 1672×941 and the supported 940×529 minimum without horizontal page overflow.

## Verification

- Worker typecheck and complete Worker test suite, including the additive readiness projection and
  privacy boundary.
- Client Python compilation, service tests and bridge-process tests for preference GET/PUT.
- Client unit tests for preference parsing, mandatory-modal gating, mode-aware member limits,
  owner pinning, automatic empty locks and theme-safe rendering states.
- Client build and focused visual tests for both themes at standard and minimum sizes.
- Packaged sidecar smoke and direct local Tauri executable build before interactive review.
- Deployment Impact classification after verified changes.

## Release boundaries

- In scope: Worker additive readiness field, KeystoneClient bridge/core/UI/assets, tests, data
  contract documentation and a pending Client changeset.
- Out of scope: Web UI, D1 schema changes, scoring weights, Team selector redesign, automatic member
  availability selection, Client-side scoring, Worker deployment and Client publication.
- Any production Worker deployment or Client release requires separate explicit authorization after
  local validation.
