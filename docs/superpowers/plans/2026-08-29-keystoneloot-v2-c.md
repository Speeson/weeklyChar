# KeystoneLoot V2-C Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-29-keystoneloot-v2-c-design.md`

1. Add failing tests for the separate Team envelope/status parser, forbidden fields, URL and
   identity helpers, Settings wording/behavior structure, planner contextual details, and the
   general team drawer.
2. Extract the V2-B objective row/list into a presentation-only shared component and prove the
   Owner drawer remains behaviorally unchanged.
3. Implement the Team character drawer with explicit Team endpoint filters, pagination,
   product states, 403 clearing, retry, focus, and stale-request protection.
4. Add exact-character Team entry points in both existing layouts without changing sorting,
   highlights, avatars, or keystone presentation.
5. Add the non-nested planner detail panel/drill-in with contextual requests, pagination,
   focus transitions, and stone/member race invalidation.
6. Apply only the approved Settings label/description and retain its single account-backed
   preference semantics.
7. Update architecture/contract/roadmap/context and write the V2-C final report.
8. Run Web, Worker, browser, lint-baseline, strict impact, diff, and staging-state validation;
   leave every V2-C file uncommitted and unstaged.

## Self-review

The plan keeps authorization server-side, does not require a Worker capability change, does
not conflate Owner and Team status envelopes, avoids nested dialogs, and treats 403 as a
sensitive-data invalidation event. Shared code is limited to DTO parsing and presentation;
endpoint choice remains visible in each container.
