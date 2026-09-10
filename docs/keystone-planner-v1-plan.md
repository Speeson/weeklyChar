# Keystone Planner V1

## 1. Objetivo

Implementar sobre el actual Selector de piedra de KeystoneSync un planificador capaz de recomendar las mejores piedras y composiciones de grupo en función de:

1. Composición válida de Mythic+: exactamente **1 Tank + 1 Healer + 3 DPS**.
2. Objetivos KeystoneLoot pendientes de los jugadores.
3. Personajes y especializaciones que cada usuario realmente está dispuesto a jugar.
4. Nivel objetivo de piedra.
5. Preferencias de personaje/spec.
6. Utilidades opcionales de composición:
   - Heroísmo / Bloodlust.
   - Battle Resurrection.
   - Buffs principales de clase.
   - Chaos Brand.
   - Mystic Touch.
   - Sinergia física/mágica.
7. Grupos incompletos de 2, 3 o 4 jugadores.
8. Top 3 de recomendaciones acompañado de una explicación determinista.

La composición 1/1/3 es la única condición que prevalece sobre el loot.

Una vez garantizada una composición válida o completable mediante PUGs:

**Loot/BiS > nivel de piedra > preferencias de personaje/spec > optimización secundaria de composición.**

Las utilities nunca deben provocar que una piedra claramente peor para los objetivos KeystoneLoot supere a una mejor solamente por disponer de más buffs.

---

# 2. Alcance técnico de V1

Componentes afectados:

- `keystone-worker`
- `keystone-web`
- Cloudflare D1

No modificar:

- Addon `Speeson/KeystoneSync`.
- SavedVariables.
- KeystoneClient, salvo que posteriormente se quiera replicar el planner allí.

El Worker debe contener toda la lógica de planificación.

La Web solamente:

- configura preferencias;
- selecciona participantes/opciones;
- envía la petición;
- representa el resultado.

No implementar el algoritmo en React.

Esto permitirá reutilizar exactamente el mismo planner desde KeystoneClient en el futuro.

---

# 3. Preferencias de juego por personaje

Crear una migración nueva posterior a `0009_battlenet_auth.sql`, previsiblemente:

`0010_keystone_planner.sql`

Crear una tabla equivalente a:

`character_play_preferences`

Campos conceptuales:

- `character_id`
- `spec_id`
- `play_preference`
- `loot_spec_id`
- `updated_at`

PK:

`(character_id, spec_id)`

`play_preference` solamente puede contener:

- `preferred`
- `available`
- `emergency`
- `disabled`

Significado:

**preferred**
El usuario desea jugar esa spec siempre que sea razonablemente posible.

**available**
La juega normalmente.

**emergency**
Puede jugarla, pero solo debería utilizarse cuando facilite una composición que de otro modo no sería posible o cuando las alternativas sean peores.

**disabled**
El planner jamás puede asignarla.

Ejemplo:

Paladin:

- Retribution → preferred
- Protection → available
- Holy → disabled

Druid:

- Balance → preferred
- Guardian → emergency
- Restoration → disabled

---

# 4. Separar spec jugada y spec de loot

Cada configuración de spec debe permitir elegir opcionalmente:

`lootSpecId`

Por defecto:

`lootSpecId = specId`

Pero debe permitirse:

Protection Paladin → jugar Protection → buscar objetivos de Retribution.

Esto es necesario porque KeystoneLoot almacena objetivos por especialización y WoW permite jugar una spec mientras se busca equipo para otra.

El planner puntuará exclusivamente los objetivos que correspondan al `lootSpecId` seleccionado para esa asignación.

---

# 5. No inferir automáticamente las specs jugables

Un Paladin no debe convertirse automáticamente en candidato:

- Tank
- Heal
- DPS

solo porque su clase pueda hacerlo.

Un personaje sin preferencias configuradas debe aparecer como:

**Configuración pendiente**

y no debe ser asignado arbitrariamente por el solver.

La interfaz debe facilitar completar esta configuración antes de utilizarlo en el planner.

---

# 6. Catálogo de especializaciones

Crear en Worker un módulo dedicado, por ejemplo:

`src/wowComposition.ts`

Debe ser la fuente de verdad del solver para:

- specId
- clase
- rol
- perfil de daño
- capabilities/utilities

Ejemplo conceptual:

`specId → role`

con:

- `tank`
- `healer`
- `dps`

No almacenar el rol en D1: debe derivarse del `specId`, evitando estados inconsistentes.

---

# 7. Perfil físico/mágico

NO utilizar porcentajes inventados como:

`55% físico / 45% mágico`.

V1 utilizará únicamente:

- `physical`
- `magical`

para DPS.

La clasificación debe basarse en el perfil de daño dominante de la spec y verificarse con información actual de Midnight.

No adivinar valores.

Si durante la implementación alguna spec no puede clasificarse con suficiente seguridad, debe dejarse explícitamente sin puntuación de afinidad hasta verificarla, en lugar de inventarla.

El perfil general del grupo puede mostrarse como:

- Predominantemente físico.
- Predominantemente mágico.
- Mixto.

según los tres DPS seleccionados.

Tank y Healer no deberían determinar la clasificación principal del grupo en V1.

---

# 8. Sistema de capabilities

No introducir reglas dispersas como:

`if class === "Mage"`.

Crear un catálogo de capabilities.

Como mínimo V1 debe soportar:

- `BLOODLUST`
- `BATTLE_REZ`
- `CHAOS_BRAND`
- `MYSTIC_TOUCH`
- `MARK_OF_THE_WILD`
- `ARCANE_INTELLECT`
- `BATTLE_SHOUT`
- `POWER_WORD_FORTITUDE`
- `SKYFURY`
- otros buffs principales actuales que se verifiquen durante la implementación.

El catálogo debe poder ampliarse posteriormente sin modificar el solver.

Cada capability debe contener como mínimo:

- id interno
- nombre
- clase/spec que lo aporta
- tipo
- icono/spell metadata necesario para representación

Tipos posibles:

- `major_utility`
- `class_buff`
- `damage_debuff`

---

# 9. Heroísmo y Battle Rez

Serán preferencias opcionales.

No son restricciones duras.

Ejemplo:

Si existe:

Party A:
- mucho mejor loot
- sin Heroísmo

Party B:
- peor loot
- Heroísmo

debe ganar Party A.

La explicación simplemente mostrará:

⚠ Sin Heroísmo.

Sin embargo, entre dos composiciones equivalentes para loot, debe preferirse aquella con Heroísmo.

Lo mismo para Battle Rez.

---

# 10. Chaos Brand y Mystic Touch

Deben evaluarse según los personajes que realmente componen el grupo.

Chaos Brand obtiene más valor si la composición contiene DPS clasificados como mágicos.

Mystic Touch obtiene más valor si contiene DPS clasificados como físicos.

Ejemplo:

3 DPS mágicos + Demon Hunter:

`Chaos Brand → alta sinergia`

3 DPS físicos + Monk:

`Mystic Touch → alta sinergia`

2 mágicos + 1 físico:

`composición mixta`

El sistema no necesita estimar porcentajes exactos de DPS.

Puede valorar la cantidad de DPS cuya clasificación hace relevante el debuff.

---

# 11. Buffs principales

Cuando esté activada:

**Optimización de composición → Buffs de clase**

el solver debe valorar la presencia de buffs únicos.

Los buffs duplicados tienen valor marginal cero.

Ejemplo:

1 Druid:

`Mark of the Wild = presente`

2 Druids:

sigue contando:

`Mark of the Wild = 1`

No otorgar puntuación extra por duplicarlo.

La misma regla aplica a cualquier capability que no acumule.

---

# 12. Piedra y propietario

Esta debe ser una restricción dura adicional.

Una Keystone pertenece a un personaje concreto.

Si:

`Speeson-Druid → +13 TOS`

y el planner utiliza esa piedra, ese mismo usuario debe participar mediante **Speeson-Druid**.

No puede recomendar:

`Esteban → Paladin`

mientras utiliza simultáneamente:

`Speeson-Druid → +13 TOS`.

Un usuario no puede utilizar dos personajes en la misma party.

Por tanto cada candidato debe estar ligado a:

`stone.characterId`

y bloquear automáticamente ese personaje para el propietario de la piedra.

---

# 13. Participantes de la sesión

El planner debe permitir elegir qué miembros juegan en esa sesión.

Ejemplo:

- Esteban ✅
- Juan ✅
- Pedro ✅
- María ❌
- Carlos ❌

El solver solo utilizará miembros seleccionados.

Nunca debe introducir automáticamente otro miembro del team que no haya sido marcado como disponible.

---

# 14. Grupos incompletos

Debe soportar:

- 2 jugadores
- 3 jugadores
- 4 jugadores
- 5 jugadores

Con cinco:

la composición final debe ser exactamente:

`1 Tank + 1 Heal + 3 DPS`.

Con menos de cinco:

la composición formada por los jugadores existentes debe poder completarse hasta 1/1/3.

Ejemplo con cuatro:

Tank ✅
Heal ✅
DPS ✅
DPS ✅
DPS → VACANTE

El resultado debe indicar:

**Necesitamos: 1 DPS**

y posteriormente utilizar las utilities para recomendar el perfil ideal.

Ejemplo:

**DPS recomendado para completar la party**
- preferiblemente con Heroísmo;
- opciones: Mage, Hunter, Shaman o Evoker.

Si Heroísmo ya está cubierto:

**DPS flexible**

No inventar un jugador externo concreto.

---

# 15. Selector de nivel de piedra

Añadir un slider:

`1 ─────────●──────── 20`

con valor visible:

`Nivel objetivo: +12`

Request:

`targetLevel: 12`

El nivel debe afectar al ranking, pero permanecer por debajo del valor del loot.

Debe utilizarse distancia absoluta inicialmente:

`abs(stoneLevel - targetLevel)`

Exactamente el nivel seleccionado:

mejor puntuación de nivel.

±1:

ligera penalización.

±2:

mayor penalización.

etc.

No debe eliminar automáticamente piedras de otros niveles.

Así, si no existe ninguna +12 pero existe una +11 con muchísimo loot, el planner todavía puede recomendarla.

---

# 16. Scoring de loot

Reutilizar `keystoneLootTierWeight()` existente.

Actualmente el Worker ya utiliza:

- Nice → 25
- Must → 60
- BiS → 100
- Transmog → 5
- Catalyst → 15

No crear una segunda interpretación incompatible de los tiers.

Excluir:

`completed_with_voidcore`

igual que hace actualmente la lógica KeystoneLoot.

Deduplicar correctamente los mismos objetivos siguiendo la identidad ya utilizada por KeystoneSelector.

El score debe calcularse usando el `lootSpecId` seleccionado para cada personaje.

---

# 17. Beneficio repartido entre jugadores

Además del valor individual de los objetos, debe existir una bonificación por distribuir objetivos entre varios jugadores.

No usar simplemente:

`cantidad total de objetos`.

Una piedra donde cuatro miembros obtienen objetivos valiosos debería normalmente resultar más interesante que otra donde todos los objetivos pertenecen a una única persona.

Una posibilidad determinista y coherente con los tiers existentes:

`lootScore = suma de pesos de objetos + bonus de cobertura`

El bonus de cada jugador puede derivarse del objetivo de mayor peso que tenga en esa dungeon.

De esta manera no se trata igual:

- un jugador con Transmog;
- un jugador con Must;
- un jugador con BiS.

No utilizar un bonus arbitrariamente enorme capaz de convertir cinco transmogs en algo mejor que varios BiS.

---

# 18. Orden global del ranking

No usar únicamente un número gigante mezclando todas las cosas.

Utilizar comparación jerárquica.

Orden:

### 1. Viabilidad

Composición completa o completable a:

`1 Tank / 1 Heal / 3 DPS`

obligatoria.

Una opción no viable se elimina.

### 2. Loot

`lootScore DESC`

Este es el criterio principal.

### 3. Nivel objetivo

`distanceFromTargetLevel ASC`

### 4. Preferencias del jugador

Preferir:

`preferred > available > emergency`

`disabled` ya habrá sido eliminado.

### 5. Utilities

Aplicar solamente las opciones habilitadas.

### 6. Tie-break determinista

Por ejemplo:

- challengeMapId
- characterId propietario de la piedra
- IDs de miembros/specs

Esto permitirá tests reproducibles.

---

# 19. Generación de combinaciones

No crear todas las combinaciones sin restricciones y filtrarlas después.

Crear candidatos por usuario:

`User → Character → playable Spec`

y hacer backtracking con poda.

Durante la generación mantener:

- tanks utilizados ≤ 1
- healers utilizados ≤ 1
- DPS utilizados ≤ 3
- un usuario ≤ 1 personaje
- stone holder bloqueado
- disabled eliminado

Con 2–4 jugadores, comprobar también que los slots restantes permiten completar el 1/1/3.

Esto reducirá enormemente el espacio de búsqueda.

---

# 20. Endpoint de preferencias

Crear API owner-only, por ejemplo:

`GET /api/me/planner/preferences`

y:

`PUT /api/me/planner/preferences`

La escritura debe validar:

- personaje propiedad del usuario;
- spec perteneciente realmente a la clase;
- `playPreference` válido;
- `lootSpecId` válido para la clase;
- ausencia de duplicados.

No permitir modificar preferencias de otro usuario.

Las preferencias son globales del usuario/personaje, no específicas de un team.

---

# 21. Endpoint del planner

Crear algo equivalente a:

`POST /api/teams/:teamId/keystone-planner`

Request conceptual:

```json
{
  "participantUserIds": [1, 2, 3, 4],
  "targetLevel": 12,
  "challengeMapId": null,
  "options": {
    "optimizeComposition": true,
    "bloodlust": true,
    "battleRez": true,
    "classBuffs": true,
    "damageSynergy": true
  },
  "locks": []
}
```

`challengeMapId = null`

→ planificador global entre todas las piedras disponibles.

Con `challengeMapId`:

→ planificar únicamente esa dungeon.

Esto permite usar el mismo motor desde dos sitios de la UI.

---

# 22. Dos formas de entrar al planner

## A. Planificar sesión

Añadir dentro del actual Selector de piedra:

**Planificar sesión**

Debe analizar simultáneamente todas las piedras disponibles del team y devolver el Top 3.

Esta es la funcionalidad principal.

## B. Planificar piedra

Activar la pestaña que ya existe actualmente en:

`StoneSelector.tsx`

y que ahora aparece como:

**Planificar piedra · Próximamente**

Cuando el usuario haya seleccionado TOS, por ejemplo:

`challengeMapId = TOS`

y el planner solamente buscará las mejores configuraciones para TOS.

Ambas vistas deben consumir el mismo endpoint/motor.

---

# 23. Bloqueos manuales

V1 debe permitir bloquear elementos antes de recalcular.

Ejemplos:

🔒 Esteban → Balance Druid

🔒 Juan → Tank

🔒 Speeson → personaje concreto

El motor recalcula el resto respetando esos locks.

También debe poder utilizarse el filtro `challengeMapId` como bloqueo de dungeon.

No duplicar el algoritmo para estos casos.

---

# 24. Response del planner

El Worker debe devolver datos estructurados, no un texto generado.

Ejemplo conceptual:

```text
recommendations[]
    rank
    stone
    party.members[]
    party.vacancies[]
    loot
    composition
    level
    preferences
    reasons[]
```

Cada miembro:

- userId
- username
- characterId
- characterName
- class
- specId
- role
- lootSpecId
- playPreference
- objectives
- capabilities

Stone:

- characterId
- characterName
- ownerUserId
- challengeMapId
- dungeon
- level

Loot summary:

- playersWithObjectives
- totalObjectives
- BiS
- Must
- Nice
- Catalyst
- Transmog
- score

Composition:

- hasBloodlust
- hasBattleRez
- buffs[]
- debuffs[]
- damageProfile

No generar la explicación mediante IA.

Debe ser completamente determinista.

---

# 25. Top 3

El endpoint debe devolver como máximo:

`3 recomendaciones`

ordenadas.

Evitar duplicados exactos mediante un fingerprint de:

`stone + assignments`.

Si existen menos de tres soluciones válidas, devolver solamente las existentes.

---

# 26. Explicación visual

Cada recomendación debe explicar por qué aparece en esa posición.

Ejemplo:

## #1 · +13 TOS — piedra de Makabe

### Party

🛡 Makabe — Guardian Druid
`[icono Mark of the Wild]`

💚 Speeral — Restoration Shaman
`[icono Skyfury] [icono Bloodlust]`

⚔ Juan — Arcane Mage
`[icono Arcane Intellect] [icono Bloodlust]`

⚔ Pedro — Devourer Demon Hunter
`[icono Chaos Brand]`

⚔ Luis — Shadow Priest
`[icono Fortitude]`

### Loot

4/5 jugadores tienen objetivos.

- 3 BiS
- 2 Must
- 2 Nice

### Composición

✅ Heroísmo
✅ Battle Rez
✅ Mark of the Wild
✅ Arcane Intellect
✅ Skyfury
✅ Chaos Brand

**Perfil de daño: predominantemente mágico**

`Chaos Brand presenta buena sinergia con esta composición.`

### Por qué es #1

`Es la piedra con mayor valor de objetivos entre las composiciones válidas y además está cerca del nivel objetivo seleccionado.`

---

# 27. Iconos

En la tarjeta de cada personaje mostrar junto a él solamente las contributions relevantes que aporta.

Ejemplo:

`[Mark icon] Makabe — Guardian Druid`

No repetir el mismo buff como beneficio adicional si otro personaje también lo aporta.

En el resumen de composición debe mostrarse una sola vez.

---

# 28. Privacidad KeystoneLoot

Mantener exactamente el comportamiento actual.

Si:

`shareKeystoneLootWithTeams = false`

el planner:

- puede utilizar al personaje para formar party si está disponible;
- puede utilizar sus preferencias de roles/spec;
- NO puede leer ni puntuar sus objetivos KeystoneLoot.

Su contribución de loot será 0.

Nunca realizar lecturas indirectas del snapshot para intentar calcular el score.

---

# 29. Estado sin configuración

Si un participante seleccionado no tiene preferencias de juego configuradas:

mostrar claramente:

**Juan necesita configurar qué personajes/specs juega.**

No inferir automáticamente una composición.

Debe poder abrirse desde ahí la configuración.

---

# 30. UI de configuración

Añadir un diálogo/panel:

## Mis personajes para el Planner

Por personaje:

### Makabe — Paladin

Retribution
`⭐ Preferida`

Protection
`✅ Disponible`

Holy
`❌ No juego`

Para specs activas:

**Objetivos de loot**
`Retribution ▼`

Estados visuales:

- ⭐ Preferida
- ✅ Disponible
- ⚠ Solo si hace falta
- ❌ No juego

---

# 31. UI del planificador

Antes de calcular:

### Jugadores de esta sesión
checkboxes de miembros del team.

### Nivel objetivo
slider 1–20.

### Optimización de composición
Master toggle.

Debajo:

- Heroísmo
- Battle Rez
- Buffs/debuffs de clase
- Sinergia física/mágica

### Opciones avanzadas
Permitir mostrar/configurar individualmente esas preferencias, pero todas siguen siendo soft constraints.

Botón:

**Calcular mejores piedras**

Resultado:

Top 3.

---

# 32. No introducir meta de clases

El planner NO debe utilizar:

- tier lists;
- DPS estimado;
- Raider.IO para decidir qué spec es mejor;
- ranking de clases;
- meta de M+.

Raider.IO puede seguir mostrándose visualmente si ya está disponible, pero no debe afectar al score.

Se está optimizando:

**loot + viabilidad + preferencias + utilidad**

no:

**qué clase hace más DPS esta semana**.

---

# 33. Tests Worker

Añadir cobertura específica para, como mínimo:

- exactamente 1/1/3;
- rechazo de 0 tanks;
- rechazo de 2 tanks;
- rechazo de 4 DPS;
- `disabled` nunca seleccionado;
- preferred gana a available en igualdad;
- available gana a emergency;
- emergency permite salvar una composición;
- stone holder utiliza exactamente el personaje dueño de la piedra;
- un usuario nunca ocupa dos slots;
- objetivos filtrados por `lootSpecId`;
- Voidcore completado excluido;
- KeystoneLoot sharing disabled no puntúa;
- BiS/Must/Nice mantienen pesos existentes;
- targetLevel afecta desempates;
- Heroísmo activado/desactivado;
- Battle Rez activado/desactivado;
- buff duplicado = cero beneficio adicional;
- Chaos Brand favorece party mágica;
- Mystic Touch favorece party física;
- 2 jugadores → 3 vacancies;
- 3 jugadores → 2 vacancies;
- 4 jugadores → 1 vacancy;
- sugerencia correcta de rol ausente;
- sugerencia de capability para PUG;
- top 3 estable;
- resultados deterministas;
- challengeMapId opcional funciona como filtro.

---

# 34. Tests Web

Añadir tests para:

- parser del nuevo response;
- preferencias por personaje;
- cuatro estados de spec;
- selección de lootSpec;
- slider 1–20;
- selección de participantes;
- master toggle;
- opciones avanzadas;
- loading;
- error;
- sin soluciones;
- preferencias sin configurar;
- Top 3;
- explicación;
- badges/icons de capabilities;
- vacancies;
- cambio rápido de dungeon sin respuestas obsoletas;
- responsive/mobile;
- keyboard/focus/accessibility.

Mantener el patrón de AbortController/request identity que ya utiliza `StoneSelector`.

---

# 35. Catálogo WoW y mantenimiento por parche

Toda la metadata patch-sensitive debe estar concentrada.

No dispersar:

- providers de Bloodlust;
- providers de Battle Rez;
- Chaos Brand;
- Mystic Touch;
- buffs;
- damage profiles

por rutas, tests y componentes diferentes.

El catálogo debe incluir comentarios/fuentes de verificación.

Cuando cambie una Season o patch:

se actualiza el catálogo y sus tests.

No el algoritmo.

---

# 36. Fase de implementación recomendada

### Bloque A — Datos y dominio

- migración `0010`;
- metadata de specs/roles;
- capabilities;
- damage profiles;
- endpoints de preferencias.

### Bloque B — Solver

- candidatos;
- restricciones;
- stone ownership;
- loot scoring;
- target level;
- preferences;
- utilities;
- incomplete parties;
- Top 3;
- explanation model.

### Bloque C — API

- planner endpoint;
- validación;
- privacidad;
- DTO estable.

### Bloque D — Web

Estado: implementado localmente y validado el 2026-09-10; pendiente del Bloque E de prueba real y cierre.

- configuración de personajes;
- selector de participantes;
- slider;
- opciones;
- Planificar sesión;
- activar pestaña Planificar piedra;
- Top 3;
- explicaciones/icons.

### Bloque E — Tests y hardening

- Worker;
- Web unit;
- Playwright;
- casos extremos;
- determinismo;
- accesibilidad.

---

# 37. Validación final

Worker:

`npm run typecheck`

`npm test`

Migración D1 local:

`npm run d1:migrate:local`

Web:

`npm run lint`

`npm test`

`npm run build`

`npm run test:visual`

Después:

`python scripts/deploy_impact.py --files <changed-files>`

No ejecutar:

- migración D1 remota;
- deploy;
- release;
- push;

sin autorización explícita.

---

# 38. Criterios de aceptación V1

La funcionalidad se considera terminada cuando:

1. Cada usuario puede indicar exactamente qué personajes/specs juega.
2. Nunca se asigna una spec marcada `disabled`.
3. Una party completa siempre cumple 1 Tank / 1 Heal / 3 DPS.
4. Los grupos incompletos muestran correctamente los roles que faltan.
5. Solo se recomiendan piedras que realmente posee algún participante válido.
6. El propietario de la piedra debe entrar con el personaje que la posee.
7. KeystoneLoot es el criterio principal después de la viabilidad.
8. Los objetivos se calculan según la spec de loot configurada.
9. El nivel 1–20 influye en el ranking.
10. Heroísmo y Battle Rez son soft preferences.
11. Chaos Brand/Mystic Touch consideran el perfil físico/mágico.
12. Los buffs principales cuentan como utilidad secundaria.
13. Los buffs duplicados no puntúan dos veces.
14. La privacidad `shareKeystoneLootWithTeams` se mantiene.
15. El sistema devuelve hasta tres recomendaciones.
16. Cada recomendación explica de forma estructurada por qué ha sido seleccionada.
17. El resultado es determinista y está cubierto por tests.
18. No se han introducido porcentajes de daño inventados.
19. No se utiliza la meta ni tier lists para escoger personajes.
20. El diseño queda preparado para añadir posteriormente dispels, interrupts, requisitos específicos por dungeon y planificación encadenada de varias piedras.

# Fuera de V1

Dejar explícitamente para versiones posteriores:

- dispels específicos por dungeon;
- interrupts;
- soothe/purge;
- affixes;
- melee/ranged requirements;
- meta/tier lists;
- score de jugador;
- rutas óptimas;
- planificación automática de varias piedras consecutivas;
- actualización automática de la piedra obtenida después de terminar otra;
- objetivos de Great Vault;
- horarios/disponibilidad;
- integración del planner en KeystoneClient.

La arquitectura de capabilities y solver debe permitir añadir estas condiciones posteriormente sin rediseñar el sistema.
