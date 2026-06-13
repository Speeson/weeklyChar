# WoW Keystone Tracker

Sistema completo para registrar y sincronizar la **piedra angular mítica+ actual** de personajes de **World of Warcraft Retail**, con soporte multi-usuario, equipos y sincronización automática desde una app de escritorio.

**Web:** https://keystonesync.esgarpe.dev  
**API:** https://weeklychar-production.up.railway.app  
**Swagger:** https://weeklychar-production.up.railway.app/docs  
**Addon (repo independiente):** https://github.com/Speeson/KeystoneSync

---

## Descripción general

```
KeystoneSync (addon WoW)
   ↓ guarda datos en SavedVariables (solo personajes nivel 90)
KeystoneClient (app de escritorio Windows)
   ↓ lee SavedVariables, consulta Raider.IO, sincroniza automáticamente
keystone-api (backend FastAPI)
   ↓ almacena datos por usuario (personajes, piedras, equipos)
keystone-web (panel web Next.js)
   ↑ consulta y muestra la información
```

---

## Componentes

### KeystoneSync — Addon de WoW

Addon de World of Warcraft Retail escrito en Lua. Repo propio con changelog: https://github.com/Speeson/KeystoneSync

**Versión actual:** 0.1.4 — WoW 12.0.5.67602 (Interface `120005`)

- Lee la piedra al iniciar sesión (`PLAYER_LOGIN` inmediato + lectura diferida 5 s).
- Detecta cambios en el inventario con `BAG_UPDATE_DELAYED` (reseteos semanales).
- Guarda el estado final al salir (`PLAYER_LOGOUT`).
- Actualiza al completar míticas+ (`CHALLENGE_MODE_COMPLETED`, lecturas diferidas 5/10/20 s).
- **Ignora personajes por debajo del nivel máximo (90).**
- Resuelve el nombre de la mazmorra via `C_ChallengeMode.GetMapUIInfo`.
- Comando manual: `/ksync`.

**Datos guardados por personaje:**

```lua
KeystoneSyncDB["Realm-Personaje"] = {
    character = "Personaje",
    realm     = "Realm",
    region    = "eu",
    hasKeystone            = true,
    keystoneLevel          = 13,
    keystoneChallengeMapId = 558,
    keystoneMapId          = 2290,
    keystoneDungeon        = "Algeth'ar Academy",
    updatedAt              = 1780000000,
    updatedReason          = "PLAYER_LOGIN_5S",
}
```

**Ubicación del archivo:**
```
World of Warcraft/_retail_/WTF/Account/NOMBRE_CUENTA/SavedVariables/KeystoneSync.lua
```

---

### KeystoneClient — App de escritorio Windows

Aplicación `.exe` de un solo archivo para usuarios no técnicos. Corre en segundo plano en la bandeja del sistema.

**Tecnología:** Python + PyInstaller (`--onefile --windowed`), pystray, tkinter, Pillow

#### UI

La app usa una imagen de fondo (`bg.jpg`) sobre la que se superponen los paneles con efecto translúcido (frosted-glass via Pillow).

**Vista de Login:**
- Mismo tamaño de ventana que la vista principal (calculado desde el aspecto de `bg.jpg`).
- Formulario centrado sobre fondo oscuro.
- Campos usuario/contraseña con borde decorado; botón "Entrar" + botón "Registrarse" (abre la web).
- Sesión válida 30 días (`login_at` en `config.json`).

**Banner superior (permanente):**
- Ícono + título "KeystoneClient" a la izquierda.
- **Pestañas dentro del banner** ("Sincronización" / "Addon") con indicador activo (barra dorada en el borde inferior).
- Avatar de perfil circular (inicial del username hasta que se descargue la imagen real) + botón de usuario con dropdown (idioma ES/EN, cerrar sesión).
- El avatar se empieza a descargar desde `cfg["avatar_url"]` al arrancar; mientras, muestra la inicial del nombre.

**Pestaña Sincronización (tabla ~75% + bloque de sync ~25%):**

La tabla de personajes muestra, de izquierda a derecha:

| Col | Contenido | Ancho |
|-----|-----------|-------|
| Avatar | Foto circular del personaje (Raider.IO) | 34 px |
| Clase | Ícono de clase (zamimg.com CDN, caché en disco) | 22 px |
| Nombre | Nombre con color de clase WoW | dinámico |
| Reino | Nombre del reino | dinámico |
| ilvl | Item level equipado (color verde→naranja) | 46 px |
| Piedra Angular | `+N Nombre completo (ABBR)` — p.ej. `+15 Algeth'ar Academy (AA)` | máximo disponible |
| Raider IO | Puntuación M+ (color verde→azul→morado→rosa→naranja) | ~82 px |

- **Cabeceras clicables** para ordenar por nombre, reino, ilvl, piedra o RIO (ascendente/descendente).
- **Fondo translúcido**: región de `bg.jpg` recortada, desenfocada (GaussianBlur 2) y mezclada al 65% oscuro.
- **Filas alternas**: tinte azulado al 22% sobre el fondo translúcido (sin rectángulos opacos).
- **Separadores de fila**: `#0f1e2d`, casi invisibles.
- Los anchos de Nombre y Reino se miden con `tkfont.Font.measure()` sobre los datos reales y se recalculan al cargar personajes.
- ~50 mazmorras mapeadas con nombre completo + abreviatura (`_DUNGEON_ABBR`), incluyendo TWW S1/S2, Dragonflight, Shadowlands, BfA, Legion y Timewalking.

Gradientes de color:
- **ilvl**: verde (0) → azul (180) → morado (220) → naranja (290+)
- **RIO**: verde (0) → teal (1000) → azul (1500) → morado (2400) → rosa (3500) → naranja (4000)

Bloque de sincronización (derecha):
- Indicador WoW detectado (● verde/rojo).
- Ícono ✓/✗ grande + fecha/hora de la última sync.
- Si hay varias cuentas de WoW seleccionadas, muestra una tarjeta de estado por cuenta con su propia última sincronización.
- Botón "Sincronizar".

**Selección de cuentas WoW:**
- KeystoneClient detecta cuentas en `World of Warcraft/_retail_/WTF/Account/*/SavedVariables/KeystoneSync.lua`.
- Si solo existe una cuenta con datos de KeystoneSync, se selecciona automáticamente y no se muestra ningún selector.
- Si hay varias cuentas con datos y todavía no hay selección guardada, aparece una ventana inicial con el mismo estilo visual del cliente para elegir qué cuentas sincronizar.
- En `Ajustes > Seleccion de cuentas` se puede cambiar la ruta de instalación de WoW, activar o desactivar cuentas detectadas, ver la ruta concreta de cada `SavedVariables`, redetectar cuentas y seleccionar todas.
- El sincronizador solo lee las cuentas seleccionadas. Si hay varias cuentas detectadas pero ninguna seleccionada, no fuerza la sincronización de la primera cuenta para evitar mezclar datos por error.

**Pestaña Addon:**
- Selector de carpeta AddOns + campo de texto con la ruta.
- Botón "Instalar / Actualizar" con barra de progreso animada.

**Footer (permanente):**
- Botón "Acceder a la Web", checkbox "Arrancar con Windows" (winreg), botón "Minimizar a la bandeja".

**System tray:**
- Ícono con menú contextual: "Abrir" (deiconify) y "Salir".
- X de cerrar muestra diálogo informativo en lugar de salir.

**Integración Raider.IO:**

Cada personaje enriquece su perfil consultando la API pública de Raider.IO:
- Avatar (foto de perfil circular recortada).
- Clase WoW (para color de nombre e ícono de clase).
- Puntuación M+ de la temporada actual.
- Item level equipado.

Los íconos de clase se descargan de `https://wow.zamimg.com/images/wow/icons/medium/classicon_{slug}.jpg` y se cachean en `%APPDATA%\KeystoneClient\class_icons\`.

#### Build

```bat
cd keystone-client
build.bat
```

Genera el ejecutable portable en `keystone-client\dist\KeystoneClient.exe`.

#### Instalador Windows

El instalador se genera con Inno Setup. Permite elegir ruta de instalacion, crear acceso directo en el menu Inicio y, opcionalmente, crear acceso directo en el escritorio.

Ruta por defecto:

```text
%ProgramFiles%\KeystoneSync
```

El instalador solicita permisos de administrador para poder instalar en Archivos de programa o en cualquier carpeta protegida del sistema.

La configuracion de usuario se mantiene fuera de la carpeta de instalacion:

```text
%APPDATA%\KeystoneClient
```

Para generar el instalador:

```bat
cd keystone-client
build_installer.bat
```

Salida:

```text
keystone-client\installer\output\KeystoneClientSetup.exe
```

Requisito local: Inno Setup instalado y `iscc.exe` disponible en el `PATH`.

#### Archivos principales

| Archivo | Descripción |
|---------|-------------|
| `main.py` | Punto de entrada, arranca `MainWindow` |
| `main_window.py` | Toda la UI: login, main view, tabla, tabs, avatar |
| `sync_worker.py` | Hilo de polling, parseo Lua, llamadas a Raider.IO y API |
| `config.py` | Carga/guarda `%APPDATA%\KeystoneClient\config.json` |
| `tray_app.py` | System tray con pystray |
| `wow_path.py` | Auto-detección de la ruta WoW en el registro de Windows |
| `addon_installer.py` | Copia el addon a la carpeta AddOns |
| `bg.jpg` | Imagen de fondo de la ventana principal |
| `icon.ico` | Ícono de la app |

---

### keystone-api — Backend

API REST con **FastAPI** y **SQLAlchemy** (SQLite local, PostgreSQL en producción).

**Autenticación:**
- Registro y login con usuario/contraseña (bcrypt + JWT de 30 días).
- Cada usuario tiene un **sync token** único (hex 64 chars) para el sincronizador.
- `get_current_user_flexible`: acepta JWT o sync token indistintamente.

**Endpoints:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Crear cuenta |
| POST | `/api/auth/login` | — | Iniciar sesión → JWT |
| GET | `/api/me` | JWT | Datos del usuario + syncToken |
| GET | `/api/me/characters` | JWT/sync | Personajes con última piedra |
| POST | `/api/me/characters/enrich` | JWT/sync | Actualizar avatar/RIO/clase/ilvl |
| PATCH | `/api/me/avatar` | JWT/sync | Cambiar foto de perfil |
| POST | `/api/keystones/update` | Sync token | Crear/actualizar piedra |
| GET | `/api/teams` | JWT | Listar equipos del usuario |
| POST | `/api/teams` | JWT | Crear equipo |
| POST | `/api/teams/join` | JWT | Unirse por código |
| GET | `/api/teams/{id}` | JWT | Detalle de equipo con miembros |

**Puesta en marcha:**

```bash
cd keystone-api
pip install -r requirements.txt
uvicorn main:app --reload
```

`.env`:
```env
DATABASE_URL=sqlite:///./keystones.db
SECRET_KEY=cambia-esto-en-produccion
ALLOWED_ORIGINS=http://localhost:3000
```

---

### keystone-web — Panel web

Panel web con **Next.js** y **Tailwind CSS**.

**Páginas:** `/login`, `/` (dashboard), `/teams`, `/teams/[id]`

**Funcionalidades:**

- **Navbar sticky** — avatar con dropdown (Perfil, Ajustes, Cerrar sesión), username desde localStorage.
- **Afijos semanales** — API pública Raider.IO EU; íconos en fila, badges de nivel (`5+`/`7+`/`10+`/`12+`), tooltip al hover.
- **Countdown de reset** — cuenta atrás hasta el miércoles 09:00 CEST en tiempo real.
- **Tabla de personajes ordenable** — clic en cabeceras, columna activa amarilla, ↑/↓.
- **Visibilidad de personajes** — toggle individual, persistido en localStorage (`ks_hidden_chars`).
- **Equipos** — crear, unirse por código, ver todos los personajes de todos los miembros.
- **Favicon** personalizado.

**Puesta en marcha:**

```bash
cd keystone-web
npm install
npm run dev
```

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Flujo completo

```
1. El usuario se registra en la web o en KeystoneClient ("Registrarse").
2. Descarga e instala KeystoneClient.exe.
3. Inicia sesión → KeystoneClient instala el addon KeystoneSync en WoW.
4. El usuario entra en WoW con sus personajes de nivel 90.
5. El addon guarda las piedras en SavedVariables al login/logout/bag change.
6. Al minimizar a la bandeja, KeystoneClient empieza a vigilar el archivo.
7. Detecta cambios → consulta Raider.IO (avatar, clase, RIO, ilvl) → envía a la API.
8. La web muestra personajes con foto, clase, ilvl, piedra, puntuación RIO, afijos y countdown.
9. Al completar una mítica+, el addon actualiza SavedVariables → KeystoneClient sincroniza.
```

---

## Despliegue en producción

| Componente | Plataforma | URL |
|------------|------------|-----|
| keystone-web | Vercel | https://keystonesync.esgarpe.dev |
| keystone-api | Railway | https://weeklychar-production.up.railway.app |
| Base de datos | Railway (PostgreSQL) | Mismo proyecto que la API |

**Variables Railway (API):**
```env
DATABASE_URL     →  ${{Postgres.DATABASE_URL}}
SECRET_KEY       →  clave secreta larga
ALLOWED_ORIGINS  →  https://keystonesync.esgarpe.dev,http://localhost:3000
```
Root Directory: `keystone-api` · Target port: `8080`

**Variables Vercel:**
```env
NEXT_PUBLIC_API_URL  →  https://weeklychar-production.up.railway.app
```

---

## Licencia

Este proyecto es **propietario**. El codigo esta publicado para consulta y transparencia del desarrollo, pero **no se concede permiso** para copiar, modificar, redistribuir, revender, republicar, alojar, empaquetar ni crear trabajos derivados sin autorizacion previa por escrito.

Consulta [LICENSE](LICENSE) para los terminos completos.

---

## Estado del proyecto

| Componente | Estado | Notas |
|------------|--------|-------|
| KeystoneSync (addon) | ✅ | v0.1.4, repo propio con CHANGELOG |
| keystone-sync-client | ✅ | Polling cada 2 s, legacy |
| keystone-api | ✅ | JWT, sync token, teams, PostgreSQL |
| keystone-web | ✅ | Navbar, afijos, reset, tabla ordenable, equipos |
| Despliegue producción | ✅ | Railway + Vercel |
| KeystoneClient UI | ✅ | Tabla translúcida, íconos de clase, gradientes RIO/ilvl, dungeon abbrevs |
| Integración Raider.IO | ✅ | Avatar, clase, RIO score, ilvl — cacheados en API y en disco |

## Roadmap

- **Actualizador de addon** — comprobar versión instalada vs. última release en GitHub y actualizar con un clic (lógica en `addon_installer.py` usando `/repos/Speeson/KeystoneSync/releases/latest`).
- **Battle.net OAuth** — login con cuenta de Blizzard.
- **Notificaciones** — alerta cuando un compañero actualiza su piedra.
- **Páginas de Perfil y Ajustes** — enlazadas en el dropdown de la web, sin implementar.

---

## Estructura del repositorio

```
weeklyChar/
├── KeystoneSync/               # Addon WoW (Lua) — también en repo propio
│   ├── KeystoneSync.toc
│   ├── KeystoneSync.lua
│   └── CHANGELOG.md
├── keystone-sync-client/       # Sincronizador externo (Python, legacy)
├── keystone-api/               # Backend REST (FastAPI + PostgreSQL)
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   └── requirements.txt
├── keystone-web/               # Panel web (Next.js + Tailwind)
│   └── app/
│       ├── page.tsx
│       ├── login/page.tsx
│       ├── teams/page.tsx
│       ├── teams/[id]/page.tsx
│       └── components/
│           ├── Navbar.tsx
│           ├── WeeklyAffixes.tsx
│           └── WeeklyReset.tsx
└── keystone-client/            # App de escritorio Windows (.exe)
    ├── main.py
    ├── main_window.py          # UI completa (login, main, tabla, banner)
    ├── sync_worker.py          # Polling + Raider.IO + API sync
    ├── config.py
    ├── tray_app.py
    ├── addon_installer.py
    ├── wow_path.py
    ├── bg.jpg                  # Imagen de fondo de la ventana
    ├── icon.ico
    └── addon/
        └── KeystoneSync/       # Addon empaquetado con el .exe
```
