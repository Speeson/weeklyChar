import type { CSSProperties } from "react";
import type { ThemeId } from "../theme/theme.types";
import keystoneBackground from "../assets/keystone-ui/bg.jpg";
import poisonBackground from "../themes/assets/poison/backgrounds/background-main.png";
import voidBackground from "../themes/assets/void/backgrounds/background-main.png";
import frostBackground from "../themes/assets/frost/backgrounds/background-main.png";
import heavenBackground from "../themes/assets/heaven/backgrounds/background-main.png";

const previews: Record<ThemeId, { background: string; accent: string; surface: string }> = {
  keystone: { background: keystoneBackground, accent: "#f4b72a", surface: "#061936" },
  poison: { background: poisonBackground, accent: "#a6ff3f", surface: "#0b1c0e" },
  void: { background: voidBackground, accent: "#ad85ff", surface: "#151126" },
  frost: { background: frostBackground, accent: "#8fc8f2", surface: "#101f2c" },
  heaven: { background: heavenBackground, accent: "#dcb777", surface: "#1d2230" },
};

export function ThemePreviewArtwork({ theme }: { theme: ThemeId }) {
  const preview = previews[theme];
  const style = preview ? {
    "--preview-background": `url("${preview.background}")`,
    "--preview-accent": preview.accent,
    "--preview-surface": preview.surface,
  } as CSSProperties : undefined;

  return (
    <span aria-hidden="true" className="settings-theme-card__preview" style={style}>
      <span className="settings-theme-card__topbar"><i /><i /><i /></span>
      <span className="settings-theme-card__layout">
        <span className="settings-theme-card__rail"><i /><i /><i /></span>
        <span className="settings-theme-card__content"><i /><i /><i /></span>
      </span>
    </span>
  );
}
