# Changesets

Release-impacting changes must add one JSON file under `.changes/pending/`.

Schema:

```json
{
  "components": ["client"],
  "type": "minor",
  "category": "added",
  "summary": "Resumen visible para usuarios.",
  "details": [
    "Detalle visible para usuarios."
  ]
}
```

Allowed `type` values: `patch`, `minor`, `major`.

Allowed `category` values: `added`, `changed`, `fixed`, `removed`, `security`.

User-facing `summary` and `details` text must be written in Spanish.
