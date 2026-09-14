# Planner artwork sources

- `../wow-ui-role-icons-hq.png`: Blizzard `Interface/LFGFRAME/UI-LFG-ICON-ROLES`,
  mirrored by Gethe's `wow-ui-textures` repository. The Client selects the current 67 px Tank,
  Healer and Damage cells from the 256 px sprite without redrawing or enlarging the legacy 64 px
  portrait-role sheet.
- `bloodlust.jpg`: Wowhead icon `spell_nature_bloodlust` (spell 2825).
- `battle-rez.jpg`: Wowhead icon `spell_nature_reincarnation` (Rebirth, spell 20484).
- `class-buffs.jpg`: Wowhead icon `spell_holy_magicalsentry` (Arcane Intellect, spell 1459).
- `damage-synergy.jpg`: Wowhead icon `ability_demonhunter_empowerwards` (Chaos Brand, spell 1490).
- `mix-damage.png`: project-provided mixed physical/magical damage artwork from
  `docs/design/mixDamage.png`, framed by the Client like the other summary icons.
- `lfg-eye.png`: Blizzard `Interface/LFGFRAME/LFG-Eye` animation sheet, mirrored byte-for-byte by
  Gethe's `wow-ui-textures` repository. The Client displays its first official 64 px frame through
  CSS without redrawing or cropping the source file.
- `offensive-synergy.jpg`: official Blizzard render icon `ability_warrior_battleshout`
  (Battle Shout, spell 6673).
- `group-defense.jpg`: official Blizzard render icon `spell_holy_sealofsacrifice`
  (Blessing of Sacrifice, spell 6940).
- `dungeon-utility.jpg`: official Blizzard render icon `spell_holy_renew`
  (Cleanse Toxins, spell 440013 in the canonical Midnight catalog).

These files are bundled locally so the Planner does not depend on third-party image availability at
runtime. World of Warcraft and the artwork are trademarks/copyrights of Blizzard Entertainment.
