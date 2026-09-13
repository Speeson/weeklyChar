# Keystone Planner: play/loot separation and loot synergy

## Objective

Separate the specialization a character plays from the specialization whose loot they want, fix
Planner ranking so loot cannot force an unwanted played role, and add armor-type loot synergy as a
late deterministic tie-breaker.

## Approved behavior

### Play preferences

Each character specialization independently uses `preferred`, `available`, `emergency` or
`disabled`. The solver first favors coverage of the critical Tank and Healer roles, then minimizes
emergency assignments and maximizes preferred assignments. Consequently, an available Tank or
Healer may beat a preferred DPS when the critical role would otherwise remain vacant. Loot never
changes the played specialization or derived role.

### Loot priorities

Loot is configured once per character, outside the played-spec cards:

- exactly one primary loot specialization;
- zero or more secondary loot specializations;
- every remaining same-class specialization has no loot interest.

Selecting the current primary again clears it. Attempting to select a different primary while one
is still selected shows an error and leaves the draft unchanged; the user must clear the current
primary first. Promoting a secondary to primary removes it from the secondary set. For a selected
dungeon, the primary loot specialization is recommended whenever it has an actionable objective;
otherwise the highest-value secondary with actionable objectives is recommended. If none has an
objective, the primary remains the recommendation. This recommendation is identical for every
played-spec candidate of the same character.

### Ranking and loot synergy

Recommendation comparison is lexicographic: critical-role coverage, stone level distance,
emergency/preferred/available play counts, enabled composition utilities, armor loot synergy,
personal objective value, and finally stable identity. Armor loot synergy counts same-armor pairs
in the proposed party (`cloth`, `leather`, `mail`, `plate`); it is a potential-sharing heuristic,
not a promise that a future drop will be tradeable. No item-level, weapon, trinket or exact trade
eligibility analysis is added.

## KeystoneClient experience

- Clicking a specialization opens its availability list directly; the intermediate availability
  plus loot window is removed.
- The activator shows `Selecciona tu preferencia`/`Select your preference` when no explicit value
  exists, then shows the selected label and its icon immediately before the chevron.
- Availability rows use only a leading visual icon: heart for preferred, green check for
  available, warning for emergency and X for disabled. Rows remain accessible listbox options and
  use larger readable text.
- The active/inactive move buttons are removed; drag and drop remains the only visible movement
  mechanism, with the existing accessible drag semantics retained.
- Their former square position becomes a same-size loot button. It shows a World of Warcraft loot
  visual and opens a floating character-level matrix whose rows are specs and whose columns are
  primary, secondary and no interest.
- The first configuration shows a two-step guided highlight once per KeystoneSync user: loot first,
  then availability. Completion is persisted only with a successful preference save and therefore
  follows the user across devices.
- An active character is saveable only when it has at least one non-disabled played spec and one
  primary loot spec. Inactive characters keep all played specs disabled and do not block saving.

## Architecture and compatibility

- Add forward-only D1 migration `0011` with normalized character loot preferences and a small
  per-user Planner settings row. Existing per-played-spec `loot_spec_id` remains as a legacy mirror.
- Do not infer loot interests from legacy played-spec rows during migration. Existing characters
  start with every loot spec at no interest and must choose their primary explicitly.
- Extend owner preference GET/PUT responses additively with `lootPreferences` and
  `onboardingCompleted`.
- New PUT requests send play preferences and character loot preferences separately. Legacy PUT
  requests containing only per-row `lootSpecId` remain accepted and are deterministically converted
  to the new character-level model.
- The Worker adapter selects one recommended loot spec per character before solver enumeration.
  Public Planner assignments retain the existing `lootSpecId`, now meaning recommended loot spec.
- KeystoneClient carries the additive contract through React, the typed core, Tauri JSONL bridge
  and Python sidecar. Existing released Client and Web payloads remain compatible; Web UI redesign
  is outside this delivery.
- No addon or SavedVariables change is required.

## Verification

- Worker regression tests for play/loot independence, critical-role precedence, armor synergy,
  primary/secondary selection, legacy payload conversion and owner isolation.
- Local D1 migration application and Worker `typecheck` plus complete tests.
- Client Python and bridge tests for the additive preference document.
- Client Vitest and visual coverage for direct availability selection, icons, loot matrix,
  drag-only active/inactive movement and the persisted two-step guide.
- Client production build and relevant Rust checks.
- Deployment Impact classification for every changed path.

## Out of scope

- Exact item tradeability, item-by-item loot-pool simulation, weapons or trinket compatibility.
- Automatic Team-member selection, performance ranking or role-specific Raider.IO scoring.
- Web preference-editor redesign, addon changes, remote migration, deployment, push or Client
  publication.
