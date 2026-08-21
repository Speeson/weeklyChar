# keystone-web

Panel web del sistema **WoW Keystone Tracker**. Muestra personajes, piedras angulares míticas+, afijos semanales y equipos.

**Producción:** https://keystonesync.esgarpe.dev  
**API:** https://api-keystonesync.esgarpe.dev

---

## Stack

- Next.js (App Router, `'use client'`)
- Tailwind CSS
- Fetch nativo — JWT almacenado en `localStorage`

---

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Vista principal compacta con personajes propios, equipos, afijos, reset y filtro rapido |
| `/login` | Registro e inicio de sesión |
| `/` | Landing publica del proyecto |
| `/characters` | Tabla de personajes propios |
| `/teams` | Crear equipos, unirse por código, listar equipos propios |
| `/teams/[id]` | Detalle de equipo: todos los miembros y sus personajes |
| `/summary` | Resumen semanal: Coins, mazmorras, Great Vault, Prey Hunts y currencies |
| `/settings` | Ajustes de visibilidad de resumen, currencies, personajes, equipos y sincronización |

---

## Funcionalidades

### Dashboard (`/dashboard`)

- **Columna lateral** — afijos semanales, reset semanal, filtro rapido por mazmorra/nivel y resumen de keys disponibles.
- **Mis personajes** — cards compactas con avatar, nombre con color de clase, piedra abreviada y ultima actualizacion.
- **Equipos** — grid compacto de equipos, con miembros agrupados por usuario y cards plegables.
- **Filtro global** — permite buscar por abreviatura (`AA`, `MT`, `PoS`), nombre de mazmorra, personaje o nivel (`+14`).

### Mis personajes (`/characters`)

- **Tabla de personajes ordenable** — clic en cualquier cabecera ordena (asc/desc); columna activa resaltada en amarillo con indicador ↑/↓.
- **Visibilidad de personajes** — botón "Gestionar" para mostrar/ocultar personajes individualmente; estado persistido en `localStorage` (`ks_hidden_chars`).

### Resumen (`/summary`)

- **Sección Coins** — muestra oro/plata/cobre por personaje y el total de la cuenta.
- **Bloques compactables** — Dungeons, Great Vault, Prey Hunts y Currencies se pueden compactar/desplegar.
- **Visibilidad configurable** — desde `/settings` se puede ocultar la sección Coins por ser información sensible.

### Navbar

- Sticky, con logo, enlaces activos ("Mis personajes" / "Equipos") y avatar de perfil.
- Dropdown del avatar: Perfil, Ajustes, Cerrar sesión.
- Username leído de `localStorage`; avatar de la API (`/api/me`).

### Equipos

- Crear un equipo genera un código de invitación (hex 8 chars).
- Otros usuarios se unen pegando el código en `/teams`.
- `/teams` muestra crear/unirse arriba y permite ver los equipos en cuadrícula o lista.
- La vista de detalle del equipo tiene cabecera compacta, código de invitación arriba a la derecha, filtro, botón de volver y modo cuadrícula/lista de cuentas.

---

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

`.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api-keystonesync.esgarpe.dev
```

---

## Despliegue (Vercel)

El proyecto esta documentado como desplegado mediante Vercel. La configuracion exacta de Git Integration vive fuera de este repositorio y no hay un workflow de despliegue versionado aqui.

**Variable de entorno en Vercel:**
```env
NEXT_PUBLIC_API_URL=https://api-keystonesync.esgarpe.dev
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
