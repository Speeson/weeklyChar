# Battle.net Authentication V1 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-08-battlenet-auth-v1-design.md`

1. Add and test migration `0009`, nullable-password compatibility, OAuth
   storage, Battle.net helpers, browser/onboarding/linking endpoints, and
   desktop polling endpoints. Apply migrations locally and keep Worker green.
2. Add and test Web login callback, onboarding, and Settings identity UX. Run
   unit, lint, build, and Playwright validation before continuing.
3. Add and test sidecar desktop flow/polling, JSONL commands, scoped Tauri URL
   opening, React states, translations, and a pending Client changeset.
4. Update durable architecture/configuration documentation, run the complete
   baseline, Deployment Impact, code review, and `git diff --check`. Do not
   commit, push, deploy, release, or apply a remote migration.
