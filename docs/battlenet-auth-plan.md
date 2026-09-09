# KeystoneSync — Battle.net Authentication V1

## 1. Objetivo

Implementar autenticación con Battle.net en KeystoneSync de forma segura y compatible con el sistema de cuentas existente.

La V1 debe permitir:

1. Iniciar sesión en KeystoneSync mediante Battle.net.
2. Crear una cuenta nueva de KeystoneSync mediante Battle.net.
3. Vincular una cuenta Battle.net a una cuenta KeystoneSync existente.
4. Desvincular Battle.net de una cuenta existente cuando no provoque bloqueo de acceso.
5. Utilizar el login Battle.net tanto desde:

   * `keystone-web`
   * `keystone-client`
6. Mantener completamente funcional el login actual mediante username/password.
7. No modificar la propiedad ni identidad interna de personajes, equipos, KeystoneLoot, sync tokens ni demás datos existentes.

Battle.net será un **proveedor de identidad**, no la identidad primaria interna de KeystoneSync.

La identidad interna seguirá siendo:

```text
users.id
```

Todos los datos existentes continuarán dependiendo del mismo `user_id`.

---

# 2. Principios obligatorios

## 2.1. KeystoneSync conserva su propia sesión

Battle.net únicamente autentica al usuario.

Después de validar Battle.net:

```text
Battle.net identity
        ↓
KeystoneSync user_id
        ↓
KeystoneSync JWT
```

El resto del sistema seguirá utilizando el JWT actual generado por KeystoneSync.

No sustituir el JWT KeystoneSync por el access token de Battle.net.

---

## 2.2. Scope mínimo

Battle.net V1 solicitará únicamente:

```text
openid
```

NO solicitar:

```text
wow.profile
```

NO acceder en esta feature a:

* personajes Battle.net;
* account profile de WoW;
* monturas;
* mascotas;
* colecciones;
* protected character profile;
* información adicional del perfil de WoW.

La integración `wow.profile` será una feature independiente futura.

---

## 2.3. No almacenar tokens Battle.net

El flujo será:

```text
Authorization Code
       ↓
Battle.net access token
       ↓
/oauth/userinfo
       ↓
sub + BattleTag
       ↓
DESCARTAR access token
```

No persistir en D1:

```text
battle.net access_token
battle.net refresh_token
authorization code
```

No incluirlos en logs.

No devolverlos a Web.

No devolverlos a KeystoneClient.

No guardarlos en localStorage.

No guardarlos en el sidecar.

---

# 3. Estado actual que debe conservarse

Actualmente KeystoneSync utiliza:

```text
users.id
```

como identidad interna.

El login actual:

```text
POST /api/auth/login
username + password
        ↓
createAccessToken(JWT_SECRET, user.id)
```

debe seguir funcionando.

El sistema existente de:

* characters
* keystones
* teams
* team_members
* KeystoneLoot
* preferences
* sync_token
* web
* client
* addon

NO debe migrarse a IDs Battle.net.

No cambiar ninguna FK existente de `user_id`.

---

# 4. Modelo de identidades externas

Crear migración:

```text
keystone-worker/migrations/0009_battlenet_auth.sql
```

## 4.1. `user_identities`

Crear una tabla similar a:

```sql
user_identities
---------------
id
user_id
provider
provider_subject
provider_display_name
created_at
last_login_at
```

Conceptualmente:

```text
user_id:                27
provider:               battlenet
provider_subject:       <Battle.net sub>
provider_display_name:  Speeson#1234
```

Restricciones obligatorias:

```text
UNIQUE(provider, provider_subject)
UNIQUE(user_id, provider)
```

Esto garantiza:

* una cuenta Battle.net no puede pertenecer a dos usuarios KeystoneSync;
* un usuario KeystoneSync no puede tener dos Battle.net en V1.

`provider_subject` es la identidad real.

`provider_display_name`/BattleTag es solo información visual.

Nunca utilizar BattleTag para identificar o fusionar cuentas.

---

# 5. Passwords para cuentas creadas con Battle.net

Una cuenta creada exclusivamente mediante Battle.net no debe estar obligada a crear una contraseña KeystoneSync.

Por tanto:

```text
users.password_hash
```

debe poder representar una cuenta sin contraseña.

Objetivo lógico:

```text
password_hash = NULL
```

para cuentas Battle.net-only.

La migración debe ser compatible con Cloudflare D1 y conservar íntegramente todos los usuarios existentes.

Si D1 requiere reconstruir `users` para modificar `NOT NULL`, hacerlo de forma segura preservando:

* columnas;
* datos;
* constraints;
* índices;
* foreign keys;
* IDs existentes.

No modificar ningún `users.id`.

Crear un test específico de migración con datos existentes y relaciones en:

* characters;
* teams;
* team_members.

No asumir que un `ALTER COLUMN` no soportado funcionará.

---

# 6. Compatibilidad del login tradicional

Actualizar tipos y autenticación para soportar:

```text
password_hash: string | null
```

El login tradicional debe comportarse así:

```text
password_hash != null
    → comprobar password normalmente

password_hash == null
    → credenciales incorrectas
```

Nunca llamar a bcrypt con `null`.

El comportamiento de usuarios existentes debe ser idéntico al actual.

---

# 7. OAuth Battle.net

## 7.1. Endpoint de autorización

Implementar Authorization Code Flow contra Battle.net.

Usar la URL oficial vigente de Battle.net configurada para la aplicación.

No inventar endpoints si han cambiado: comprobar los endpoints actuales antes de codificar.

El redirect URI debe ser explícito mediante configuración, por ejemplo:

```text
BATTLENET_REDIRECT_URI
```

Producción prevista:

```text
https://api-keystonesync.esgarpe.dev/api/auth/battlenet/callback
```

El valor debe coincidir exactamente con el registrado en Battle.net Developer Portal.

---

# 8. Protección OAuth

Cada autorización debe utilizar:

## `state`

Generar:

```text
32 bytes CSPRNG mínimo
```

Nunca usar:

* user ID;
* username;
* BattleTag;
* timestamp;
* valores predecibles

como `state`.

Persistir únicamente:

```text
SHA-256(state)
```

---

## PKCE

Usar:

```text
code_challenge_method=S256
```

Generar un `code_verifier` criptográficamente aleatorio por operación.

Calcular:

```text
code_challenge =
BASE64URL(SHA256(code_verifier))
```

El verifier existe únicamente durante la transacción OAuth.

Después del callback debe eliminarse.

---

# 9. Tabla temporal de OAuth

Crear una tabla temporal/persistente con TTL lógico:

```text
oauth_flows
```

Campos conceptuales:

```text
id
intent
state_hash
pkce_verifier
initiator_user_id
desktop_poll_secret_hash
handoff_secret_hash
provider_subject
provider_display_name
result_user_id
status
expires_at
created_at
completed_at
```

`intent` debe utilizar una whitelist cerrada, por ejemplo:

```text
login_web
login_desktop
link_account
```

No aceptar intents arbitrarios.

Estados posibles:

```text
pending
needs_onboarding
ready
consumed
failed
```

Las operaciones deben ser de un solo uso.

Expiración recomendada:

```text
OAuth flow: 5-10 minutos
web handoff ticket: <= 60 segundos
```

Eliminar o invalidar operaciones expiradas oportunísticamente.

---

# 10. Callback Battle.net

Implementar:

```text
GET /api/auth/battlenet/callback
```

El callback debe:

1. comprobar errores devueltos por Battle.net;
2. comprobar `state`;
3. localizar exactamente una transacción activa;
4. comprobar expiración;
5. consumir/inutilizar el `state`;
6. intercambiar `code` por access token;
7. enviar el `code_verifier` PKCE;
8. validar la respuesta;
9. llamar a `userinfo`;
10. validar estrictamente los campos;
11. extraer:

    * `sub`
    * `battletag`
12. descartar inmediatamente el access token;
13. eliminar `pkce_verifier`;
14. continuar según el tipo de flujo.

No registrar en logs:

```text
code
access_token
code_verifier
state plaintext
handoff secret
desktop poll secret
```

---

# 11. Identidad Battle.net

Utilizar:

```text
userinfo.sub
```

como:

```text
provider_subject
```

Utilizar:

```text
userinfo.battletag
```

solo como:

```text
provider_display_name
```

Si BattleTag cambia, actualizar `provider_display_name` en el siguiente login.

Nunca cambiar `provider_subject`.

Nunca buscar usuarios KeystoneSync por BattleTag.

Nunca hacer linking automático por:

* username parecido;
* BattleTag;
* nombre;
* personajes WoW;
* email;
* nombre de cuenta.

---

# 12. Login web: cuenta ya vinculada

Flujo:

```text
Login KeystoneSync
        ↓
Continuar con Battle.net
        ↓
Battle.net
        ↓
callback Worker
        ↓
userinfo
        ↓
user_identities
        ↓
user_id existente
        ↓
handoff ticket
        ↓
Web callback
        ↓
KeystoneSync JWT
```

Nunca poner el JWT KeystoneSync directamente en la URL.

Crear un ticket criptográficamente aleatorio, de un solo uso y corta duración.

Persistir únicamente:

```text
SHA-256(ticket)
```

Redirigir al frontend:

```text
/login/battlenet/callback?ticket=<opaque-ticket>
```

El frontend realiza:

```text
POST /api/auth/battlenet/exchange
```

y entrega el ticket.

El Worker:

1. valida hash;
2. valida TTL;
3. valida que no se utilizó;
4. consume el ticket;
5. emite:

```text
createAccessToken(JWT_SECRET, user.id)
```

El frontend continúa utilizando el sistema actual:

```text
setToken()
hydrateProfile()
router.push('/dashboard')
```

---

# 13. Battle.net no vinculada

Si Battle.net devuelve una identidad que no existe en:

```text
user_identities
```

NO crear automáticamente una cuenta.

Mostrar onboarding:

```text
Esta cuenta Battle.net todavía no está
asociada a KeystoneSync.

Battle.net:
Speeson#1234

[ Crear cuenta KeystoneSync ]

¿Ya tienes una cuenta?
[ Vincular cuenta existente ]
```

Generar un ticket de onboarding de un solo uso.

---

# 14. Crear cuenta mediante Battle.net

El usuario debe elegir al menos:

```text
username KeystoneSync
```

No utilizar automáticamente el BattleTag como username.

Puede sugerirse visualmente la parte anterior a `#`, pero el usuario debe confirmarlo.

Crear:

```text
users
```

con:

```text
username = elegido
password_hash = NULL
sync_token = newSyncToken()
```

Los datos que Battle.net no proporciona no deben inventarse.

Campos como:

```text
email
first_name
last_name
date_of_birth
```

pueden permanecer `NULL` en cuentas Battle.net-only.

No marcar un email como verificado si no existe.

En la misma operación lógica crear:

```text
user_identities
```

relacionando Battle.net con el nuevo `user_id`.

Evitar estados parciales.

Si falla la creación de identity, no debe quedar una cuenta huérfana creada accidentalmente.

Después:

```text
KeystoneSync JWT
```

y login completado.

---

# 15. Vincular una cuenta existente desde onboarding

Si el usuario selecciona:

```text
Ya tengo cuenta KeystoneSync
```

pedir:

```text
username
password
```

Verificar exactamente con las mismas reglas que el login tradicional.

Si el email de esa cuenta requiere verificación según las reglas actuales, respetar esa restricción.

Después:

```text
Battle.net identity
        ↓
existing user_id
```

Crear `user_identities`.

No mover datos.

No copiar datos.

No crear otro usuario.

Sus:

* personajes;
* equipos;
* KeystoneLoot;
* preferencias;
* sync token

permanecen intactos porque continúan dependiendo del mismo `user_id`.

---

# 16. Vinculación desde Ajustes

Añadir en:

```text
keystone-web/app/settings
```

sección:

```text
Cuenta
└── Cuentas vinculadas
```

Estado no vinculado:

```text
Battle.net
No vinculado

[ Vincular Battle.net ]
```

Estado vinculado:

```text
Battle.net
Speeson#1234
Vinculado

[ Desvincular ]
```

Crear endpoint autenticado:

```text
GET /api/me/identities
```

Respuesta pública:

```json
{
  "battleNet": {
    "linked": true,
    "displayName": "Speeson#1234",
    "linkedAt": "..."
  }
}
```

NO devolver `provider_subject` salvo que exista una necesidad real.

---

# 17. Inicio de linking autenticado

Un `<a>` normal no puede adjuntar vuestro Bearer JWT.

Por tanto crear:

```text
POST /api/me/identities/battlenet/start
Authorization: Bearer <Keystone JWT>
```

El Worker crea una OAuth flow:

```text
intent = link_account
initiator_user_id = currentUser.id
```

y devuelve:

```json
{
  "authorizationUrl": "..."
}
```

El frontend navega entonces a esa URL.

---

# 18. Callback de linking

Al volver Battle.net:

### Si la cuenta Battle.net no pertenece a nadie:

```text
INSERT user_identities
```

para el `initiator_user_id`.

### Si ya pertenece al mismo usuario:

considerar la operación idempotente y devolver éxito.

### Si pertenece a otro usuario:

rechazar.

Mensaje:

```text
Esta cuenta Battle.net ya está vinculada
a otra cuenta de KeystoneSync.
```

No indicar username ni información del otro usuario.

### Si el usuario KeystoneSync ya tiene otra Battle.net:

rechazar.

No reemplazarla automáticamente.

---

# 19. Desvinculación

Crear:

```text
DELETE /api/me/identities/battlenet
```

No permitir que el usuario se quede sin método de autenticación.

Para V1:

```text
password_hash != NULL
    → Battle.net puede desvincularse

password_hash == NULL
    → rechazar desvinculación
```

Respuesta:

```text
No puedes desvincular Battle.net porque
actualmente es tu único método de acceso.
```

No implementar todavía un mecanismo inseguro de establecimiento de password únicamente para poder desbloquear esta acción.

La creación segura de contraseña para usuarios Battle.net-only puede ser una mejora independiente.

---

# 20. Web UI

Modificar login/registro actual manteniendo el estilo existente.

En login:

```text
Usuario
Password

[ Entrar ]

──────── o ────────

[ Continuar con Battle.net ]

¿No tienes cuenta?
...
```

El botón Battle.net debe estar separado visualmente del login tradicional.

No sustituir los formularios existentes.

Errores contemplados:

```text
Usuario canceló Battle.net
Autorización caducada
Battle.net no disponible
State inválido
Cuenta ya vinculada
Error temporal
```

No mostrar detalles técnicos.

---

# 21. KeystoneClient

La feature también debe estar disponible en el cliente Tauri.

NO introducir:

```text
BLIZZARD_CLIENT_SECRET
```

en:

* React;
* Vite;
* Tauri frontend;
* Python sidecar;
* bundle;
* variables públicas.

El secret continúa exclusivamente en el Worker.

---

# 22. OAuth desktop

Evitar depender inicialmente de custom URI schemes.

Implementar un flujo mediante navegador + ticket de polling.

## Inicio

KeystoneClient solicita:

```text
POST /api/auth/battlenet/desktop/start
```

El Worker genera:

```text
flowId
pollSecret
authorizationUrl
expiresAt
```

Persistir únicamente:

```text
SHA-256(pollSecret)
```

KeystoneClient abre `authorizationUrl` en el navegador del sistema.

Mostrar:

```text
Esperando autorización de Battle.net...
```

con opción:

```text
Cancelar
```

---

# 23. Desktop callback

Battle.net continúa devolviendo el callback al Worker HTTPS.

Si Battle.net ya está vinculado:

```text
oauth flow → ready → user_id
```

El navegador muestra:

```text
Battle.net conectado correctamente.

Puedes volver a KeystoneClient.
```

El cliente consulta periódicamente el estado mediante el flow ID + poll secret.

No consultar con una frecuencia agresiva.

Ejemplo:

```text
cada 2 segundos
máximo hasta expiración del flow
```

---

# 24. Desktop exchange

Endpoint:

```text
POST /api/auth/battlenet/desktop/exchange
```

Body:

```text
flowId
pollSecret
```

Estados:

```text
pending
needs_onboarding
ready
expired
consumed
```

Cuando esté `ready`:

1. verificar poll secret;
2. verificar TTL;
3. consumir flow;
4. emitir KeystoneSync JWT;
5. no permitir segundo exchange.

El sidecar continúa con el flujo ya existente:

```text
GET /api/me
```

y almacena exclusivamente:

```text
KeystoneSync access_token
sync_token
username
avatar_url
```

igual que actualmente.

Nunca almacenar Battle.net token.

---

# 25. Battle.net nueva desde KeystoneClient

Si el usuario inicia OAuth desde el cliente y esa Battle.net no tiene KeystoneSync:

el navegador debe mostrar el onboarding web:

```text
Crear cuenta KeystoneSync

o

Vincular cuenta existente
```

Después de completarlo:

```text
desktop OAuth flow → ready
```

KeystoneClient detecta el estado y completa automáticamente su login.

Esto evita duplicar todo el formulario de linking OAuth dentro de Tauri.

---

# 26. Rate limiting

Añadir límites razonables para:

```text
OAuth start
OAuth callback failures
onboarding register
onboarding link
ticket exchange
desktop start
desktop exchange
```

Especialmente proteger:

```text
onboarding link existing
```

porque acepta username/password.

Reutilizar la infraestructura existente de rate limiting cuando sea posible.

---

# 27. Headers de seguridad

En endpoints sensibles utilizar:

```text
Cache-Control: no-store
```

En páginas/resultados OAuth:

```text
Referrer-Policy: no-referrer
```

No insertar recursos de terceros innecesarios en la página final del callback.

No aceptar `returnTo` arbitrarios.

Cualquier redirección debe proceder de una whitelist interna.

Evitar open redirects.

---

# 28. Secretos

El repositorio nunca debe contener valores reales de:

```text
BLIZZARD_CLIENT_ID
BLIZZARD_CLIENT_SECRET
```

El `CLIENT_SECRET` debe existir únicamente como Cloudflare secret/environment.

Añadir únicamente placeholders a ejemplos de configuración.

Antes del deploy verificar que no aparece en:

```text
git diff
git history nuevo
frontend bundle
tests snapshots
logs
```

---

# 29. Variables de entorno

Reutilizar:

```text
BLIZZARD_CLIENT_ID
BLIZZARD_CLIENT_SECRET
WEB_BASE_URL
```

Añadir si procede:

```text
BATTLENET_REDIRECT_URI
```

No usar:

```text
NEXT_PUBLIC_BLIZZARD_CLIENT_SECRET
VITE_BLIZZARD_CLIENT_SECRET
```

bajo ninguna circunstancia.

---

# 30. Actualización de BattleTag

Cada login Battle.net correcto debe poder actualizar:

```text
provider_display_name
```

si el BattleTag ha cambiado.

No afecta a la identidad.

La relación continúa utilizando:

```text
provider_subject
```

---

# 31. Casos que deben rechazarse

Implementar tests explícitos para:

### OAuth

* state inexistente;
* state incorrecto;
* state reutilizado;
* state expirado;
* code inexistente;
* code reutilizado;
* callback con `error`;
* respuesta token inválida;
* userinfo inválido;
* `sub` ausente;
* PKCE incorrecto.

### Linking

* Battle.net ya vinculada a otro user;
* usuario ya tiene otra Battle.net;
* linking ticket expirado;
* linking ticket reutilizado;
* password incorrecta;
* username inexistente.

### Sesiones

* handoff expirado;
* handoff reutilizado;
* desktop secret incorrecto;
* desktop flow expirado;
* desktop flow consumido.

### Desvinculación

* Battle.net-only → rechazar;
* usuario con password → permitir;
* identity inexistente → respuesta coherente/idempotente según decisión implementada.

---

# 32. Tests de base de datos

La migración `0009` debe probar:

1. usuario tradicional existente;
2. usuario con characters;
3. usuario creador de team;
4. usuario member de team;
5. preservación exacta de IDs;
6. login password después de migración;
7. creación de Battle.net-only user;
8. FK ON DELETE CASCADE de identity.

---

# 33. Tests Worker

Añadir suite dedicada, por ejemplo:

```text
tests/battlenetAuth.test.js
```

Mockear completamente Battle.net.

Los tests normales no deben depender de Internet.

Comprobar:

* autorización usa exactamente `openid`;
* NO aparece `wow.profile`;
* state aleatorio;
* PKCE S256;
* callback;
* token exchange;
* userinfo;
* login linked;
* onboarding;
* register;
* existing account linking;
* settings linking;
* conflicts;
* unlink;
* expiration;
* replay protection;
* desktop flow;
* no token persistence.

---

# 34. Tests Web

Añadir tests del:

```text
Continuar con Battle.net
```

y callback.

Playwright debe cubrir como mínimo:

### Login existente

```text
Battle.net vinculada
→ callback
→ JWT KeystoneSync
→ /dashboard
```

### Nueva Battle.net

```text
Battle.net
→ onboarding
→ crear username
→ dashboard
```

### Vincular existente

```text
Battle.net
→ onboarding
→ username/password
→ misma cuenta existente
→ dashboard
```

### Settings

```text
Ajustes
→ Battle.net no vinculada
→ vincular
→ BattleTag visible
```

---

# 35. Tests KeystoneClient

Añadir tests frontend + sidecar para:

```text
Continuar con Battle.net
```

Comprobar:

* abre navegador;
* inicia desktop flow;
* estado pending;
* estado ready;
* exchange;
* persiste KeystoneSync JWT;
* llama `/api/me`;
* autenticación completada;
* timeout;
* cancelación;
* server error.

El login username/password existente debe seguir pasando todos sus tests.

---

# 36. No introducir regresiones

Debe continuar funcionando:

```text
registro tradicional
verificación email
login tradicional
forgot password
reset password
sync token
client login
web login
addon sync
teams
KeystoneLoot
Characters
```

No modificar comportamiento no relacionado.

---

# 37. UX de seguridad

No mostrar nunca al usuario:

```text
Battle.net access token
OAuth code
provider_subject
state
PKCE verifier
poll secret
handoff secret
```

Mostrar únicamente:

```text
Battle.net
Speeson#1234
Vinculado
```

---

# 38. Observabilidad

Se pueden registrar eventos seguros como:

```text
battlenet_oauth_started
battlenet_oauth_completed
battlenet_oauth_failed
battlenet_identity_linked
battlenet_identity_unlinked
```

Pero nunca incluir secretos.

Como máximo:

```text
internal user_id
flow intent
error category
```

Evitar BattleTag salvo que sea realmente necesario para diagnóstico.

---

# 39. Fuera de alcance de V1

NO implementar:

```text
wow.profile
importación de personajes Battle.net
verificación de ownership de personajes
mounts
pets
collections
Battle.net account sync
refresh tokens Battle.net
Discord login
Google login
GitHub login
migración global de JWT a cookies
cambio general del sistema de sesiones
```

Todo esto puede hacerse después.

---

# 40. Nota sobre el JWT web actual

Actualmente `keystone-web` conserva:

```text
access_token
```

en `localStorage`.

Battle.net V1 no debe empeorar ni ampliar este comportamiento.

El JWT KeystoneSync nunca debe aparecer en query params OAuth.

Una futura hardening independiente puede estudiar:

```text
HttpOnly Secure SameSite cookies
```

pero NO mezclar esa migración con Battle.net V1.

---

# 41. Battle.net Developer Portal

Antes de probar producción verificar manualmente que la aplicación Battle.net tenga registrado exactamente el callback previsto:

```text
https://api-keystonesync.esgarpe.dev/api/auth/battlenet/callback
```

No modificar el portal automáticamente.

No imprimir el Client Secret.

---

# 42. Orden de implementación

## Fase A — Worker y DB

1. migración `0009`;
2. tipos;
3. nullable password;
4. `user_identities`;
5. `oauth_flows`;
6. helpers Battle.net;
7. PKCE/state;
8. callback;
9. web exchange;
10. onboarding;
11. linking;
12. unlink;
13. desktop flow;
14. tests.

No avanzar al frontend hasta tener Worker verde.

---

## Fase B — Web

1. botón Battle.net;
2. callback;
3. onboarding;
4. create account;
5. link existing;
6. Settings → Cuentas vinculadas;
7. UX errores;
8. Playwright.

---

## Fase C — KeystoneClient

1. botón Battle.net;
2. sidecar start;
3. navegador del sistema;
4. polling;
5. exchange;
6. persistencia sesión actual;
7. estados UX;
8. tests frontend;
9. tests sidecar.

---

## Fase D — Validación integral

Ejecutar todas las suites existentes del repositorio y las nuevas.

No aceptar simplemente los tests nuevos.

Debe permanecer verde el baseline completo de:

```text
Worker
Web
Client frontend
Sidecar
Bridge
Playwright
```

Ejecutar también:

```text
git diff --check
```

---

# 43. Pruebas manuales

Antes de considerar terminada la feature probar:

## Cuenta existente

```text
login username/password
→ settings
→ vincular Battle.net
→ logout
→ login Battle.net
→ misma cuenta
→ mismos personajes
→ mismos teams
```

## Cuenta nueva

```text
Battle.net login
→ no identity
→ crear KeystoneSync username
→ login
→ sync token disponible
```

## Conflicto

```text
Battle.net A
→ user 1

intentar Battle.net A
→ user 2

RECHAZADO
```

## Desktop

```text
KeystoneClient
→ Battle.net
→ navegador
→ autorizar
→ volver al cliente
→ sesión iniciada
```

---

# 44. Deployment

No desplegar automáticamente como parte de la implementación salvo instrucción expresa.

Preparar primero informe de impacto.

Cuando se autorice el despliegue, orden esperado:

```text
1. Verificar secretos/configuración
2. Aplicar migración D1 0009
3. Deploy Worker
4. Smoke OAuth Worker
5. Deploy Web
6. Smoke Web
7. Release KeystoneClient
```

No modificar ni desplegar addon.

No ejecutar migraciones remotas durante desarrollo sin autorización explícita.

---

# 45. Criterios de aceptación

La feature se considera completada únicamente si:

* [ ] login tradicional sigue funcionando;
* [ ] una cuenta existente puede vincular Battle.net;
* [ ] después puede iniciar sesión con Battle.net en la misma cuenta;
* [ ] una Battle.net nueva puede crear KeystoneSync;
* [ ] no se duplican personajes ni teams;
* [ ] una Battle.net no puede estar vinculada a dos usuarios;
* [ ] BattleTag no se utiliza como identidad;
* [ ] solo se solicita `openid`;
* [ ] no se solicita `wow.profile`;
* [ ] PKCE S256 activo;
* [ ] state criptográfico y single-use;
* [ ] callback exacto;
* [ ] access token Battle.net no se persiste;
* [ ] refresh token Battle.net no se persiste;
* [ ] Client Secret no aparece en Web ni Client;
* [ ] JWT KeystoneSync no aparece en URLs;
* [ ] tickets y flows son single-use y expiran;
* [ ] Battle.net-only no puede desvincular su único login;
* [ ] web funciona;
* [ ] KeystoneClient funciona;
* [ ] todos los tests anteriores continúan verdes;
* [ ] nuevos tests OAuth verdes;
* [ ] `git diff --check` verde.

---

# 46. Resultado arquitectónico esperado

```text
                    ┌─────────────────────┐
                    │ KeystoneSync users  │
                    │      user_id        │
                    └──────────┬──────────┘
                               │
               ┌───────────────┴────────────────┐
               │                                │
        password_hash                   user_identities
               │                                │
     username/password                   Battle.net
                                         sub + BattleTag
```

Y durante login:

```text
Battle.net
    │
    │ Authorization Code + PKCE
    ▼
Keystone Worker
    │
    │ access token temporal
    ▼
Battle.net userinfo
    │
    │ sub
    ▼
user_identities
    │
    ▼
users.id
    │
    ▼
KeystoneSync JWT
```

Battle.net autentica.

KeystoneSync sigue controlando su sesión y sus datos.

Ese límite arquitectónico no debe romperse en V1.
