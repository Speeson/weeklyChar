# KeystoneLoot V2-A Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-29-keystoneloot-v2-a-design.md`

## Tasks

1. Add failing pure-contract and route tests for snapshot states, DTO allowlisting, Voidcore, deduplication, filtering, pagination, owner isolation, same-team authorization, cross-team isolation, opt-out behavior, and removal.
2. Add failing metadata tests for D1 cache states, OAuth and Blizzard item/media responses, failures, host/size/identity validation, bounded concurrency, and the 2,000-favorite page limit.
3. Add migration `0004`, objective projection/pagination, Blizzard enrichment/cache, and owner/team routes while preserving the existing recommendation engine.
4. Update architecture, data-contract, roadmap, durable context, and the V2-A final SDD report.
5. Run complete Worker/migration/impact/diff validation, review the full diff, correct findings, and leave all changes uncommitted and unstaged.
