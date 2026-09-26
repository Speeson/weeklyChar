<!-- lang:es -->
# KeystoneClient 0.15.5

## Cambios

- La pestaña Sincronizar oculta los personajes marcados como inactivos.
  - Reutiliza la preferencia local de Personajes para filtrar la tabla de Sincronizar.
  - Actualiza el contador visible y muestra un estado vacío específico cuando todos están inactivos.
  - Mantiene la inactividad como una preferencia de presentación sin detener la sincronización.
- El filtro de nivel mínimo de Equipos parte de +10 y se presenta como una tarjeta diferenciada.
  - Inicializa el filtro global de piedras en +10, cerca del centro de su recorrido de +1 a +20.
  - Agrupa el título, el nivel actual y la barra en un recuadro con encabezado destacado.
  - Sustituye el separador vertical independiente por el borde completo del nuevo control.
  - Mantiene el título y la barra alineados dentro del recuadro, también en la ventana mínima.

<!-- lang:en -->
# KeystoneClient 0.15.5

## Changes

- The Sync tab now hides characters marked as inactive.
  - Reuses the local Characters preference to filter the Sync table.
  - Updates the visible count and shows a dedicated empty state when every character is inactive.
  - Keeps inactivity as a presentation preference without stopping synchronization.
- The Teams minimum-level filter now starts at +10 and appears as a distinct card.
  - Initializes the global keystone filter at +10, near the midpoint of its +1 to +20 range.
  - Groups the title, current level, and slider in a framed control with an emphasized heading.
  - Replaces the standalone vertical separator with the complete border of the new control.
  - Keeps the title and slider aligned inside the frame, including at the minimum window size.
