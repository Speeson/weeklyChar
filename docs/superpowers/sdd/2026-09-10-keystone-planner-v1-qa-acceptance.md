# Keystone Planner V1 — aceptación QA controlada

## Decisión

**PASS** para Keystone Planner V1.

El 10 de septiembre de 2026 se creó y validó contra el Worker y D1 de producción un Team aislado
de cinco identidades `KSPQA_*`. La API real devolvió un Top 3 coherente y estable, las tres
recomendaciones cumplieron 1 Tank / 1 Healer / 3 DPS y se verificaron ranking, holder, preferencias,
utilities, afinidad de daño, Voidcore, locks, parties incompletas, filtro por piedra y privacidad.
La Web se ejecutó únicamente en local contra esa API y se revisó en desktop y móvil. No se desplegó
la Web ni se modificaron scoring, solver, schema o datos ajenos al fixture.

Queda una incidencia independiente del Planner: el login por contraseña con hashes bcrypt de coste
10 agotó CPU del Worker y produjo Cloudflare `1102`. Para completar exclusivamente esta aceptación,
las cinco identidades QA quedaron con hashes de coste 4 después de dos autorizaciones explícitas.
No se cambió código de autenticación y no se conservaron ni documentaron contraseñas, JWT, cookies,
tokens o el código de invitación.

## Alcance y forma de creación

- Rama: `feature/keystone-planner-v1`.
- API: `https://api-keystonesync.esgarpe.dev`.
- Team QA: ID `5`, `Keystone Planner QA`.
- Único uso de SQL para crear datos: cinco identidades mínimas, aisladas y autorizadas; después se
  actualizaron únicamente sus cinco hashes, también con autorización explícita, para superar la
  incidencia `1102`.
- Todos los datos funcionales —Team, membresías, personajes, snapshots, piedras y preferencias— se
  crearon mediante APIs normales del producto.
- No se modificó ninguna fila real preexistente ni se relajó constraint alguno.

## Inventario exacto para cleanup posterior

Los datos se dejan intactos para revisión. Un cleanup futuro debe limitarse estrictamente a estos
identificadores y volver a comprobar relaciones antes de borrar nada.

| Entidad | ID | Identificador QA |
| --- | ---: | --- |
| User | 27 | `KSPQA_Paladin_20260910` |
| User | 28 | `KSPQA_Shaman_20260910` |
| User | 29 | `KSPQA_DemonHunter_20260910` |
| User | 30 | `KSPQA_Monk_20260910` |
| User | 31 | `KSPQA_Druid_20260910` |
| Team | 5 | `Keystone Planner QA` |
| Membership | 10 | Team 5 / User 27 |
| Membership | 11 | Team 5 / User 28 |
| Membership | 12 | Team 5 / User 29 |
| Membership | 13 | Team 5 / User 30 |
| Membership | 14 | Team 5 / User 31 |
| Character | 30 | `KSPQA-Aegis`, Paladin |
| Character | 31 | `KSPQA-Tempest`, Shaman |
| Character | 32 | `KSPQA-Devourer`, Demon Hunter |
| Character | 33 | `KSPQA-Fist`, Monk |
| Character | 34 | `KSPQA-Astral`, Druid |
| Keystone | 517 | Character 30 / map 588 / +15 |
| Keystone | 518 | Character 31 / map 587 / +10 |
| Keystone | 519 | Character 32 / map 586 / +12 |
| Keystone | 520 | Character 34 / map 584 / +13 |

Las preferencias son 16 filas identificables por `character_id` 30–34: 3, 3, 3, 3 y 4 filas,
respectivamente. Los cinco snapshots están en `characters.keystone_loot_json`, llevan
`addonVersion = KSPQA-20260910` y contienen 4, 3, 1, 2 y 4 objetivos. No quedaron invitaciones
pendientes del Team 5.

## Perfiles y preferencias

| Usuario | Played spec / estado | Loot spec relevante |
| --- | --- | --- |
| Paladin | Holy 65 `disabled`; Protection 66 `preferred`; Retribution 70 `emergency` | Protection usa Holy 65 |
| Shaman | Elemental 262 `available`; Enhancement 263 `disabled`; Restoration 264 `preferred` | 264 |
| Demon Hunter | Havoc 577 `disabled`; Vengeance 581 `disabled`; Devourer 1480 `preferred` | 1480 |
| Monk | Brewmaster 268 `emergency`; Windwalker 269 `preferred`; Mistweaver 270 `disabled` | 269 |
| Druid | Balance 102 `preferred`; Feral 103 `available`; Guardian 104 `emergency`; Restoration 105 `disabled` | según played spec |

Esto prueba explícitamente que played spec y loot spec son independientes: el Paladin juega
Protection 66 y puntúa loot de Holy 65. También confirma `Devourer (1480) → Demon Hunter`.

## Piedras y objetivos KeystoneLoot

| Piedra | Dungeon | Nivel | Owner | Objetivos que puntúan |
| --- | --- | ---: | --- | --- |
| A | Altar of Fangs, map 588 | +15 | Paladin | 3 BiS |
| B | Murder Row, map 587 | +10 | Shaman | 1 BiS + 3 Must |
| C | Den of Nalorakk, map 586 | +12 | Demon Hunter | 2 BiS + 1 Nice |
| D | The Blinding Vale, map 584 | +13 | Druid | 2 BiS + 1 Nice |

Se usaron únicamente los pesos de producto: BiS `100`, Must `60` y Nice `25`. Los item IDs
`990001`–`990014` y `990099` son objetivos sintéticos positivos, aislados y reconocibles; el fallback
de metadata del producto permitió usarlos sin inventar pesos. El objetivo `990099`, BiS de map 586,
quedó marcado en `voidcore.usedItems` y no apareció ni puntuó en recomendaciones.

## Ejecución principal y Top 3

Payload funcional: cinco participantes, `targetLevel = 12`, sin locks y con
`optimizeComposition`, `bloodlust`, `battleRez`, `classBuffs` y `damageSynergy` activados. Resultado
de dominio: `status = ok`, cuatro piedras elegibles y tres recomendaciones.

| Rank | Piedra | Weighted score | Players with objectives | Level distance | Preference summary |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | A — map 588 +15 | 300 | 3 | 3 | 5 preferred |
| 2 | B — map 587 +10 | 280 | 4 | 2 | 5 preferred |
| 3 | C — map 586 +12 | 225 | 3 | 0 | 5 preferred |

La piedra D obtuvo también score `225` y 3 jugadores, pero distancia `1`; por ello C ganó el
desempate de distancia y D quedó cuarta. A demuestra que mayor weighted score prevalece aunque esté
más lejos. B beneficia a más jugadores que A, pero pierde porque su score es inferior.

Las tres recomendaciones asignaron exactamente:

- Tank: Paladin, Protection 66 con loot spec Holy 65.
- Healer: Shaman, Restoration 264.
- DPS: Demon Hunter Devourer 1480, Monk Windwalker 269 y Druid Balance 102.

En cada rank se comprobó: 1/1/3, owner ligado al mismo `characterId` de su piedra, cinco usuarios
únicos y seleccionados, cero specs disabled, loot specs correctos, objetivos sólo de la dungeon,
Voidcore excluido y fingerprints únicos. Repetir el payload produjo el mismo orden y fingerprints;
el último fallback del comparador determinista permanece además cubierto por la suite unitaria, sin
haber forzado en producción una colisión artificial de todos los criterios.

## Utilities y composición

Las tres composiciones principales devolvieron daño `mixed`, con dos DPS mágicos (Devourer y
Balance) y uno físico (Windwalker), sin porcentajes inventados. Las capabilities agregadas fueron
únicas y exactamente:

- `BLOODLUST`, garantizado por Shaman;
- `BATTLE_REZ`, garantizado por Paladin/Druid;
- `CHAOS_BRAND`, con 2 beneficiarios mágicos;
- `MYSTIC_TOUCH`, con 1 beneficiario físico;
- `MARK_OF_THE_WILD`;
- `SKYFURY`.

## Desempate por preferencias

Para aislar este criterio se desactivó temporalmente el sharing del Paladin y del Druid, eliminando
sus diferencias de loot en map 587. Con el mismo score `160` y 2 jugadores beneficiados se observó:

| Rank | Preferencias | Variantes relevantes |
| ---: | --- | --- |
| 1 | 5 preferred | Protection 66 / Balance 102 |
| 2 | 4 preferred + 1 available | Protection 66 / Feral 103 |
| 3 | 3 preferred + 2 emergency | Retribution 70 / Guardian 104 |

El resultado confirma `preferred > available > emergency` a igualdad de criterios superiores. Los
dos flags de sharing se restauraron y una consulta D1 final confirmó los cinco usuarios QA con
sharing habilitado.

## Locks

- Role lock compatible, Paladin → Tank: `status = ok` y assignment coincidente.
- Character lock, Demon Hunter → character 32: `status = ok` y assignment coincidente.
- Assignment lock, Shaman → character 31 / Restoration 264: `status = ok` y assignment coincidente.
- Role lock incompatible, Paladin → Healer: HTTP `400`, `status = invalid_input`, código
  `INVALID_LOCK` y diagnóstico `LOCKS_HAVE_NO_CANDIDATE:27`.

## Parties incompletas

| Participantes | Assignments | Vacancies |
| ---: | ---: | --- |
| 2: Paladin + Demon Hunter | 2 | Healer, DPS, DPS |
| 3: Paladin + Shaman + Demon Hunter | 3 | DPS, DPS |
| 4: Paladin + Demon Hunter + Monk + Druid | 4 | Healer |

En los casos de 2 y 4 faltó Bloodlust; la vacancy de Healer incluyó `BLOODLUST` en
`preferredCapabilities`. La API no inventó miembros, personajes ni clases.

## Planificar piedra y privacidad

- `challengeMapId = 588`: `status = ok`, `eligibleStoneCount = 1` y todas las recomendaciones
  correspondieron exclusivamente a map 588.
- `challengeMapId = 585`, sin piedra QA: `eligibleStoneCount = 0`,
  `status = no_valid_composition` y cero recomendaciones; la Web dispone del estado vacío neutral
  “No hay una piedra de esta mazmorra”.
- Con sharing deshabilitado temporalmente para Druid, el miembro continuó asignado como DPS Balance
  102 y aportó sus dos capabilities, pero tuvo `objectives = []`; el score principal bajó de 300 a
  220. Tras restaurarlo, el score volvió a 300. No se expuso el snapshot privado.

## Web local

La Web local se conectó al Worker de producción desde `http://localhost:3000`; el origen
`127.0.0.1` fue rechazado correctamente por la política CORS exacta y no se amplió la allowlist.
En el Team QA se visualizaron los cinco miembros, las cuatro piedras, el selector y el Planner.

En desktop y móvil se revisaron el target +12, Top 3, cinco slots, owners, specs y loot specs,
resúmenes de preferencias, objetivos expandibles, capabilities, Chaos Brand, Mystic Touch,
Bloodlust, Battle Rez y daño mixto. Los controles de locks y los modos Planificar sesión / Planificar
piedra quedaron accesibles; las respuestas específicas de locks y vacancies se verificaron por API
y siguen cubiertas visualmente por la suite Playwright. A 390×844 las cards quedaron apiladas sin
overflow horizontal aparente.

Evidencia visual conservada:

- [Desktop](../../../keystone-planner-qa-desktop.png)
- [Móvil](../../../keystone-planner-qa-mobile.png)

## Bugs, límites y cambios de código

- Incidencia reproducida: comparar una contraseña contra bcrypt coste 10 provoca Cloudflare Worker
  `1102`; un usuario inexistente devuelve el `401` normal, aislando el fallo en la comparación.
- Excepción temporal autorizada: sólo los cinco hashes QA usan coste 4. No debe extrapolarse a
  usuarios reales ni considerarse una solución de producto.
- No se corrigió silenciosamente la autenticación porque quedaba fuera del alcance Planner y exige
  diseño/validación propios.
- No se modificó código durante esta aceptación QA. Los cambios pendientes de Worker
  `src/http.ts` y `tests/httpCors.test.js` pertenecen al hardening CORS ya documentado en el informe
  de Bloque E.
- Las credenciales fueron efímeras y no se persistieron. Para una nueva revisión interactiva será
  necesaria una rotación/reseed de credenciales QA expresamente autorizada; los datos funcionales
  permanecen intactos.

## Comprobaciones finales

- Worker `npm run typecheck`: passed.
- Worker `npm test`: passed, 190/190; incluye ranking completo, tie-break determinista, Top 3,
  holder binding, preferencias, utilities, locks, privacidad y estados sin piedra.
- Cinco users, cinco memberships y cinco characters QA exactos.
- Cuatro keystones QA exactas y 16 preferencias.
- Cinco snapshots `KSPQA-20260910`; Voidcore `990099` persistido sólo en Shaman.
- Cero invitaciones pendientes para Team 5.
- Los cinco flags de sharing restaurados a true.
- `PRAGMA foreign_key_check`: cero filas.
- No Web deploy, push, merge, PR, release, tag, migración, cambio de scoring o cleanup.

La aceptación del Planner queda desbloqueada. La siguiente operación sobre este fixture debe ser una
revisión o un cleanup separado y explícitamente autorizado; la incidencia bcrypt debe tratarse como
trabajo independiente de autenticación.
