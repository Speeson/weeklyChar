# KeystoneClient exact-stone Planner design

## Objective

Enable the existing disabled **Planificar piedra** tab in KeystoneClient so the user selects one
specific current Team keystone and receives the three most profitable compositions for that exact
stone. The Planner must never compare or substitute other stones after selection.

## Approved design

- Keep the existing dungeon rail and Objectives/Plan Stone tabs.
- Keep a 300 px configuration column. Its level slider is **Nivel mínimo de piedra** and filters
  visible stone chips locally; it does not affect solver ranking.
- Each chip shows level and owner character. Selecting it fixes that exact owner character, ensures
  its user is selected, invalidates the previous result and enables explicit **Calcular Top 5**.
- Show five equal full-width horizontal recommendation previews filling the remaining area. Each
  preview shows role icon, avatar, character, class, played specialization and loot-tier summary.
- The recommendations form an exclusive accordion. The expanded result lays Tank and Healer on the
  upper row and the three DPS cards on the lower row as a trapezoid, followed by loot, buffs,
  utilities, damage profile and ranking summaries.
- Mark the selected stone owner in preview and detail with a gold `Crown` leader icon matching the
  familiar World of Warcraft group-leader metaphor. The icon has an accessible owner label.
- Keep advanced composition options and locks in the configuration column. Loading, no-stone,
  unconfigured, invalid-lock and no-composition states remain explicit and recoverable.

## Architecture and contract

- Extend `POST /api/teams/:teamId/keystone-planner` additively with optional
  `stoneCharacterId: number | null`.
- When present, require a non-null `challengeMapId`, filter to the latest same-week current stone of
  that exact character and selected Team participant, and let the existing solver force the owner
  character. A stale or unavailable selection yields zero eligible stones without leaking data.
- KeystoneClient sends the selected stone's actual level as the required legacy `targetLevel`; for
  one fixed stone, level distance is identical across compositions and cannot affect their order.
- Add no D1 column or migration. Old Web/clients remain compatible by omitting the optional field.
- Preserve the Client path React → typed core request → Tauri JSONL bridge → Python sidecar → Worker.
  React never receives or manages the access token.

## Verification

- Worker: `cd keystone-worker; npm run typecheck; npm test`.
- Client sidecar/bridge: `python -m compileall -q keystone-client/sidecar scripts tests; python -m
  unittest discover -s tests/client; python -m unittest discover -s tests/client_bridge`.
- Client UI: `npm --prefix keystone-client test; npm --prefix keystone-client run build; npm
  --prefix keystone-client run test:visual`.
- Review the 1672×941 reference layout and 940×529 minimum window without horizontal overflow.
- Run `python scripts/deploy_impact.py --files <changed-paths>` after verified changes.

## Out of scope

- Web UI changes, Web deployment, Worker deployment, remote migrations or D1 writes.
- Changes to tier weights, solver ranking, specialization/capability catalogs or privacy rules.
- Automatic selection of the “best” stone, automatic recalculation on chip click, and Client-side
  scoring.
