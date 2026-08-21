# Release and Push Workflow

Estas reglas deben seguirse siempre que se actualice el proyecto.

Estado actual verificado:

- El impacto de build/deploy/release se clasifica con `python scripts/deploy_impact.py --files <changed-paths>`.
- El orquestador versionado esta en `.github/workflows/deploy.yml`.
- El cliente se construye con PyInstaller/Inno Setup.
- El instalador publico esperado es `KeystoneClientSetup.exe`.
- El build del cliente para validacion/orquestacion usa `.github/workflows/build-client.yml` con permisos read-only.
- La publicacion de GitHub Releases del cliente esta automatizada solo mediante ejecucion manual de `.github/workflows/release-client.yml` con `publish_release=true`.
- El Worker se despliega con Wrangler y usa D1; despliegue y migraciones remotas estan disponibles solo por ejecucion manual/guardada de `.github/workflows/deploy-worker.yml`.
- La web esta documentada como desplegada con Vercel, pero la configuracion externa de Git Integration no esta versionada en este repositorio.
- Los workflows del addon canonico estan preparados como handoff en `docs/workflow-handoff/addon/`; no estan activos hasta copiarlos a `Speeson/KeystoneSync`.
- KeystoneClient no contiene una copia embebida del addon. Instala releases standalone del addon desde `Speeson/KeystoneSync`; un cambio solo de addon no requiere release del cliente.

## Addon KeystoneSync

- Si se modifica el addon, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, modificar el addon solo en el repositorio canonico `Speeson/KeystoneSync`.
- Los workflows preparados para ese repositorio estan en `docs/workflow-handoff/addon/validate-addon.yml` y `docs/workflow-handoff/addon/release-addon.yml`.
- El release del addon debe usar tag `vX.Y.Z` y asset dedicado `KeystoneSync-vX.Y.Z.zip` con carpeta raiz `KeystoneSync/`.
- Una release solo de addon se publica en `Speeson/KeystoneSync` y los usuarios pueden actualizar desde KeystoneClient; no hace falta nuevo `KeystoneClientSetup.exe`.
- No recrear un bundle de addon dentro de `keystone-client`; el cliente consume releases remotas y una cache local validada.
- Tras subir el commit del addon, crear y subir el tag correspondiente a la version del addon solo con autorizacion explicita.
- El tag debe seguir el formato usado por el addon, por ejemplo: `v0.1.13`.

## Cliente KeystoneClient

- Si se modifica el cliente, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, subir los cambios al repositorio principal del proyecto: `Speeson/weeklyChar`.
- El build del cliente no descarga ni empaqueta el addon.
- El instalador del cliente no debe contener `KeystoneSync.toc`, `KeystoneSync.lua` ni otros archivos runtime del addon.
- Generar el instalador con `keystone-client/build_installer.bat`.
- Si hay cambios de cliente, proporcionar los datos para que el usuario cree el release manualmente.
- El workflow `.github/workflows/build-client.yml` genera el instalador como artifact para validacion/orquestacion.
- El workflow `.github/workflows/release-client.yml` genera el instalador y puede publicar el release cuando se ejecuta manualmente.
- Para publicar el release, ejecutar manualmente `release-client.yml` con `publish_release=true`.
- El tag del cliente debe seguir el formato existente `client-vX.Y.Z`, derivado de `keystone-client/VERSION`.
- El release del cliente debe incluir el instalador generado como asset con el nombre `KeystoneClientSetup.exe`.

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
- En `main`, el orquestador valida/builda segun impacto; las operaciones productivas siguen siendo manuales/guardadas.
- Nunca hacer push sin confirmacion explicita del usuario.
- Antes de cualquier push, revisar el estado de Git y confirmar que los cambios pertenecen al alcance esperado.
- Si hay cambios mezclados de addon, cliente y web, separar mentalmente el impacto:
  - Addon: repo propio + tag.
  - Cliente: repo principal + datos de release.
  - Web: repo principal sin release si no afecta al cliente.
  - Worker/D1: Wrangler y migraciones separadas, siempre con autorizacion explicita para remoto.
