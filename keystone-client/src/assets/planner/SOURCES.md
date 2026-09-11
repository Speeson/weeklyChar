# Planner artwork sources

- `../wow-ui-role-icons-hq.png`: Blizzard `Interface/LFGFRAME/UI-LFG-ICON-ROLES`,
  mirrored by Gethe's `wow-ui-textures` repository. The Client selects the current 67 px Tank,
  Healer and Damage cells from the 256 px sprite without redrawing or enlarging the legacy 64 px
  portrait-role sheet.
- `bloodlust.jpg`: Wowhead icon `spell_nature_bloodlust` (spell 2825).
- `battle-rez.jpg`: Wowhead icon `spell_nature_reincarnation` (Rebirth, spell 20484).
- `class-buffs.jpg`: Wowhead icon `spell_holy_magicalsentry` (Arcane Intellect, spell 1459).
- `damage-synergy.jpg`: Wowhead icon `ability_demonhunter_empowerwards` (Chaos Brand, spell 1490).

These files are bundled locally so the Planner does not depend on third-party image availability at
runtime. World of Warcraft and the artwork are trademarks/copyrights of Blizzard Entertainment.
