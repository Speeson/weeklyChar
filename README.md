# WoW Keystone Tracker

Sistema completo para registrar y sincronizar la **piedra angular mítica+ actual** de personajes de **World of Warcraft Retail**, con soporte multi-usuario, equipos y sincronización automática.

---

## Descripción general

El sistema consta de cuatro componentes:

```
KeystoneSync (addon WoW)
   ↓ guarda datos en SavedVariables
KeystoneClient (app de escritorio Windows) [en desarrollo]
   ↓ lee SavedVariables y sincroniza automáticamente
keystone-api (backend FastAPI)
   ↓ almacena datos por usuario
keystone-web (panel web Next.js)
   ↑ consulta y muestra la información
```

Cada usuario crea su cuenta, obtiene su **sync token** personal, configura el sincronizador y ve sus personajes junto con los de su equipo en la web.

---

## Arquitectura del sistema

### KeystoneSync — Addon de WoW

Addon de World of Warcraft Retail escrito en Lua que:

- Lee la piedra actual del personaje al iniciar sesión (`PLAYER_LOGIN`).
- Actualiza la piedra al completar una mítica+ (`CHALLENGE_MODE_COMPLETED`).
- Guarda los datos en `SavedVariables` (archivo local).
- Permite forzar la lectura con `/ksync`.
- Guarda el nombre de la mazmorra (usando `C_ChallengeMode.GetMapUIInfo`).

**Versión actual:** 0.1.0  
**Versión de WoW compatible:** 12.0.5.67602 (Interface: 120005)

**Datos guardados por personaje:**

```lua
KeystoneSyncDB["Realm-Personaje"] = {
    character = "Personaje",
    realm     = "Realm",
    region    = "eu",
    hasKeystone              = true,
    keystoneLevel            = 13,
    keystoneChallengeMapId   = 558,
    keystoneMapId            = 2290,
    keystoneDungeon          = "Magisters' Terrace",
    updatedAt                = 1780000000,
    updatedReason            = "PLAYER_LOGIN",
}
```

**Ubicación del archivo:**

```
World of Warcraft/_retail_/WTF/Account/NOMBRE_CUENTA/SavedVariables/KeystoneSync.lua
```

---

### keystone-sync-client — Sincronizador externo

Script Python que observa el archivo de SavedVariables y envía los cambios a la API automáticamente.

- Usa **polling** (comprueba cambios cada 2 segundos) en lugar de watchdog, ya que WoW no escribe el archivo de forma estándar en Windows.
- Parsea el formato Lua con la librería `slpp`.
- Autentica con el **sync token** del usuario (no con usuario/contraseña).
- Modo continuo: se queda escuchando indefinidamente.

**Configuración (`.env`):**

```env
KEYSTONE_SAVED_VARIABLES_PATH=C:/Program Files (x86)/World of Warcraft/_retail_/WTF/Account/NOMBRE_CUENTA/SavedVariables/KeystoneSync.lua
API_BASE_URL=http://localhost:8000
SYNC_TOKEN=pega-aqui-tu-sync-token
```

**Ejecución:**

```bash
python sync.py
```

> El sync token se obtiene en la web tras registrarse.

---

### keystone-api — Backend

API REST construida con **FastAPI** y **SQLAlchemy** (SQLite en local, PostgreSQL en producción).

**Autenticación:**

- Registro y login con usuario/contraseña (bcrypt + JWT de 30 días).
- Cada usuario tiene un **sync token** único (hex de 64 caracteres) para autenticar el sincronizador.

**Endpoints principales:**

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Crear cuenta |
| POST | `/api/auth/login` | — | Iniciar sesión |
| GET | `/api/me` | JWT | Datos del usuario y sync token |
| GET | `/api/me/characters` | JWT | Personajes propios |
| POST | `/api/keystones/update` | Sync token | Actualizar piedra desde el sincronizador |
| GET | `/api/teams` | JWT | Listar equipos propios |
| POST | `/api/teams` | JWT | Crear equipo |
| POST | `/api/teams/join` | JWT | Unirse a un equipo por código |
| GET | `/api/teams/{id}` | JWT | Detalle del equipo con personajes de todos los miembros |

**Modelos de base de datos:**

- `User` — cuenta de usuario con sync token único.
- `Character` — personaje vinculado a un usuario (nombre + realm + región).
- `Keystone` — registro de piedra por personaje (historial, se muestra el último).
- `Team` — equipo con código de invitación.
- `TeamMember` — relación usuario ↔ equipo.

**Stack:**

```text
FastAPI + Uvicorn
SQLAlchemy (SQLite local / PostgreSQL producción)
python-jose (JWT)
bcrypt (hash de contraseñas)
python-dotenv
```

**Puesta en marcha:**

```bash
cd keystone-api
pip install -r requirements.txt
uvicorn main:app --reload
```

Configuración (`.env`):

```env
DATABASE_URL=sqlite:///./keystones.db
SECRET_KEY=cambia-esto-en-produccion
```

---

### keystone-web — Panel web

Panel web construido con **Next.js 16** y **Tailwind CSS**.

**Páginas:**

- `/login` — registro e inicio de sesión.
- `/` — dashboard con personajes propios y sync token (mostrar/ocultar/copiar).
- `/teams` — crear equipos, unirse por código de invitación, listar equipos.
- `/teams/[id]` — detalle de equipo: miembros y todos sus personajes en una tabla.

**Stack:**

```text
Next.js 16 (App Router)
Tailwind CSS
Fetch nativo (JWT en localStorage)
```

**Puesta en marcha:**

```bash
cd keystone-web
npm install
npm run dev
```

Configuración (`.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Flujo completo actual

```
1. El usuario se registra en la web y obtiene su sync token.
2. Pega el sync token en el .env del sincronizador.
3. Instala el addon KeystoneSync en WoW.
4. Inicia sesión en WoW — el addon guarda la piedra en SavedVariables.
5. Ejecuta el sincronizador (python sync.py).
6. El sincronizador detecta el archivo y envía los datos a la API.
7. La web muestra los personajes y sus piedras actuales.
8. Al completar una mítica+, el addon actualiza SavedVariables automáticamente.
9. El sincronizador detecta el cambio y reenvía los datos.
10. La web refleja la nueva piedra al recargar.
```

---

## Sistema de equipos

Los usuarios pueden crear equipos o unirse a equipos mediante un **código de invitación**.

- El creador del equipo obtiene un código de invitación (hex de 8 caracteres).
- Otros usuarios se unen pegando ese código en la web.
- La vista de equipo muestra todos los personajes de todos los miembros en una sola tabla.
- Cada usuario gestiona sus propios personajes de forma independiente.

Esto permite que amigos con distintas cuentas de WoW compartan su información de piedras sin acceder a los datos del otro.

---

## KeystoneClient — App de escritorio (en desarrollo)

Para usuarios no técnicos que no pueden o no quieren ejecutar scripts Python manualmente.

**KeystoneClient** será una aplicación de escritorio Windows (`.exe`) que:

- Se instala una sola vez.
- Corre en segundo plano en la barra de tareas (system tray).
- Solicita usuario y contraseña al primer arranque (login único).
- Detecta automáticamente la carpeta de WoW y el archivo de SavedVariables.
- Sincroniza los datos con la API sin necesidad de terminal ni configuración manual.
- Muestra la versión actual del addon instalado.
- Permite descargar e instalar actualizaciones del addon directamente desde GitHub Releases con un clic.

**Tecnología prevista:** Python + PyInstaller (`.exe`), sistema tray con `pystray`, UI mínima con `tkinter` o similar.

**Flujo de actualización del addon:**

```
KeystoneClient comprueba la última release en GitHub
   ↓ compara con la versión instalada
Si hay actualización disponible → botón "Actualizar"
   ↓ descarga el .zip de la release
   ↓ extrae los archivos
   ↓ sobreescribe la carpeta del addon en WoW
   ↓ muestra confirmación
```

---

## Despliegue en producción

**Plan recomendado:**

| Componente | Plataforma | Coste |
|------------|-----------|-------|
| keystone-web | Vercel | Gratuito |
| keystone-api | Railway | Tier gratuito disponible |
| Base de datos | Railway (PostgreSQL) | Incluido con la API |

**Pasos generales:**

1. Subir `keystone-api` a Railway con la variable `DATABASE_URL` apuntando a PostgreSQL.
2. Subir `keystone-web` a Vercel con `NEXT_PUBLIC_API_URL` apuntando a la URL de Railway.
3. Actualizar `allow_origins` en la API con el dominio de producción de Vercel.

La API y la web funcionan correctamente con estas plataformas sin cambios de código adicionales (solo cambiar de SQLite a PostgreSQL en la variable de entorno).

---

## Estado actual del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| Addon KeystoneSync | Completado | Lee y guarda piedras, incluye nombre de mazmorra |
| Sincronizador Python | Completado | Modo watch por polling, auth con sync token |
| Backend FastAPI | Completado | Multi-usuario, JWT, sync tokens, teams |
| Panel web Next.js | Completado | Dashboard, equipos, tabla de personajes |
| KeystoneClient (.exe) | En diseño | App de escritorio para usuarios no técnicos |
| Despliegue producción | Pendiente | Vercel + Railway |

---

## Roadmap futuro

- **KeystoneClient v1:** Ejecutable Windows con system tray, login, sincronización automática y actualizador de addon.
- **Battle.net OAuth:** Login con cuenta de Blizzard en lugar de usuario/contraseña propio.
- **PostgreSQL en producción:** Migración desde SQLite al desplegar.
- **Raider.IO:** Mostrar score y mejores runs de cada personaje.
- **Blizzard API:** Item level, clase, avatar del personaje.
- **Notificaciones:** Alerta en la web o Discord cuando un compañero actualiza su piedra.

---

## Estructura del repositorio

```
weeklyChar/
├── KeystoneSync/               # Addon de WoW (Lua)
│   ├── KeystoneSync.toc
│   └── KeystoneSync.lua
├── keystone-sync-client/       # Sincronizador externo (Python)
│   ├── sync.py
│   ├── requirements.txt
│   └── .env.example
├── keystone-api/               # Backend REST (FastAPI)
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── requirements.txt
│   └── .env.example
└── keystone-web/               # Panel web (Next.js)
    ├── app/
    │   ├── page.tsx            # Dashboard
    │   ├── login/page.tsx
    │   └── teams/
    │       ├── page.tsx
    │       └── [id]/page.tsx
    └── lib/
        └── auth.ts
```
