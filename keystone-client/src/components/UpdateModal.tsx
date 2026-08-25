import type { UpdaterSnapshot } from "../core/updater";
import { useI18n } from "../core/i18n";
import { ThemedIcon } from "./ThemedIcon";

type UpdateModalProps = {
  snapshot: UpdaterSnapshot;
  onClose: () => void;
  onInstall: () => void;
  onRetry: () => void;
};

function progress(snapshot: UpdaterSnapshot): number | null {
  if (!snapshot.totalBytes || snapshot.totalBytes <= 0) {
    return null;
  }
  return Math.min(100, Math.round((snapshot.downloadedBytes / snapshot.totalBytes) * 100));
}

export function UpdateModal({ snapshot, onClose, onInstall, onRetry }: UpdateModalProps) {
  const { t } = useI18n();
  const percent = progress(snapshot);
  const busy = snapshot.status === "downloading" || snapshot.status === "installing";

  return (
    <div aria-labelledby="update-modal-title" aria-modal="true" className="ks-modal ks-update-modal" role="dialog">
      <div className="ks-modal__panel ks-update-modal__panel">
        <div className="ks-modal__header">
          <div>
            <p className="shell__eyebrow">KeystoneClient</p>
            <h2 id="update-modal-title">
              {snapshot.status === "error"
                ? t("updater.errorTitle")
                : t("updater.title", { version: snapshot.availableVersion ?? snapshot.currentVersion })}
            </h2>
          </div>
          <button aria-label={t("common.close")} className="ks-modal__close" disabled={busy} onClick={onClose} type="button">
            <ThemedIcon name="close" size={20} />
          </button>
        </div>

        <div className="ks-update-modal__body">
          {snapshot.status === "error" ? (
            <p className="error" role="alert">{snapshot.error ?? t("updater.errorGeneric")}</p>
          ) : (
            <>
              <p className="ks-update-modal__version">
                {t("updater.versionTransition", {
                  current: snapshot.currentVersion,
                  available: snapshot.availableVersion ?? snapshot.currentVersion,
                })}
              </p>
              <section aria-labelledby="update-notes-title" className="ks-update-modal__notes">
                <h3 id="update-notes-title">{t("updater.notes")}</h3>
                <p>{snapshot.notes || t("updater.noNotes")}</p>
              </section>
            </>
          )}

          {snapshot.status === "downloading" ? (
            <div className="ks-update-modal__progress">
              <div className="ks-update-modal__progress-copy">
                <span>{t("updater.downloading")}</span>
                <strong>{percent === null ? t("updater.calculating") : `${percent}%`}</strong>
              </div>
              <progress
                aria-label={t("updater.downloading")}
                aria-valuenow={percent ?? undefined}
                max={100}
                value={percent ?? undefined}
              />
            </div>
          ) : null}

          {snapshot.status === "installing" ? (
            <p className="ks-update-modal__installing" role="status">
              <ThemedIcon className="spin" name="refresh" size={18} />
              {t("updater.installing")}
            </p>
          ) : null}
        </div>

        <div className="ks-update-modal__actions">
          {snapshot.status === "error" ? (
            <button onClick={onRetry} type="button"><ThemedIcon name="retry" size={17} />{t("updater.retry")}</button>
          ) : (
            <button disabled={busy || snapshot.status !== "available"} onClick={onInstall} type="button">
              <ThemedIcon name="download" size={18} />
              {busy ? t("updater.working") : t("updater.installRelaunch")}
            </button>
          )}
          <button className="ks-update-modal__later" disabled={busy} onClick={onClose} type="button">{t("updater.later")}</button>
        </div>
      </div>
    </div>
  );
}
