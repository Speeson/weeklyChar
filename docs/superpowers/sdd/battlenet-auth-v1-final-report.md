# Battle.net Authentication V1 — informe final

## Estado

La funcionalidad V1 queda implementada, validada y desplegada en Worker, Web y KeystoneClient:

- **`REAL OAUTH VALIDATED`**
- **`REAL EXISTING ACCOUNT LINK: PASS`**
- **`REAL DESKTOP LOGIN: PASS`**
- **`PRODUCTION ROLLOUT: PASS`**
- **`RELEASED: client-v0.9.0`**

El estado global es **`RELEASED`**. Los cambios se integraron en `main` mediante los PR [#7](https://github.com/Speeson/weeklyChar/pull/7) y [#8](https://github.com/Speeson/weeklyChar/pull/8); la migración D1 de producción, el deploy del Worker y sus smoke tests terminaron correctamente, y KeystoneClient `0.9.0` está publicado.

La validación OAuth end-to-end con Battle.net real se realizó primero mediante el Worker `keystone-sync-api-staging` y la D1 aislada `keystone-sync-staging`, sin datos copiados de producción. El rollout posterior utilizó la configuración de producción ya registrada y no copió datos entre entornos.

El trabajo partió de un `main` local ya sucio. Se preservaron sin editar los artefactos previos ajenos al alcance (`.playwright-mcp/`, `docs/CHARACTER-CLIENT.md`, `docs/design/`, `docs/keystonesync-selector-piedra-plan.md` y `keystone-client/tauri-current-characters.png`). La actualización versionada de `keystone-client/src-tauri/Cargo.toml` a `0.9.0` fue realizada por el workflow oficial de release.

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

Para compatibilidad con las transacciones implícitas de D1, la reconstrucción usa `PRAGMA defer_foreign_keys = ON` y respalda/restaura temporalmente las filas de las tablas afectadas por `ON DELETE CASCADE` (`characters`, `keystones`, `team_members` y `team_invitations`). El test reproduce el modo transaccional de D1 y comprueba también keystones e invitaciones. Las tablas de respaldo se eliminan dentro de la propia migración.

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
- Cliente visual/release: snapshots actualizados para Battle.net y el ajuste final de alineación ES/EN del footer, y changeset publicado en `.changes/releases/client-v0.9.0/battlenet-auth-v1.json`.
- Bridge: tres suites bajo `tests/client_bridge/`.

## Validación ejecutada

- Worker: `npm test` — 128/128; `npm run typecheck` — PASS.
- Migración: `python -m unittest tests/test_battlenet_auth_migration.py` — 2/2; `npm run d1:migrate:local` — PASS, sin migraciones pendientes en D1 local.
- Web: `npm test` — 66/66; `npm run build` — PASS; `npm run test:visual` — 11/11.
- Web lint: `npm run lint` — PASS, 0 errores y 0 warnings tras el saneamiento mecánico del baseline preexistente.
- Cliente Python: compileall — PASS; `tests/client` — 104/104; `tests/client_bridge` — 66/66.
- Cliente frontend: `npm ci` — PASS, 0 vulnerabilidades; `npm test` — 42 archivos, 252/252; `npm run build` — PASS; `npm run test:visual` — 175/175.
- Tauri: fmt check — PASS; cargo check — PASS; cargo test — 25/25 (warning informativo del linker de Windows).
- Packaging: sidecar PyInstaller limpio y smoke `ready/ping/get_state/second_ping/eof` — PASS; build NSIS, firma del updater y verificación de artefactos de release — PASS.
- Baseline adicional: `tests/release` — 51/51; `tests/deploy_impact` — 47/47.
- Release ejecutado: client minor `0.8.1 -> 0.9.0`; tag y GitHub Release [client-v0.9.0](https://github.com/Speeson/weeklyChar/releases/tag/client-v0.9.0) publicados con `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig` y `latest.json`.

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

### Rollout de producción

- El primer intento automático de aplicar `0009_battlenet_auth.sql` falló porque `PRAGMA foreign_keys = OFF` no tiene efecto dentro de la transacción implícita de una migración D1. D1 revirtió la migración completa: `0009` continuó pendiente, los contadores permanecieron en `4` users, `25` characters, `3` teams y `6` memberships, y `PRAGMA foreign_key_check` no devolvió incidencias.
- El hotfix del PR [#8](https://github.com/Speeson/weeklyChar/pull/8) sustituyó ese comportamiento por diferimiento de FKs y respaldo/restauración explícita de las relaciones cascade, con una prueba de regresión que ejecuta la migración dentro de una transacción como D1.
- El rollout de backend [34297029378](https://github.com/Speeson/weeklyChar/actions/runs/34297029378) terminó en PASS: Worker typecheck/tests, migración D1 remota, deploy del Worker y smoke de producción.
- D1 producción quedó sin migraciones pendientes. Tras `0009`, los contadores siguieron exactamente en `4` users, `25` characters, `3` teams y `6` memberships; `PRAGMA foreign_key_check` devolvió cero filas.
- `users.password_hash` admite `NULL`; `user_identities` y `oauth_flows` existen; no quedaron tablas temporales de respaldo. En el momento de la auditoría había `0` identities y `0` oauth flows de producción, por lo que no se creó ninguna cuenta durante el rollout.
- El Worker de producción responde `200` en `https://api-keystonesync.esgarpe.dev/api/health`.
- Un inicio OAuth de producción, sin seguir el redirect ni completar autenticación, confirmó host `oauth.battle.net`, scope exacto `openid`, callback `https://api-keystonesync.esgarpe.dev/api/auth/battlenet/callback`, `state`, code challenge y PKCE `S256`. No se imprimieron sus valores efímeros.
- La Web de producción responde `200` en `https://keystonesync.esgarpe.dev/login` y el bundle servido contiene el código Battle.net; su build y lint volvieron a pasar en el pipeline de publicación.
- El pipeline de release [34297312960](https://github.com/Speeson/weeklyChar/actions/runs/34297312960) repitió Worker tests, Web build/lint y smoke de producción antes de superar el gate de backend, validar Python/React/Rust, construir NSIS, verificar firma/assets y publicar atómicamente `client-v0.9.0`.
- No se desplegó ni publicó el Addon.

## Configuración manual pendiente

- No queda configuración obligatoria pendiente para este rollout: el callback de producción está registrado, los bindings/secrets permanecen gestionados fuera del repositorio y `0009_battlenet_auth.sql` está aplicada.
- Como comprobación operativa opcional posterior al rollout, puede completarse un login real en producción. La integración OAuth real ya fue validada end-to-end en staging con la misma implementación y Battle.net real; durante el rollout de producción solo se validó el inicio del flujo para no crear o vincular cuentas involuntariamente.

## Impacto de despliegue

- Worker: migración D1 remota y deploy completados; health/smoke PASS.
- Web: cambios integrados en `main`, Web de producción operativa y pipeline build/lint PASS.
- Cliente: release minor `0.9.0` publicado con updater firmado.
- Addon: sin impacto y sin publicación.

## Riesgos y limitaciones

- PKCE S256, Authorization Code, callback, `/userinfo`, vinculación a cuenta tradicional y flujo desktop han sido probados satisfactoriamente contra Battle.net real.
- No se completó un login Battle.net real contra producción durante el rollout; la prueba end-to-end real se ejecutó en staging aislado y el endpoint de inicio/callback configurado de producción se verificó sin avanzar al consentimiento.
- El perfil nuevo de Opera observado durante la prueba se debió a que el arnés aisló `APPDATA` para proteger el perfil real; una ejecución normal hereda el perfil habitual del navegador predeterminado.
- Se conserva deliberadamente el JWT Web actual en localStorage; no se migró a cookies HttpOnly.
- V1 no implementa `wow.profile`, importación de personajes, email Battle.net ni establecimiento de password para cuentas Battle.net-only.
