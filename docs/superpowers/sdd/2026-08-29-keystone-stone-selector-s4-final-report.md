# Stone Selector S4 — implementation report

S4 implements the Client data/bridge layer only. It adds the protocol-v1 commands `teams.list`,
`teams.get`, and `teams.keystone_selector` across TypeScript, Rust, and Python, reusing the existing
Worker endpoints. The Python sidecar remains the only layer that reads the access token and applies
Bearer authentication. Both Python and TypeScript strictly validate and project safe DTOs.

The implementation intentionally omits a member-profile avatar because the authoritative Team
detail API does not return one; per-character avatars remain available. It also adds no preview
transport or visible UI because the current preview mode supplies startup state only and S5 owns
the Team UI harness.

Validation records:

- Client frontend: 150 before; 155 after.
- Rust: 23 before; 23 after, with the packaged bridge test extended through a mocked Worker.
- Python Client services: 82 before; 87 after.
- JSONL bridge integration: 57 before; 59 after.
- Client production TypeScript/Vite build: passed.
- PyInstaller sidecar build and smoke checks: passed.

Deployment impact is Client build/release only relative to the S3 commit. Cumulatively from the
original main baseline, the branch requires Web, Worker, D1, and Client build/release handling;
addon distribution remains unaffected. The pending Client changeset is intentionally unconsumed.
