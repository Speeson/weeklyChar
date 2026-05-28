# WoW Keystone Tracker

Sistema completo para registrar y sincronizar la **piedra angular mítica+ actual** de personajes de **World of Warcraft Retail**, con soporte multi-usuario, equipos y sincronización automática desde una app de escritorio.

**Web:** https://weekly-char.vercel.app  
**API:** https://weeklychar-production.up.railway.app  
**Swagger:** https://weeklychar-production.up.railway.app/docs  
**Addon (repo independiente):** https://github.com/Speeson/KeystoneSync

---

## Descripción general

El sistema consta de cuatro componentes principales:

```
KeystoneSync (addon WoW)
   ↓ guarda datos en SavedVariables (solo personajes nivel 90)
KeystoneClient (app de escritorio Windows)
   ↓ lee SavedVariables, sincroniza automáticamente en segundo plano
keystone-api (backend FastAPI)
   ↓ almacena datos por usuario
keystone-web (panel web Next.js)
   ↑ consulta y muestra la información
```

---

## Arquitectura del sistema

### KeystoneSync — Addon de WoW

Addon de World of Warcraft Retail escrito en Lua. Tiene su propio repositorio con changelog de versiones en https://github.com/Speeson/KeystoneSync.

**Versión actual:** 0.1.4  
**WoW compatible:** 12.0.5.67602 (Interface: 120005)

**Funcionalidad:**

- Lee la piedra actual al iniciar sesión (`PLAYER_LOGIN` inmediato + lectura diferida 5 s).
- Detecta cambios en el inventario con `BAG_UPDATE_DELAYED` (reseteos semanales).
- Guarda el estado final al salir (`PLAYER_LOGOUT`).
- Actualiza la piedra al completar míticas+ (`CHALLENGE_MODE_COMPLETED` con lecturas diferidas).
- **Ignora personajes por debajo del nivel máximo (90)** — evita contaminar la base de datos con alts bajos.
- Resuelve el nombre de la mazmorra via `C_ChallengeMode.GetMapUIInfo`.
- Comando manual: `/ksync`.

**Historial de versiones:**

| Versión | Cambio |
|---------|--------|
| 0.1.4 | Filtro `MAX_LEVEL = 90` — ignora personajes de nivel bajo |
| 0.1.3 | Lectura final en `PLAYER_LOGOUT` |
| 0.1.2 | Evento `BAG_UPDATE_DELAYED` para detectar reseteo semanal |
| 0.1.1 | Lectura diferida 5 s en `PLAYER_LOGIN` |
| 0.1.0 | Versión inicial |

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
    keystoneDungeon        = "Magisters' Terrace",
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

Aplicación `.exe` para usuarios no técnicos. Se instala una sola vez y corre en segundo plano.

**Tecnología:** Python + PyInstaller, pystray (system tray), tkinter (UI)

**Funcionalidad:**

- **Login** — pantalla de inicio de sesión con campos de usuario/contraseña y botón "Registrarse" (abre la web). Sesión válida 30 días.
- **Vista principal** — header con `@username` y botón de cerrar sesión, indicador de WoW detectado (●), estado de última sincronización.
- **Panel de addon** — colapsable, muestra la ruta de la carpeta AddOns, barra de progreso (gris → verde al completar), botón instalar/actualizar.
- **Barra inferior** — botón "Abrir web", checkbox "Arrancar con Windows" (registro en winreg), botón "Minimizar a la bandeja".
- **System tray** — ícono con menú contextual; clic en el ícono o "Abrir" en el menú devuelve la ventana.
- **X de cerrar** — muestra diálogo informativo ("Minimizado a la bandeja") en lugar de cerrar la app.
- **Sincronización automática** — mismo algoritmo de polling que `keystone-sync-client`, se activa al minimizar a la bandeja.
- **Ícono personalizado** — `icon.ico` embebido en el `.exe` y en la ventana tkinter.

**Build:**

```bash
cd keystone-client
python -m PyInstaller --onefile --windowed --name KeystoneClient \
  --add-data "addon;addon" --add-data "icon.ico;." --icon=icon.ico main.py
```

---

### keystone-api — Backend

API REST construida con **FastAPI** y **SQLAlchemy** (SQLite en local, PostgreSQL en producción).

**Autenticación:**

- Registro y login con usuario/contraseña (bcrypt + JWT de 30 días).
- Cada usuario tiene un **sync token** único (hex de 64 caracteres) para el sincronizador.

**Endpoints principales:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Crear cuenta |
| POST | `/api/auth/login` | — | Iniciar sesión |
| GET | `/api/me` | JWT | Datos del usuario |
| GET | `/api/me/characters` | JWT | Personajes propios |
| POST | `/api/keystones/update` | Sync token | Actualizar piedra |
| GET | `/api/teams` | JWT | Listar equipos propios |
| POST | `/api/teams` | JWT | Crear equipo |
| POST | `/api/teams/join` | JWT | Unirse por código |
| GET | `/api/teams/{id}` | JWT | Detalle del equipo |

**Stack:**

```text
FastAPI + Uvicorn
SQLAlchemy (SQLite local / PostgreSQL producción)
python-jose (JWT)
bcrypt
python-dotenv
```

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
```

---

### keystone-web — Panel web

Panel web construido con **Next.js 16** y **Tailwind CSS**.

**Páginas:**

- `/login` — registro e inicio de sesión.
- `/` — dashboard principal.
- `/teams` — crear equipos, unirse por código, listar equipos.
- `/teams/[id]` — detalle de equipo: miembros y todos sus personajes.

**Funcionalidades del dashboard:**

- **Navbar sticky** — logo, enlaces activos ("Mis personajes" / "Equipos"), avatar de perfil con dropdown (Perfil, Ajustes, Cerrar sesión).
- **Afijos semanales** — obtiene los afijos EU actuales de la API de Raider.IO; muestra solo iconos en fila horizontal con badges de nivel (`5+` / `7+` / `10+` / `12+`) y tooltip al hover (nombre + descripción).
- **Countdown de reset semanal** — tarjeta con cuenta atrás en tiempo real hasta el miércoles 09:00 CEST.
- **Tabla de personajes ordenable** — clic en cualquier cabecera ordena por esa columna (asc/desc), columna activa resaltada en amarillo.
- **Gestión de visibilidad** — botón "Gestionar" para mostrar/ocultar personajes individualmente; estado persistido en localStorage.
- **Favicon** — ícono personalizado en la pestaña del navegador.

**Stack:**

```text
Next.js 16 (App Router, 'use client')
Tailwind CSS
Fetch nativo (JWT en localStorage)
```

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

## Flujo completo actual

```
1. El usuario se registra en la web o en KeystoneClient (botón "Registrarse").
2. Descarga e instala KeystoneClient.
3. Inicia sesión en KeystoneClient con usuario/contraseña.
4. KeystoneClient instala el addon KeystoneSync en WoW automáticamente.
5. El usuario inicia sesión en WoW con sus personajes de nivel 90.
6. El addon guarda las piedras en SavedVariables (automáticamente al login/logout/bag change).
7. KeystoneClient detecta los cambios y los envía a la API en segundo plano.
8. La web muestra los personajes, piedras, afijos de la semana y countdown del reset.
9. Al completar una mítica+, el addon actualiza SavedVariables y KeystoneClient lo sincroniza.
```

---

## Sistema de equipos

- El creador del equipo obtiene un código de invitación (hex de 8 caracteres).
- Otros usuarios se unen pegando ese código en la web (`/teams`).
- La vista de equipo muestra todos los personajes de todos los miembros en una sola tabla ordenable.

---

## Despliegue en producción

| Componente | Plataforma | URL |
|------------|-----------|-----|
| keystone-web | Vercel | https://weekly-char.vercel.app |
| keystone-api | Railway | https://weeklychar-production.up.railway.app |
| Base de datos | Railway (PostgreSQL) | Mismo proyecto que la API |

**Variables Railway (API):**

```env
DATABASE_URL     →  ${{Postgres.DATABASE_URL}}
SECRET_KEY       →  clave secreta larga
ALLOWED_ORIGINS  →  https://weekly-char.vercel.app,http://localhost:3000
```

- Root Directory: `keystone-api`
- Target port: `8080`

**Variables Vercel:**

```env
NEXT_PUBLIC_API_URL  →  https://weeklychar-production.up.railway.app
```

---

## Estado actual del proyecto

| Componente | Estado | Notas |
|------------|--------|-------|
| KeystoneSync (addon) | ✅ Completado | v0.1.4, repo propio con CHANGELOG |
| keystone-sync-client | ✅ Completado | Polling cada 2 s, auth con sync token |
| keystone-api | ✅ Completado | Multi-usuario, JWT, teams, PostgreSQL |
| keystone-web | ✅ Completado | Navbar, afijos, reset, tabla ordenable |
| Despliegue producción | ✅ Completado | Railway + Vercel |
| KeystoneClient (.exe) | ✅ Completado | System tray, login, sync, addon installer |

---

## Roadmap futuro

- **Actualizador de addon en KeystoneClient** — comprobar versión instalada vs. última release en GitHub y actualizar con un clic.
- **Battle.net OAuth** — login con cuenta de Blizzard.
- **Raider.IO score** — mostrar puntuación M+ junto al nombre del personaje.
- **Blizzard API** — item level, clase, avatar del personaje.
- **Notificaciones** — alerta cuando un compañero actualiza su piedra.
- **Páginas de Perfil y Ajustes** — actualmente enlazadas en el dropdown pero sin implementar.

---

## Estructura del repositorio

```
weeklyChar/
├── KeystoneSync/               # Addon de WoW (Lua) — también en repo propio
│   ├── KeystoneSync.toc
│   ├── KeystoneSync.lua
│   └── CHANGELOG.md
├── keystone-sync-client/       # Sincronizador externo (Python, legacy)
│   ├── sync.py
│   ├── requirements.txt
│   └── .env.example
├── keystone-api/               # Backend REST (FastAPI)
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── requirements.txt
│   └── .env.example
├── keystone-web/               # Panel web (Next.js 16)
│   ├── app/
│   │   ├── page.tsx            # Dashboard (personajes, afijos, reset)
│   │   ├── login/page.tsx
│   │   ├── teams/page.tsx
│   │   ├── teams/[id]/page.tsx
│   │   ├── favicon.ico
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── WeeklyAffixes.tsx
│   │       └── WeeklyReset.tsx
│   └── lib/auth.ts
└── keystone-client/            # App de escritorio Windows (.exe)
    ├── main.py
    ├── main_window.py
    ├── tray_app.py
    ├── sync_worker.py
    ├── config.py
    ├── addon_installer.py
    ├── wow_path.py
    ├── icon.ico
    └── addon/
        └── KeystoneSync/       # Addon empaquetado con el .exe
```
