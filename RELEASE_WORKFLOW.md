# Release and Push Workflow

Estas reglas deben seguirse siempre que se actualice el proyecto.

Estado actual verificado:

- El impacto de build/deploy/release se clasifica con `python scripts/deploy_impact.py --files <changed-paths>`.
- El orquestador versionado esta en `.github/workflows/deploy.yml`.
- El frontend se construye con React/Vite, el host nativo con Rust/Tauri, el sidecar Python con PyInstaller y el instalador con NSIS.
- El instalador publico esperado es `KeystoneClientSetup.exe`.
- El build del cliente para validacion/orquestacion usa `.github/workflows/build-client.yml` con permisos read-only.
- La publicacion de GitHub Releases del cliente puede ejecutarse para pushes a `main` cuando Deployment Impact marca `CLIENT_RELEASE=true`, existe un changeset valido y `TAURI_CLIENT_RELEASE_ENABLED=true`.
- El Worker se despliega con Wrangler y usa D1; despliegue y migraciones remotas estan disponibles solo por ejecucion manual/guardada de `.github/workflows/deploy-worker.yml`.
- La web esta documentada como desplegada con Vercel, pero la configuracion externa de Git Integration no esta versionada en este repositorio.
- Los workflows del addon canonico viven en `Speeson/KeystoneSync`. `docs/workflow-handoff/addon/` conserva solo un puntero para evitar una segunda copia autoritativa. Este repositorio no publica releases del addon.
- KeystoneClient no contiene una copia embebida del addon. Instala releases standalone del addon desde `Speeson/KeystoneSync`; un cambio solo de addon no requiere release del cliente.

## Addon KeystoneSync

- Si se modifica el addon, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, modificar el addon solo en el repositorio canonico `Speeson/KeystoneSync`.
- Los workflows reales del addon estan en `Speeson/KeystoneSync/.github/workflows/`.
- El release del addon debe usar tag `vX.Y.Z` y asset dedicado `KeystoneSync-vX.Y.Z.zip` con carpeta raiz `KeystoneSync/`.
- Una release solo de addon se publica en `Speeson/KeystoneSync` y los usuarios pueden actualizar desde KeystoneClient; no hace falta nuevo `KeystoneClientSetup.exe`.
- No recrear un bundle de addon dentro de `keystone-client`; el cliente consume releases remotas y una cache local validada.
- Tras subir el commit del addon, crear y subir el tag correspondiente a la version del addon solo con autorizacion explicita.
- El tag debe seguir el formato usado por el addon, por ejemplo: `v0.1.13`.

## Cliente KeystoneClient

- Si se modifica comportamiento visible del cliente, incluir un changeset JSON en `.changes/pending/` con `components: ["client"]`.
- Tras confirmacion explicita, subir los cambios al repositorio principal del proyecto: `Speeson/weeklyChar`.
- El build del cliente no descarga ni empaqueta el addon.
- El instalador del cliente no debe contener `KeystoneSync.toc`, `KeystoneSync.lua` ni otros archivos runtime del addon.
- Generar el sidecar con `python scripts/build_client_sidecar.py --clean`.
- Generar el instalador local con `npm --prefix keystone-client run tauri:build -- --bundles nsis`.
- El instalador nativo aparece en `keystone-client/src-tauri/target/release/bundle/nsis/KeystoneClient_<version>_x64-setup.exe`.
- El workflow `.github/workflows/build-client.yml` genera el instalador como artifact para validacion/orquestacion.
- El workflow `.github/workflows/release-client.yml` soporta `build-only`, `release-dry-run` y `release`.
- `release-dry-run` construye y valida los artefactos firmados sin crear tag, GitHub Release ni `latest.json` publico; `release` requiere autorizacion explicita o el gate automatico habilitado.
- En Pull Requests, los cambios con `CLIENT_RELEASE=true` validan el changeset, calculan version/notas y buildan sin publicar.
- En push a `main`, los cambios con `CLIENT_RELEASE=true` solo publican automaticamente si `TAURI_CLIENT_RELEASE_ENABLED=true`; `auto` selecciona `patch`, `minor` o `major`.
- El release commit y el tag se suben con `git push --atomic`; no hay fallback secuencial.
- El tag del cliente debe seguir el formato existente `client-vX.Y.Z`, derivado de `keystone-client/VERSION`.
- El release del cliente debe incluir `KeystoneClientSetup.exe`, `KeystoneClientSetup.exe.sig` y `latest.json`; la firma Minisign se valida contra la clave publica configurada en Tauri.

## Pagina web

- Si se modifica solo la pagina web, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, subir los cambios al repositorio principal del proyecto: `Speeson/weeklyChar`.
- Si no se ha tocado ni el cliente ni el addon, no hace falta crear release.
- La web esta documentada como desplegada mediante Vercel. La configuracion exacta de Git Integration es externa y no esta versionada aqui.
- `.github/workflows/deploy-web.yml` valida build y lint. El lint es temporalmente no bloqueante por la deuda documentada en Phase 8; el build si es bloqueante.
- No crear un despliegue Vercel duplicado desde GitHub Actions mientras la Git Integration externa siga siendo el modelo documentado.

## Worker y D1

- Si se modifica `keystone-worker`, primero validar con los scripts locales relevantes.
- `.github/workflows/deploy-worker.yml` ejecuta `npm run typecheck` y `npm test`.
- `npm run deploy` ejecuta `wrangler deploy`; en CI solo se ejecuta con entrada manual `deploy=true`.
- `npm run d1:migrate:remote` aplica migraciones remotas de D1; en CI solo se ejecuta con entrada manual `run_migrations=true` y entorno `production`.
- Las migraciones locales (`npm run d1:migrate:local`) son validacion/desarrollo local, no despliegue de produccion.

## Regla general

- Antes de decidir que construir, desplegar, migrar o publicar, ejecutar Deployment Impact. Para cambios del addon canonico externo usar `python scripts/deploy_impact.py --addon-changed`.
- Tras Phase 11, `--addon-changed` implica release standalone del addon, no build/release del cliente.
- En Pull Requests, el orquestador solo valida/builda segun impacto; no publica releases, despliega Worker ni ejecuta migraciones remotas.
- En `main`, el orquestador valida/builda segun impacto. Los releases de cliente requieren `CLIENT_RELEASE=true` y `TAURI_CLIENT_RELEASE_ENABLED=true`; Worker deploy y migraciones remotas siguen siendo manuales/guardadas.
- Nunca hacer push sin confirmacion explicita del usuario.
- Antes de cualquier push, revisar el estado de Git y confirmar que los cambios pertenecen al alcance esperado.
- Si hay cambios mezclados de addon, cliente y web, separar mentalmente el impacto:
  - Addon: repo propio + tag.
  - Cliente: repo principal + datos de release.
  - Web: repo principal sin release si no afecta al cliente.
  - Worker/D1: Wrangler y migraciones separadas, siempre con autorizacion explicita para remoto.
