import { SelectField } from "./ui";
import { useI18n } from "../core/i18n";
import { getSelectableThemes } from "../theme/theme.registry";
import type { ThemeDefinition, ThemeId } from "../theme/theme.types";

type ThemeSelectorProps = {
  onThemeChange: (theme: ThemeId) => void;
  theme: ThemeId;
  themes: readonly ThemeDefinition[];
};

export function ThemeSelector({ onThemeChange, theme, themes }: ThemeSelectorProps) {
  const { t } = useI18n();
  const selectableThemes = getSelectableThemes(themes);

  if (selectableThemes.length < 2) {
    return null;
  }

  return (
    <section
      aria-labelledby="settings-appearance-title"
      className="settings-block settings-appearance"
    >
      <h3 id="settings-appearance-title">{t("settings.appearance")}</h3>
      <SelectField
        label={t("settings.theme")}
        onChange={(event) => {
          const selectedTheme = selectableThemes.find(({ id }) => id === event.currentTarget.value);
          if (selectedTheme) {
            onThemeChange(selectedTheme.id);
          }
        }}
        value={theme}
      >
        {selectableThemes.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
        ))}
      </SelectField>
    </section>
  );
}
