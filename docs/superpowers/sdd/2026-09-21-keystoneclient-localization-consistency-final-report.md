# KeystoneClient localization consistency — final report

Date: 2026-09-21

## Outcome

Implemented consistent Spanish (Europe) and English presentation across KeystoneClient. World of Warcraft classes, specializations, hero talent trees and Season 2 dungeons now resolve through shared locale-aware catalogs instead of displaying whichever language arrived in a snapshot or API payload.

The Teams objective cards now show the class before the localized specialization list. Talent summaries and the expanded talent modal use the same localized class, specialization and hero-tree identity. Planner labels, roles, tiers, upgrade tracks, errors, release notes and accessibility text follow the selected client language.

## Data flow

- The client sends `es_ES` or `en_US` with Planner requests.
- The Python bridge validates the optional locale and keeps `es_ES` as the compatibility default.
- The Worker allowlists the locale and requests locale-isolated Blizzard metadata.
- No persistent schema, D1 migration or addon contract change is required.

## Compatibility and release notes

- Unknown future specialization IDs preserve the snapshot-provided name rather than becoming blank.
- User-facing errors no longer expose untranslated backend exception prose.
- Release-note generation accepts separate Spanish and English content and the client selects the matching language section.
- Added the pending Client changeset `client-localization-consistency`.

## Validation

- Client unit/component tests: 55 files, 374 tests passed.
- Client production build: passed.
- Client visual tests: 185 tests passed; expected snapshots regenerated for translated copy.
- Python compilation: passed.
- Client Python tests: 120 passed.
- Client bridge tests: 68 passed.
- Release tooling tests: 52 passed.
- Worker typecheck: passed.
- Worker tests: 249 passed.
- Client Rust formatting, check and tests: passed (33 tests).
- `git diff --check`: passed (line-ending notices only).
- Deployment Impact strict classification: Client build and release required; Worker deployment required; no Web, D1 or addon release impact.

## Rollout note

Deploy the Worker before publishing the Client so English Planner metadata is localized by the locale-aware endpoint from the first released Client request. No remote deployment or release was performed as part of this implementation.
