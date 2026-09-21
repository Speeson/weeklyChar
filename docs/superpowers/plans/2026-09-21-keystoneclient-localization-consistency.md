# KeystoneClient Localization Consistency Implementation Plan

## Task 1: Establish the official WoW display catalog

- Record the verified `es_ES` and `en_US` class, specialization, hero-tree, and current dungeon names against stable identifiers and compatibility aliases.
- Add locale-aware resolvers and exhaustive catalog tests.
- Replace partial talent-display dictionaries without changing snapshot transport data.

## Task 2: Correct Characters and talent surfaces

- Localize class and specialization names on active and inactive character cards.
- Localize talent preview and dialog class, specialization, hero-tree, fallback, action, and accessibility copy.
- Localize character empty, equipment, enchantment, rating, and sync-keystone copy.
- Add Spanish and English regression coverage.

## Task 3: Correct Teams, Objectives, and Planner surfaces

- Localize every dungeon rail label and accessible name.
- Render localized class before localized specializations on Objectives cards and localize filters, tiers, roles, utility, and status copy.
- Localize Planner preference class/spec labels and accessible controls.
- Add Spanish and English component coverage for the corrected flows.

## Task 4: Forward Planner locale end to end

- Add the selected locale to the Client Planner request and sidecar bridge.
- Validate and forward the locale through the Worker Planner route to Blizzard item metadata enrichment.
- Preserve `es_ES` as the compatibility default and avoid persistence/schema changes.
- Update the data-contract documentation and focused Client/Worker tests.

## Task 5: Make status, errors, and release notes language-safe

- Resolve known structured error/status codes through Client i18n and replace raw mixed-language fallbacks with localized generic messages.
- Extend the changeset and release generation contract with optional English copy while keeping legacy entries valid.
- Render the matching localized release notes and add generator/UI tests.

## Task 6: Validate and review the complete change

- Add a pending Client changeset describing the user-visible correction in Spanish and English.
- Run focused tests throughout implementation, then the relevant Client frontend, Python, bridge, Rust, and Worker validation suites.
- Review the final diff for localization completeness, contract compatibility, accessibility, and unrelated changes.
- Run strict Deployment Impact classification and write the SDD final report.
- Report required Client release and Worker deployment actions without performing remote operations.
