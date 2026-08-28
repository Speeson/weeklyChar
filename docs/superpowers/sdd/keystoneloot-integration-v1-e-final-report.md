# KeystoneLoot Integration V1-E Final Report

## Verdict

`V1 RELEASE READINESS: GO`

V1-E found no KeystoneLoot runtime defect and made no runtime change. V1-D was committed
locally as `13e6cc5e1015438df3207d134f4d7e5b6802ce1c`; this report closes the V1 release-readiness
documentation.

## Complete system validation

The read-only real SavedVariables file contained seven characters, four with supported
KeystoneLoot API v2 snapshots. All four passed semantic equality across:

```text
SavedVariables -> KeystoneClient payload -> local D1 -> owner /api/me/characters
```

Representative live snapshot:

```text
Bakuhatsu - Zul'jin
state=supported, installed=true, supported=true, apiVersion=2
addonVersion=2.13.1, characterKey=Zul'jin-Bakuhatsu-2
updatedAt=1787949416, favorites=24
representative favorite: sourceId=250, sourceType=dungeon, specId=66,
itemId=158373, tier=3, slotId=10, icon=1881362
voidcore.checked=true, voidcore.usedItems count=5
```

A real historical character without the block produced no payload property and preserved
a pre-seeded server snapshot. The empty-wishlist fixture emitted `favorites=[]`, replaced
an older non-empty snapshot, and returned `[]` from the owner API.

The disposable local D1 applied `0001_initial`, `0002_keystone_loot`, and
`0003_keystone_loot_sharing` in order. Real-local privacy validation proved default true,
false opt-out, unchanged owner access, minimal `sharing_disabled`, raw team-data omission,
and resumed recommendations after re-enabling.

The recommendation integration produced all four statuses. A dungeon target at map 399
ranked the exact `Plannerone-Local` character/spec, excluded a same-ID raid source through
the `sourceType=dungeon` namespace guard, and reported one aggregate Voidcore exclusion.
Unauthenticated and non-member requests returned 401 and 403 respectively.

Actual production-built Web connected to the actual local Worker/D1. Settings persisted
false and true through reloads; `Restaurar valores` sent no privacy PATCH and localStorage
contained no duplicate privacy value. The planner selected real seeded keystones, rendered
all statuses, highlighted only the exact character ID, and rejected a delayed map-399
response fetched from the Worker after the user switched back to map 588. No raw item or
wishlist fields appeared in team responses or UI.

## Regression and packaging evidence

- Addon: 31 runtime, 10 deployment-impact, and 30 release/package tests passed; TOC and
  disposable `KeystoneSync-v0.2.2.zip` validation passed.
- Client Python: 82 tests passed; Client bridge: 57 passed; compileall passed.
- Client frontend: 140 tests passed; production build passed.
- Client Rust: format/check passed; 22 tests passed.
- Sidecar: clean PyInstaller build and protocol smoke passed.
- NSIS: `KeystoneClient_0.6.2_x64-setup.exe` built locally.
- Worker: typecheck passed; 47 tests passed.
- Web: 22 tests passed; production build and TypeScript passed.
- Repository: 45 deployment-impact and 28 release tests passed.

Repository-wide Web lint remains at the pre-existing 13-error/25-warning baseline. Client
visual tests report 124 passes and 20 tiny snapshot diffs; the unmodified main worktree
reproduces the same 20 failures, so they are pre-existing baseline drift rather than V1.

## Compatibility and deployment

The pre-V1 Worker at `origin/main` was executed locally with only migration `0001`; it
accepted a new Client payload containing `keystoneLoot`, ignored the additive field, and
returned its old response shape. The new Worker accepts both old payloads and new payloads
that omit the field, preserving existing snapshots.

Safe production order:

1. release addon;
2. release Client;
3. apply migration `0002`;
4. apply migration `0003`;
5. deploy Worker;
6. deploy Web.

Complete weeklyChar impact is Web, Worker, DB, Client build, and Client release. The
standalone addon separately requires addon build/release. Pending metadata consists of
one Spanish addon patch changeset and one Spanish Client patch changeset; no duplicate
changeset or version bump exists.

## Security and remaining scope

Membership authorization, server-side preference enforcement, owner/team read separation,
malformed/oversized snapshot validation, malformed recommendation parsing, historical
preservation, and stale planner responses are covered and passed. No cross-user raw data
leak was found.

V2 remains mandatory and unimplemented: item icon, item name, tier, dungeon/source, spec,
Voidcore state, `Ver objetivos`, per-character wishlist view/drawer, and dungeon/spec
filtering. V2 requires a deliberate privacy-aware API contract and must not reuse the
owner endpoint to expose team wishlists.
