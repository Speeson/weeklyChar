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
  ],
  "summaryEn": "User-facing summary.",
  "detailsEn": [
    "User-facing detail."
  ]
}
```

Allowed `type` values: `patch`, `minor`, `major`.

Allowed `category` values: `added`, `changed`, `fixed`, `removed`, `security`.

User-facing `summary` and `details` text must be written in Spanish. Client changesets should also
provide `summaryEn` and `detailsEn` so KeystoneClient can render release notes in either language;
the English fields remain optional for compatibility with historical changesets.
