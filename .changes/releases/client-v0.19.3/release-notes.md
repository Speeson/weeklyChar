<!-- lang:es -->
# KeystoneClient 0.19.3

## Correcciones

- Corrige la detección de actualizaciones del addon cuando GitHub limita la API.
  - Consulta la página pública de la última release si la API no está disponible y comprueba que existe el ZIP del addon.
  - Distingue la versión en caché de la última versión verificada y evita mostrar un falso estado actualizado.

<!-- lang:en -->
# KeystoneClient 0.19.3

## Fixes

- Fix addon update detection when the GitHub API is rate limited.
  - Use GitHub's public latest release page when the API is unavailable and verify the addon ZIP exists.
  - Distinguish a cached version from a verified latest version and avoid a false up-to-date status.
