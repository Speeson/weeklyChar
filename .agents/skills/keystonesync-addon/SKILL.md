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

The weeklyChar repository keeps generated client packaging content at:

`keystone-client/addon/KeystoneSync/`

Do not edit `keystone-client/addon/KeystoneSync/` directly. If addon work is required, work in `Speeson/KeystoneSync` or use/request a valid canonical source checkout and refresh the client bundle with:

```text
python scripts/sync_addon.py --source <path-to-Speeson-KeystoneSync>
python scripts/check_addon_sync.py --source <path-to-Speeson-KeystoneSync>
```

Prepared addon-repository workflow handoff files live in:

```text
docs/workflow-handoff/addon/validate-addon.yml
docs/workflow-handoff/addon/release-addon.yml
```

They are not active in `Speeson/KeystoneSync` until copied to that repository.

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
10. Keep `.toc` metadata, changelog, package layout, and bundled-copy synchronization coherent for release preparation.

## Review checklist

When changing addon behavior, review whether the change affects:

- SavedVariables schema
- KeystoneClient parser/payload
- Worker request contract
- D1 persistence
- Web rendering
- fixtures/tests
- addon bundled in KeystoneClient
- sync/check tooling
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

- Run `python scripts/validate_addon.py` for local generated-bundle structure.
- Run `python scripts/check_addon_sync.py --source <path-to-Speeson-KeystoneSync>` when a canonical source checkout is available and bundle freshness matters.
- Lua loads without errors in WoW when manual testing is available.
- Addon files required by `.toc` exist.
- SavedVariables output remains structurally valid.
- Package contains the expected `KeystoneSync/` folder layout.
- Bundled client copy is synchronized when packaging or release work depends on it.
