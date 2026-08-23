# KeystoneClient Block 1 Real Synchronization Plan

1. Add focused Python tests for character sanitization, cache/refresh behavior and score-zero preservation, then implement `CharacterService`.
2. Add lifecycle tests for automatic start, restart after WoW changes, no duplicate worker and character refresh after successful sync; extend `SyncService` and bridge orchestration.
3. Preserve matching account selections in `wow_service.select_install` and add asynchronous one-per-path Addon checks.
4. Extend Python and Rust command allowlists with character commands and add a scoped native Raider.IO opener with URL-encoding tests.
5. Add typed React character state, display utilities and tests for gradients, missing values, class colors, sorting and native row actions.
6. Replace production account placeholders in `SyncPage` with real character rows while keeping deterministic previews and the approved composition.
7. Run Python, React, Rust and visual validation after each logical batch; inspect intentional screenshot differences.
8. Update durable architecture/context/migration documentation, add the pending Spanish client changeset entry and run final Deployment Impact.
