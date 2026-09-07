# KeystoneClient Characters Design

## Objective

Add a read-only `Characters` view to KeystoneClient that renders each synchronized character's equipment, current talent trees, Omnium Folio, Mythic+ season, Great Vault, Prey Hunts, currencies, and money from snapshots captured by KeystoneSync inside WoW. Preserve the full additive data path through SavedVariables, the Python sidecar, Worker/D1, and owner character responses.

## Approved Design

- `keystone-client/design/characters-client.png` is authoritative whenever the original prompt conflicts with the visual composition. The 1672 × 941 target therefore uses the PNG's top `Gear + Talents` row, middle `Dungeons + Great Vault/Prey` row, and bottom `Currencies` area with compact Gold inside the lower-right composition.
- Navigation order is `Sincronizar | Characters | Equipos | Addon`. Account and realm filters remain fixed above independently scrolling, class-tinted character cards.
- Gear is a compact single row of the 16 specified inventory slots. The Talents summary card opens a large modal containing simultaneous Class, Hero, and Spec trees plus a smaller Omnium tree.
- Dungeon layout is 4 × 2 using the existing Season 2 definitions, local teleport art, Web medal assets, `keystoneColor`, `UpgradeMedal`, and `estimatedDungeonRating` semantics.
- Ten currencies are visible together at the target viewport. Only Hero/Myth Mistcrests are presented; Untainted Mana-Crystals (currency 3356) is added. Cap styling follows weekly, seasonal-total, and owned-total metadata without runtime hardcoded caps.
- Keystone, Poison, and Void use existing theme tokens. WoW class, quality, keystone, rating, completion, and MAX colors remain semantic and theme-independent.
- Real pages consume real sanitized character DTOs. Deterministic preview fixtures exist only for automated and manual visual verification.

## Architecture

- The standalone addon remains authoritative for equipment, gems, enchants, talents, Hero subtrees, import strings, and Omnium. Capture code uses live Blizzard/WoW APIs, preserves complete item links plus safely parsed variant fields, walks every visible trait node/entry/edge, discovers Omnium through trait system 48, and refuses to replace valid snapshots with transient empty reads.
- `sync_worker.py` transports the three new top-level blocks. Worker request validation stores them in additive D1 columns `equipment_json`, `talents_json`, and `omnium_folio_json`; shared character response helpers return them without N+1 reads. Missing columns are introduced by migration `0008` and missing fields from old clients preserve prior data.
- `CharacterService` allowlists and recursively sanitizes bounded JSON-compatible snapshot data while preserving `vault`, `preyHunts`, `currencies`, `money`, `mythicPlusSeason`, `equipment`, `talents`, and `omniumFolio` in memory and disk cache. React performs a second typed validation at the bridge boundary.
- A central typed Wowhead helper builds only `item`, `spell`, or `currency` links from positive integer IDs and serializes allowlisted typed parameters deterministically. One provider configures and loads `https://wow.zamimg.com/js/tooltips.js`, refreshes dynamic links, and leaves local names/icons/fallback tooltips authoritative.
- `CharactersPage` owns filters, selection reconciliation, dashboard composition, and empty states. Focused gear, currency, dungeon, talent-summary, and SVG-backed tree components keep geometry/rendering isolated from page orchestration.
- Web retains its existing one-time loader and receives only matching currency/cap helper semantics needed for the additive contract.

## Compatibility And Failure Handling

- Old SavedVariables, old API rows, and cached snapshots may omit all new blocks; the Client renders explicit empty states without crashing.
- Old Client payloads remain accepted. Omitted new snapshot properties preserve stored values; explicit `null` clears only when accepted by the existing additive snapshot convention.
- Wowhead failure or offline operation never hides local content. An enchant gets an independent Wowhead spell tooltip only when a separately resolved reliable positive `spellId` exists.
- Trait/equipment event bursts are coalesced. Login-time empty trait or Omnium results do not erase valid prior snapshots.
- No CSP change is introduced: current `security.csp = null` is retained rather than adding a broader policy as part of this feature.

## Verification

- Addon unit/static fixtures and package-layout checks, including equipment, traits, Omnium, event coalescing, transient preservation, and currency 3356.
- `cd keystone-worker; npm run typecheck; npm test; npm run d1:migrate:local`
- `cd keystone-web; npm run lint; npm run build`
- `python -m compileall -q keystone-client/sidecar scripts tests`
- `python -m unittest discover -s tests/client`
- `python -m unittest discover -s tests/client_bridge`
- `npm --prefix keystone-client test`
- `npm --prefix keystone-client run build`
- `npm --prefix keystone-client run test:visual`
- `cargo fmt --all --manifest-path keystone-client/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- `cargo test --locked --manifest-path keystone-client/src-tauri/Cargo.toml`
- Attempt `python scripts/build_client_sidecar.py --clean` and `npm --prefix keystone-client run tauri:build -- --bundles nsis` when local prerequisites permit.
- Manual review of the 1672 × 941 Characters and Talents-modal screenshots against the approved PNG, plus best-effort real Tauri Wowhead checks.
- Deployment Impact for both repositories and `git diff --check`; no remote migration, deployment, release, push, or commit.

## Out Of Scope

- Editing equipment, talents, loadouts, or Omnium from KeystoneClient.
- Runtime dependencies on AlterEgo, Raider.IO talent/equipment data, SimulationCraft, the Web bundle, or Wowhead availability.
- KeystoneLoot tooltip refactors unless directly reusable without widening the feature.
- Version bumps, commits, pushes, tags, releases, deployments, or remote D1 migrations.
