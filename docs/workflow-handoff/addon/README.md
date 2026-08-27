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

`midnight-season-2.patch` is the apply-checked handoff for the Midnight Season 2 update. From a writable checkout of the standalone repository, validate and apply it with:

```powershell
git apply --unidiff-zero --check C:\path\to\weeklyChar\docs\workflow-handoff\addon\midnight-season-2.patch
git apply --unidiff-zero C:\path\to\weeklyChar\docs\workflow-handoff\addon\midnight-season-2.patch
```

Run the addon package checks and the in-game smoke test before considering a tag or release. This handoff does not authorize publication.
