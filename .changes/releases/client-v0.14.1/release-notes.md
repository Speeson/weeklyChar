# KeystoneClient 0.14.1

## Correcciones

- El avatar de perfil permanece visible al abrir KeystoneClient sin conexión.
  - El cliente conserva una copia local dedicada del avatar activo y asegura su almacenamiento antes de confirmar un cambio de avatar.
  - Los intentos de cambiar el avatar sin conexión muestran ahora un mensaje explícito y mantienen el avatar anterior.
