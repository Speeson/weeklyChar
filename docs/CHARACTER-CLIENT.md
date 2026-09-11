Quiero implementar una nueva feature completa de KeystoneSync: una pestaña "Characters" en KeystoneClient que muestre el resumen completo del personaje, su equipo, currencies, progreso M+, Great Vault, Prey Hunts y permita abrir una visualización completa de sus talentos, Hero Talents y Omnium Folio.

Además hay que mejorar el tracking de currencies, añadir Untainted Mana-Crystals e implementar una integración reutilizable de Wowhead Tooltips para items, gems, enchants, talents, currencies, etc.

IMPORTANTE:

Antes de modificar nada, inspecciona el estado ACTUAL de `main` de los repositorios implicados y reutiliza la arquitectura existente.

Repositorios:
- Addon: `Speeson/KeystoneSync`
- Aplicación/Worker/Web/Cliente: `Speeson/weeklyChar`

NO hagas commit.
NO hagas push.
NO hagas release.
NO hagas deploy.
NO ejecutes migraciones D1 remotas.

Implementa, prueba y al final dame un informe completo del resultado.

==================================================
1. DISEÑO: FUENTE DE VERDAD
==================================================

El diseño FINAL Y APROBADO de Characters está en:

`keystone-client/design/characters-client.png`

ABRE ESA IMAGEN ANTES DE IMPLEMENTAR LA UI.

Es la fuente de verdad visual.

No quiero reinterpretaciones del layout.
No quiero volver a una versión anterior.
No quiero inventar otra distribución.

La ventana de referencia sigue siendo:

1672 × 941

El diseño aprobado tiene:

LEFT RAIL
- selector Cuenta
- selector Reino
- tarjetas de personajes

TOP
- Gold
- Gear en UNA SOLA FILA

MIDDLE
- Dungeons ocupando la mayor parte del ancho
- Great Vault estrecho a la derecha
- Prey Hunts estrecho debajo

BOTTOM
- Currencies
- 10 cards visibles simultáneamente
- grid 5 × 2

La implementación debe seguir funcionando con:
- Keystone
- Poison
- Void

Usar tokens/theme actuales.

Los colores semánticos independientes del theme son:
- clases
- item quality
- keystone level
- rating
- MAX
- completed
- WoW quality colors

==================================================
2. NUEVA PESTAÑA CHARACTERS
==================================================

Actualmente KeystoneView contiene:

"sync" | "teams" | "addon"

Añadir:

"characters"

Orden EXACTO:

Sincronizar | Characters | Equipos | Addon

Characters debe aparecer ANTES de Equipos.

Crear una página propia:

`keystone-client/src/pages/CharactersPage.tsx`

No meter toda esta funcionalidad en App.tsx.

==================================================
3. FILTROS Y PERSONAJES
==================================================

En el rail izquierdo:

CUENTA
[ selector ]

REINO
[ selector ]

Los dos selectores van UNO ENCIMA DEL OTRO.

Después:

PERSONAJES

Las tarjetas de personajes deben quedar SUELTAS.
NO encerrarlas dentro de un gran panel.

Cada tarjeta:
- avatar
- nombre
- clase
- color del nombre según clase
- fondo ligeramente tintado según clase
- borde/acento discreto del color de clase
- selected state claro

Reutilizar/factorizar la lógica de class colors existente.

El listado de personajes puede hacer scroll vertical.

Cuenta/Reino permanecen fijos arriba.

Cuenta usa `wowAccount`.

Realm depende de la cuenta seleccionada.

Cambios:
Cuenta -> recalcular realms y personajes
Realm -> filtrar personajes
Personaje -> refrescar todo el panel derecho

Mantener selección durante refresh siempre que siga existiendo.

==================================================
4. GOLD
==================================================

En la parte superior del panel derecho:

[ GOLD ] [                          GEAR                         ]

Gold sólo ocupa una altura compacta.

Mostrar:
- gold
- silver
- copper
- personaje

Usar `money`.

No volver a mostrar aquí:
- realm
- rio
- current keystone
- etc.

==================================================
5. GEAR: UNA ÚNICA FILA
==================================================

A la derecha de Gold:

GEAR [Item Level] [Set Pieces] [Mostrar talentos]

Todos los items equipados deben mostrarse EN UNA SOLA FILA.

NO 2 filas.

La altura debe mantenerse compacta porque Currencies tiene prioridad vertical.

Seguir `characters-client.png`.

Mostrar los slots relevantes:

Head
Neck
Shoulder
Back
Chest
Wrist
Hands
Waist
Legs
Feet
Finger1
Finger2
Trinket1
Trinket2
MainHand
OffHand

No Shirt.
No Tabard.

Por item:
- icono grande suficiente para reconocerse
- borde/calidad del item
- item level
- gemas como pequeños overlays
- enchant como pequeño indicador cuando corresponda

Al hacer hover:
- item => Wowhead tooltip de la PIEZA REAL equipada
- gem => tooltip Wowhead de esa gema
- enchant => tooltip Wowhead del enchant si tenemos spellId fiable

==================================================
6. EQUIPMENT: FUENTE DE VERDAD
==================================================

NO usar Raider.IO como fuente del equipo.

La fuente de verdad es el propio addon KeystoneSync dentro de WoW.

Raider.IO puede seguir usándose para sus datos actuales como avatar/RIO, pero:

equipment
enchants
gems
talents
hero talents
omnium

los obtenemos directamente de las APIs de Blizzard/WoW.

Tomar AlterEgo como referencia técnica cuando sea útil, pero KeystoneSync NO debe depender de AlterEgo.

Capturar equipment con APIs apropiadas como:

GetInventoryItemLink("player", slotID)
C_Item.GetItemInfo(...)
C_Item.GetItemUpgradeInfo(...)
C_TooltipInfo.GetInventoryItem(...)
C_Item.GetItemGem(...)

Actualmente `C_Item.GetItemGem(hyperlink, index)` está disponible y devuelve el gem link.

Conservar el `itemLink` completo.

==================================================
7. DTO DE EQUIPMENT
==================================================

Diseñar un DTO robusto similar a:

equipment: {
  averageItemLevel?: number,
  setPieces?: {
    setId?: number,
    count: number
  }[],
  items: [
    {
      slotId: number,
      slotName: string,

      itemId: number,
      itemName: string | null,
      itemLink: string,

      quality: number | null,
      itemLevel: number | null,

      iconFileID: number | null,
      iconPath: string | null,

      setId: number | null,

      enchant: {
        enchantId: number | null,
        spellId: number | null,
        name: string | null,
        iconFileID: number | null
      } | null,

      gems: [
        {
          itemId: number,
          itemLink: string | null,
          name: string | null,
          iconFileID: number | null
        }
      ],

      bonusIds: number[],

      itemContext?: number | null,
      suffixId?: number | null
    }
  ]
}

No es obligatorio copiar exactamente esta estructura si el estado real de las APIs justifica algo mejor, pero debe conservar toda la información necesaria para reconstruir correctamente el tooltip Wowhead de la variante REAL del item.

==================================================
8. ITEMLINK Y TOOLTIP EXACTO
==================================================

El ItemLink de WoW codifica, entre otros:

itemID
enchantID
gemID1
gemID2
gemID3
gemID4
suffixID
linkLevel
specializationID
itemContext
bonusIDs
...

Utilizar el formato real del ItemLink.

No hacer un parser ingenuo que rompa cuando hay bonus/modifiers variables.

Si se crea parser, debe:
- estar aislado
- tener tests
- respetar el formato actual de ItemLink
- manejar arrays de bonusIDs correctamente
- no confundir campos al existir numBonusIDs / numModifiers

Cuando APIs como `C_Item.GetItemGem` permitan obtener una parte de forma más segura, preferirlas.

==================================================
9. DUNGEONS
==================================================

Seguir EXACTAMENTE `characters-client.png`.

Mostrar las 8 Midnight Season 2 dungeons.

Reutilizar:

`keystone-client/src/core/season2.ts`

y los assets existentes:

`keystone-client/src/assets/dungeon-teleports/`

Layout:

4 columnas × 2 filas.

Tarjetas de poca altura.

Cada card:

┌─────────────────────────────────────────────┐
│ [ART]  Dungeon Name                322       │
│ [ART]  +12 [MEDAL +2]             rating    │
└─────────────────────────────────────────────┘

El icono/arte de dungeon ocupa las 2 líneas de altura.

Fila 1:
Dungeon Name

Fila 2:
+level
medal +1/+2/+3

A la derecha:
rating grande
"rating" pequeño debajo

NO son tres iconos.
Es un único icono vertical.

Los medals deben usar los mismos assets y semántica de la web:

`keystone-web/public/icons/medals/tier1.avif`
`tier2.avif`
`tier3.avif`

Copiarlos al bundle del Client si es necesario.

No depender de la Web en runtime.

Reutilizar:
- keystoneColor
- UpgradeMedal
- estimatedDungeonRating

No inventar fórmulas diferentes.

Datos:
`mythicPlusSeason.dungeons`

==================================================
10. GREAT VAULT + PREY
==================================================

A la derecha de Dungeons:

[ GREAT VAULT ]
[ PREY HUNTS  ]

Estrechos.

La prioridad horizontal es Dungeons.

Great Vault:
- Raids
- Dungeons
- World
- slots
- progress

Prey:
- Normal
- Hard
- Nightmare

Reutilizar la semántica de `/summary`.

==================================================
11. CURRENCIES
==================================================

Mostrar TODAS estas 10:

1 Hero Mistcrest
2 Myth Mistcrest
3 Venomblight Manaflux
4 Tidal Spark Dust
5 Spark of Tides
6 Coffer Key Shards
7 Restored Coffer Key
8 Untainted Mana-Crystals
9 Nebulous Voidcore
10 Trovehunter's Bounty

Layout:

5 columnas × 2 filas.

TODAS visibles simultáneamente en 1672×941.

No scroll en Currencies a tamaño normal.

Sólo Hero y Myth entre las Mistcrest visibles.

Adventurer/Veteran/Champion pueden seguir trackeándose internamente, pero NO mostrarse.

==================================================
12. UNTAINTED MANA-CRYSTALS
==================================================

Añadir:

key:
`untaintedManaCrystals`

currency ID:
3356

NO hardcodear caps en runtime.

Guardar:

quantity
maxQuantity
maxWeeklyQuantity
totalEarned
trackedQuantity
quantityEarnedThisWeek
useTotalEarnedForMaxQty
canEarnPerWeek

==================================================
13. SEMÁNTICA GENERAL DE CAPS
==================================================

Eliminar la lógica especial exclusiva de Nebulous Voidcore.

Calcular:

isWeeklyMaxed =
  maxWeeklyQuantity > 0
  && quantityEarnedThisWeek >= maxWeeklyQuantity

isSeasonMaxed =
  useTotalEarnedForMaxQty === true
  && maxQuantity > 0
  && totalEarned >= maxQuantity

isTotalMaxed =
  useTotalEarnedForMaxQty !== true
  && maxQuantity > 0
  && quantity >= maxQuantity

isMaxed =
  isWeeklyMaxed || isSeasonMaxed || isTotalMaxed

Caso crítico:

Coffer Key Shards

quantity = 0
quantityEarnedThisWeek = 600
maxWeeklyQuantity = 600

=> IS MAXED

Debe salir rojo aunque Owned sea 0.

Otro test:

Untainted:
quantity=143
weekly=250/250
maximum=143/1000

=> weekly maxed
=> valor principal rojo
=> Weekly rojo
=> Maximum no rojo

==================================================
14. CHARACTER SERVICE
==================================================

Actualmente:

`keystone-client/sidecar/character_service.py`

elimina mucha información devuelta por `/api/me/characters`.

Debe conservar/sanitizar:

vault
preyHunts
currencies
money
mythicPlusSeason
equipment
talents
omniumFolio

También conservarlo en cache.

Snapshots antiguos deben seguir funcionando.

==================================================
15. PERSISTENCIA
==================================================

Ampliar Worker/D1 para:

equipment_json
talents_json
omnium_folio_json

Usar migración aditiva.

Elige el siguiente número de migración realmente libre al ejecutar la tarea.

NO ejecutar la migración remotamente.

Extender:

POST `/api/keystones/update`

con:

equipment
talents
omniumFolio

Actualizar:

CharacterRow
UPDATE
characterResponse(...)
GET `/api/me/characters`
sync_worker.py
CharacterService
TypeScript DTOs

No crear nuevos endpoints innecesarios.

Evitar N+1.

==================================================
16. TALENTS: FUENTE DE VERDAD
==================================================

NO obtener talentos de Raider.IO.

Los obtenemos directamente dentro de WoW.

Usar:

C_ClassTalents.GetActiveConfigID()
C_Traits.GetConfigInfo(configID)
C_Traits.GetTreeNodes(treeID)
C_Traits.GetNodeInfo(configID, nodeID)
C_Traits.GetEntryInfo(configID, entryID)
C_Traits.GetDefinitionInfo(definitionID)
C_Traits.GetSubTreeInfo(...)
C_Traits.GenerateImportString(configID)

Guardar también:
- specId
- specName
- class
- configID
- loadout name
- import string
- character level

Debemos capturar la geometría necesaria para reconstruir visualmente los árboles.

==================================================
17. TALENT NODE DTO
==================================================

Necesitamos suficiente información para representar el árbol real.

Un DTO orientativo:

TalentTreeSnapshot {
  treeId
  type
  name
  nodes[]
}

TalentNodeSnapshot {
  nodeId

  posX
  posY

  nodeType

  ranksPurchased
  maxRanks

  activeEntryId

  entries[]

  visibleEdges[]

  subTreeId
}

TalentEntrySnapshot {
  entryId
  definitionId

  spellId
  overriddenSpellId

  name
  description
  subtext

  iconFileID

  selected
  rank
}

TalentEdgeSnapshot {
  targetNodeId
  type
  visualStyle
  active
}

No dependas obligatoriamente de estos nombres si las estructuras reales actuales de Blizzard sugieren algo mejor.

Lo importante es conservar:

- posición
- icono
- selected state
- ranks
- choices
- conexiones
- dirección de conexión
- Hero subtree
- spell IDs

==================================================
18. BOTÓN "MOSTRAR TALENTOS"
==================================================

En el panel Gear debe existir:

[ Mostrar talentos ]

Al pulsarlo abrir una ventana/modal grande de Characters.

No navegar a otra página.

Debe tener estética similar al árbol de talentos dentro de WoW.

ESTRUCTURA:

┌──────────────────────────────────────────────────────┐
│ Character - Spec                           [Cerrar]   │
│                                                      │
│ CLASS           HERO TALENTS            SPEC         │
│                                                      │
│ [full tree]      [hero tree]          [full tree]    │
│                                                      │
│ ---------------------------------------------------- │
│ OMNIUM FOLIO                                          │
│              [small folio tree]                      │
│                                                      │
│ [Copiar build]                                       │
└──────────────────────────────────────────────────────┘

Los 3 árboles principales deben verse A LA VEZ:

IZQUIERDA:
Class Talent Tree

CENTRO:
Hero Talent Tree

DERECHA:
Spec Talent Tree

No quiero únicamente una lista de iconos.

QUIERO EL ÁRBOL.

Debe verse:
- posición de los nodos
- líneas entre nodos
- nodos elegidos
- nodos no elegidos
- choice nodes
- ranks
- 1/2 etc.
- iconos reales
- conexiones activas/inactivas

Inspiración visual:
la interfaz real de Blizzard.

No es necesario copiar el artwork/background propietario de Blizzard.
Sí hay que reproducir la estructura funcional.

==================================================
19. RENDER DEL ÁRBOL
==================================================

Utilizar las posiciones reales de Blizzard:

posX / posY

Normalizarlas dentro del viewport de cada árbol.

Las conexiones se deben dibujar idealmente mediante SVG.

Por ejemplo:

TalentTree
  position: relative

SVG:
  edges

HTML:
  TalentNode components

El SVG debe quedar DETRÁS de los nodos.

Edge activa:
color resaltado del árbol.

Edge inactiva:
gris/atenuada.

Nodo seleccionado:
borde WoW/talento resaltado.

Nodo no seleccionado:
desaturado.

Rank:
pequeño badge 1 / 2 etc.

Choice nodes:
visual diferente si la información de node type lo permite.

NO calcular conexiones basándonos en proximidad visual.

Usar `visibleEdges` / datos reales de Blizzard.

==================================================
20. CLASS / SPEC / HERO
==================================================

Separar correctamente:

CLASS TREE
SPEC TREE
HERO TREE

No asumir simplemente "tree 1 = class, tree 2 = spec".

Investigar cómo la versión actual 12.1 representa esos árboles y subtrees.

Hero Talents deben resolverse mediante la información de subtrees/config actual, no mediante una tabla hardcoded por spec.

Mostrar el nombre del Hero tree, por ejemplo:

ELUNE'S CHOSEN

y su icono si Blizzard proporciona uno.

==================================================
21. OMNIUM FOLIO
==================================================

Trackear también la selección actual del Omnium Folio.

La fuente de verdad vuelve a ser `C_Traits`.

La implementación actual conocida utiliza:

Trait system:
48

y actualmente el Folio utiliza el tree:
1186

Pero:

PREFERIR obtener el config mediante:

C_Traits.GetConfigIDBySystemID(48)

y derivar después los treeIDs desde:

C_Traits.GetConfigInfo(configID)

No acoplar la implementación exclusivamente al treeID 1186 si puede descubrirse correctamente desde el system.

El 1186 puede utilizarse como:
- validación
- fallback documentado
- test fixture

No como única fuente de verdad si no es necesario.

Guardar:

omniumFolio {
  systemId
  configId
  treeIds
  nodes
  selected entries
  edges
  ranks
  etc.
}

En el modal:

OMNIUM FOLIO debe aparecer debajo de los tres árboles principales.

Más pequeño.

Pero debe conservar:
- iconos
- conexiones
- seleccionados
- ranks
- tooltips

==================================================
22. REFRESH DE TALENTS / OMNIUM
==================================================

Escuchar eventos apropiados y actuales.

Investigar los eventos correctos en WoW 12.1.

Considerar entre otros:

TRAIT_CONFIG_LIST_UPDATED
TRAIT_CONFIG_UPDATED
ACTIVE_COMBAT_CONFIG_CHANGED
PLAYER_SPECIALIZATION_CHANGED

No asumir que todos son necesarios.

No sincronizar decenas de veces por un único cambio.

Debounce/coalesce eventos si hace falta.

IMPORTANTE:

Durante login las APIs de traits pueden no estar listas.

No sobrescribir un snapshot de talentos válido con un árbol vacío transitorio.

Aplicar la misma filosofía defensiva que ya utilizamos en otros snapshots.

==================================================
23. WOWHEAD TOOLTIPS: PRINCIPIO
==================================================

Los DATOS vienen de Blizzard/nuestro addon.

Wowhead se usa exclusivamente para proporcionar tooltips ricos en KeystoneClient/Web.

La pantalla no debe depender de Wowhead para funcionar.

Si Wowhead:
- no carga
- falla
- no tiene ese ID
- usuario está offline

la UI sigue mostrando:
- icono
- nombre
- item level / rank
- estado básico

==================================================
24. WOWHEAD TOOLTIP LOADER
==================================================

Crear una integración CENTRAL reutilizable.

NO añadir scripts Wowhead individualmente en cada componente.

Por ejemplo:

`WowheadTooltipProvider`
`useWowheadTooltips`
`WowheadTooltipLink`

o nombres equivalentes adecuados.

El script oficial es:

https://wow.zamimg.com/js/tooltips.js

Cargarlo UNA sola vez.

Antes del script configurar:

window.whTooltips = {
  colorLinks: false,
  iconizeLinks: false,
  renameLinks: false
}

IMPORTANTE:

Queremos que Wowhead proporcione el TOOLTIP.

NO queremos que Wowhead:
- sustituya nuestros iconos
- cambie nuestros nombres
- coloree/desmonte nuestro diseño

Por eso:
colorLinks false
iconizeLinks false
renameLinks false

Después de insertar dinámicamente nuevos elementos:

window.$WowheadPower?.refreshLinks?.()

Reutilizar el patrón de la Web si ya existe.

La web actualmente ya carga:

`https://wow.zamimg.com/js/tooltips.js`

desde `keystone-web/app/layout.tsx`.

No crear dos estrategias incompatibles.

==================================================
25. WOWHEAD: LOCALIZACIÓN
==================================================

El tooltip debe seguir el idioma del cliente.

Si lang = `es`:

data-wowhead debe incluir:

domain=es

Si lang = `en`:

domain=www

No hardcodear siempre español ni siempre inglés.

Crear helper central:

wowheadDomainForLanguage(lang)

==================================================
26. FORMATO WOWHEAD PARA SPELLS / TALENTS
==================================================

Para un talento o habilidad con spellId:

href:
https://www.wowhead.com/spell=<SPELL_ID>

Opciones:

data-wowhead="domain=es&lvl=<CHARACTER_LEVEL>"

Usar el character level real cuando esté disponible porque algunos spell tooltips escalan con nivel.

No usar item IDs para talentos.

Usar:
spellId

Si existe:
overriddenSpellId

investigar cuál de ambos corresponde al tooltip visual real en esa selección y utilizarlo de forma coherente.

No inventar spell IDs.

==================================================
27. FORMATO WOWHEAD PARA ITEMS EQUIPADOS
==================================================

Para equipment NO basta:

item=<ITEM_ID>

Necesitamos intentar representar la VARIANTE REAL equipada.

Wowhead soporta entre otros:

ench
gems
bonus
ilvl
pcs
lvl

Construir algo equivalente a:

href:
https://www.wowhead.com/item=<ITEM_ID>

data-wowhead:
domain=es
&ench=<ENCHANT_ID>
&gems=<GEM1>:<GEM2>:...
&bonus=<BONUS1>:<BONUS2>:...
&ilvl=<ACTUAL_ITEM_LEVEL>
&lvl=<CHARACTER_LEVEL>

Sólo incluir parámetros que existan.

Ejemplo conceptual:

data-wowhead="
  domain=es
  &ench=1234
  &gems=210000:210001
  &bonus=123:456:789
  &ilvl=331
  &lvl=90
"

La cadena real debe construirse SIN espacios.

==================================================
28. SET PIECES Y `pcs`
==================================================

Wowhead soporta:

pcs=itemID:itemID:itemID...

Esto sirve para que el tooltip calcule correctamente bonuses de set.

Si es posible determinar qué piezas equipadas pertenecen al mismo set, construir `pcs` con los item IDs EQUIPADOS correspondientes.

Ejemplo:

pcs=111:222:333:444

No poner todos los items del personaje indiscriminadamente.

Sólo los del set correspondiente.

Si no se puede determinar de forma fiable:
omitir pcs.

No inventarlo.

==================================================
29. GEMS
==================================================

Para el tooltip de la pieza:

gems debe usar ITEM IDs.

Formato:

gems=ITEM_ID:ITEM_ID:ITEM_ID

Utilizar:
`C_Item.GetItemGem`

o APIs actuales equivalentes para obtenerlos de forma fiable.

Para el hover SOBRE LA GEMA:

href:
https://www.wowhead.com/item=<GEM_ITEM_ID>

data-wowhead:
domain=es

Así el tooltip es de la gema individual.

==================================================
30. ENCHANTS: IMPORTANTE
==================================================

NO CONFUNDIR:

enchantId
con
spellId

Son identificadores diferentes.

Para MODIFICAR EL TOOLTIP DEL ITEM:

usar:

ench=<enchantId>

El enchantId está codificado en el ItemLink.

Para hacer hover sobre el pequeño icono/indicador del enchant y mostrar un tooltip INDEPENDIENTE:

usar un:

spell=<spellId>

SÓLO SI disponemos de un spellId resuelto de manera fiable.

Si sólo tenemos enchantId pero no spellId:

NO construir:
spell=enchantId

Eso sería incorrecto.

En ese caso:
- mostrar fallback local con el nombre del enchant
o
- no hacer tooltip Wowhead independiente para ese badge

pero el tooltip COMPLETO DEL ITEM seguirá mostrando el enchant mediante:

ench=<enchantId>

==================================================
31. BONUS IDs
==================================================

Wowhead:

bonus=BONUS_ID:BONUS_ID:...

Preservar TODOS los bonus IDs relevantes de la pieza equipada.

No conservar únicamente uno.

El tooltip del item debe representar correctamente:
- upgrade/version
- sockets
- tertiary stats
- dificultad/contexto
- etc.

cuando esos estados estén codificados mediante bonus IDs.

==================================================
32. ITEM LEVEL
==================================================

Para la pieza real:

añadir:

ilvl=<itemLevel>

cuando esté disponible.

Wowhead permite `ilvl` como override de item level.

Nos interesa para que lo mostrado coincida con lo que KeystoneSync capturó realmente.

==================================================
33. TOOLTIP TARGET COMPONENT
==================================================

Crear un componente reutilizable.

Ejemplo conceptual:

<WowheadTooltip
  type="item"
  id={item.itemId}
  options={{
    ench: item.enchant?.enchantId,
    gems: item.gems.map(...),
    bonus: item.bonusIds,
    ilvl: item.itemLevel,
    lvl: character.level,
    pcs: ...
  }}
>
  <GearItem ... />
</WowheadTooltip>

Y:

<WowheadTooltip
  type="spell"
  id={talent.spellId}
  options={{ lvl: character.level }}
>
   <TalentNode ... />
</WowheadTooltip>

No construir strings Wowhead manualmente en veinte componentes.

Crear helper tipado que serialice:

string
number
number[]
boolean

Arrays separados por `:`.

Parámetros separados por `&`.

==================================================
34. SEGURIDAD DE WOWHEAD TOOLTIP PARAMS
==================================================

Los atributos Wowhead deben construirse sólo desde valores ya tipados/sanitizados.

IDs:
integers positivos.

Arrays:
arrays de integers positivos.

No concatenar strings procedentes directamente del SavedVariables sin validación.

No permitir:
- HTML arbitrario
- javascript URLs
- atributos arbitrarios

El href debe construirse desde type + numeric ID mediante helper.

No aceptar una URL Wowhead arbitraria enviada por SavedVariables.

==================================================
35. TAURI + WOWHEAD
==================================================

KeystoneClient es Tauri.

Verifica que el script oficial de Wowhead funciona en:
- desarrollo
- build real Tauri

No darlo por válido únicamente porque funciona bajo Vite en browser.

Actualmente `tauri.conf.json` tiene:

security.csp = null

NO relajes seguridad adicional para esta feature.

Si introduces una CSP:
permitir únicamente los hosts estrictamente necesarios para Wowhead y los recursos ya utilizados por la app.

No convertir esto en:
script-src *
connect-src *
img-src *

Si mantener la CSP existente es la opción coherente con el estado actual, documentarlo.

==================================================
36. WOWHEAD: FALLBACK LOCAL
==================================================

Wowhead es enriquecimiento.

Si no está cargado:

Item:
- item name
- ilvl
- quality

Talent:
- talent name
- rank
- description local si Blizzard nos la proporcionó

Gem:
- gem name

Enchant:
- enchant name

Currency:
- currency name

Crear un tooltip/local fallback ligero si ya existe infraestructura adecuada.

No bloquear la interfaz esperando Wowhead.

==================================================
37. ICONOS
==================================================

Los iconos principales NO deben depender de que Wowhead los inyecte.

Usar:
- Blizzard iconFileID/iconPath
- assets locales
- metadata actual

Wowhead Tooltip:
hover enrichment.

Wowhead no debe reescribir nuestros iconos.

==================================================
38. TOOLTIP DE CURRENCIES
==================================================

Las currency cards pueden utilizar también Wowhead.

Para currencies:

href:
https://www.wowhead.com/currency=<ID>

Para item-based currency/status como:
Spark of Tides
Trovehunter's Bounty

usar:
item=<ID>

Reutilizar la metadata existente:

wowheadType
wowheadId

==================================================
39. WEB
==================================================

Mantener la integración existente de Wowhead Web.

Actualmente:

`keystone-web/app/layout.tsx`

ya carga el script oficial y configura:

whTooltips

No romperla.

Actualizar los helpers Web para compartir la semántica correcta cuando sea apropiado.

No es obligatorio compartir código físicamente entre Client y Web si genera un acoplamiento incorrecto de build, pero las reglas deben ser iguales.

==================================================
40. TOOLTIP DE KEYSTONELOOT
==================================================

Si la infraestructura reusable permite mejorar los tooltips actuales de KeystoneLoot sin introducir riesgo, reutilizar el nuevo helper.

Pero NO ampliar innecesariamente el scope de esta tarea.

Characters / Gear / Talents tienen prioridad.

==================================================
41. TALENT IMPORT STRING
==================================================

Guardar:

C_Traits.GenerateImportString(configID)

En la ventana de talentos:

[ Copiar build ]

Debe copiar el import string del loadout ACTUAL capturado.

Si no existe:
botón disabled.

NO regenerar el import string en Tauri.

El addon es quien lo obtiene.

==================================================
42. TOOLTIP EN TODOS LOS TALENTOS
==================================================

Cada nodo que represente una definición/spell real debe tener tooltip.

Selected o no selected.

Esto es importante:

NO sólo los talentos seleccionados.

Como vamos a representar el árbol entero, los nodos no seleccionados también necesitan:
- icono
- nombre
- tooltip

Por tanto el snapshot del addon debe recoger las entries/definitions necesarias para TODOS los nodos visibles, no únicamente los comprados.

==================================================
43. CHOICE NODES
==================================================

Si un nodo permite varias entries:

guardar todas las entries relevantes.

El cliente debe:
- mostrar la entry activa
- permitir tooltip sobre la representación mostrada
- indicar visualmente que es un choice node

No es necesario permitir CAMBIAR talentos desde KeystoneClient.

Characters es READ-ONLY.

==================================================
44. OMNIUM TOOLTIPS
==================================================

Igual que talents.

Si el Omnium node deriva en spellId:
Wowhead spell tooltip.

Si representa otra entidad y Blizzard expone otro ID:
usar el tipo Wowhead correcto sólo cuando pueda determinarse con certeza.

No inventar mappings.

Siempre mantener fallback local.

==================================================
45. READ ONLY
==================================================

Todo el sistema de:
- Gear
- Talents
- Omnium
- Currencies

es READ-ONLY.

KeystoneClient NO modifica:
- items
- talents
- loadouts
- Omnium

Sólo visualiza snapshots capturados dentro de WoW.

==================================================
46. EVENTS
==================================================

Equipment:
investigar y utilizar eventos apropiados como:

PLAYER_EQUIPMENT_CHANGED
UNIT_INVENTORY_CHANGED

Talents:
investigar eventos 12.1 actuales.

Omnium:
investigar eventos `C_Traits` / system apropiados.

Coalesce/debounce.

No escribir SavedVariables innecesariamente decenas de veces.

==================================================
47. UI VACÍA / DATOS ANTIGUOS
==================================================

Personajes sincronizados antes de esta feature:

equipment = missing
talents = missing
omniumFolio = missing

deben seguir funcionando.

Mostrar:

Gear:
"Sin datos de equipo. Entra con este personaje y sincroniza."

Talents:
botón disabled o mensaje equivalente.

Currencies:
usar snapshot disponible.

No crash.

==================================================
48. PREVIEW VISUAL
==================================================

Crear preview/fixture determinista de Characters.

Debe reproducir:

`keystone-client/design/characters-client.png`

con:
- Cuenta/Reino
- 7+ personajes
- Gold
- Gear 16 items en UNA FILA
- gems
- enchants
- 8 dungeons
- medals
- Great Vault
- Prey
- 10 currencies

Además crear fixture para el modal de talents:

Druid / Balance / Elune's Chosen, por ejemplo.

Debe contener suficientes nodos para validar:
- class
- hero
- spec
- edges
- selected/unselected
- choice
- rank 2
- Omnium

==================================================
49. PLAYWRIGHT VISUAL
==================================================

Validar 1672 × 941.

Characters:
- currencies completas
- no overflow
- Gear una fila
- Great Vault estrecho
- Prey estrecho
- dungeons 4×2
- filtros en rail

Talent modal:
- tres árboles visibles simultáneamente
- class izquierda
- hero centro
- spec derecha
- Omnium abajo
- edges detrás de nodes
- tooltips accesibles
- scroll/scale sólo si realmente es necesario
- modal usable en minWidth/minHeight actual

==================================================
50. TESTS WOWHEAD
==================================================

Tests específicos del helper.

ITEM:

input:
itemId=123
enchantId=456
gems=[1001,1002]
bonusIds=[2001,2002]
ilvl=331
lvl=90

output equivalente a:

href:
https://www.wowhead.com/item=123

data-wowhead:
domain=es&ench=456&gems=1001:1002&bonus=2001:2002&ilvl=331&lvl=90

El orden puede ser distinto si es determinista, pero el contenido debe ser equivalente.

Test:
undefined/null => parámetro omitido.

Test:
empty arrays => omitidos.

Test:
IDs inválidos => rechazados/omitidos.

SPELL:

spell ID correcto.

GEM:
item tooltip.

ENCHANT:
no confundir enchantId con spellId.

==================================================
51. TESTS TALENTS
==================================================

Probar:

- active config
- tree nodes
- positions
- edges
- selected node
- unselected node
- multi-rank
- choice node
- hero subtree
- import string
- empty/transient API snapshot no pisa snapshot válido
- spec change actualiza
- loadout change actualiza

==================================================
52. TESTS OMNIUM
==================================================

Probar:

- system 48
- config discovery mediante GetConfigIDBySystemID
- tree IDs derivados desde config
- selected nodes
- edges
- ranks
- transient unavailable
- snapshot backward compatibility

==================================================
53. TESTS EQUIPMENT
==================================================

Probar:

- 16 slots
- slot vacío
- itemId
- itemLink
- ilvl
- quality
- bonus IDs
- enchant ID
- gems
- item context si se conserva
- JSON
- event refresh

==================================================
54. TESTS CURRENCIES
==================================================

Probar:

Untainted ID 3356.

Coffer:
0 owned + 600/600 weekly => MAX.

Untainted:
143 owned + 250/250 => MAX.

Season cap.

Total cap.

No hardcoded caps.

Hero/Myth visibles.

Other Mistcrests no visibles.

==================================================
55. TESTS WORKER / SIDECAR
==================================================

Worker:
- equipment persisted
- talents persisted
- omnium persisted
- returned from /api/me/characters

Sidecar:
sanitize preserves:
- vault
- prey
- currency
- money
- M+
- equipment
- talents
- Omnium

Cache idem.

==================================================
56. NO MOCK COMO IMPLEMENTACIÓN
==================================================

Fixtures sólo para tests/previews.

La página real:
datos reales de usuario.

El addon:
datos reales de WoW.

No hardcodear el árbol de un Druid concreto.

No hardcodear item IDs del mock.

No hardcodear selected talents.

==================================================
57. REVISIÓN DE ARQUITECTURA
==================================================

Antes de crear funciones nuevas revisar:

Addon:
- GetCurrencyData
- GetMoneyData
- UpdateMythicPlusSeason

Client:
- TeamsPage
- CharacterService
- core/types
- core/season2
- themes
- character display helpers

Web:
- summary/page.tsx
- season2Currencies.ts
- colors.ts
- UpgradeMedal
- Wowhead integration actual

AlterEgo:
referencia técnica para:
- equipment
- gems
- enchant
- C_TooltipInfo

Raider.IO addon:
referencia para:
- C_Traits
- talent import/export

SimulationCraft addon:
referencia para:
- Omnium system ID 48

Pero KeystoneSync no debe depender runtime de ninguno.

==================================================
58. VALIDACIÓN FINAL
==================================================

Al terminar:

1. Addon tests completos.
2. Worker tests.
3. Worker typecheck.
4. Web tests.
5. Web build/typecheck.
6. Client frontend tests.
7. Sidecar tests.
8. Client build.
9. Tauri real build si el entorno lo permite.
10. Playwright.
11. Wowhead tooltip real en Tauri.
12. Tooltip de:
    - item
    - gem
    - enchant
    - class talent
    - spec talent
    - hero talent
    - Omnium
    - currency
13. `git diff --check`.

Revisión visual manual contra:

`keystone-client/design/characters-client.png`

==================================================
59. INFORME FINAL
==================================================

Al finalizar dame:

- resumen funcional;
- archivos modificados;
- migración creada;
- DTO final Currency;
- DTO final Equipment;
- DTO final Talents;
- DTO final Omnium;
- arquitectura Wowhead tooltip;
- formato exacto generado para un item de ejemplo;
- formato exacto generado para un talent de ejemplo;
- tests añadidos;
- resultados exactos;
- builds;
- Playwright;
- diferencias visuales respecto a characters-client.png;
- limitaciones reales de Wowhead encontradas;
- estado final de ambos working trees.

NO COMMIT.
NO PUSH.
NO RELEASE.
NO DEPLOY.
NO MIGRACIONES D1 REMOTAS.

==================================================
60. ORGANIZACIÓN LOCAL DE PERSONAJES
==================================================

La barra lateral divide los personajes visibles de la cuenta y reino seleccionados en dos zonas:
**Activos** e **Inactivos**. Las tarjetas pueden moverse en ambos sentidos mediante arrastre o con
el control accesible de cada tarjeta.

- Las dos zonas permanecen visibles y tienen scroll interno para conservar siempre un destino de
  arrastre alcanzable.
- Durante el arrastre la tarjeta usa 50 % de opacidad y un desenfoque sutil; al soltar o cancelar
  recupera inmediatamente su aspecto normal.
- Un personaje inactivo se oscurece, pero continúa sincronizándose y puede abrirse para consultar
  sus datos.
- La elección se guarda sólo en el `localStorage` versionado del cliente. No elimina datos, no
  modifica SavedVariables y no cambia ningún DTO del Worker, D1 o Web.

La barra lateral compacta la navegación en dos secciones plegables. Sus cabeceras redondeadas sólo
muestran el título y el chevron sobre una textura temática propia; el contenido queda ligeramente
sangrado, sin guías verticales:

- **Cuenta y reino** usa un solo selector jerárquico. El primer nivel muestra cuentas y cada cuenta
  despliega sus reinos hacia la derecha antes de seleccionar uno.
- **Personajes** contiene los activos y una bandeja **Inactivos** compacta por defecto. La bandeja
  acepta drops aunque esté cerrada y, al pulsarla, muestra sus tarjetas por encima de su cabecera.
  **Activos** se ajusta al número de tarjetas sin reservar huecos y conserva esa altura al abrir
  **Inactivos** siempre que ambas listas quepan. Sólo si se produciría una superposición, los activos
  ceden el espacio imprescindible y pasan a tener scroll interno.
- El personaje mostrado se identifica iluminando la tarjeta completa, sin borde interior ni cambio
  de tamaño.

==================================================
61. PULIDO FINAL DE INTERFAZ Y EQUIPO POR TIER
==================================================

- El menú nativo del WebView queda deshabilitado. En la sesión autenticada, el botón derecho abre
  un menú compacto temático con Sincronizar ahora, Cambiar avatar, Configuración y Minimizar a la
  bandeja; se mantiene dentro del viewport y se cierra al elegir, pulsar Escape o hacer clic fuera.
- El tick del avatar seleccionado se muestra a la derecha de su tarjeta como un cuadrado amarillo
  redondeado, separado del retrato circular.
- La cabecera de Mazmorras muestra el rating total en un chip integrado, con margen y padding
  propios. Prioriza `mythicPlusSeason.rating`, usa `rioScore` como respaldo y muestra `—` sin dato.
- Equipo muestra el desglose de piezas por tier procedente de Raider.IO, por ejemplo
  `2 Piezas de conjunto (T35) · 3 Piezas de conjunto (T36)`. Sin `tierPieces`, conserva el total
  genérico anterior.
