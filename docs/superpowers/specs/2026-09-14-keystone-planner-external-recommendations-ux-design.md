# Keystone Planner external recommendations UX

## Scope

Improve only the Keystone Client presentation of modern Quick/Advanced external-slot recommendations. Keep legacy responses and ranking semantics unchanged. Keystone Web receives no visual change.

## Data contract

Modern vacancies gain an additive `recommendations` array. Every entry represents one class (Quick) or exact specialization (Advanced) and contains a stable identity, its own offensive estimate, and separate `buffsDebuffs` and `utilities` capability arrays. Capability entries carry the ability name and spell ID required by the existing official Wowhead integration.

The selected completion remains the first recommendation. Remaining compatible choices are scored for presentation with the existing vacancy scoring functions while holding the other external selections fixed. This does not participate in the recommendation comparator and therefore cannot change result order. Legacy vacancies omit the field.

Quick alternatives aggregate only abilities shared by every role-compatible specialization of the class, so the UI does not invent a spec. Advanced alternatives use the exact spec catalog. The UI limits detail-card capability chips while the modal may show a wider set.

## Client interaction

- The compact preview renders at most four class icons in Quick or spec icons in Advanced, plus overflow when needed. It contains no gain or explanatory text.
- Each expanded vacancy becomes an external recommendation card. Its first alternative is initially active. Up to four icon buttons select another alternative and update gain, buffs/debuffs, and utilities in place.
- The overflow button opens the complete modal for that vacancy. Modal rows remain read-only comparisons; selecting a detail-card alternative does not alter solver output.
- Ability chips use the existing Wowhead tooltip component with opt-in official Wowhead iconization.
- The recommendation modal is portaled to `document.body`, escaping the isolated preview stacking context. A modest modal layer sits above page content.

## Accessibility

Selectors are labelled buttons with `aria-pressed`; the gain has an accessible explanation; the dialog has `aria-modal`, a labelled heading, Escape/backdrop close, and focus returns to the trigger through normal React focus behavior. Decorative images have empty alt text while controls expose complete labels.

## Validation

Cover DTO generation/sanitization, legacy omission, client selection behavior, Quick/Advanced icon rules, overflow/modal content, Wowhead attributes, and portal stacking. Run Worker tests/typecheck, sidecar tests if its validator changes, Client unit tests/build, focused Planner Playwright, Web compatibility checks, `git diff --check`, and deployment-impact classification.
