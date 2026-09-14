# KeystoneClient 0.11.0

## Novedades

- Completa las previews del Planner con recomendaciones de clases externas para las plazas vacantes.
  - Mantiene cinco tarjetas en cada recomendación y representa los huecos con el fondo del rol, un avatar interrogante y hasta cuatro clases sugeridas.
  - Ordena las clases en el Worker por Ansia de sangre, resurrección en combate y el nivel compartido de buffos de clase y sinergia de daño.
  - Agrega las especializaciones internamente por clase, no altera el valor de botín y conserva compatibilidad con respuestas antiguas.
- Permite calcular el Planner con o sin completar los huecos de la composición.
  - Añade un switch Rellenar la composición antes del selector Quick/Advanced y lo mantiene activado por defecto.
  - Cuando se desactiva, el Worker ordena únicamente a los miembros elegidos y no devuelve tarjetas externas.
  - Centra las tarjetas restantes por filas de Tank/Healer y DPS cuando el grupo está incompleto.
  - Oculta la barra de scroll del panel lateral y muestra una flecha overlay sólo mientras queda contenido inferior.
- Añade recomendaciones Quick por clase y Advanced por especialización al Keystone Planner.
  - Usa datos versionados de impacto ofensivo, defensiva de grupo y utilidad específica de cada mazmorra para completar conjuntamente las plazas externas.
  - Agrupa diferencias pequeñas en bandas de equivalencia y vuelve a priorizar el scoring de loot y tiers dentro de cada estrato de composición.
  - Conserva y muestra todas las alternativas de vacante del mejor estrato activo en su orden real, sin promover artificialmente la opción seleccionada.
  - Muestra en Advanced las defensivas de grupo y utilidades de mazmorra más relevantes en una fila unificada de iconos, con overflow accesible mediante un indicador + sin recuadro.
  - Mantiene las cinco posiciones de grupo fijas por rol, usa un icono propio para el daño mixto y actualiza el perfil de daño al seleccionar otra alternativa DPS externa.
  - Resume la composición, los esenciales y todas las capacidades distintas de la party en tres secciones de iconos, ajustando dinámicamente el overflow al ancho disponible.
  - Distingue con un brillo propio los esenciales aportados por el externo seleccionado y mantiene accesible el popup de capacidades mientras el cursor se desplaza hasta él o hace scroll.
  - Corrige el recurso de Mistweaver, centra los iconos cuadrados y carga texturas de capacidad de mayor resolución para evitar desenfoque al ampliarlas.
  - Reutiliza por cálculo la evaluación de loot y los perfiles estáticos del Planner para evitar que combinaciones densas superen el límite de CPU del Worker.
  - Corrige Quick cuando el grupo seleccionado sólo contiene soportes: los DPS externos también reciben buffs mediante un perfil medio de clase y dejan de colapsar todas las clases a ganancia cero.
  - Incorpora en KeystoneClient un selector Quick/Advanced accesible, prioridades específicas por modo, iconos oficiales locales y explicaciones acotadas por vacante.
  - Conserva exactamente el contrato y comparator legacy para Keystone Web y no añade persistencia ni migraciones D1.

## Cambios

- Mejora el aprovechamiento del espacio y la legibilidad de la vista previa del Top 5.
  - Distribuye las tarjetas de personaje existentes por todo el ancho libre de la vista previa, sin reservar columnas vacías, y mantiene márgenes simétricos respecto a Objetivos, Preferidos y Valor de botín.
  - Aumenta el tamaño de objetivos, preferidos, nombres y propietarios, y destaca el nombre del personaje con un tratamiento de clase más visible.
  - Aumenta también el tamaño de las etiquetas de Prioridades del grupo para facilitar su lectura.
