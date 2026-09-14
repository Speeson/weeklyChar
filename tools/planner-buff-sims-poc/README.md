# Keystone Planner — Buff Impact Simulation PoC

Este paquete genera datos **offline** para medir cuánto mejora una spec concreta al añadir buffs/debuffs de composición. No modifica KeystoneSync.

## PoC incluido

Specs MID2:
- Windwalker Monk (`269`)
- Devourer Demon Hunter (`1480`)
- Frost Mage (`64`)

Buffs/debuffs:
- Mark of the Wild
- Battle Shout
- Arcane Intellect
- Skyfury
- Chaos Brand
- Mystic Touch
- Hunter's Mark

Escenarios:
- 1 objetivo
- 8 objetivos

Ponderación M+ del PoC:
- 40% single target
- 60% AoE de 8 objetivos

El resultado **no compara DPS absoluto entre clases**. Cada spec se normaliza contra su propio baseline sin esos buffs.

## Requisitos

- Windows
- Python 3.10+
- SimulationCraft CLI de una build actual de la rama Midnight
- La carpeta `profiles` de esa misma build/repositorio, incluyendo `MID2`

No requiere paquetes Python externos.

## Ejecución recomendada

```powershell
.\run-poc.ps1 `
  -Simc "C:\Tools\SimulationCraft\simc.exe" `
  -Profiles "C:\Tools\SimulationCraft\profiles"
```

Si has clonado SimulationCraft y quieres registrar también el commit exacto:

```powershell
.\run-poc.ps1 `
  -Simc "C:\Tools\SimulationCraft\build\simc.exe" `
  -Profiles "C:\Tools\SimulationCraft\profiles" `
  -SimcRepo "C:\Tools\SimulationCraft"
```

El script hace:
1. `doctor` (rutas, versión y perfiles)
2. simulaciones
3. validación del JSON generado

## Salida

`generated/midnight-s2-buff-impact-poc.json`

También conserva inputs y reportes crudos en `work/`. Si algo falla, **no borres `work/`**.

## Modo powerset

Primero valida el modo normal. Después, opcionalmente:

```powershell
.\run-poc.ps1 `
  -Simc "C:\Tools\SimulationCraft\simc.exe" `
  -Profiles "C:\Tools\SimulationCraft\profiles" `
  -Mode powerset
```

Con 7 buffs son 127 combinaciones por spec y escenario. Para 3 specs y 2 escenarios son 762 profilesets, así que tardará bastante más.

## Nota sobre Skyfury

El PoC usa `override.skyfury`, observado en builds Midnight actuales. Documentación histórica de SimC todavía puede mostrar `windfury_totem`. El generador **falla** si tu build no soporta la opción; no sustituye silenciosamente un efecto por otro.

## Qué devolver para revisión

Si pasa:
- `generated/midnight-s2-buff-impact-poc.json`

Si falla:
- el texto del error
- la carpeta `work/<spec>/<scenario>/` correspondiente

Con eso podemos decidir si ampliamos a todas las DPS specs MID2 y, después, cómo conectar la matriz al solver.
