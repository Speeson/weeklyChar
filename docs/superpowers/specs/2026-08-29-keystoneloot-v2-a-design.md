# KeystoneLoot V2-A Design

## Objective

Add authenticated owner and same-team KeystoneLoot objective presentation APIs without exposing raw snapshots or changing V1 recommendation scoring. Enrich only the displayed page with Blizzard item names and icons through a bounded D1-backed cache.

## Approved architecture

`shareKeystoneLootWithTeams` remains the single team-sharing control. Owner access ignores it. Team access requires a fresh JWT, current requester membership in the requested team, a target character owned by another current member of that same team, and the target owner's enabled sharing preference. Membership is queried on every request and no authorization result is cached.

Both endpoints parse the stored snapshot defensively, filter and deduplicate its favorites, sort them deterministically, paginate with a validated opaque cursor tied to the active filters, and map each record to an explicit objective DTO. The DTO contains only item display identity, tier/spec/source/slot, metadata, and a derived Voidcore state.

Migration `0004_keystone_loot_item_metadata.sql` adds a `(region, locale, item_id)` metadata cache only. Worker-side Blizzard OAuth uses client credentials, strict region/host allowlists, `static-{region}`, and locale `es_ES`. Positive metadata lasts 30 days, confirmed not-found entries last 6 hours, stale positive data remains usable, and upstream failures degrade to null metadata.

## Verification

- Worker typecheck and full test suite.
- Route tests for owner isolation, live same-team authorization, cross-team isolation, opt-out privacy, DTO allowlisting, filters, pagination, statuses, and membership removal.
- Metadata tests for cache hit/miss/stale behavior, OAuth, upstream failures and validation, and page-bounded lookup with 2,000 favorites.
- Local D1 migrations `0001` through `0004`, strict deployment-impact classification, and `git diff --check`.

## Out of scope

Web UI, Settings wording implementation, addon/client changes, recommendation changes, production secrets, remote migration, deployment, release, V2-B, commits, and pushes.
