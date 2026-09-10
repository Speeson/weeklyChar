# Keystone Planner V1 Block C Implementation Plan

1. Add strict public request parsing and explicit normalized-data limits.
2. Reuse the objective module for one-pass, exact-variant Planner normalization.
3. Add grouped live-Team participant, character/preference, and current-stone D1 reads.
4. Build privacy-filtered candidates and filtered stones without truncation or N+1 queries.
5. Invoke the unchanged pure solver and project item/capability metadata safely.
6. Mount the authenticated Team endpoint with the documented HTTP status mapping.
7. Add adapter/API coverage for authorization, validation, D1 data, privacy, solver integration,
   enrichment, limits, zero-stone behavior, and determinism.
8. Update durable architecture/data-contract context and write the Block C report.
9. Run Worker, migration-regression, diff, self-review, and deployment-impact validation. Leave
   Block C uncommitted.
