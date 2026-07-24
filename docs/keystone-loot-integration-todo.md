# KeystoneLoot Integration TODO

Objetivo: recoger la informacion que el usuario configura en el addon
[KeystoneLoot](https://github.com/Wolkenschutz/KeystoneLoot) para usarla en la web de KeystoneSync.

La funcionalidad principal a futuro sera sugerir automaticamente un personaje por cada miembro de un equipo cuando se elija una piedra concreta, priorizando los personajes que tienen objetos importantes en esa mazmorra.

## Contexto Detectado

KeystoneLoot guarda datos en dos SavedVariables:

- `KeystoneLootDB`: global de cuenta.
- `KeystoneLootCharDB`: por personaje.

Estructura importante de `KeystoneLootDB`:

```lua
KeystoneLootDB.favorites["Zul'jin-Spee-3"][558][255][251119] = {
    tier = 3,
    icon = 7259236,
}
```

Significado:

- `Zul'jin-Spee-3`: clave del personaje en formato `realm-character-classId`.
- `558`: sourceId. En dungeons suele ser el `challengeModeId`.
- `255`: specId.
- `251119`: itemId.
- `tier`: prioridad marcada por el usuario.
- `icon`: icono del item, opcional.
- `bonusIds`, `gems`, `enchant`: opcionales si vienen de import/export.

Tiers de KeystoneLoot:

- `1`: Nice to have.
- `2`: Must have.
- `3`: Best in Slot.
- `4`: Transmog.

Estructura importante de `KeystoneLootCharDB`:

```lua
KeystoneLootCharDB.voidcore = {
    [251079] = true,
    [249343] = true,
}
```

Esto indica items marcados como obtenidos/usados con Voidcore para ese personaje.

## Datos a Exportar Desde KeystoneSync Addon

Guardar en cada personaje dentro de `KeystoneSyncDB[key]`:

```lua
keystoneLoot = {
    installed = true,
    characterKey = "Zul'jin-Spee-3",
    classId = 3,
    favorites = {
        {
            sourceId = 558,
            sourceType = "dungeon",
            sourceName = "Magister's Terrace",
            sourceAbbr = "MT",
            specId = 255,
            itemId = 251119,
            tier = 3,
            icon = 7259236,
            slotId = 10,
            bonusIds = nil,
            gems = nil,
            enchant = nil,
            voidcoreUsed = false,
        }
    },
    voidcore = {
        checked = true,
        usedItems = { 251079, 249343 }
    }
}
```

## Implementacion Propuesta

### Fase 1: Addon

- Añadir `## OptionalDeps: KeystoneLoot` en `KeystoneSync.toc`.
- Detectar si `KeystoneLootDB` existe.
- Detectar si `KeystoneLootCharDB` existe.
- Construir la clave compatible con KeystoneLoot:

```lua
realm .. "-" .. character .. "-" .. classId
```

- Leer `KeystoneLootDB.favorites[characterKey]`.
- Aplanar favoritos en una lista simple.
- Leer `KeystoneLootCharDB.voidcore`.
- Marcar `voidcoreUsed = true` en favoritos cuyo `itemId` este en `KeystoneLootCharDB.voidcore`.
- Guardar el resultado en `KeystoneSyncDB[key].keystoneLoot`.

Notas:

- No tocar ni modificar datos de KeystoneLoot.
- Solo leer sus tablas si estan cargadas.
- Si KeystoneLoot no esta instalado, guardar `installed = false` o no guardar el bloque.

### Fase 2: Cliente

- Leer `entry.get("keystoneLoot")` desde `KeystoneSync.lua`.
- Enviarlo a la API dentro del payload.
- No mostrarlo en la UI del cliente por ahora.
- Al tocar cliente, reconstruir `.exe` e instalador.

### Fase 3: API

- Añadir columna JSON/texto en `characters`, por ejemplo:

```text
keystone_loot_json
```

- Añadir `keystoneLoot` al modelo de payload.
- Guardar el JSON recibido.
- Devolverlo en `/api/me/characters` y en endpoints de equipos.

### Fase 4: Web

- Mostrar informacion de KeystoneLoot en vistas futuras.
- Permitir usar los favoritos en equipos.
- Añadir opcion de privacidad en ajustes:

```text
Compartir wishlist de KeystoneLoot con mis equipos
```

Decidir si por defecto va activado o desactivado.

## Funcionalidad Objetivo: Sugerir Personajes Para Una Piedra

Entrada:

- Una piedra seleccionada de un personaje del equipo.
- Ejemplo: `Magister's Terrace +12`.

Proceso:

- Obtener `challengeMapId` de esa piedra.
- Buscar favoritos KeystoneLoot de todos los miembros del equipo para ese `sourceId`.
- Agrupar resultados por usuario/cuenta.
- Elegir el mejor personaje de cada miembro.

Sistema de puntuacion sugerido:

```text
Tier 3, Best in Slot: +100
Tier 2, Must Have:    +60
Tier 1, Nice:         +25
Tier 4, Transmog:     +5
voidcoreUsed:         -80 o excluir
```

Reglas:

- Contar un mismo item una sola vez si aparece en varias specs.
- Priorizar personajes con mas items utiles en esa dungeon.
- Si un personaje ya tiene todos los items marcados como `voidcoreUsed`, bajarlo de prioridad o excluirlo.
- Devolver como maximo un personaje recomendado por miembro del equipo.

Salida esperada:

```text
Piedra elegida: MT +12

Spee:
- Spee, 3 items BiS en MT

Zeyks:
- Zeykdh, 2 Must Have en MT

Thestral:
- Threstank, 1 BiS y 2 Must Have en MT
```

## Impacto En Releases

Si se implementa esta funcionalidad completa:

- Addon cambia: subir a `Speeson/KeystoneSync` y crear tag, previa confirmacion.
- Cliente cambia: subir a `Speeson/weeklyChar`, reconstruir instalador y preparar datos de release, previa confirmacion.
- API/Web cambian: subir a `Speeson/weeklyChar`, previa confirmacion.

No hacer push sin confirmacion explicita.
