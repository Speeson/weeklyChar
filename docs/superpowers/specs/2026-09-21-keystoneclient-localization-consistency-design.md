# KeystoneClient Localization Consistency Design

## Objective

Make every user-facing KeystoneClient surface consistently follow the selected Spanish or English language, using official World of Warcraft European Spanish (`es_ES`) names for game entities and canonical English (`en_US`) names for English.

## Approved Design

- A central WoW catalog owns localized class, specialization, hero-talent-tree, and current Mythic+ dungeon names. Runtime snapshots remain transport data and no longer decide the display language.
- Catalog entries use stable game identifiers whenever the source contract exposes one. Normalized English and Spanish aliases are retained only as a compatibility fallback for older snapshots.
- Spanish names are transcribed from official Blizzard `es_ES` sources. English uses Blizzard's canonical `en_US` terminology.
- Character cards, talent previews, the talent dialog, Teams dungeon cards, Objectives, Planner preferences, and accessible labels all resolve names through the same catalog.
- Objectives character headings render the localized class before the localized specialization list.
- Generic interface copy, empty states, statuses, errors, recommendations, group labels, and accessibility text use the shared ES/EN localization layer instead of backend or snapshot prose.
- The Planner request carries `es_ES` or `en_US` from Client to sidecar to Worker. The Worker uses it for Blizzard item metadata and preserves the existing `es_ES` default for older callers.
- Release changesets gain optional English `summaryEn` and `detailsEn` fields. Existing Spanish-only changesets remain valid; the release generator emits localized note sections and the Client selects the requested language without guessing from prose.

## Architecture And Data Flow

- The existing `core/wowSpecs`, `core/talentDisplay`, and `core/season2` modules form the canonical frontend display catalog and expose locale-aware resolvers. Existing color, icon, transport, and snapshot code continues to use canonical internal values.
- `core/i18n` remains the source for generic interface copy. Domain resolvers do not duplicate navigation or status strings.
- Client UI language (`es` or `en`) is converted at the transport boundary to Blizzard locale (`es_ES` or `en_US`). The additive Planner locale field is forwarded without changing persisted Team or objective data.
- Worker metadata lookup validates the requested locale against the supported allowlist before using it in cache keys and Blizzard requests. Missing or unsupported values fall back to `es_ES`.
- Structured error codes choose localized user messages. Raw sidecar, Rust, or Worker messages are diagnostic inputs and are not displayed when they would bypass the selected locale.

## Official Naming Sources

- Blizzard's European Spanish class pages define class and specialization terminology.
- Blizzard's European Spanish hero-talent overview and current class update articles define hero tree terminology, including current renamed or newly added trees.
- Blizzard's European Spanish current-season article defines the dungeon names.
- Community data may be used only to associate an undocumented numeric identifier with an official Blizzard name; it does not define the displayed translation.

## Compatibility

- No addon or SavedVariables change is required.
- No D1 schema migration is required.
- Planner locale is additive and older Client/sidecar/Worker combinations retain their current Spanish metadata default.
- Existing Spanish-only changesets remain consumable. English UI uses a neutral localized fallback for a release entry that predates bilingual metadata.

## Verification

- Unit coverage for all supported classes and specializations in both languages, every catalogued hero tree, and every current-season dungeon.
- Component coverage for Characters, the talent dialog, Teams Objectives, Planner preferences, empty/error states, and accessible labels in Spanish and English.
- Client frontend tests and production build.
- Client Python and bridge tests for Planner locale forwarding.
- Worker typecheck and tests for locale validation and metadata lookup.
- Changeset/release-generator tests for bilingual and legacy entries.
- Strict Deployment Impact classification for every changed path.

## Out Of Scope

- Translating character names, player names, guild names, item names already returned in the requested Blizzard locale, or third-party proper names such as KeystoneSync, Battle.net, Raider.IO, and Wowhead.
- Changing objective logic, Planner solver behavior, Team persistence, addon data capture, D1 schema, Web UI, or the active Mythic+ dungeon pool.
- Remote deployment, release, tag, push, migration, or standalone addon repository changes.
