# KeystoneClient 0.6.11

## Correcciones

- Elimina favoritos obsoletos de KeystoneLoot tras reiniciar los datos locales.
  - Detecta de forma persistente una nueva instancia de SavedVariables y reconcilia únicamente KeystoneLoot para la cuenta de WoW y región afectadas.
  - Conserva personajes y el resto de sus datos, y reintenta la reconciliación si falla la red o no puede guardarse el nuevo baseline.
