# Addon Workflow Ownership

The authoritative KeystoneSync addon workflows now live in the standalone repository:

```text
Speeson/KeystoneSync
```

Do not maintain active addon workflow YAML copies in `weeklyChar`.

KeystoneClient consumes addon releases from `Speeson/KeystoneSync` GitHub Releases using the dedicated asset:

```text
KeystoneSync-vX.Y.Z.zip
```
