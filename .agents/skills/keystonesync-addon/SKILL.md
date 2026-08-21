---
name: keystonesync-addon
description: Work safely on the KeystoneSync World of Warcraft addon, its SavedVariables contract, versioning, packaging and release behavior.
---

# KeystoneSync Addon

## When to use

Load this skill whenever work affects the WoW addon, including:

- `KeystoneSync.lua`
- `KeystoneSync.toc`
- SavedVariables
- WoW events
- weekly reset behavior
- addon versioning
- changelog
- packaging
- addon installation/bundling
- addon GitHub releases

## Source of truth

The canonical manually edited addon source is the external standalone repository:

`Speeson/KeystoneSync`

The weeklyChar repository must not contain embedded KeystoneSync addon runtime files. If addon work is required, work in `Speeson/KeystoneSync`; KeystoneClient consumes addon releases directly from that repository.

Prepared addon-repository workflow handoff files live in:

```text
docs/workflow-handoff/addon/validate-addon.yml
docs/workflow-handoff/addon/release-addon.yml
```

They are not active in `Speeson/KeystoneSync` until copied to that repository.

Standalone addon releases are independently consumable by KeystoneClient's updater. Expected release contract:

- Git tag: `vX.Y.Z`
- Release asset: `KeystoneSync-vX.Y.Z.zip`
- ZIP root: `KeystoneSync/`
- `KeystoneSync.toc` `Version` must match the tag/asset version.

Normal addon-only releases do not require a KeystoneClient release.

## Working rules

1. Inspect current Lua and `.toc` in the canonical addon source before changing behavior.
2. Preserve existing SavedVariables whenever compatible.
3. Treat transient WoW API empty values carefully; do not erase valid weekly state without evidence.
4. Respect weekly-reset semantics.
5. Prefer dynamic WoW APIs over seasonal hardcodes when practical.
6. Do not invent currency, item, quest, map or spell IDs.
7. Load `keystonesync-data-contract` for any tracked-data or SavedVariables contract change.
8. Do not bump version or changelog unless the task is intended to produce a publishable addon change.
9. Do not tag or release without explicit authorization.
10. Keep `.toc` metadata, changelog, package layout, and release asset naming coherent for release preparation.

## Review checklist

When changing addon behavior, review whether the change affects:

- SavedVariables schema
- KeystoneClient parser/payload
- Worker request contract
- D1 persistence
- Web rendering
- fixtures/tests
- KeystoneClient release/updater compatibility
- README/changelog
- WoW patch compatibility

## Versioning

Keep these coherent when preparing a release:

- `.toc` Version
- changelog
- Git tag/release version
- ZIP/package name

The `.toc` Interface value tracks WoW client compatibility and is independent from the addon semantic version.

## Validation

At minimum:

- Lua loads without errors in WoW when manual testing is available.
- Addon files required by `.toc` exist.
- SavedVariables output remains structurally valid.
- Package contains the expected `KeystoneSync/` folder layout.
- Release asset name, tag, ZIP root, and `.toc` Version satisfy the KeystoneClient updater contract.
