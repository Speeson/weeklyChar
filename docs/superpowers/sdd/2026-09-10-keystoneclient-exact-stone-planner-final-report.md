# KeystoneClient exact-stone Planner final report

## Outcome

KeystoneClient's existing **Planificar piedra** tab now calculates a Top 3 for one explicitly
selected current Team keystone. The level slider only filters visible stone chips. Selecting a chip
fixes its character, keeps the owner among the 2–5 participants and sends the exact character,
dungeon and level through the private Client bridge.

The result area renders three equal full-width previews. Opening one recommendation collapses the
other two and displays Tank/Healer above three DPS cards, followed by loot, preference, damage,
buff and utility summaries. A gold `Crown` leader marker identifies the stone owner in the chip,
participant list, compact preview and expanded character card, with an accessible owner label.

## Contract and trust boundaries

- `POST /api/teams/:teamId/keystone-planner` accepts additive optional `stoneCharacterId`.
- Exact mode requires `challengeMapId` and filters the latest same-week current stone by Team,
  selected participant, character, dungeon and selected level. Stale selections yield zero stones.
- Existing Web calls remain compatible when they omit `stoneCharacterId`.
- Client transport remains React → typed core → Tauri JSONL → Python sidecar → Worker.
- The sidecar owns bearer authentication and allowlists the response; TypeScript independently
  validates and projects it again. React performs no scoring and receives no credentials.
- No D1 schema or migration was added.

## Validation

- Worker typecheck: passed.
- Worker tests: 191 passed.
- Python compileall: passed.
- Client service tests: 106 passed.
- Client bridge tests: 66 passed.
- Frontend unit tests: 257 passed.
- Rust format/check/tests: passed; 25 tests passed with one existing linker warning.
- Sidecar clean build and packaged smoke: passed (`ready`, `ping`, second ping, get state and EOF).
- Focused Planner Playwright review: passed at 1672×941 and 940×529 with no body overflow.
- Full Playwright run: 170 passed and 6 unrelated Void-theme snapshots differed by only 9–49
  pixels. A dedicated rerun reproduced the same pre-existing baseline differences; snapshots were
  not rewritten because this change does not affect those surfaces.
- Pending Client changeset plans `0.10.0` from `0.9.0`; no version was bumped or consumed.
- Strict Deployment Impact: `WORKER=true`, `CLIENT_BUILD=true`, `CLIENT_RELEASE=true`; Web, DB,
  addon and addon release are false, with no unknown or outside paths.

## Remote state

Worker version `2ec220c6-ee31-411f-a110-f3f44b804d0c` was deployed to production and passed the
custom-domain health, authentication-boundary and exact-stone Planner smoke checks. User `Spee`
joined Team QA 5 through the normal `/api/teams/join` product API.

No push, tag, Client release, Web deployment, remote D1 migration or external
repository write was performed.
