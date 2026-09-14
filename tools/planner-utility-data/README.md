# Keystone Planner — Utility Data Extractor

Extractor offline para construir el catálogo de defensivas y utilidades de Keystone Planner.

**No modifica el Worker, Web, Client ni el solver.**

Usa directamente `spell_query` de tu SimulationCraft para consultar:

- `class_spell`
- `spec_spell`
- `talent_spell`

para las 13 clases de WoW.

## Qué genera

### `generated/midnight-s2-spell-catalog-raw.json`

Todos los hechizos únicos que SimulationCraft devuelve para esas fuentes, con:

- spell ID
- nombre
- clase proveedora
- fuentes SimC donde apareció
- cooldown
- duración
- cargas
- flags
- descripción
- tooltip
- efectos textuales
- campos originales parseados

### `generated/midnight-s2-utility-candidates.json`

Subset para revisión humana.

Las heurísticas buscan defensivos, interrupts, stops, dispels, purge/soothe,
movilidad, desplazamientos y utility especial. También incluye nombres
semilla conocidos y habilidades activas con cooldown >= 20 s para reducir
el riesgo de que un tooltip extraño quede fuera.

**La heurística NO asigna puntuaciones ni decide qué hechizo es bueno.**
Solo reduce el espacio de revisión.

### `work/<class>/*.txt`

Salida textual original de SimulationCraft. No la borres si algo falla.

---

# Paso 1 — Doctor

Desde esta carpeta:

```powershell
python .\extract.py `
  --simc "C:\Users\esteb\Downloads\simc-1210.01.c1935b9-win64\simc-1210.01.c1935b9-win64\simc.exe" `
  --doctor
```

Debe comprobar:

```text
class_spell.class=warrior
spec_spell.class=warrior
talent_spell.class=warrior
```

y terminar:

```text
Doctor PASS. El CLI acepta las fuentes y los 13 identificadores de clase.
```

# Paso 2 — Extracción completa

```powershell
python .\extract.py `
  --simc "C:\Users\esteb\Downloads\simc-1210.01.c1935b9-win64\simc-1210.01.c1935b9-win64\simc.exe"
```

Se ejecutan 39 consultas: 13 clases x 3 fuentes.

# Paso 3 — Validación

```powershell
python .\validate.py
```

Queremos:

```text
VALIDATION PASS
```

# Qué subir a ChatGPT después

Sube primero:

```text
generated\midnight-s2-utility-candidates.json
```

Si hay algún resultado extraño, también:

```text
generated\midnight-s2-spell-catalog-raw.json
```

No hace falta subir `work/` salvo que una consulta falle.

# Qué haremos después

1. Revisar candidatos contra la build exacta de SimulationCraft.
2. Crear un catálogo semántico versionado:
   - group defensive
   - external defensive
   - interrupt
   - AoE / ST stops
   - purge / soothe
   - poison / disease / curse / magic dispels
   - grip / knockback
   - group mobility
   - utility especial
3. Separar:
   - siempre disponible
   - talento
   - spec-specific
   - condicional
4. Investigar relevancia por cada dungeon de Midnight S2.
5. Definir tiers/pesos y redundancia.
6. Solo entonces integrar el catálogo en Keystone Planner.

## Nota importante

El parser conserva la salida original en `work/`. Si una nightly cambia el
formato textual, no se pierde la evidencia: podremos ajustar el parser contra
la salida exacta de tu build.
