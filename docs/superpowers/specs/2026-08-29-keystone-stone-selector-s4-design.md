# Stone Selector S4 — Client Teams bridge design

## Scope

S4 adds a data-only path from the React core wrapper through the existing Tauri/Rust allowlist and persistent Python JSONL sidecar to the authenticated Worker. It adds no Teams navigation or production UI.

## Commands and endpoints

| Core command | Worker endpoint | React-safe result |
| --- | --- | --- |
| `teams.list` | `GET /api/teams` | compact Team summaries |
| `teams.get` | `GET /api/teams/:teamId` | Team members and compact character dashboard data |
| `teams.keystone_selector` | `GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary` | aggregate Selector DTO |

The protocol remains version 1 because capability discovery and the command allowlists treat additive commands as compatible.

## Trust and authentication boundary

React sends only positive safe-integer identifiers. Rust forwards only allowlisted commands and object payloads. Python loads the private access token, applies the Bearer header, performs the HTTP request, and projects the response into an allowlist. Tokens, raw Worker rows, error bodies, invite codes, account identifiers, vault data, raw KeystoneLoot snapshots, and item internals never cross into React.

Python validates and sanitizes the Worker response before returning it. TypeScript validates the safe DTO again before a React caller can consume it. Both layers reject malformed required fields, bound collection and string sizes, accept only HTTPS nullable URLs and known Voidcore states, ignore additive fields, and preserve unknown positive objective tiers.

The existing Team detail response has no member-profile avatar. `ClientTeamMember` therefore contains `userId`, `username`, and `characters`; S4 does not invent a value or change the Worker. Character avatars remain available.

## Errors

Python maps HTTP and transport failures to stable `CoreError` payloads: invalid request, expired session, lost Team access, missing Team, throttling, unavailable API, and invalid Team/Selector response. A Worker 401 produces `SESSION_EXPIRED` without retrying or changing the existing authentication state machine. Raw response bodies and credentials are never used as user-facing messages.

## S5 handoff

S5 may build its Team switcher, dungeon selector, character cards, item grid, and tooltip UI exclusively from these safe DTOs. The current preview system supplies startup `SystemState` rather than intercepting domain commands, so S4 does not add an alternate preview transport. Safe fixtures can be introduced with the S5 UI harness where they have an actual consumer.
