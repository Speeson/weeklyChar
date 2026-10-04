import type { CSSProperties } from "react";
import { useI18n } from "../core/i18n";
import { getSelectableThemes } from "../theme/theme.registry";
import type { ThemeDefinition, ThemeId } from "../theme/theme.types";
import keystoneBackground from "../assets/keystone-ui/bg.jpg";
import poisonBackground from "../themes/assets/poison/backgrounds/background-main.png";
import voidBackground from "../themes/assets/void/backgrounds/background-main.png";
import frostBackground from "../themes/assets/frost/backgrounds/background-main.png";
import heavenBackground from "../themes/assets/heaven/backgrounds/background-main.png";

type ThemeSelectorProps = {
  onThemeChange: (theme: ThemeId) => void;
  theme: ThemeId;
  themes: readonly ThemeDefinition[];
};

const previews: Record<ThemeId, { background: string; accent: string; surface: string }> = {
  keystone: { background: keystoneBackground, accent: "#f4b72a", surface: "#061936" },
  poison: { background: poisonBackground, accent: "#a6ff3f", surface: "#0b1c0e" },
  void: { background: voidBackground, accent: "#ad85ff", surface: "#151126" },
  frost: { background: frostBackground, accent: "#8fc8f2", surface: "#101f2c" },
  heaven: { background: heavenBackground, accent: "#dcb777", surface: "#1d2230" },
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
          const preview = previews[candidate.id];
          const style = preview ? {
            "--preview-background": `url("${preview.background}")`,
            "--preview-accent": preview.accent,
            "--preview-surface": preview.surface,
          } as CSSProperties : undefined;
          return (
            <button
              aria-pressed={theme === candidate.id}
              className="settings-theme-card"
              key={candidate.id}
              onClick={() => onThemeChange(candidate.id)}
              style={style}
              type="button"
            >
              <span aria-hidden="true" className="settings-theme-card__preview">
                <span className="settings-theme-card__topbar"><i /><i /><i /></span>
                <span className="settings-theme-card__layout">
                  <span className="settings-theme-card__rail"><i /><i /><i /></span>
                  <span className="settings-theme-card__content"><i /><i /><i /></span>
                </span>
              </span>
              <span className="settings-theme-card__name">{candidate.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
