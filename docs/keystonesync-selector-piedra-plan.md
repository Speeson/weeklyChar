# KeystoneSync — Selector de piedra
## Plan de implementación Web + KeystoneClient

**Fecha:** 2026-08-29
**Repositorio:** `Speeson/weeklyChar`
**Base recomendada:** `main` en `585d266b5057d9d2e3579c0655b7f00f8a5595e6` (`Release KeystoneClient 0.6.4`)
**Feature:** Selector de piedra / Stone Selector
**Superficies afectadas:** Worker, D1, Web, KeystoneClient
**Fuera de alcance en esta iteración:** composición automática / optimizador de grupo

---

# 1. Objetivo de producto

Sustituir la experiencia actual de **Planificar piedra** por un nuevo **Selector de piedra** orientado a responder de forma inmediata:

> “Si hacemos esta mazmorra, ¿qué personajes del equipo quieren objetos ahí, cuántos y de qué prioridad?”

La intención no es que KeystoneSync monte una composición, sino evitar tener que revisar KeystoneLoot personaje por personaje.

Para cualquier mazmorra del pool actual, el usuario debe poder ver:

- qué personajes del Team tienen objetivos pendientes;
- cuántos objetivos tiene cada personaje;
- cuántos son BiS, Must Have, Nice to Have, Catalyst, etc.;
- qué specs están asociadas a esos objetivos;
- los objetos concretos mediante iconos;
- tooltip de cada objeto;
- cuántas piedras reales de esa mazmorra tiene actualmente el equipo.

La misma información debe estar disponible en:

1. la Web;
2. el KeystoneClient mediante una nueva pestaña **Equipos / Teams**.

Ambas superficies deben consumir el mismo contrato del Worker y no duplicar lógica de negocio.

---

# 2. Principios

## 2.1 El Selector informa, no decide

Esta feature **no** debe:

- montar 1 Tank + 1 Healer + 3 DPS;
- elegir composición;
- optimizar Raider.IO;
- usar rendimiento;
- decidir automáticamente la “mejor piedra”;
- puntuar globalmente la party.

Eso queda reservado para la futura pestaña **Planificar piedra**.

---

## 2.2 Mostrar siempre todo el pool

El Selector debe mostrar siempre todas las mazmorras del pool de temporada.

Ejemplo:

```text
[RLP ×2] [TOS ×1] [VSA ×0] [HOA ×1] [...]
```

El contador indica cuántas piedras actuales posee el Team.

Las mazmorras con `×0`:

- siguen visibles;
- siguen siendo seleccionables;
- aparecen visualmente atenuadas.

Esto permite consultar:

> “¿Quién necesita cosas de esta dungeon aunque ahora mismo no tengamos la piedra?”

---

## 2.3 Ocultar personajes sin objetivos

Al seleccionar una mazmorra:

- sólo aparecen personajes con al menos un objetivo relevante;
- los personajes con 0 objetivos no aparecen;
- se ordenan de mayor a menor cantidad de objetivos pendientes.

La pantalla **no** se ordena con los pesos históricos 100/60/25/etc.

---

# 3. Reutilización de KeystoneLoot V2

La implementación debe reutilizar todo lo ya desplegado.

## Worker

Reutilizar:

- validación de snapshots KeystoneLoot;
- autorización por Team;
- comprobación de membresía actual;
- `shareKeystoneLootWithTeams`;
- lógica Voidcore;
- deduplicación;
- metadata Blizzard;
- caché `wow_item_metadata`;
- helpers de tiers;
- pool de temporada centralizado.

Endpoints ya existentes:

```text
GET /api/me/characters/:characterId/keystone-loot/objectives
GET /api/teams/:teamId/characters/:characterId/keystone-loot/objectives
GET /api/teams/:teamId/recommendations
```

El Selector **no** debe hacer una llamada por personaje.

---

## Web

Reutilizar:

- `keystoneLootObjectives.ts`;
- `KeystoneLootObjectiveList` cuando tenga sentido;
- `season2.ts`;
- `wowSpecs.ts`;
- datos actuales de Team;
- privacidad V2;
- estilos/tokens actuales.

La zona visual actual de `KeystonePlanner` es el área principal a reemplazar.

---

## KeystoneClient

Navegación actual:

```text
Sincronización | Addon
```

Objetivo:

```text
Sincronización | Equipos | Addon
```

Actualizar:

```ts
type KeystoneView = "sync" | "teams" | "addon";
```

Mantener arquitectura:

```text
React
  ↓ coreRequest()
Tauri / bridge
  ↓
Python sidecar
  ↓
Worker
```

React no debe recibir ni gestionar directamente el bearer token.

---

# 4. Web — nueva ubicación

Eliminar el botón superior actual:

```text
Planificar piedra
```

Añadir una nueva sección **Selector de piedra** entre:

1. cabecera principal del Team;
2. bloques actuales de miembros/personajes.

Estructura:

```text
┌─────────────────────────────────────────────────────┐
│ Cabecera Team                                       │
└─────────────────────────────────────────────────────┘

SELECTOR DE PIEDRA
[RLP ×2] [TOS ×1] [VSA ×0] [HOA ×1] [...]

┌─────────────────────────────────────────────────────┐
│ [ OBJETIVOS ] [ PLANIFICAR PIEDRA · Próximamente ] ✕│
├─────────────────────────────────────────────────────┤
│ resumen                                             │
│ personajes                                          │
│ grids de objetos                                    │
└─────────────────────────────────────────────────────┘

Bloques actuales del Team...
```

---

# 5. Web — botones de mazmorra

Cada botón debe mostrar:

- nombre corto o abreviatura;
- contador de piedras actuales;
- estado seleccionado;
- estado disponible/no disponible;
- `aria-label` con nombre completo y cantidad.

### Con piedra disponible

- más luminoso;
- borde/acento Poison;
- glow;
- badge de cantidad destacado.

### Sin piedra disponible

- atenuado;
- sigue siendo pulsable;
- sigue siendo accesible por teclado.

El botón seleccionado debe sentirse visualmente conectado al panel desplegado.

---

# 6. Web — panel inline

Al pulsar una dungeon:

- no abrir modal;
- desplegar panel inline justo debajo;
- empujar el contenido del Team hacia abajo;
- cambiar de dungeon debe sustituir el contenido del mismo panel;
- pulsar cerrar colapsa el panel.

No repetir un gran título con el nombre de la dungeon.

El contexto ya lo proporciona el botón seleccionado.

---

# 7. Cabecera del panel

Sólo:

```text
[ OBJETIVOS ] [ PLANIFICAR PIEDRA · Próximamente ]      ✕
```

La pestaña **Planificar piedra**:

- deshabilitada;
- claramente marcada como `Próximamente`;
- no ejecuta el planner antiguo.

---

# 8. Resumen global

Mostrar un resumen compacto:

```text
7 personajes · 23 objetivos
8 BiS · 9 Must · 4 Nice · 2 Catalyst
```

Opcionalmente:

```text
2 piedras disponibles en el equipo
```

No sobrecargar visualmente la parte superior.

---

# 9. Tarjetas de personaje

Ejemplo:

```text
┌────────────────────────────────────────────────────┐
│ (avatar) Bakuhatsu                     7 objetivos │
│          Frost · Speeson                           │
│                                                    │
│ [3 Best in Slot] [2 Must] [2 Catalyst]            │
│                                       Ver objetos ▼│
└────────────────────────────────────────────────────┘
```

Mostrar:

- avatar;
- nombre;
- propietario/miembro;
- spec o specs relevantes;
- total de objetivos;
- contadores por tier.

Usar color de clase sólo donde no comprometa legibilidad.

---

# 10. Orden de personajes

Orden principal:

```text
totalPendingObjectives DESC
```

Desempates:

1. mayor número de BiS;
2. mayor número de Must;
3. nombre del personaje;
4. reino;
5. ID estable.

---

# 11. Varias specs

No pedir que el usuario seleccione la spec antes.

Ejemplo:

```text
Bakuhatsu — 9 objetivos

[Frost · 7] [Arcane · 2]
```

Dentro de la tarjeta se puede alternar entre specs.

El total superior debe evitar duplicar visualmente el mismo objetivo exacto cuando varias specs compartan el mismo item/origen.

---

# 12. Presentación de objetos

No usar una lista vertical larga.

Usar grid visual agrupado por prioridad:

```text
BEST IN SLOT · 3

[icon] [icon] [icon]

MUST HAVE · 2

[icon] [icon]

CATALYST · 2

[icon] [icon]
```

Tile recomendado:

- icono 48–56 px;
- borde del color del tier;
- nombre corto cuando haya espacio;
- estado Voidcore;
- foco de teclado.

Orden de grupos:

1. Best in Slot;
2. Must Have;
3. Nice to Have;
4. Catalyst;
5. Transmog;
6. tiers futuros desconocidos.

---

# 13. Tooltip global de objetos

Crear un componente reutilizable para todos los objetos KeystoneLoot.

Aplicar en:

- Web `Ver objetivos` propio;
- Web `Ver objetivos` Team;
- Web Selector;
- futuro planner;
- KeystoneClient Teams.

Contenido:

```text
Brazales estabilizantes de embalsamador

Muñecas · Tela

Estadísticas
• Intelecto
• Aguante
• Celeridad
• Maestría

Ruby Life Pools
Frost
Best in Slot

Pendiente
```

Mostrar cuando exista:

- nombre;
- icono;
- slot;
- categoría/tipo;
- nombres de estadísticas;
- dungeon;
- spec;
- tier;
- Voidcore.

---

# 14. Estadísticas sin cantidades

En esta iteración **no mostrar cantidades numéricas de stats**.

No mostrar:

```text
+2732 Int
+819 Celeridad
```

Motivo:

- depende del ilvl;
- upgrade track;
- bonus IDs;
- scaling;
- variante exacta del objeto.

Sí mostrar:

```text
Intelecto
Aguante
Celeridad
Maestría
```

No intentar reproducir el tooltip exacto de Wowhead.

---

# 15. Interacción del tooltip

Desktop:

- hover;
- focus de teclado.

Touch/mobile:

- tap/click;
- popover cerrable.

Nunca depender exclusivamente de hover.

---

# 16. Nuevo endpoint agregado del Worker

Añadir un endpoint específico para Selector.

Propuesta:

```text
GET /api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary
```

La nomenclatura puede adaptarse al estilo actual del repo.

No implementar N llamadas a endpoints individuales.

---

# 17. Autorización

Cada petición debe comprobar en vivo:

1. JWT válido;
2. requester pertenece actualmente al Team;
3. sólo se consideran miembros actuales;
4. cada propietario objetivo tiene:
   `shareKeystoneLootWithTeams = true`.

Los cambios de membresía o privacidad deben reflejarse en la siguiente petición.

---

# 18. Privacidad

Nunca exponer:

- snapshot bruto;
- `favorites`;
- `usedItems`;
- `characterKey`;
- bonus IDs;
- gems;
- enchants;
- pesos internos;
- SavedVariables crudos.

Si un usuario desactiva compartir:

- sus personajes desaparecen completamente del Selector para compañeros;
- no mostrar contadores 0;
- no mostrar pistas de información anterior.

---

# 19. Contrato sugerido del Selector

```ts
type KeystoneLootDungeonSummaryDTO = {
  teamId: number;
  challengeMapId: number;

  availability: {
    stoneCount: number;
    stones: Array<{
      characterId: number;
      characterName: string;
      ownerUserId: number;
      ownerUsername: string;
      level: number;
    }>;
  };

  summary: {
    charactersWithObjectives: number;
    totalObjectives: number;
    tiers: {
      bestInSlot: number;
      mustHave: number;
      niceToHave: number;
      catalyst: number;
      transmog: number;
      other: number;
    };
  };

  characters: Array<{
    userId: number;
    username: string;

    characterId: number;
    characterName: string;
    realm: string;
    region: string;
    wowClass: string | null;
    avatarUrl: string | null;
    ilvl: number | null;
    rioScore: number | null;

    totalObjectives: number;

    tierCounts: {
      bestInSlot: number;
      mustHave: number;
      niceToHave: number;
      catalyst: number;
      transmog: number;
      other: number;
    };

    specs: Array<{
      specId: number;
      objectiveCount: number;
      tierCounts: {
        bestInSlot: number;
        mustHave: number;
        niceToHave: number;
        catalyst: number;
        transmog: number;
        other: number;
      };
    }>;

    objectives: KeystoneLootSelectorObjectiveDTO[];
  }>;
};
```

---

# 20. DTO de objeto

```ts
type KeystoneLootSelectorObjectiveDTO = {
  itemId: number;
  itemName: string | null;
  iconUrl: string | null;

  tier: number;
  specIds: number[];

  sourceType: string;
  sourceId: number | string;

  slotId: number | null;
  slotName: string | null;

  itemClassName: string | null;
  itemSubClassName: string | null;

  statNames: string[];

  voidcoreState:
    | "pending"
    | "completed_with_voidcore"
    | "voidcore_not_checked";
};
```

No añadir cantidades de stats.

---

# 21. Extender metadata Blizzard

La tabla actual:

```text
wow_item_metadata
```

ya guarda:

- name;
- icon URL;
- status;
- timestamps.

Añadir migración aditiva:

```text
0005_keystone_loot_item_tooltip_metadata.sql
```

Campos sugeridos:

```text
slot_name
item_class_name
item_subclass_name
stat_names_json
```

Verificar primero la respuesta real de Blizzard Game Data.

Reglas:

- sólo API oficial Blizzard;
- nada de scraping Wowhead;
- nada de llamadas directas desde navegador;
- fallo de metadata nunca oculta objetivos;
- campos opcionales pueden quedar `null`.

---

# 22. Disponibilidad de piedras

Calcular cuántas piedras reales actuales del Team corresponden a `challengeMapId`.

Reutilizar lógica actual de piedra vigente/reset semanal.

No contar:

- piedras históricas;
- piedras inválidas;
- duplicados antiguos.

Una dungeon con `stoneCount = 0` sigue siendo consultable.

---

# 23. Voidcore

Conservar semántica V2.

Recomendación:

```text
totalObjectives = objetivos actualmente accionables
```

Los completados con Voidcore:

- pueden seguir visibles;
- no deben sumar en el contador principal de pendientes;
- deben aparecer claramente marcados.

`voidcore_not_checked` sigue siendo explícito.

---

# 24. KeystoneClient — nueva pestaña Equipos

Navegación:

```text
ES: Sincronización | Equipos | Addon
EN: Sync | Teams | Addon
```

Añadir `"teams"` a `KeystoneView`.

Mantener dimensiones, scaling y estética Poison actuales.

---

# 25. KeystoneClient — selector de Team

Si el usuario pertenece a varios Teams:

```text
Mythiqueros2.0 ▼
```

Permitir cambio sin salir de la pestaña.

Sólo persistir localmente una preferencia de UI inofensiva.

Nunca cachear autorización.

---

# 26. KeystoneClient — dashboard superior

Mostrar resumen compacto de miembros y sus personajes.

Ejemplo:

```text
Speeson
Bakuhatsu · Makabe · Spee

Player2
Paladin · Warrior
```

Usar:

- avatar del miembro;
- avatares de personajes;
- color de clase;
- piedra actual en pequeño si aporta valor.

No replicar todo el dashboard Web.

Debe dejar espacio para el Selector.

---

# 27. KeystoneClient — Selector vertical

Zona izquierda:

```text
💎 RLP   2
💎 TOS   1
   VSA   0
💎 HOA   1
...
```

Mostrar:

- abreviatura;
- icono de piedra;
- cantidad;
- estado seleccionado.

Con piedra:

- iluminado;
- glow Poison;
- contador visible.

Sin piedra:

- atenuado;
- sigue pulsable.

---

# 28. KeystoneClient — panel derecho

Al pulsar una dungeon:

```text
[RLP ×2] ───────────────┐
                        │ [OBJETIVOS] [PLANIFICAR · Próximamente] ✕
                        │
                        │ resumen
                        │ personajes
                        │ objetos
                        └───────────────────────────────────────
```

El botón seleccionado y el panel deben sentirse como una misma pieza visual.

No repetir gran título de dungeon.

---

# 29. Arquitectura Client

No llamar al Worker desde React.

Añadir capacidades bridge similares a:

```text
teams.list
teams.get
teams.keystone_selector
```

Los nombres pueden adaptarse al patrón actual.

### React

Responsable de:

- render;
- selección Team;
- selección dungeon;
- expand/collapse;
- tabs;
- tooltip;
- estados loading/error.

### Core / bridge

Responsable de:

- protocolo;
- comandos;
- tipado;
- routing.

### Python sidecar

Responsable de:

- bearer token;
- HTTP;
- timeouts;
- conectividad;
- API Worker.

---

# 30. Planner actual

Eliminar del flujo principal la UI actual de:

```text
Composición recomendada
```

No conservar una UI confusa sólo por posible reutilización futura.

Mantener helpers únicamente si:

- están bien aislados;
- son útiles para la futura feature.

La nueva pestaña `Planificar piedra` queda como placeholder visual deshabilitado.

---

# 31. UI/UX

Usar criterios sólidos de UI/UX.

Prioridades:

1. Selector inmediatamente escaneable;
2. piedras disponibles obvias;
3. botón seleccionado conectado al panel;
4. resumen entendible sin expandir;
5. jerarquía clara de tiers;
6. iconos como reconocimiento principal;
7. no abusar de texto;
8. evitar espacios vacíos gigantes;
9. teclado completo;
10. Web responsive.

La feature debe sentirse parte del tema Poison, no un dashboard genérico.

---

# 32. Playwright / revisión visual

Usar Playwright durante el desarrollo, no sólo al final.

## Web

Capturar/revisar:

1. Selector cerrado;
2. mezcla de piedras disponibles/no disponibles;
3. dungeon seleccionada;
4. resumen lleno;
5. varias tarjetas;
6. personaje expandido;
7. multi-spec;
8. dungeon sin objetivos;
9. tooltip abierto;
10. Planner deshabilitado;
11. mobile;
12. mobile con objetos expandidos.

## Client

Capturar/revisar:

1. pestaña Teams;
2. Team único;
3. varios Teams;
4. Selector vertical;
5. available/unavailable;
6. dungeon seleccionada;
7. personaje expandido;
8. tooltip;
9. dungeon sin resultados;
10. nombres largos;
11. muchos miembros;
12. coherencia Poison.

No actualizar snapshots ajenos a la feature.

---

# 33. Accesibilidad

Web y Client:

- botones nativos;
- `aria-pressed` para dungeon;
- `aria-expanded` para personaje;
- foco visible;
- tooltip usable por teclado;
- Escape donde corresponda;
- tab order lógico;
- no depender sólo de color;
- hit targets adecuados;
- reduced motion.

La pestaña Planner debe comunicar que no está disponible.

---

# 34. Loading y race conditions

Al cambiar rápido entre dungeons:

- abortar petición anterior;
- mantener selección nueva;
- mostrar skeleton/local loading;
- no bloquear toda la página;
- impedir que una respuesta vieja reemplace una nueva.

Reutilizar patrón `AbortController` + request identity de V2.

---

# 35. Estados de error

Distinguir:

- sesión caducada;
- sin acceso al Team;
- Team eliminado;
- API no disponible;
- respuesta malformada;
- sin objetivos;
- metadata Blizzard no disponible.

Si falla metadata:

```text
Objeto #<itemId>
```

+ icono genérico.

No convertir fallo de metadata en fallo completo.

---

# 36. Tests Worker

Cubrir al menos:

1. same-Team;
2. cross-Team;
3. requester eliminado;
4. target eliminado;
5. sharing disabled;
6. snapshot unsupported;
7. cero favoritos;
8. colisión dungeon/raid;
9. varias specs;
10. deduplicación;
11. Voidcore completed;
12. Voidcore unchecked;
13. tier futuro;
14. stone count;
15. exclusión histórica;
16. dungeon ×0 con objetivos;
17. ordering determinista;
18. muchos objetivos;
19. fallback metadata;
20. caché tooltip.

---

# 37. Tests Web

Cubrir:

- badges;
- contador;
- ordering;
- tier summaries;
- ocultar personajes 0;
- multi-spec;
- expand/collapse;
- tooltip;
- Planner disabled;
- privacidad;
- errores;
- stale response protection.

Build producción obligatorio.

---

# 38. Tests KeystoneClient

Cubrir:

- nueva navegación Teams;
- `teams.list`;
- Team switching;
- selector request;
- auth expiry;
- errors;
- botones verticales;
- summaries;
- grid de items;
- tooltip;
- Planner disabled;
- bridge;
- Python;
- Rust si cambia command surface;
- visual Playwright.

---

# 39. Documentación

Actualizar:

```text
docs/AGENT_CONTEXT.md
docs/ARCHITECTURE.md
docs/DATA_CONTRACT.md
docs/keystone-loot-integration-todo.md
```

Documentar:

- propósito del Selector;
- endpoint agregado;
- Web;
- Client Teams;
- tooltip;
- metadata nueva;
- planner futuro.

Mantener estructura `docs/superpowers/...` si sigue siendo la convención actual.

---

# 40. Impacto esperado

```text
WEB=true
WORKER=true
DB=true
CLIENT_BUILD=true
CLIENT_RELEASE=true
ADDON=false
ADDON_RELEASE=false
```

El addon no debería requerir cambios.

Si aparece una carencia real del contrato del addon:

**STOP** antes de modificar `Speeson/KeystoneSync`.

---

# 41. Fases recomendadas

## S1 — Worker Selector contract

Implementar:

- endpoint;
- auth;
- dungeon filter;
- agregación;
- tier counters;
- stone availability;
- specs;
- Voidcore;
- ordering;
- tests.

---

## S2 — Tooltip metadata

Implementar:

- migración 0005;
- slot;
- class/subclass;
- stat names;
- caché;
- tests;
- fallback.

---

## S3 — Web Selector

Implementar:

- barra horizontal;
- badges;
- panel inline;
- tabs;
- summary;
- cards;
- item grid;
- tooltip;
- quitar botón actual;
- responsive;
- Playwright.

---

## S4 — Client bridge

Implementar:

- comandos Teams;
- sidecar HTTP;
- tipos;
- validación;
- tests.

Sin UI final todavía.

---

## S5 — Client Teams UI

Implementar:

- pestaña Teams;
- team switcher;
- dashboard superior;
- Selector vertical;
- detail panel;
- summaries;
- cards;
- item grids;
- tooltip;
- Planner placeholder;
- Poison styling;
- Playwright.

---

## S6 — E2E / release readiness

Validar:

- Worker;
- D1;
- Web;
- Client;
- privacidad;
- Teams múltiples;
- ×0 dungeon;
- multi-spec;
- Voidcore;
- fallback metadata;
- tooltip;
- race conditions;
- accessibility;
- deploy impact.

Cerrar con GO / NO-GO.

---

# 42. No objetivos

No implementar ahora:

- party builder;
- roles 1/1/3;
- scoring global;
- rendimiento;
- Raider.IO optimizer;
- decisión automática de mejor piedra;
- Battle.net Login;
- stats numéricas;
- upgrade simulation;
- Wowhead scraping;
- llamadas Blizzard desde browser;
- addon changes.

---

# 43. Criterios de aceptación

La feature se considera completa cuando:

1. desaparece el botón superior antiguo `Planificar piedra`;
2. Web muestra todas las dungeons del pool;
3. sus contadores son correctos;
4. dungeon ×0 sigue seleccionable;
5. pulsar abre panel inline;
6. panel header sólo tiene Objetivos / Planner futuro / cerrar;
7. Worker devuelve todos los personajes elegibles;
8. personajes con 0 objetivos no aparecen;
9. orden por cantidad descendente;
10. summaries por tier visibles;
11. objetos en grid;
12. multi-spec sin selector previo obligatorio;
13. tooltip global funciona;
14. tooltip sin cantidades de stats;
15. privacidad same-Team exacta;
16. Client añade Equipos / Teams;
17. dashboard Team visible;
18. Selector Client vertical;
19. Client muestra la misma información funcional;
20. React Client no recibe secretos;
21. tests pasan;
22. Playwright visual review aprobado;
23. no snapshot churn ajeno;
24. docs actualizadas;
25. strict deploy impact sin unknown/outside paths.

---

# 44. Guardrails de implementación

- partir de `origin/main` actualizado;
- crear worktree/branch aislado;
- no push sin autorización;
- no PR sin autorización;
- no merge;
- no deploy;
- no migraciones remotas;
- no releases;
- no bumps manuales;
- changesets pendientes;
- commits por fase tras revisión;
- tests por fase;
- working tree limpio entre fases aprobadas.

---

# 45. Rama sugerida

```text
feature/keystone-stone-selector
```

Base inicial recomendada:

```text
585d266b5057d9d2e3579c0655b7f00f8a5595e6
```

Antes de empezar:

```bash
git fetch origin
```

Si `origin/main` ha avanzado, usar el nuevo HEAD y reportarlo.

---

# 46. Dirección final

La pregunta del producto debe ser:

```text
¿Qué ganamos haciendo esta dungeon?
```

No:

```text
¿Qué cinco personajes me obliga la app a jugar?
```

Flujo deseado:

```text
click dungeon
↓
ver quién necesita loot
↓
ver cuánto
↓
ver prioridad
↓
inspeccionar items
↓
el Team decide
```

La futura pestaña **Planificar piedra** podrá evolucionar más adelante hacia composición/optimización sin mezclar esa complejidad en esta versión.

---

# 47. Extensión aprobada — Planner de piedra exacta en KeystoneClient

Esta extensión, aprobada el 10 de septiembre de 2026, sustituye únicamente el placeholder futuro
descrito en las secciones 2.1, 7, 30 y 42 para KeystoneClient. El Selector de objetivos mantiene su
comportamiento actual y la Web queda fuera de este cambio.

## 47.1 Semántica

**Planificar piedra** no compara todas las piedras de una dungeon. El flujo obligatorio es:

```text
seleccionar dungeon
↓
filtrar chips por nivel mínimo
↓
seleccionar una piedra concreta
↓
marcar miembros disponibles y prioridades
↓
calcular el Top 5 para esa piedra exacta
```

Las cinco recomendaciones deben conservar exactamente el mismo owner character, dungeon y nivel.
Sólo pueden variar assignments, played specs, loot specs, loot, preferencias y utilities.

## 47.2 Contrato Worker

Ampliar de forma aditiva `POST /api/teams/:teamId/keystone-planner` con:

```ts
stoneCharacterId?: number | null
```

Cuando exista:

- `challengeMapId` también es obligatorio;
- debe identificar el personaje owner de una piedra actual, latest y de la semana vigente;
- el owner debe pertenecer a uno de los participantes actuales del Team;
- la piedra debe coincidir con la dungeon seleccionada;
- el adapter entrega sólo esa piedra al solver;
- una selección obsoleta o ya no disponible produce cero piedras elegibles sin filtrar información.

No se añade schema ni migración. Clientes anteriores continúan omitiendo el campo.

## 47.3 Configuración y chips

Mantener una columna lateral de aproximadamente 300 px. La barra se denomina **Nivel mínimo de
piedra** y sólo muestra chips con `stone.level >= minimumStoneLevel`; no participa en el scoring.
El `targetLevel` enviado al contrato existente será el nivel real de la piedra seleccionada.

Cada chip muestra:

- nivel;
- avatar o identidad del personaje owner;
- nombre del personaje;
- estado normal/hover/focus/seleccionado.

Seleccionar un chip:

- lo convierte en la única piedra activa;
- incluye y fija a su usuario propietario entre los participantes;
- impide retirar al owner mientras la piedra siga activa;
- invalida cualquier resultado anterior;
- no calcula automáticamente: el usuario confirma con **Calcular Top 5**.

Si el filtro oculta la piedra activa, se deselecciona y se limpia el resultado con explicación
neutral.

## 47.4 Cinco previews horizontales

El área restante usa cinco tarjetas alargadas de igual tamaño, apiladas verticalmente y ocupando
entre las cinco todo el alto disponible. Cada preview muestra cinco personajes con:

```text
icono de rol | avatar | nombre de personaje
```

No muestra objetos individuales ni explicaciones extensas hasta expandirse.

## 47.5 Acordeón y detalle

Sólo una recomendación puede estar expandida. Al abrirla, las otras cuatro dejan de mostrarse y la
activa ocupa toda la ventana de resultados. El detalle distribuye las tarjetas de assignment como un trapecio:

```text
             [ Tank ] [ Healer ]
        [ DPS 1 ] [ DPS 2 ] [ DPS 3 ]
```

Cada tarjeta de personaje elimina el avatar y muestra, en este orden, icono oficial de role, icono
oficial de clase, icono oficial de played spec, nombre y username. Debajo aparecen los iconos de los
objetivos puntuados, con el mismo tamaño que los iconos de identidad, borde de tier y tooltip Wowhead.
Las métricas de objetivos y preferencias se muestran en la cabecera junto al rank y la puntuación.
Buffos, utilidades y composición se organizan debajo en columnas separadas visualmente, con icono y
texto localizado al castellano o inglés.

## 47.6 Icono de owner

Usar el icono `Crown` como metáfora del icono de leader/grupo de World of Warcraft.

- Preview: corona dorada superpuesta o adyacente al avatar del owner.
- Detalle: corona visible en la tarjeta del owner, sin repetir el texto o nivel de la piedra.
- Accesibilidad: nombre `Dueño de la piedra`; nunca depender sólo del color.
- No usar gema, llave o corona para indicar liderazgo real del Team: en esta superficie significa
  exclusivamente owner de la piedra seleccionada.

## 47.7 Arquitectura Client

Mantener el recorrido:

```text
React → coreRequest → bridge Tauri → sidecar Python → Worker
```

Añadir tipos defensivos, comando sidecar y `TeamsDataSource` para Planner. React no llama al Worker,
no lee bearer tokens y no reconstruye scoring, roles, capabilities ni objectives.

## 47.8 Orden de implementación

1. Worker: request aditivo y filtro exacto por `stoneCharacterId`, con tests.
2. Sidecar/bridge: comando Planner autenticado y tests de sanitización/error.
3. Client core: DTO/parser defensivo, request identity/race protection y previews.
4. Client UI: pestaña, chips, configuración, Top 5, acordeón, corona y estados.
5. Visual: 1672×941 y mínimo 940×529, teclado y reducción de movimiento.
6. Docs, changeset Client, validación completa y Deployment Impact.

## 47.9 Criterios de aceptación

1. No se puede calcular sin seleccionar una piedra concreta.
2. El filtro de nivel sólo afecta a los chips visibles.
3. El owner queda seleccionado y su character es el holder exacto de todos los ranks.
4. Las cinco previews ocupan el ancho disponible y reparten el alto cuando están cerradas.
5. Cada preview prioriza avatar y nombre legible, con icono de rol ampliado y corona en el owner.
6. El detalle usa distribución Tank/Healer sobre tres DPS y muestra utilities debajo.
7. Sólo una recomendación está expandida y ocupa el área completa de resultados.
8. Cero piedras, selección obsoleta, unconfigured, invalid lock y no composition son estados claros.
9. El Worker sigue aceptando requests Web anteriores sin `stoneCharacterId`.
10. No hay schema migration, scoring local, acceso de React al token ni deploy remoto.

## 47.10 Revisión visual de configuración y detalle

La configuración de personajes mantiene una altura fija por personaje. Al activar una
especialización, los selectores de disponibilidad y botín aparecen en una ventana flotante sobre
el contenido y no desplazan ni agrandan la tarjeta. Sólo una especialización puede mantener abierta
esta ventana a la vez.

- Las especializaciones se ordenan siempre como Tank → Healer → DPS.
- Las clases de cuatro especializaciones muestran las cuatro tarjetas en una única fila.
- Las clases de tres especializaciones conservan tres columnas que ocupan todo el ancho.
- El estado Preferido/Disponible/Emergencia/Desactivado y los campos de la ventana flotante usan un
  tamaño de texto mayor.

En el detalle del Top 5, cada personaje muestra únicamente el icono de rol, el icono oficial de la
especialización, nombre, username y, cuando corresponda, la corona del owner. El icono de clase se
elimina. Rol y especialización tienen el mismo tamaño visual; el rol no usa marco negro exterior.

Cada tarjeta muestra hasta cinco objetivos y reserva el sexto espacio para `+` cuando existen seis
o más. El botón abre un desglose flotante de todos los objetos agrupados en BiS, Must, Nice,
Catalyst, Transfiguración y Otros, conservando borde de tier y tooltip Wowhead. El detalle completo
permite scroll vertical cuando el número de buffos, utilidades u objetivos supera el alto disponible.

## 47.11 Legibilidad e integración Wowhead

- El estado `Sin objetivos de botín` usa el mismo tamaño legible que el resto del contenido de la
  tarjeta de personaje.
- Los roles usan la hoja actual de alta resolución de WoW
  `Interface/LFGFRAME/UI-LFG-ICON-ROLES` (256×256), recortando sus celdas de 67×67 para evitar el
  reescalado borroso de la antigua hoja `UI-LFG-ICON-PORTRAITROLES` de 64×64.
- Los objetivos del selector general y los del Planner comparten los tooltips oficiales de
  Wowhead. El selector transmite, cuando existen, `bonus`, `ilvl` y `spec` para representar la
  variante concreta del objeto.

## 47.12 Personajes activos e inactivos

La ventana de configuración divide los personajes propios en dos zonas de arrastre: **Personajes
activos** y **Personajes inactivos**. La tarjeta completa se puede mover entre ambas zonas mediante
arrastre, con acciones equivalentes Activar/Desactivar disponibles para teclado y accesibilidad.

- Un personaje activo debe tener al menos una especialización distinta de `disabled`.
- Mover una tarjeta a Inactivos establece todas sus especializaciones en `disabled`, cierra su
  configuración flotante y oscurece la tarjeta.
- Mover una tarjeta de vuelta a Activos no restaura ni elige ninguna especialización
  automáticamente: todas permanecen desactivadas hasta que el usuario configure al menos una.
- Mientras exista una tarjeta activa sin especialización configurada, **Guardar y planificar**
  permanece deshabilitado.
- Las zonas muestran sus contadores y resaltan el destino durante el arrastre.
- En Windows, la ventana Tauri desactiva su receptor nativo de archivos (`dragDropEnabled: false`)
  para permitir que WebView2 entregue los eventos HTML5 a estas zonas.
- Durante cualquier arrastre la tarjeta se muestra al 50 % de opacidad y con desenfoque sutil; al
  soltarla o cancelar el gesto recupera su aspecto normal.

## 47.13 Pulido final del cliente antes de publicación

Antes del cleanup y la subida de la rama se implementará el diseño aprobado en
`docs/superpowers/specs/2026-09-11-keystoneclient-final-ui-data-polish-design.md`:

- sustituir el menú contextual nativo de WebView por uno temático compacto con Sincronizar ahora,
  Cambiar avatar, Configuración y Minimizar a la bandeja;
- mover el confirmador del avatar seleccionado al extremo derecho de su tarjeta;
- mostrar el rating Mythic+ total en un chip integrado en la cabecera de Mazmorras, con padding y
  límites que impidan que toque o sobresalga del borde;
- enriquecer el equipo con conteos aditivos `tierPieces` obtenidos del campo `tier` que Raider.IO ya
  devuelve por objeto, permitiendo mostrar simultáneamente T35, T36 y tiers futuros.

No se autoriza aún push, release, deploy ni cleanup. Esas acciones se evaluarán después de completar
y validar estas correcciones.
