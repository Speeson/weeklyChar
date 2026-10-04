import { useI18n } from "../core/i18n";
import { useTheme } from "../theme/useTheme";
import { ThemePreviewArtwork } from "./ThemePreviewArtwork";
import { ThemedIcon } from "./ThemedIcon";

export function NewThemesModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { setTheme, theme } = useTheme();

  return (
    <div aria-labelledby="new-themes-modal-title" aria-modal="true" className="ks-modal ks-update-modal" role="dialog">
      <div className="ks-modal__panel ks-update-modal__panel new-themes-modal__panel">
        <div className="ks-modal__header">
          <div>
            <p className="shell__eyebrow">KeystoneClient</p>
            <h2 id="new-themes-modal-title">{t("changelog.newThemesTitle")}</h2>
          </div>
          <button aria-label={t("common.close")} className="ks-modal__close" onClick={onClose} type="button">
            <ThemedIcon name="close" size={20} />
          </button>
        </div>
        <div className="ks-update-modal__body">
          <p className="new-themes-modal__intro">{t("changelog.newThemesDescription")}</p>
          <div className="new-themes-modal__grid">
            {(["frost", "heaven"] as const).map((candidate) => (
              <button
                aria-pressed={theme === candidate}
                className="settings-theme-card"
                key={candidate}
                onClick={() => setTheme(candidate)}
                type="button"
              >
                <ThemePreviewArtwork theme={candidate} />
                <span className="settings-theme-card__name">{candidate === "frost" ? "Frost" : "Heaven"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ks-update-modal__actions">
          <button onClick={onClose} type="button"><ThemedIcon name="confirm" size={18} />{t("changelog.understood")}</button>
        </div>
      </div>
    </div>
  );
}
