# Keystone Planner: functional Top 5 and richer assignment previews

## Objective

Remove functionally redundant recommendations from the Top 5, make priority changes recalculate
without blanking or crashing the Client, and distinguish played and loot specializations in compact
and expanded assignment cards.

## Approved behavior

### Functional recommendation diversity

The solver continues treating played specializations as real assignments, but the final Top 5 does
not spend multiple slots on the same characters when changing specialization produces the same
functional contribution. For one exact stone, recommendations share a diversity identity when each
selected user keeps the same character, role, melee/ranged combat style, physical/magical damage
profile and resolved capabilities. The highest
ranked recommendation for that identity is retained.

Role, combat style, damage profile and utility changes remain distinct. Loot specialization and its
objectives do not consume another Top 5 slot by themselves; canonical ranking retains the strongest
version. This keeps alternatives such as Balance/Feral and Beast Mastery/Survival while collapsing
dominated same-profile alternatives such as Arcane/Frost when their resulting contribution is
identical.

### Live recalculation

The initial action remains **Calculate Top 5**. After a successful result, changing a group priority
starts a short debounced recalculation automatically. Existing cards remain mounted and are subtly
dimmed while the new request runs; the response replaces them atomically. The existing generation
guard rejects stale responses. The action becomes **Recalculate Top 5** after the first result and
remains available as a manual retry.

Changing a priority must not clear the result, and checkbox state is captured synchronously before
any React state updater consumes it. This removes the WebView black-screen failure caused by reading
a released synthetic event.

### Assignment card language

Compact previews keep the avatar and character name, append the owning username, and replace the
visible role control with the played-spec icon. The role is communicated by a large soft background
icon plus role-colored glow. The selected loot spec occupies a same-size rounded square in the top
right, with the official loot-bag visual overlaid at a legible size.

The exact-stone owner receives a crown placed over the top-left border of the compact card so it may
protrude slightly. In the expanded card the crown stays inside the top-right corner. Both views use
the same played-spec and loot-spec language, while role is represented by the background artwork.

Played-spec, loot-spec and owner visuals expose localized title/ARIA descriptions; meaning never
depends only on glow or color.

### Compact objective row

Expanded assignment cards keep one uninterrupted, horizontally centered objective row. It preserves
the five-icon-plus-overflow limit and the full grouped loot popover without adding tier labels between
icons.

## Architecture

- `keystone-worker/src/wowComposition.ts` owns combat style alongside the existing role, damage and
  capability catalog.
- `keystone-worker/src/keystonePlanner.ts` owns functional diversity filtering after canonical
  ranking and before the five-result cap. The public HTTP shape and D1 schema do not change.
- `keystone-client/src/pages/TeamsPage.tsx` owns recalculation state and presentation only; it does
  not reproduce ranking or deduplication.
- Existing Planner assignment fields already contain played spec, loot spec, role, capabilities and
  objective identities. No sidecar, bridge, migration, addon or Web change is required.

## Verification

- Worker regression tests for dominated same-profile and loot-only deduplication, plus preservation
  of meaningful role, combat-style, damage and utility alternatives.
- Client component tests for the released-event crash, automatic recalculation, stale-response
  protection, manual recalculation label and assignment accessibility.
- Client visual review for compact/expanded cards, owner crown, role treatment and centered objectives.
- Worker typecheck/tests, Client tests/build and strict Deployment Impact.

## Out of scope

- Performance, item-tradeability or interrupt-cooldown scoring.
- API response, D1, sidecar, bridge, Web or addon changes.
- Push, deployment, tag or Client release publication.
