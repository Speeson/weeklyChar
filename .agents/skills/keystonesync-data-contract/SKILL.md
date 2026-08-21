---
name: keystonesync-data-contract
description: Protect the end-to-end KeystoneSync data contract across addon SavedVariables, Windows client, Worker, D1 and Web.
---

# KeystoneSync Data Contract

## When to use

Load this skill whenever a change:

- adds/removes/renames tracked data;
- changes `KeystoneSyncDB`;
- changes client payload shape;
- changes Worker request/response shape;
- changes D1 persistence;
- changes Web data interfaces;
- changes reset/staleness semantics.

Use `docs/DATA_CONTRACT.md` as the current source of truth for existing fields, local-only metadata, Worker/D1 behavior, and Web consumers.

## Pipeline

Always reason through the full pipeline:

```text
Addon
 ↓
KeystoneSyncDB
 ↓
Client parser
 ↓
Client payload
 ↓
Worker
 ↓
D1
 ↓
Worker read response
 ↓
Web
```

A feature is not complete merely because the addon captures it.

## Contract checklist

For every changed field answer:

1. Where is the source value obtained?
2. What is its SavedVariables key/type?
3. Can old SavedVariables omit it safely?
4. Does the Python parser preserve it?
5. Does the outbound payload include it?
6. Does Worker validation/parsing accept it?
7. Where is it persisted?
8. Is it inside an existing JSON column or does schema change?
9. Does D1 require a migration?
10. Does the read API return it?
11. Does Web type/render it?
12. What should happen when it is missing/stale/zero?
13. What reset/staleness semantics apply?
14. Which fixture/test protects the behavior?
15. Which documentation must change?

## D1 decision rule

Prefer existing JSON blocks for naturally nested/evolving data when that matches the established architecture.

Do not add a D1 column merely because a new nested key exists.

A migration is appropriate when storage/query semantics genuinely require schema change.

Do not generalize this into "JSON fields never need migrations." A new top-level block, queryable field, uniqueness rule, or compatibility requirement may still need a schema/contract decision.

## Known current local-only metadata

`docs/DATA_CONTRACT.md` currently documents these addon-written fields as not transported by the client payload:

- `keystoneWeeklyResetKey`
- `mythicPlusSeasonUpdatedAt`

Do not assume they are available in Worker/D1/Web until the contract is changed deliberately.

## Compatibility

Prefer additive changes.

Do not break existing clients unnecessarily.

When removing or renaming a field:

- inspect currently deployed client behavior;
- define backward-compatibility window if needed;
- test old/partial payloads.

## Documentation

Update `docs/DATA_CONTRACT.md` when the durable contract changes.

Update `docs/AGENT_CONTEXT.md` only if the change represents persistent architectural/project state.
