# KeystoneClient 0.4.1

## Cambios

- Unifica la estructura interna de KeystoneClient tras la migracion a Tauri.
  - El cliente conserva su comportamiento, configuracion y compatibilidad de actualizacion mientras elimina componentes historicos que ya no forman parte del producto.
  - La interfaz Tauri, el host Rust y el sidecar Python pasan a compartir un unico arbol canonico de KeystoneClient.
