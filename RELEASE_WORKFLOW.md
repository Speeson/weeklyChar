# Release and Push Workflow

Estas reglas deben seguirse siempre que se actualice el proyecto.

## Addon KeystoneSync

- Si se modifica el addon, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, subir los cambios al repositorio propio del addon: `Speeson/KeystoneSync`.
- Tras subir el commit, crear y subir siempre el tag correspondiente a la version del addon.
- El tag debe seguir el formato usado por el addon, por ejemplo: `v0.1.13`.

## Cliente KeystoneClient

- Si se modifica el cliente, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, subir los cambios al repositorio principal del proyecto: `Speeson/weeklyChar`.
- Si hay cambios de cliente, proporcionar los datos para que el usuario cree el release manualmente.
- El usuario crea el release en GitHub.
- El release del cliente debe incluir el instalador generado como asset.

## Pagina web

- Si se modifica solo la pagina web, primero hay que pedir confirmacion antes de subir cambios.
- Tras confirmacion, subir los cambios al repositorio principal del proyecto: `Speeson/weeklyChar`.
- Si no se ha tocado ni el cliente ni el addon, no hace falta crear release.
- En ese caso basta con actualizar el repositorio para que el despliegue de la web se encargue del resto.

## Regla general

- Nunca hacer push sin confirmacion explicita del usuario.
- Antes de cualquier push, revisar el estado de Git y confirmar que los cambios pertenecen al alcance esperado.
- Si hay cambios mezclados de addon, cliente y web, separar mentalmente el impacto:
  - Addon: repo propio + tag.
  - Cliente: repo principal + datos de release.
  - Web: repo principal sin release si no afecta al cliente.
