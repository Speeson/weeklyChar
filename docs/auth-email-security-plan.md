# KeystoneSync Auth + Email Security Plan

## Objetivo

Mejorar el registro y la seguridad de KeystoneSync añadiendo:

- Registro con nombre, apellidos, email, username, password, confirmacion de password y fecha de nacimiento.
- Confirmacion obligatoria del email antes de poder iniciar sesion.
- Recuperacion de password mediante email.
- Pagina web para verificar email.
- Pagina web para solicitar recuperacion de password.
- Pagina web para establecer una nueva password desde un link seguro.

## Configuracion necesaria en Resend

Resend sera el servicio que enviara los emails transaccionales:

- Email de verificacion de cuenta.
- Email de recuperacion de password.

Variables que necesitaremos en Railway para la API:

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=KeystoneSync <noreply@keystonesync.esgarpe.dev>
WEB_BASE_URL=https://keystonesync.esgarpe.dev
```

`RESEND_API_KEY` es secreta. No se debe subir nunca a GitHub.

## Guia Resend para esgarpe.dev

### 1. Crear cuenta

1. Entra en https://resend.com
2. Crea una cuenta o inicia sesion.

### 2. Anadir dominio

1. Ve a `Domains`.
2. Pulsa `Add Domain`.
3. Usa un subdominio para emails, recomendado:

```txt
keystonesync.esgarpe.dev
```

Tambien podrias usar:

```txt
mail.esgarpe.dev
```

Recomendacion actual: `keystonesync.esgarpe.dev`, porque queda claro que esos emails pertenecen al proyecto.

### 3. Configurar DNS

Resend te mostrara varios registros DNS que debes crear donde tengas gestionado el dominio `esgarpe.dev`.

Normalmente seran registros tipo:

- `TXT`
- `MX`
- `CNAME`

Debes copiarlos exactamente.

Ejemplo conceptual:

```txt
Tipo: TXT
Nombre: keystonesync
Valor: resend-verification=...

Tipo: MX
Nombre: keystonesync
Valor: feedback-smtp...

Tipo: CNAME
Nombre: resend._domainkey.keystonesync
Valor: ...
```

No copies este ejemplo literalmente. Usa los valores exactos que te de Resend.

### 4. Esperar verificacion

Despues de crear los DNS:

1. Vuelve a Resend.
2. Pulsa `Verify DNS Records`.
3. Espera hasta que el dominio aparezca como verificado.

Puede tardar desde unos minutos hasta varias horas, dependiendo del proveedor DNS.

### 5. Crear API Key

1. Ve a `API Keys`.
2. Pulsa `Create API Key`.
3. Permiso recomendado: `Sending access`.
4. Si Resend permite limitarla al dominio, selecciona `keystonesync.esgarpe.dev`.
5. Copia la API key.

Solo se muestra una vez.

### 6. Configurar Railway

En el servicio de la API en Railway:

1. Entra en el proyecto.
2. Abre el servicio de `keystone-api`.
3. Ve a `Variables`.
4. Anade:

```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=KeystoneSync <noreply@keystonesync.esgarpe.dev>
WEB_BASE_URL=https://keystonesync.esgarpe.dev
```

5. Redeploy de la API.

## Cambios de backend

### Base de datos

Anadir columnas a `users`:

- `first_name`
- `last_name`
- `email`
- `date_of_birth`
- `email_verified`
- `email_verification_token_hash`
- `email_verification_expires_at`
- `password_reset_token_hash`
- `password_reset_expires_at`

Los tokens deben guardarse hasheados, no en claro.

### Registro

Endpoint actual:

```txt
POST /api/auth/register
```

Nuevo payload:

```json
{
  "firstName": "Nombre",
  "lastName": "Apellidos",
  "email": "usuario@email.com",
  "username": "usuario",
  "password": "password",
  "confirmPassword": "password",
  "dateOfBirth": "YYYY-MM-DD"
}
```

Validaciones:

- `username` obligatorio y unico.
- `email` obligatorio, valido y unico.
- `password` y `confirmPassword` deben coincidir.
- Password minima decente.
- Fecha de nacimiento valida.

Flujo:

1. Crear usuario con `email_verified = false`.
2. Generar token de verificacion.
3. Guardar hash del token y expiracion.
4. Enviar email con link:

```txt
https://keystonesync.esgarpe.dev/verify-email?token=...
```

### Login

Endpoint actual:

```txt
POST /api/auth/login
```

Cambio:

- Si username/password no coinciden: error normal.
- Si el email no esta verificado: devolver `403`.
- Solo devolver JWT si `email_verified = true`.

### Verificar email

Nuevo endpoint:

```txt
POST /api/auth/verify-email
```

Payload:

```json
{
  "token": "..."
}
```

Flujo:

1. Hashear token recibido.
2. Buscar usuario con ese hash.
3. Comprobar expiracion.
4. Marcar `email_verified = true`.
5. Limpiar token y expiracion.

### Solicitar recuperacion de password

Nuevo endpoint:

```txt
POST /api/auth/forgot-password
```

Payload:

```json
{
  "email": "usuario@email.com"
}
```

Flujo:

1. Buscar usuario por email.
2. Generar token si existe.
3. Guardar hash y expiracion.
4. Enviar email con link:

```txt
https://keystonesync.esgarpe.dev/reset-password?token=...
```

Importante: responder siempre con un mensaje generico, exista o no exista el email, para no filtrar cuentas.

### Resetear password

Nuevo endpoint:

```txt
POST /api/auth/reset-password
```

Payload:

```json
{
  "token": "...",
  "password": "nueva-password",
  "confirmPassword": "nueva-password"
}
```

Flujo:

1. Hashear token recibido.
2. Buscar usuario con ese hash.
3. Comprobar expiracion.
4. Validar passwords.
5. Actualizar `password_hash`.
6. Limpiar token y expiracion.

## Cambios web

Actualizar:

- Popup de registro de la landing.
- Pagina `/login`.

Crear:

- `/verify-email`
- `/forgot-password`
- `/reset-password`

Mensajes necesarios:

- Registro creado, revisa tu email.
- Email ya registrado.
- Username ya registrado.
- Passwords no coinciden.
- Email pendiente de verificar.
- Link invalido o caducado.
- Password actualizada correctamente.

## Cambios cliente desktop

El cliente usa el login de la API.

Cambios minimos:

- Mostrar mensaje claro si la API devuelve `403` por email no verificado.
- No hace falta implementar registro completo en el cliente si decidimos que el registro se haga desde web.

## Orden recomendado de implementacion

1. Configurar Resend y verificar dominio.
2. Anadir columnas nuevas a usuarios.
3. Implementar envio de email en API.
4. Cambiar registro para exigir datos nuevos y enviar verificacion.
5. Bloquear login si email no verificado.
6. Crear pagina `/verify-email`.
7. Implementar recuperacion de password.
8. Crear paginas `/forgot-password` y `/reset-password`.
9. Adaptar mensajes del cliente desktop.
10. Probar en local y luego en produccion.

