# keystone-web

Panel web del sistema **WoW Keystone Tracker**. Muestra personajes, piedras angulares míticas+, afijos semanales y equipos.

**Producción:** https://keystonesync.esgarpe.dev  
**API:** https://weeklychar-production.up.railway.app

---

## Stack

- Next.js (App Router, `'use client'`)
- Tailwind CSS
- Fetch nativo — JWT almacenado en `localStorage`

---

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/login` | Registro e inicio de sesión |
| `/` | Dashboard: personajes, afijos, countdown de reset |
| `/teams` | Crear equipos, unirse por código, listar equipos propios |
| `/teams/[id]` | Detalle de equipo: todos los miembros y sus personajes |
| `/summary` | Resumen semanal: oro, mazmorras, Great Vault, Prey Hunts y currencies |
| `/settings` | Ajustes de visibilidad de resumen, currencies, personajes, equipos y sincronización |

---

## Funcionalidades

### Dashboard (`/`)

- **Tabla de personajes ordenable** — clic en cualquier cabecera ordena (asc/desc); columna activa resaltada en amarillo con indicador ↑/↓.
- **Visibilidad de personajes** — botón "Gestionar" para mostrar/ocultar personajes individualmente; estado persistido en `localStorage` (`ks_hidden_chars`).
- **Afijos semanales** — obtiene los afijos EU actuales de la API pública de Raider.IO (`/api/v1/mythic-plus/affixes?region=eu`); muestra íconos en fila horizontal con badges de nivel (`5+` / `7+` / `10+` / `12+`) y tooltip CSS al hover (nombre + descripción).
- **Countdown de reset semanal** — cuenta atrás en tiempo real hasta el miércoles 09:00 CEST.

### Resumen (`/summary`)

- **Sección Oro** — muestra oro/plata/cobre por personaje y el total de la cuenta.
- **Bloques compactables** — Dungeons, Great Vault, Prey Hunts y Currencies se pueden compactar/desplegar.
- **Visibilidad configurable** — desde `/settings` se puede ocultar la sección de oro por ser información sensible.

### Navbar

- Sticky, con logo, enlaces activos ("Mis personajes" / "Equipos") y avatar de perfil.
- Dropdown del avatar: Perfil, Ajustes, Cerrar sesión.
- Username leído de `localStorage`; avatar de la API (`/api/me`).

### Equipos

- Crear un equipo genera un código de invitación (hex 8 chars).
- Otros usuarios se unen pegando el código en `/teams`.
- La vista de equipo muestra todos los personajes de todos los miembros en una tabla ordenable.

---

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Despliegue (Vercel)

El proyecto se despliega automáticamente desde la rama `main` del monorepo.

**Variable de entorno en Vercel:**
```env
NEXT_PUBLIC_API_URL=https://weeklychar-production.up.railway.app
```

---

## Estructura

```
keystone-web/
└── app/
    ├── layout.tsx
    ├── page.tsx                # Dashboard principal
    ├── favicon.ico
    ├── globals.css
    ├── login/
    │   └── page.tsx
    ├── teams/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    └── components/
        ├── Navbar.tsx
        ├── WeeklyAffixes.tsx   # Afijos Raider.IO
        └── WeeklyReset.tsx     # Countdown hasta el reset
```
