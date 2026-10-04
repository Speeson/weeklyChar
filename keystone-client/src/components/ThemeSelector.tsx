import { useI18n } from "../core/i18n";
import { getSelectableThemes } from "../theme/theme.registry";
import type { ThemeDefinition, ThemeId } from "../theme/theme.types";
import { ThemePreviewArtwork } from "./ThemePreviewArtwork";

type ThemeSelectorProps = {
  onThemeChange: (theme: ThemeId) => void;
  theme: ThemeId;
  themes: readonly ThemeDefinition[];
};

export function ThemeSelector({ onThemeChange, theme, themes }: ThemeSelectorProps) {
  const { t } = useI18n();
  const selectableThemes = getSelectableThemes(themes);
  const currentTheme = themes.find(({ id }) => id === theme);
  const currentThemeIsSelectable = selectableThemes.some(({ id }) => id === theme);

  if (selectableThemes.length < 2) {
    return null;
  }

  return (
    <section
      aria-label={t("settings.appearance")}
      className="settings-block settings-appearance"
    >
      <h3 className="settings-section-heading" id="settings-theme-title">{t("settings.theme")}</h3>
      {!currentThemeIsSelectable ? (
        <p className="muted">{t("settings.themeUnavailable", { theme: currentTheme?.label ?? theme })}</p>
      ) : null}
      <div aria-labelledby="settings-theme-title" className="settings-theme-grid" role="group">
        {selectableThemes.map((candidate) => {
          return (
            <button
              aria-pressed={theme === candidate.id}
              className="settings-theme-card"
              key={candidate.id}
              onClick={() => onThemeChange(candidate.id)}
              type="button"
            >
              <ThemePreviewArtwork theme={candidate.id} />
              <span className="settings-theme-card__name">{candidate.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
