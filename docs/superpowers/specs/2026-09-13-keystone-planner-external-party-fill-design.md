# Keystone Planner: relleno externo de party y ajuste de la preview

## Objetivo

Completar visualmente y analizar cada recomendacion del Top 5 como una party de cinco plazas, aunque
se hayan seleccionado menos de cinco miembros del Team. Las plazas vacantes propondran clases
externas que cubran el rol que falta y mejoren la composicion real. Este cambio tambien aprovecha
mejor el ancho de la preview sin volver a juntar el rango con los contadores.

## Comportamiento aprobado

### Cinco plazas en cada recomendacion

Cada fila del Top 5 mostrara exactamente cinco tarjetas:

- los miembros seleccionados conservan su tarjeta normal;
- cada plaza que falte se representa mediante una tarjeta externa;
- la formacion obligatoria sigue siendo un Tank, un Healer y tres DPS;
- si faltan varias plazas, se calculan conjuntamente para evitar recomendaciones redundantes o una
  combinacion global peor;
- los externos no aportan objetivos, preferencias jugadas ni valor de botin.

El Worker evaluara la mejor complecion externa de cada recomendacion real. Su calidad de composicion
podra decidir entre recomendaciones empatadas en los criterios anteriores, pero nunca inflara los
contadores de objetivos/preferidos ni el valor de botin.

### Prioridad de relleno

La viabilidad del rol es una restriccion previa, no una preferencia. Sobre las combinaciones viables,
la prioridad lexicografica sera:

1. Ansia de sangre (`BLOODLUST`).
2. Resurreccion en combate (`BATTLE_REZ`).
3. Buffos de clase y sinergia de dano, en el mismo nivel de prioridad.
4. Orden estable por clase como ultimo desempate tecnico.

Cada interruptor actual del Planner activa o elimina su criterio. Si la optimizacion de composicion
esta desactivada, las tarjetas externas siguen rellenando los roles, pero las clases compatibles se
ordenan de forma estable sin atribuirles una superioridad tactica.

La disponibilidad garantizada de una utilidad supera a la condicional. Una utilidad ya cubierta no
vuelve a sumar por duplicado; importa la cobertura nueva de la party completada.

### Equivalencia de buffos ofensivos

`classBuffs` y `damageSynergy` permanecen como controles distintos, pero aportan al mismo escalon de
comparacion del relleno externo. No se sumaran como dos prioridades consecutivas capaces de ganar
dos veces por el mismo beneficio.

Dentro de ese escalon se calcula primero el beneficio ofensivo pertinente para los DPS reales:

- party orientada a dano magico: Intelecto Arcano compite con Marca del Caos;
- party orientada a dano fisico: Grito de batalla compite con Toque mistico;
- una clase cuyo efecto no beneficia al perfil dominante queda por debajo de otra que si lo hace,
  pero por encima de una clase que no aporta ningun efecto nuevo cuando no existe una alternativa
  mas pertinente;
- una composicion mixta pondera los beneficiarios efectivos de cada opcion, no una etiqueta global
  binaria;
- los demas buffos de clase nuevos se consideran en este mismo escalon, despues del beneficio
  ofensivo pertinente y antes del desempate alfabetico.

Los valores actuales de referencia son 3% para Intelecto Arcano y Marca del Caos, y 5% para Grito de
batalla y Toque mistico. Esta igualdad nominal solo permite agrupar cada pareja dentro de su contexto:
Intelecto o poder de ataque y aumento de dano recibido no son la misma base matematica. Por ello el
Planner no afirmara una equivalencia exacta de DPS ni inventara una simulacion. Usara como puntuacion
la suma de DPS beneficiados efectivamente por el efecto que falta y la cobertura nueva. Si dos efectos
benefician al mismo numero de DPS, se consideran empatados en este criterio y deciden las restantes
aportaciones nuevas y, finalmente, el orden estable; el porcentaje nominal no rompe ese empate.

El catalogo central de especializaciones incorporara el atributo ofensivo necesario para distinguir
DPS basados en Intelecto de DPS basados en poder de ataque. El perfil `magical`/`physical` existente
seguira indicando el tipo de dano que aprovecha Marca del Caos o Toque mistico. Los datos desconocidos
no recibiran beneficios supuestos.

### Las opciones visibles son clases, no especializaciones

La especializacion solo se usa dentro del Worker para demostrar que una clase puede ocupar el rol
vacante. Una clase se agrega una unica vez aunque tenga varias specs compatibles. El resultado
publico y la interfaz no enumeran specs, no muestran sus iconos y no convierten Mage en tres opciones.

Cada candidato de clase incluye un identificador canonico de clase, las capacidades que aportaria y
codigos de motivo suficientes para explicar su posicion. El orden ya llega resuelto desde el Worker;
el Client no reconstruye ni modifica el scoring.

Para el rol vacante, una capacidad es `guaranteed` si todas las variantes internas viables de esa
clase la proporcionan, y `conditional` si depende de elegir una spec, talento, mascota u otra
configuracion concreta. Esa distincion puede explicarse sin revelar ni listar las specs candidatas.

Cada vacante conserva todas las clases viables ordenadas por su calidad marginal dentro de la mejor
complecion posible de las demas plazas. La preview muestra las cuatro primeras y el desglose puede
mostrar el resto. Asi se presentan alternativas utiles aunque no sean empates exactos.

## Presentacion en KeystoneClient

### Geometria de la fila

- Se restaura la separacion anterior entre `#1`/`#2` y el bloque de Objetivos/Preferidos.
- El bloque de contadores mantiene un margen claro antes de la primera tarjeta.
- Las cinco tarjetas forman una rejilla de columnas iguales y ocupan todo el ancho util restante.
- `VALOR DE BOTIN` se divide explicitamente en dos lineas (`VALOR DE` y `BOTIN`) y mantiene la cifra
  legible, liberando ancho para las tarjetas.
- El margen entre la ultima tarjeta y el bloque de valor replica visualmente el margen existente
  entre los contadores y la primera tarjeta.

### Tarjeta externa

La tarjeta externa tiene las mismas dimensiones y conserva el fondo cromatico/icono de su rol:

- avatar con una interrogacion ornamentada, centrado horizontal y verticalmente;
- sin nombre, username, spec jugada, spec de botin ni bolsa, pero con el texto de "External" en ingles para el cliente ingles como titulo encima del avatar, centrado horizontalmente como si fuera el nombre;
- hasta cuatro iconos de clase, uno en cada esquina, con el tamano de los iconos actuales de spec;
- si hay mas de cuatro opciones, boton `+` centrado en el borde inferior;
- el boton abre una ventana flotante con todas las **clases** candidatas y el motivo resumido de cada
  una; nunca desglosa specs;
- nombres accesibles describen `Plaza externa`, el rol, cada clase y la utilidad propuesta.

Ejemplo: si falta un DPS y tambien falta Ansia, la tarjeta puede mostrar Shaman, Mage, Evoker y Hunter
en sus cuatro esquinas. Si la party ya cubre utilidades criticas y predomina el dano magico, Mage o
Demon Hunter deben superar a Warrior; Warrior aun puede superar a una clase que no aporte nada nuevo.

## Contrato y compatibilidad

El calculo pertenece a `keystone-worker/src/keystonePlanner.ts` y los metadatos de clase/spec a
`keystone-worker/src/wowComposition.ts`. No se persiste ninguna sugerencia y no hay migracion D1.

El sidecar y los parsers actuales proyectan solo las propiedades conocidas de cada vacante. Esto
permite una extension aditiva de respuesta sin romper clientes publicados:

- el Worker añade `candidateClasses` como propiedad opcional de cada vacante;
- los clientes antiguos y la Web actual ignoran esa propiedad y conservan su presentacion;
- el Client nuevo valida y conserva `candidateClasses` cuando esta presente;
- si el Client nuevo se conecta temporalmente a un Worker anterior, muestra la plaza externa generica
  sin iconos de clase, en vez de rechazar toda la recomendacion;
- `preferredCapabilities` se conserva para compatibilidad y para el resumen existente;
- el orden operativo recomendado sigue siendo desplegar el Worker antes de publicar el Client;
- la Web conserva su presentacion actual en esta fase.

Forma conceptual de la extension, sin IDs de especializacion:

```ts
type PlannerExternalClassCandidate = {
  wowClass: WowClassName
  contributions: Array<{
    capabilityId: CapabilityId
    availability: 'guaranteed' | 'conditional'
  }>
  reasonCodes: ExternalClassReasonCode[]
}

type PlannerVacancy = {
  role: WowRole
  preferredCapabilities: CapabilityId[]
  candidateClasses?: PlannerExternalClassCandidate[]
}
```

Cuando faltan varias plazas, cada alternativa se puntua condicionada a la mejor eleccion posible para
las demas vacantes. La interfaz no debe interpretar la primera clase de todas las tarjetas como una
combinacion obligatoria si esas primeras opciones se excluyen entre si. El fingerprint de los miembros
reales permanece estable; las sugerencias derivadas no crean duplicados del Top 5.

## Fuentes de verdad y mantenimiento

El catalogo versionado del Worker sera la unica fuente runtime. Los valores y descripciones sensibles
al parche se verifican antes de cambiarlos. Referencias revisadas para este diseno:

- Blizzard, notas de Battle for Azeroth sobre [Intelecto Arcano y Toque mistico](https://worldofwarcraft.blizzard.com/en-us/news/21959894).
- Warcraft Wiki: [Arcane Intellect](https://warcraft.wiki.gg/wiki/Arcane_Intellect),
  [Battle Shout](https://warcraft.wiki.gg/wiki/Battle_Shout) y
  [Mystic Touch](https://warcraft.wiki.gg/wiki/Mystic_Touch).
- Wowhead: [Chaos Brand](https://www.wowhead.com/spell=1490/chaos-brand).

## Criterios de aceptacion

1. Toda preview contiene cinco tarjetas y respeta 1 Tank, 1 Healer y 3 DPS.
2. Una clase aparece una sola vez por vacante aunque tenga varias specs viables.
3. El Client no recibe ni muestra una lista de specs externas.
4. En party magica, Mage/Demon Hunter pertinentes superan a Warrior si no faltan utilidades mayores;
   en party fisica sucede lo equivalente con Warrior/Monk.
5. Una aportacion ofensiva no pertinente puede superar a una clase sin aportacion, pero no a la
   alternativa pertinente del mismo escalon.
6. Las opciones de dos o mas plazas se optimizan conjuntamente y de forma determinista.
7. Externos no alteran objetivos, preferencias ni valor de botin.
8. Se recupera el margen original de rango/contadores, el valor usa dos lineas y las cinco tarjetas
   ensanchan hasta ocupar el espacio simetrico disponible.
9. Clientes publicados ignoran de forma segura la extension; la Web y D1 no requieren cambios.

## Fuera de alcance

- Simular DPS, talentos, equipo, logs, nivel de habilidad o balance concreto de una spec.
- Recomendar nombres de jugadores externos o buscarlos en servicios de terceros.
- Persistir candidatos, modificar el addon o publicar deploys/releases.
