import { useI18n } from "../core/i18n";
import { ThemedIcon } from "./ThemedIcon";
import { ReleaseNotesMarkdown } from "./ReleaseNotesMarkdown";

type ChangelogModalProps = {
  version: string;
  notes: string;
  onClose: () => void;
};

export function ChangelogModal({ version, notes, onClose }: ChangelogModalProps) {
  const { t } = useI18n();
  return (
    <div aria-labelledby="changelog-modal-title" aria-modal="true" className="ks-modal ks-update-modal" role="dialog">
      <div className="ks-modal__panel ks-update-modal__panel">
        <div className="ks-modal__header">
          <div>
            <p className="shell__eyebrow">KeystoneClient {version}</p>
            <h2 id="changelog-modal-title">{t("changelog.title")}</h2>
          </div>
          <button aria-label={t("common.close")} className="ks-modal__close" onClick={onClose} type="button">
            <ThemedIcon name="close" size={20} />
          </button>
        </div>
        <div className="ks-update-modal__body">
          <section className="ks-update-modal__notes">
            <ReleaseNotesMarkdown notes={notes} fallback={t("updater.noNotes")} />
          </section>
        </div>
        <div className="ks-update-modal__actions">
          <button onClick={onClose} type="button"><ThemedIcon name="confirm" size={18} />{t("changelog.understood")}</button>
        </div>
      </div>
    </div>
  );
}
