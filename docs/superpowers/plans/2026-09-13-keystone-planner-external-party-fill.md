# Keystone Planner External Party Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every Planner recommendation to five visible slots and rank role-compatible external class suggestions with Bloodlust, battle resurrection, and composition-aware offensive utility.

**Architecture:** The Worker remains the only scoring authority and adds optional, class-aggregated candidates to each vacancy. The Python sidecar and TypeScript parser validate that additive response, while React only renders the ordered candidates. No suggestion is persisted and existing clients safely discard the new property.

**Tech Stack:** TypeScript, Cloudflare Worker, Node test runner, Python unittest, React 19, Vitest, Playwright, CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-keystone-planner-external-party-fill-design.md`

## Global Constraints

- Every recommendation renders exactly five slots in a 1 Tank, 1 Healer, 3 DPS shape.
- External options are classes, never displayed or transported specialization alternatives.
- External priority is Bloodlust, then battle resurrection, then class buffs and damage synergy at the same tier.
- Offensive effects compare effective DPS beneficiaries; nominal percentages never break equal coverage ties.
- External slots never add loot value, objectives, or play preferences.
- `candidateClasses` is an optional additive response field; old consumers remain valid and a new Client tolerates an old Worker.
- No D1 migration, addon change, remote deployment, release, tag, push, or local commit is authorized.
- Preserve the existing uncommitted Planner typography and visual-test changes in `keystone-client/src/App.css` and `keystone-client/tests/visual/teams-stone-selector.spec.ts`.

---

### Task 1: Worker composition metadata and external resolver

**Files:**
- Modify: `keystone-worker/src/wowComposition.ts`
- Modify: `keystone-worker/src/keystonePlanner.ts`
- Test: `keystone-worker/tests/wowComposition.test.js`
- Test: `keystone-worker/tests/keystonePlanner.test.js`

**Interfaces:**
- Produces: `WowPrimaryStat = 'intellect' | 'attack_power' | null` on `WowSpecialization`.
- Produces: `PlannerExternalClassCandidate` and optional `candidateClasses` on `PlannerVacancy`.
- Produces: deterministic class aggregation and joint vacancy completion owned by `solveKeystonePlanner`.

- [x] **Step 1: Add failing catalog tests**

Add literal assertions that Mage DPS uses `intellect`, Warrior/Monk DPS uses `attack_power`, and unknown profiles remain `null`. Run:

```powershell
npm --prefix keystone-worker test -- --test-name-pattern="primary stat"
```

Expected: FAIL because `primaryStat` does not exist.

- [x] **Step 2: Implement the minimal catalog field**

Add the union and explicit values to `WOW_SPECIALIZATIONS`; do not derive the field from `damageProfile` because attack-power specs can deal magical damage. Re-run the focused test and expect PASS.

- [x] **Step 3: Add failing vacancy recommendation tests**

Cover these hand-derived cases in `keystonePlanner.test.js`:

```js
assert.deepEqual(vacancy.candidateClasses.slice(0, 4).map(item => item.wowClass),
  ['Evoker', 'Mage', 'Shaman', 'Hunter'])
assert.equal(new Set(vacancy.candidateClasses.map(item => item.wowClass)).size,
  vacancy.candidateClasses.length)
assert.ok(magicalClasses.indexOf('Mage') < magicalClasses.indexOf('Warrior'))
assert.ok(magicalClasses.indexOf('Demon Hunter') < magicalClasses.indexOf('Warrior'))
assert.ok(physicalClasses.indexOf('Monk') < physicalClasses.indexOf('Mage'))
assert.ok(physicalClasses.indexOf('Warrior') < physicalClasses.indexOf('Mage'))
```

Also verify guaranteed Bloodlust precedes Hunter's conditional contribution, disabled composition options fall back to stable class order, multiple vacancies are role-correct, and assignments/loot summaries are unchanged. Run the focused Worker test and expect FAIL because `candidateClasses` is absent.

- [x] **Step 4: Implement joint, class-aggregated completion**

Generate all role-feasible class combinations from `WOW_SPECIALIZATIONS`, aggregate each class once, resolve guaranteed/conditional capabilities across eligible specs, and score a completed party lexicographically. Use a score tuple equivalent to:

```ts
type ExternalCompletionScore = {
  bloodlust: number
  battleRez: number
  effectiveOffensiveBeneficiaries: number
  newClassCapabilities: number
  stableClassKey: string
}
```

Return every viable class per vacancy ordered by its best compatible completion of the other vacancies. Keep `preferredCapabilities` and do not include spec IDs.

- [x] **Step 5: Run Worker domain tests**

```powershell
npm --prefix keystone-worker test
```

Expected: all tests PASS.

### Task 2: Additive contract through API and sidecar

**Files:**
- Modify: `keystone-worker/tests/keystonePlannerRoutes.test.js`
- Modify: `keystone-client/sidecar/team_service.py`
- Test: `tests/client/test_team_service.py`
- Modify: `docs/DATA_CONTRACT.md`

**Interfaces:**
- Consumes: optional `PlannerVacancy.candidateClasses` from Task 1.
- Produces: sanitized Python dictionaries with `wowClass`, `contributions`, and `reasonCodes`, or the legacy vacancy shape when absent.

- [x] **Step 1: Add failing route and sidecar contract tests**

The route test asserts candidates contain no `specId`/`specIds`. The Python test feeds both legacy and extended vacancies and asserts the extended value survives sanitization while malformed class, availability, capability, or excessive list lengths reject the response. Run:

```powershell
npm --prefix keystone-worker test -- --test-name-pattern="external class"
python -m unittest tests.client.test_team_service
```

Expected: new assertions FAIL because the sidecar drops `candidateClasses`.

- [x] **Step 2: Implement bounded defensive parsing**

Accept at most 13 classes per vacancy, at most 16 contributions/reasons per class, canonical non-empty class names, known availability values, and capability/reason strings up to 64 characters. Preserve the exact legacy output when the optional property is absent.

- [x] **Step 3: Document the response field**

Add the Planner vacancy extension, source, missing behavior, non-persistence, and old-consumer behavior to `docs/DATA_CONTRACT.md`.

- [x] **Step 4: Re-run focused contract tests**

```powershell
npm --prefix keystone-worker test -- --test-name-pattern="external class"
python -m unittest tests.client.test_team_service
```

Expected: PASS.

### Task 3: TypeScript parser and five-slot React behavior

**Files:**
- Modify: `keystone-client/src/core/types.ts`
- Modify: `keystone-client/src/core/keystonePlanner.ts`
- Test: `keystone-client/src/core/keystonePlanner.test.ts`
- Modify: `keystone-client/src/pages/TeamsPage.tsx`
- Test: `keystone-client/src/pages/TeamsPage.test.tsx`

**Interfaces:**
- Consumes: sanitized optional `candidateClasses`.
- Produces: `KeystonePlannerExternalClassCandidate` and a visual `PlannerExternalPreview` that receives one typed vacancy.

- [x] **Step 1: Add failing parser tests**

Assert a valid extended vacancy retains all class candidates, legacy vacancies parse with no candidates, malformed nested entries reject the recommendation, and no spec field is accepted into the typed result. Run:

```powershell
npm --prefix keystone-client test -- src/core/keystonePlanner.test.ts
```

Expected: FAIL because the parser drops the extension.

- [x] **Step 2: Add the minimal types and parser**

Validate the same bounds as the sidecar and preserve `candidateClasses?: KeystonePlannerExternalClassCandidate[]`. Re-run the parser test and expect PASS.

- [x] **Step 3: Add failing component tests**

Render recommendations with 2, 3, 4, and 5 real assignments. Assert each compact party has five cards, external cards expose role/class labels, only four corner icons are initially visible, `+` opens all remaining classes, Escape/close dismisses the dialog, and the UI contains no external spec names. Run:

```powershell
npm --prefix keystone-client test -- src/pages/TeamsPage.test.tsx
```

Expected: FAIL because vacancies are not rendered as cards.

- [x] **Step 4: Implement external cards without local scoring**

Use `wowClassIconUrl`, `classColor`, and the existing role watermark. Render the Worker order verbatim, cap corners at four, and reuse the modal accessibility pattern for the class breakdown. A missing `candidateClasses` renders the centered ornamental question mark without class icons.

- [x] **Step 5: Re-run component tests**

```powershell
npm --prefix keystone-client test -- src/core/keystonePlanner.test.ts src/pages/TeamsPage.test.tsx
```

Expected: PASS.

### Task 4: Preview geometry and visual coverage

**Files:**
- Modify: `keystone-client/src/App.css`
- Modify: `keystone-client/tests/visual/teams-stone-selector.spec.ts`
- Modify if required: `keystone-client/src/core/teamsPreview.ts`

**Interfaces:**
- Consumes: five rendered assignment/vacancy elements from Task 3.
- Produces: equal-width five-column layout, symmetric side gaps, two-line loot label, corner icons, and centered external avatar.

- [x] **Step 1: Extend the visual fixture and write failing geometry assertions**

Change the preview response to four real assignments plus one vacancy with at least five candidate classes. Assert:

```ts
expect(await party.locator('.planner-assignment-preview, .planner-external-preview').count()).toBe(5)
expect(leftGap).toBeCloseTo(rightGap, 0)
expect(lootLabelLines).toEqual(['VALOR DE', 'BOTIN'])
expect(externalCenterDeltaX).toBeLessThan(2)
expect(externalCenterDeltaY).toBeLessThan(2)
```

Run the Planner Playwright test and expect FAIL on the new external geometry.

- [x] **Step 2: Implement scoped CSS**

Use an explicit `repeat(5, minmax(0, 1fr))` party grid, preserve the restored rank/metrics spacing already in the worktree, split the score label with two spans, and position external class icons at four corners with a bottom-center overflow. Do not reduce the approved 11/14/15/11 px typography.

- [x] **Step 3: Run visual and frontend tests**

```powershell
npm --prefix keystone-client test
npm --prefix keystone-client run test:visual
npm --prefix keystone-client run build
```

Expected: all commands PASS and snapshots show five usable cards at 1672x941 and the supported minimum viewport.

### Task 5: Durable context, release metadata, and final verification

**Files:**
- Modify: `docs/AGENT_CONTEXT.md`
- Create: `.changes/pending/client-planner-external-party-fill.json`
- Create: `docs/superpowers/sdd/keystone-planner-external-party-fill-final-report.md`

**Interfaces:**
- Consumes: verified implementation from Tasks 1-4.
- Produces: durable architecture note, valid Client changeset, validation report, and deterministic deployment classification.

- [x] **Step 1: Record durable behavior and release impact**

Document that Worker owns external class scoring, response fields are additive/non-persistent, and Client renders but does not score. Add a valid pending Client changeset matching the repository schema.

- [x] **Step 2: Run full relevant validation**

```powershell
Push-Location keystone-worker; npm run typecheck; npm test; Pop-Location
python -m compileall -q keystone-client/sidecar scripts tests
python -m unittest discover -s tests/client
python -m unittest discover -s tests/client_bridge
npm --prefix keystone-client test
npm --prefix keystone-client run build
npm --prefix keystone-client run test:visual
```

Expected: every command exits 0.

- [x] **Step 3: Review and classify**

Review only task-related diffs for contract safety, no leaked secrets, no D1 changes, no local scoring, and preservation of existing CSS work. Then run:

```powershell
python scripts/deploy_impact.py --files keystone-worker/src/wowComposition.ts keystone-worker/src/keystonePlanner.ts keystone-worker/tests/wowComposition.test.js keystone-worker/tests/keystonePlanner.test.js keystone-worker/tests/keystonePlannerRoutes.test.js keystone-client/sidecar/team_service.py tests/client/test_team_service.py keystone-client/src/core/types.ts keystone-client/src/core/keystonePlanner.ts keystone-client/src/core/keystonePlanner.test.ts keystone-client/src/core/teamsPreview.ts keystone-client/src/pages/TeamsPage.tsx keystone-client/src/pages/TeamsPage.test.tsx keystone-client/src/App.css keystone-client/tests/visual/teams-stone-selector.spec.ts docs/DATA_CONTRACT.md docs/AGENT_CONTEXT.md .changes/pending/client-planner-external-party-fill.json docs/superpowers/specs/2026-09-13-keystone-planner-external-party-fill-design.md docs/superpowers/plans/2026-09-13-keystone-planner-external-party-fill.md docs/superpowers/sdd/keystone-planner-external-party-fill-final-report.md --json --strict
```

Expected: `WORKER=true`, `CLIENT_BUILD=true`, `CLIENT_RELEASE=true`, `DB=false`, `WEB=false`, `ADDON=false`, and no unknown paths.

- [x] **Step 4: Write the final SDD report**

Record built behavior, exact validation commands/results, deployment impact, and any remaining manual visual limitation. Do not perform remote operations.
