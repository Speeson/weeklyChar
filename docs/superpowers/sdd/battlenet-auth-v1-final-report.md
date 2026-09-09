# Battle.net Authentication V1 — informe final

## Estado

La funcionalidad V1 queda implementada y validada en Worker, Web y KeystoneClient mediante infraestructura staging aislada:

- **`REAL OAUTH VALIDATED`**
- **`REAL EXISTING ACCOUNT LINK: PASS`**
- **`REAL DESKTOP LOGIN: PASS`**

El estado global es **`READY FOR RELEASE`**. Este estado expresa preparación técnica; no se ha realizado ni autorizado el release.

No se ha realizado commit, push, deploy de producción, release ni migración D1 de producción. Para la validación real se utilizaron únicamente el Worker `keystone-sync-api-staging` y la D1 aislada `keystone-sync-staging`, sin datos copiados de producción.

El trabajo partió de un `main` local ya sucio. Se preservaron sin editar los artefactos previos ajenos al alcance (`keystone-client/src-tauri/Cargo.toml`, `.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`, `docs/keystonesync-selector-piedra-plan.md` y `keystone-client/tauri-current-characters.png`). `Cargo.toml` continúa apareciendo modificado por una diferencia previa de finales de línea, sin diff textual.

El saneamiento posterior del baseline Web dejó `npm run lint` en PASS, con 0 errores y 0 warnings. Todas las suites automatizadas relevantes terminan correctamente.

## Arquitectura y seguridad

- `users.id` sigue siendo la identidad interna y el login username/password permanece operativo.
- `user_identities` relaciona un usuario con el proveedor `battlenet`; `provider_subject` contiene `userinfo.sub` y tiene unicidad por proveedor. BattleTag se guarda y expone solo como nombre visible actualizable.
- `oauth_flows` conserva transacciones efímeras con intent cerrado, hashes de state/tickets/secreto de polling, PKCE verifier temporal, expiración y estados single-use.
- El Worker ejecuta Authorization Code con `state` CSPRNG, PKCE S256, intercambio confidencial y `userinfo`. Solicita exactamente `openid`; no solicita `wow.profile`.
- `BLIZZARD_CLIENT_SECRET` solo existe como binding del Worker. Web, React, Tauri y sidecar no lo reciben.
- Los access/refresh tokens Battle.net no se persisten ni se devuelven. El access token se usa en memoria para una llamada `userinfo` con `Authorization: Bearer` y se descarta. No se solicita ni almacena refresh token.
- Los JWT KeystoneSync se entregan solo mediante respuestas POST de canje, nunca en URLs.
- No existe auto-link por BattleTag, username, email o personajes. El onboarding exige crear un username explícito o autenticar una cuenta existente con password.
- Las respuestas sensibles usan `Cache-Control: no-store`; callbacks y páginas OAuth usan `Referrer-Policy: no-referrer`; redirects y aperturas nativas validan destinos exactos.
- Token y userinfo tienen timeout, tamaño máximo y validación estructural. Hay rate limiting por acción.

## Esquema y migración

`keystone-worker/migrations/0009_battlenet_auth.sql` reconstruye `users` para permitir `password_hash NULL`, conservando IDs, columnas, constraints e índices, incluido username case-insensitive. Crea:

- `user_identities`: dos restricciones UNIQUE impiden compartir una Battle.net entre usuarios o vincular dos Battle.net al mismo usuario; FK `ON DELETE CASCADE`.
- `oauth_flows`: intents `login_web`, `login_desktop`, `link_account`; estados `pending`, `needs_onboarding`, `ready`, `consumed`, `failed`; índices de expiración y polling.

El test de migración demuestra preservación de usuarios, characters, teams, memberships, IDs, login tradicional, creación Battle.net-only, constraints y cascade.

## Endpoints

- `POST /api/auth/battlenet/start`
- `GET /api/auth/battlenet/callback`
- `POST /api/auth/battlenet/exchange`
- `POST /api/auth/battlenet/onboarding/status`
- `POST /api/auth/battlenet/onboarding/register`
- `POST /api/auth/battlenet/onboarding/link`
- `POST /api/auth/battlenet/desktop/start`
- `POST /api/auth/battlenet/desktop/exchange`
- `GET /api/me/identities`
- `POST /api/me/identities/battlenet/start`
- `DELETE /api/me/identities/battlenet`

## Flujos de producto

Web inicia OAuth desde el login o desde Ajustes. Una identidad conocida recibe un ticket web de 60 segundos y lo canjea por POST; una identidad nueva pasa por onboarding explícito. Ajustes muestra BattleTag y permite link/unlink, impidiendo dejar sin método de acceso a usuarios Battle.net-only.

KeystoneClient pide al Worker un flow desktop, abre exclusivamente `https://oauth.battle.net/authorize` en el navegador del sistema y sondea con `flowId` y secreto aleatorio mantenido solo en memoria del sidecar. El callback sigue en el Worker/Web; una cuenta nueva completa onboarding en el navegador. Al quedar ready, el sidecar recibe un JWT KeystoneSync single-use, valida `/api/me` y persiste exclusivamente la sesión KeystoneSync existente.

La validación real detectó y corrigió dos defectos del cliente antes del release: la allowlist del host Rust no incluía los tres comandos Battle.net del sidecar y el efecto de detección inicial de WoW podía quedar bloqueado por el replay de React Strict Mode. Ambos cambios son mínimos, cuentan con pruebas de regresión y no modifican la arquitectura OAuth.

## Archivos

- Diseño/contexto: `docs/ARCHITECTURE.md`, `docs/AGENT_CONTEXT.md`, `docs/superpowers/specs/2026-09-08-battlenet-auth-v1-design.md`, `docs/superpowers/plans/2026-09-08-battlenet-auth-v1.md` y este informe.
- Worker: `.dev.vars.example`, `README.md`, migración `0009`, `src/routes/battlenetAuth.ts`, y ajustes en `src/{index,types,crypto,http,rateLimit}.ts`.
- Tests Worker/DB: `tests/battlenetAuth.test.js`, `tests/test_battlenet_auth_migration.py`.
- Web: `app/components/BattleNetButton.tsx`/`BattleNetIcon.tsx`, login/settings, `app/login/battlenet/{layout,callback/page,onboarding/page}.tsx`, `lib/battlenet.ts`, tests unitarios y `playwright/battlenet-auth.spec.ts`.
- Cliente: sidecar `auth_service.py`/`bridge_main.py`, Tauri `bridge.rs`/`lib.rs`/`window.rs`, core auth/native/types/i18n, nuevo `battleNetAuth.ts`, `BattleNetIcon`, `LoginPage`, `OnboardingPage`, CSS y sus tests.
- Cliente visual/release: snapshots actualizados para Battle.net y el ajuste final de alineación ES/EN del footer, y `.changes/pending/battlenet-auth-v1.json` (minor, plan `0.9.0`).
- Bridge: tres suites bajo `tests/client_bridge/`.

## Validación ejecutada

- Worker: `npm test` — 128/128; `npm run typecheck` — PASS.
- Migración: `python -m unittest tests/test_battlenet_auth_migration.py` — 2/2; `npm run d1:migrate:local` — PASS, sin migraciones pendientes en D1 local.
- Web: `npm test` — 66/66; `npm run build` — PASS; `npm run test:visual` — 11/11.
- Web lint: `npm run lint` — PASS, 0 errores y 0 warnings tras el saneamiento mecánico del baseline preexistente.
- Cliente Python: compileall — PASS; `tests/client` — 104/104; `tests/client_bridge` — 66/66.
- Cliente frontend: `npm ci` — PASS, 0 vulnerabilidades; `npm test` — 42 archivos, 252/252; `npm run build` — PASS; `npm run test:visual` — 175/175.
- Tauri: fmt check — PASS; cargo check — PASS; cargo test — 25/25 (warning informativo del linker de Windows).
- Packaging: sidecar PyInstaller limpio y smoke `ready/ping/get_state/second_ping/eof` — PASS; instalador NSIS del baseline previo al release — PASS.
- Baseline adicional: `tests/release` — 51/51; `tests/deploy_impact` — 47/47.
- Release plan: client minor `0.8.1 -> 0.9.0`, tag futuro `client-v0.9.0`; no se ha preparado ni publicado.

### Validación OAuth real en staging

Entorno utilizado:

- Worker: `https://keystone-sync-api-staging.estebangperez77.workers.dev`.
- D1: `keystone-sync-staging`, sin copia de datos de producción.
- Migraciones remotas staging `0001` a `0009`: PASS.
- Web local: configurada exclusivamente contra el Worker staging.
- Redirect URI registrado en Battle.net Developer Portal: `https://keystone-sync-api-staging.estebangperez77.workers.dev/api/auth/battlenet/callback`.
- Producción no fue utilizada ni modificada.

Resultados confirmados manualmente:

- Authorization Code real: PASS.
- PKCE S256 real: PASS.
- Callback HTTPS real del Worker: PASS.
- Consulta real a `/userinfo`: PASS.
- Scope solicitado: únicamente `openid`; no se solicitó `wow.profile`.
- Battle.net desconocida produjo `needs_onboarding`: PASS.
- Creación explícita de una cuenta KeystoneSync Battle.net-only: PASS.
- `password_hash IS NULL`: confirmado en D1 staging.
- `user_identities` se creó correctamente.
- Logout y posterior login con la misma Battle.net: PASS.
- El segundo login resolvió al mismo `users.id`; no creó otro usuario ni otra identidad.
- Settings mostró correctamente BattleTag y estado de vinculación.
- El intento de desvincular Battle.net siendo el único método de acceso fue rechazado correctamente.
- No se observaron access tokens ni refresh tokens Battle.net persistidos.

### Validación real de vinculación a cuenta existente

- Cuenta tradicional staging `bnet-link-staging`, con password y sync token previos: vinculada correctamente.
- `users.id` permaneció exactamente en `3` y `user_identities.user_id` quedó en `3`.
- `password_hash` y `sync_token` conservaron exactamente sus valores anteriores, verificados mediante fingerprints sin exponerlos.
- Logout y posterior `Continuar con Battle.net`: PASS; resolvió directamente a la misma cuenta tradicional.
- Usuarios staging: `1`; identities Battle.net: `1`; no se creó onboarding, usuario ni identity adicional.
- **`REAL EXISTING ACCOUNT LINK: PASS`**.

### Validación real de KeystoneClient desktop

- Inicio en KeystoneClient, apertura del navegador del sistema, callback, polling y exchange: PASS.
- La sesión resultante se mostró como `bnet-link-staging` y el JWT KeystoneSync validado por el sidecar resolvió a `users.id = 3`.
- D1 staging confirmó un único flow `login_desktop`, estado `consumed`, `completed_at` presente, `state_hash` y `pkce_verifier` eliminados, poll secret almacenado únicamente como hash y sin handoff secret.
- D1 staging confirmó un usuario, una identity Battle.net asociada al usuario `3` y cero flows `needs_onboarding`.
- El APPDATA aislado de KeystoneClient contenía únicamente `config.json` con la sesión KeystoneSync existente. No contenía access token, refresh token, authorization code, state, PKCE verifier ni poll secret de Battle.net.
- Los tokens KeystoneSync reales no se imprimieron ni incorporaron al informe.
- El navegador heredó el APPDATA aislado del arnés de prueba y creó allí un perfil nuevo de Opera, lo que explica la ventana sin personalización y la nueva autenticación Battle.net. Es un efecto exclusivo del aislamiento de la prueba, no del flujo normal del producto.
- **`REAL DESKTOP LOGIN: PASS`**.

## Configuración manual pendiente

- Para producción, configurar los bindings/secrets correspondientes, registrar su callback exacto y aplicar `0009_battlenet_auth.sql` antes del futuro deploy. Ninguna de estas operaciones de producción se realizó durante la validación staging.

## Impacto de despliegue

- Worker: requiere migración D1 remota y deploy del Worker, en ese orden.
- Web: requiere deploy Web.
- Cliente: requiere build y release minor `0.9.0`.
- Addon: sin impacto.

## Riesgos y limitaciones

- PKCE S256, Authorization Code, callback, `/userinfo`, vinculación a cuenta tradicional y flujo desktop han sido probados satisfactoriamente contra Battle.net real.
- El perfil nuevo de Opera observado durante la prueba se debió a que el arnés aisló `APPDATA` para proteger el perfil real; una ejecución normal hereda el perfil habitual del navegador predeterminado.
- Se conserva deliberadamente el JWT Web actual en localStorage; no se migró a cookies HttpOnly.
- V1 no implementa `wow.profile`, importación de personajes, email Battle.net ni establecimiento de password para cuentas Battle.net-only.
