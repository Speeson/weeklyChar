---
name: keystonesync-wow-patch
description: Audit and update KeystoneSync for a new World of Warcraft patch or Mythic+ season without relying on stale IDs or assumptions.
---

# KeystoneSync WoW Patch / Season Update

## When to use

Load this skill for:

- new Retail WoW patches
- new minor/major versions
- new Mythic+ seasons
- `.toc` Interface updates
- seasonal currencies
- seasonal items
- Prey Hunts
- Great Vault changes
- Mythic+ dungeon pools
- WoW API/event changes

## Core rule

Never assume patch-sensitive data from memory.

Verify current information before modifying code.

This especially applies to:

- Interface number
- currency IDs
- item IDs
- quest IDs
- map IDs
- dungeon pool
- reset behavior
- API names/signatures
- event behavior

Use current reliable sources such as official Blizzard patch/content notes, current API documentation, or current authoritative community API references when Blizzard does not document a detail.

## Audit order

### 1. Classify the work

Distinguish:

- compatibility update: addon loads, `.toc` Interface, API/event compatibility;
- season/content data update: dungeon pool, currencies, items, quests, seasonal labels, and Web display metadata.

A working addon can still contain stale seasonal data.

### 2. Compatibility metadata

Check:

- current Retail patch
- `.toc` Interface
- addon version
- whether the addon currently loads

### 3. WoW APIs

Audit every API the addon uses.

Classify each relevant call as:

- unchanged
- changed
- deprecated
- removed
- replacement available

Do not rewrite working API usage without evidence.

### 4. Seasonal hardcodes

Search addon and Web for hardcoded:

- currencies
- items
- quests
- dungeon names
- dungeon IDs
- season labels
- weekly activities

Build an explicit before/after table before changing IDs.

### 5. Mythic+

Check:

- owned keystone APIs
- challenge map table
- season rating
- per-map bests
- affix data
- current season dungeon pool
- Web display metadata

Prefer data obtained dynamically from Blizzard APIs.

### 6. Weekly systems

Review:

- Great Vault
- Prey Hunts
- weekly-reset calculation
- stale-data preservation logic

### 7. Related skills

Load targeted skills when the patch work touches their scope:

- `keystonesync-addon` for addon behavior, `.toc`, versioning, packaging, or release work;
- `keystonesync-data-contract` when data shape, SavedVariables, payloads, persistence, or Web rendering changes;
- `keystonesync-web` when seasonal UI metadata changes.

Do not make every patch task load every skill.

## Evidence expectations

Do not copy an unverified ID from an old guide merely because the name matches.

## Completion report

Summarize:

```text
PATCH
INTERFACE
API CHANGES
SEASONAL DATA CHANGES
HARDCODED DATA UPDATED
PIPELINE IMPACT
TESTS / MANUAL VALIDATION
UNRESOLVED ITEMS
```
