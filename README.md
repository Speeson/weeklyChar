# WoW Keystone Tracker

Proyecto para registrar y sincronizar información de personajes de **World of Warcraft Retail**, especialmente la **piedra angular mítica+ actual** de cada personaje.

La idea general es construir el sistema en tres fases:

1. Crear un addon de World of Warcraft que lea la piedra actual del personaje.
2. Crear un sincronizador externo que lea los datos guardados por el addon y los envíe a una API.
3. Crear una página web donde consultar los personajes, su piedra actual y, más adelante, otros datos como item level, Raider.IO, míticas realizadas, etc.

---

## Objetivo del proyecto

El objetivo principal es disponer de una página web que muestre información actualizada de varios personajes de World of Warcraft Retail.

Información deseada:

- Nombre del personaje.
- Reino.
- Región.
- Clase.
- Especialización, si es posible en fases futuras.
- Item level, mediante API de Blizzard o Raider.IO.
- Raider.IO score, mediante API de Raider.IO.
- Piedra angular actual:
  - mazmorra;
  - nivel;
  - fecha de última actualización;
  - personaje al que pertenece.
- Historial de cambios de piedra, opcional.
- Datos de piedras completadas, opcional.

La parte más importante de la primera fase es comprobar que se puede obtener de forma fiable la piedra actual del personaje desde un addon.

---

## Limitación importante

Los addons de World of Warcraft no deben plantearse como una aplicación normal con acceso libre a internet.

El addon **no enviará directamente peticiones HTTP** a la página web.

El flujo correcto será:

```text
Addon de WoW
   ↓
Lee la piedra actual del personaje
   ↓
Guarda los datos en SavedVariables
   ↓
Un sincronizador externo lee ese archivo
   ↓
El sincronizador envía los datos a una API web
   ↓
La web actualiza la información del personaje
```

---

# Fase 1: Addon de World of Warcraft

## Nombre provisional del addon

```text
KeystoneSync
```

## Objetivo del addon

Crear un addon mínimo para World of Warcraft Retail que:

- detecte el personaje actual;
- detecte el reino actual;
- lea la piedra angular actual del personaje;
- guarde los datos en SavedVariables;
- actualice los datos al iniciar sesión;
- actualice los datos al finalizar una mazmorra mítica+;
- permita forzar una actualización manual con un comando de chat.

---

## Funciones de la API de WoW a utilizar

El addon deberá utilizar funciones internas de World of Warcraft relacionadas con Mythic+.

Funciones principales:

```lua
C_MythicPlus.GetOwnedKeystoneLevel()
C_MythicPlus.GetOwnedKeystoneChallengeMapID()
C_MythicPlus.GetOwnedKeystoneMapID()
```

También se podrán usar funciones generales del personaje:

```lua
UnitName("player")
GetRealmName()
time()
```

---

## Eventos a escuchar

El addon deberá escuchar los siguientes eventos:

```lua
PLAYER_LOGIN
CHALLENGE_MODE_COMPLETED
```

### PLAYER_LOGIN

Se usará para leer la piedra actual cuando el jugador entre con un personaje.

### CHALLENGE_MODE_COMPLETED

Se usará para detectar que una mazmorra mítica+ ha finalizado.

Importante: después de este evento, la piedra puede tardar unos segundos en actualizarse. Por eso, no se debe hacer una única lectura inmediata.

Se recomienda hacer varias lecturas retardadas:

```text
Al completar una piedra:
- leer a los 5 segundos;
- leer a los 10 segundos;
- leer a los 20 segundos;
- guardar el último dato válido.
```

---

## Comando manual

El addon deberá incluir un comando manual para forzar la lectura de la piedra:

```text
/ksync
```

Al ejecutar el comando, el addon deberá:

1. leer la piedra actual;
2. guardar los datos en SavedVariables;
3. mostrar un mensaje en el chat indicando el resultado.

Ejemplo:

```text
[KeystoneSync] Piedra actual guardada: Ara-Kara +8
```

Si el personaje no tiene piedra:

```text
[KeystoneSync] No se ha detectado ninguna piedra actual para este personaje.
```

---

## Estructura inicial del addon

La estructura del addon debería ser:

```text
KeystoneSync/
├── KeystoneSync.toc
├── KeystoneSync.lua
└── README.md
```

---

## Archivo KeystoneSync.toc

Ejemplo base:

```toc
## Interface: 110000
## Title: KeystoneSync
## Notes: Guarda la piedra mítica+ actual del personaje en SavedVariables.
## Author: Esteban
## Version: 0.1.0
## SavedVariables: KeystoneSyncDB

KeystoneSync.lua
```

El número de `Interface` deberá ajustarse a la versión actual de World of Warcraft Retail.

---

## Archivo KeystoneSync.lua

El addon deberá implementar, como mínimo:

- creación de frame;
- registro de eventos;
- función para leer piedra;
- función para guardar datos;
- comando `/ksync`;
- mensajes básicos por chat.

Pseudocódigo esperado:

```lua
local frame = CreateFrame("Frame")

frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("CHALLENGE_MODE_COMPLETED")

local function GetCharacterKey()
    local character = UnitName("player")
    local realm = GetRealmName()
    return realm .. "-" .. character
end

local function SaveCurrentKeystone(reason)
    KeystoneSyncDB = KeystoneSyncDB or {}

    local character = UnitName("player")
    local realm = GetRealmName()
    local key = GetCharacterKey()

    local level = C_MythicPlus.GetOwnedKeystoneLevel()
    local challengeMapId = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
    local mapId = C_MythicPlus.GetOwnedKeystoneMapID()

    KeystoneSyncDB[key] = KeystoneSyncDB[key] or {}

    KeystoneSyncDB[key].character = character
    KeystoneSyncDB[key].realm = realm
    KeystoneSyncDB[key].region = "eu"
    KeystoneSyncDB[key].keystoneLevel = level
    KeystoneSyncDB[key].keystoneChallengeMapId = challengeMapId
    KeystoneSyncDB[key].keystoneMapId = mapId
    KeystoneSyncDB[key].updatedAt = time()
    KeystoneSyncDB[key].updatedReason = reason

    KeystoneSyncDB[key].history = KeystoneSyncDB[key].history or {}

    table.insert(KeystoneSyncDB[key].history, {
        keystoneLevel = level,
        keystoneChallengeMapId = challengeMapId,
        keystoneMapId = mapId,
        updatedAt = time(),
        updatedReason = reason
    })

    print("[KeystoneSync] Piedra actual guardada.")
end

frame:SetScript("OnEvent", function(self, event)
    if event == "PLAYER_LOGIN" then
        SaveCurrentKeystone("PLAYER_LOGIN")
    end

    if event == "CHALLENGE_MODE_COMPLETED" then
        C_Timer.After(5, function()
            SaveCurrentKeystone("CHALLENGE_MODE_COMPLETED_5S")
        end)

        C_Timer.After(10, function()
            SaveCurrentKeystone("CHALLENGE_MODE_COMPLETED_10S")
        end)

        C_Timer.After(20, function()
            SaveCurrentKeystone("CHALLENGE_MODE_COMPLETED_20S")
        end)
    end
end)

SLASH_KEYSTONESYNC1 = "/ksync"

SlashCmdList["KEYSTONESYNC"] = function()
    SaveCurrentKeystone("MANUAL_COMMAND")
end
```

Este código es orientativo. La implementación final deberá validar errores y casos sin piedra.

---

## Datos esperados en SavedVariables

El addon deberá generar un archivo similar a:

```text
World of Warcraft/_retail_/WTF/Account/NOMBRE_CUENTA/SavedVariables/KeystoneSync.lua
```

Con una estructura similar a:

```lua
KeystoneSyncDB = {
    ["Dun Modr-NombrePersonaje"] = {
        character = "NombrePersonaje",
        realm = "Dun Modr",
        region = "eu",
        keystoneLevel = 8,
        keystoneChallengeMapId = 503,
        keystoneMapId = 2293,
        updatedAt = 1780000000,
        updatedReason = "CHALLENGE_MODE_COMPLETED_20S",
        history = {
            {
                keystoneLevel = 7,
                keystoneChallengeMapId = 499,
                keystoneMapId = 2289,
                updatedAt = 1779999000,
                updatedReason = "PLAYER_LOGIN"
            },
            {
                keystoneLevel = 8,
                keystoneChallengeMapId = 503,
                keystoneMapId = 2293,
                updatedAt = 1780000000,
                updatedReason = "CHALLENGE_MODE_COMPLETED_20S"
            }
        }
    }
}
```

---

## Casos que debe contemplar el addon

El addon debe funcionar correctamente en estos escenarios:

### Personaje con piedra

Debe guardar:

- personaje;
- reino;
- nivel de piedra;
- identificador de mazmorra;
- fecha de actualización;
- motivo de actualización.

### Personaje sin piedra

Debe guardar el personaje igualmente, pero indicando que no tiene piedra.

Ejemplo:

```lua
keystoneLevel = nil
keystoneChallengeMapId = nil
hasKeystone = false
```

### Al finalizar una mítica en tiempo

Debe esperar unos segundos y guardar la nueva piedra.

### Al finalizar una mítica fuera de tiempo

Debe esperar unos segundos y guardar la piedra actualizada, aunque haya bajado de nivel.

### Al cambiar de personaje

Debe guardar la información separada por personaje y reino.

### Al ejecutar `/reload`

Debe mantener la información guardada mediante SavedVariables.

---

## Criterios de aceptación de la fase 1

La fase 1 se considerará correcta si:

- El addon aparece en la lista de addons de WoW Retail.
- No genera errores Lua al iniciar sesión.
- El comando `/ksync` funciona.
- Se crea correctamente el archivo `KeystoneSync.lua` en SavedVariables.
- El archivo contiene el personaje, reino y datos de piedra.
- Al completar una mítica+, el addon actualiza el registro tras unos segundos.
- Si se usan varios personajes, cada uno queda guardado con su propia clave.

---

# Fase 2: Sincronizador externo

## Objetivo

Crear una pequeña aplicación externa que lea el archivo `KeystoneSync.lua` generado por el addon y envíe los datos a una API web.

Esta aplicación puede hacerse en:

- Python;
- Node.js;
- C#;
- cualquier lenguaje que permita leer archivos locales y hacer peticiones HTTP.

Para una primera versión, se recomienda Python por simplicidad.

---

## Nombre provisional

```text
keystone-sync-client
```

---

## Responsabilidades del sincronizador

El sincronizador deberá:

1. localizar el archivo de SavedVariables;
2. leer los datos generados por el addon;
3. transformar la estructura Lua a JSON;
4. detectar cambios nuevos;
5. enviar los datos a una API mediante HTTP;
6. registrar errores;
7. reintentar si la API no está disponible.

---

## Ruta configurable

La ruta del archivo deberá poder configurarse.

Ejemplo en `.env`:

```env
KEYSTONE_SAVED_VARIABLES_PATH=C:/Program Files (x86)/World of Warcraft/_retail_/WTF/Account/ACCOUNT_NAME/SavedVariables/KeystoneSync.lua
API_BASE_URL=http://localhost:8000
API_TOKEN=change-me
```

---

## Payload esperado

El sincronizador deberá enviar un JSON similar a:

```json
{
  "character": "NombrePersonaje",
  "realm": "Dun Modr",
  "region": "eu",
  "keystoneLevel": 8,
  "keystoneChallengeMapId": 503,
  "keystoneMapId": 2293,
  "updatedAt": 1780000000,
  "updatedReason": "CHALLENGE_MODE_COMPLETED_20S"
}
```

---

## Endpoint de prueba

La API deberá exponer inicialmente un endpoint como:

```http
POST /api/keystones/update
```

Con cabecera de autenticación simple:

```http
Authorization: Bearer change-me
```

---

## Respuesta esperada de la API

Ejemplo correcto:

```json
{
  "status": "ok",
  "message": "Keystone updated",
  "character": "NombrePersonaje",
  "realm": "Dun Modr"
}
```

Ejemplo con error:

```json
{
  "status": "error",
  "message": "Invalid API token"
}
```

---

## Modo de ejecución

El sincronizador debería permitir dos modos:

### Modo manual

Ejecutar una vez y sincronizar:

```bash
python sync.py
```

### Modo watch

Quedarse escuchando cambios en el archivo:

```bash
python sync.py --watch
```

En modo `watch`, cada vez que detecte cambios en `KeystoneSync.lua`, deberá leer el archivo y enviar los datos actualizados.

---

## Criterios de aceptación de la fase 2

La fase 2 se considerará correcta si:

- El sincronizador lee correctamente el archivo `KeystoneSync.lua`.
- Convierte los datos del personaje a JSON.
- Envía una petición `POST` a la API.
- La API recibe los datos.
- Si el token es incorrecto, la API rechaza la petición.
- Si la API no está disponible, el sincronizador muestra un error claro.
- Si el archivo cambia, el modo `watch` vuelve a enviar los datos.

---

# Fase 3: API y página web

## Objetivo

Crear una aplicación web donde se pueda consultar la información de los personajes registrados.

La web deberá mostrar inicialmente:

- listado de personajes;
- piedra actual;
- nivel de piedra;
- mazmorra;
- fecha de última actualización;
- motivo de actualización;
- historial básico de cambios.

Más adelante podrá integrar datos externos de Blizzard y Raider.IO.

---

## Stack recomendado

Para una primera versión sencilla:

```text
Frontend: React, Next.js o similar
Backend: FastAPI, Node.js/Express o similar
Base de datos: PostgreSQL o SQLite para pruebas
```

Si se quiere avanzar rápido, una opción cómoda sería:

```text
Frontend + Backend: Next.js
Base de datos: PostgreSQL
ORM: Prisma
```

Otra opción muy alineada con proyectos anteriores:

```text
Backend: FastAPI
Base de datos: PostgreSQL
Frontend: React
```

---

## Modelo de datos inicial

### Tabla characters

```sql
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    realm VARCHAR(100) NOT NULL,
    region VARCHAR(10) NOT NULL DEFAULT 'eu',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, realm, region)
);
```

### Tabla keystones

```sql
CREATE TABLE keystones (
    id SERIAL PRIMARY KEY,
    character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    keystone_level INTEGER,
    keystone_challenge_map_id INTEGER,
    keystone_map_id INTEGER,
    updated_reason VARCHAR(100),
    source VARCHAR(50) DEFAULT 'addon',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Vista lógica deseada

Cada personaje debe tener una piedra actual, pero también se puede conservar historial.

La piedra actual será la última entrada de `keystones` para ese personaje.

---

## Endpoint principal

### Actualizar piedra

```http
POST /api/keystones/update
```

Body:

```json
{
  "character": "NombrePersonaje",
  "realm": "Dun Modr",
  "region": "eu",
  "keystoneLevel": 8,
  "keystoneChallengeMapId": 503,
  "keystoneMapId": 2293,
  "updatedAt": 1780000000,
  "updatedReason": "CHALLENGE_MODE_COMPLETED_20S"
}
```

Comportamiento esperado:

1. Validar token.
2. Buscar personaje por nombre, reino y región.
3. Si no existe, crearlo.
4. Insertar nuevo registro de piedra.
5. Marcar esa piedra como la más reciente del personaje.
6. Devolver respuesta JSON.

---

## Endpoints secundarios

### Listar personajes

```http
GET /api/characters
```

Debe devolver:

```json
[
  {
    "id": 1,
    "name": "NombrePersonaje",
    "realm": "Dun Modr",
    "region": "eu",
    "currentKeystone": {
      "level": 8,
      "challengeMapId": 503,
      "mapId": 2293,
      "updatedAt": "2026-05-25T14:30:00"
    }
  }
]
```

### Ver detalle de personaje

```http
GET /api/characters/{id}
```

Debe devolver:

```json
{
  "id": 1,
  "name": "NombrePersonaje",
  "realm": "Dun Modr",
  "region": "eu",
  "currentKeystone": {
    "level": 8,
    "challengeMapId": 503,
    "mapId": 2293,
    "updatedAt": "2026-05-25T14:30:00"
  },
  "history": [
    {
      "level": 7,
      "challengeMapId": 499,
      "updatedReason": "PLAYER_LOGIN",
      "createdAt": "2026-05-25T13:00:00"
    },
    {
      "level": 8,
      "challengeMapId": 503,
      "updatedReason": "CHALLENGE_MODE_COMPLETED_20S",
      "createdAt": "2026-05-25T14:30:00"
    }
  ]
}
```

---

## Interfaz web inicial

La página principal deberá mostrar una tabla de personajes:

| Personaje | Reino | Región | Piedra actual | Nivel | Última actualización |
|---|---|---|---|---|---|
| NombrePersonaje | Dun Modr | EU | Ara-Kara | +8 | 25/05/2026 14:30 |

La primera versión puede mostrar el `challengeMapId` directamente si todavía no existe una tabla de traducción de mazmorras.

Más adelante se deberá añadir un mapeo de `challengeMapId` a nombre de mazmorra.

---

## Mapeo de mazmorras

El addon probablemente guardará identificadores como:

```text
keystoneChallengeMapId
keystoneMapId
```

La web deberá traducir esos identificadores a nombres visibles.

Ejemplo:

```json
{
  "503": "Ara-Kara, Ciudad de los Ecos",
  "499": "Priorato de la Llama Sagrada"
}
```

Este mapeo puede mantenerse inicialmente como un archivo local:

```text
data/dungeons.json
```

En fases posteriores se podrá obtener información desde APIs externas.

---

# Fase 4: Integración futura con Blizzard y Raider.IO

## Blizzard API

En fases posteriores, la aplicación podrá consultar la API oficial de Blizzard para obtener:

- datos básicos del personaje;
- clase;
- raza;
- nivel;
- equipo;
- item level;
- media/render del personaje;
- información adicional del perfil.

---

## Raider.IO API

La API de Raider.IO se podrá usar para obtener:

- Raider.IO score;
- mejores mazmorras de la temporada;
- runs recientes;
- progreso de raid;
- ranking;
- información pública del personaje.

---

## Datos que NO dependerán inicialmente de Blizzard

La piedra actual del personaje no dependerá de la API web de Blizzard.

La fuente principal para la piedra actual será:

```text
Addon KeystoneSync → SavedVariables → Sincronizador externo → Web
```

---

# Flujo completo esperado

```text
1. El jugador entra en WoW con un personaje.
2. El addon KeystoneSync ejecuta PLAYER_LOGIN.
3. El addon lee la piedra actual.
4. El addon guarda los datos en SavedVariables.
5. El sincronizador externo detecta cambios en KeystoneSync.lua.
6. El sincronizador convierte los datos a JSON.
7. El sincronizador envía los datos a la API.
8. La API guarda o actualiza el personaje.
9. La web muestra la piedra actual.

Después de completar una mítica+:

1. WoW lanza CHALLENGE_MODE_COMPLETED.
2. El addon espera 5, 10 y 20 segundos.
3. El addon lee de nuevo la piedra.
4. El addon guarda la nueva piedra.
5. El sincronizador externo detecta el cambio.
6. El sincronizador envía la actualización a la API.
7. La web muestra la nueva piedra.
```

---

# Seguridad básica

La API no debe aceptar actualizaciones sin autenticación.

Para la primera versión se usará un token simple:

```env
API_TOKEN=change-me
```

El sincronizador enviará:

```http
Authorization: Bearer change-me
```

La API rechazará cualquier petición sin token o con token incorrecto.

En el futuro se podrá mejorar con:

- usuarios;
- login;
- claves por jugador;
- tokens rotativos;
- panel privado;
- HTTPS obligatorio.

---

# Roadmap

## Versión 0.1

- Addon mínimo.
- Comando `/ksync`.
- Guardado en SavedVariables.
- Lectura al iniciar sesión.
- Lectura al completar mítica+.

## Versión 0.2

- Sincronizador externo.
- Conversión de SavedVariables a JSON.
- Envío a API local.
- Token básico.

## Versión 0.3

- Backend con endpoint de actualización.
- Base de datos.
- Listado de personajes.

## Versión 0.4

- Página web con tabla de personajes.
- Historial de piedras.
- Traducción de IDs de mazmorra a nombres.

## Versión 0.5

- Integración con Raider.IO.
- Mostrar Raider.IO score.
- Mostrar mejores runs.
- Mostrar progreso.

## Versión 0.6

- Integración con Blizzard API.
- Mostrar item level.
- Mostrar equipo.
- Mostrar clase, raza y avatar.

---

# Prioridad de desarrollo

El orden recomendado es:

1. Addon mínimo.
2. Comprobar que lee bien la piedra.
3. Comprobar que actualiza tras completar una mítica+.
4. Guardar correctamente en SavedVariables.
5. Crear sincronizador externo.
6. Probar envío a una API local.
7. Crear backend real.
8. Crear web.
9. Añadir Raider.IO.
10. Añadir Blizzard API.

---

# Prueba inicial recomendada

Antes de construir la web completa, se recomienda hacer una prueba mínima:

```text
Addon → SavedVariables → Script externo → API local fake
```

Por ejemplo:

1. Instalar el addon.
2. Entrar con un personaje.
3. Ejecutar `/ksync`.
4. Comprobar que se genera `KeystoneSync.lua`.
5. Ejecutar el sincronizador.
6. Comprobar que la API local recibe el JSON.
7. Completar una mítica+.
8. Esperar 20 segundos.
9. Comprobar que el archivo cambia.
10. Comprobar que la API recibe la nueva piedra.

---

# Criterio final de éxito

El proyecto se considerará funcional cuando:

- un personaje complete una piedra mítica+;
- el addon detecte el cambio;
- la nueva piedra quede guardada localmente;
- el sincronizador la envíe a la API;
- la web muestre la piedra actualizada sin introducirla manualmente.
