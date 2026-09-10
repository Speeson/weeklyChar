# Keystone Planner V1 Block B Implementation Plan

1. Define normalized solver input/output, diagnostic, lock, assignment, loot, vacancy, and
   composition DTOs in `keystone-worker/src/keystonePlanner.ts`.
2. Validate participants, target level, candidate identities, and mutually intersecting locks.
3. Normalize candidates through the central specialization/capability catalog.
4. Search each eligible stone with holder-aware, role-capacity-aware backtracking and pruning.
5. Calculate variant-aware pending loot, preferences, level distance, unique capabilities, damage
   profile, utility metrics, vacancies, reason codes, and stable fingerprints.
6. Rank through one hierarchical comparator, deduplicate, and return the top three.
7. Add focused solver tests for hard constraints, ranking hierarchy, loot identity, capabilities,
   incomplete groups, locks, diagnostics, Top 3, and deterministic ordering.
8. Update durable documentation only for the new pure-domain behavior.
9. Run Worker typecheck/tests, migration regression coverage, diff checks, self-review, and the
   strict deployment-impact classifier. Leave Block B uncommitted.
