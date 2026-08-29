# KeystoneLoot V2-B Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-29-keystoneloot-v2-b-design.md`

1. Add failing tests for the response parser, statuses, labels/fallbacks, freshness, request URLs, pagination, request identity races, and required dialog/responsive/accessibility structure.
2. Add centralized dungeon/spec presentation helpers without duplicating seasonal or specialization names.
3. Implement the owner drawer and exact-character entry point with server filters, cursor pagination, retry, AbortController, and focus restoration.
4. Update the V2 roadmap/context and add the V2-B final SDD report.
5. Run Web, Worker, lint-baseline, responsive/accessibility, impact, diff, and status validation; leave V2-B unstaged and uncommitted.
