# Upgrade track icon assets

The Client and Web assets under `upgrade-tracks/` reproduce the default artwork used by
ItemUpgradeQualityIcons:

- Explorer through Hero are cropped from Blizzard's `Professions-ChatIcon-Quality-Tier1` through
  `Tier5` atlas textures (FileDataIDs 4723389, 4723392, 4723395, 4723398, and 4723401).
- Myth is cropped from `ProfessionsQualityIcons.blp` in ItemUpgradeQualityIcons, using the same
  texture coordinates as that addon's default Myth icon.

The images are stored as transparent PNG files because browsers and the Tauri WebView cannot render
WoW BLP textures or in-game atlas markup directly.
