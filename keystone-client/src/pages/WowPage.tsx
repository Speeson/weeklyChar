import { open } from "@tauri-apps/plugin-dialog";
import { ExternalLink, FolderOpen, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { detectWow, selectWowAccounts, selectWowInstall } from "../core/wow";
import type { AddonStatus, CoreError, WowState } from "../core/types";
import { useI18n, type TranslationKey } from "../core/i18n";

type WowPageProps = {
  addonStatus?: AddonStatus;
  initialWow: WowState;
  onGoAddon?: () => void;
  onWowChanged: (wow: WowState) => void;
};

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

function formatWowError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return fallback;
}

function formatModifiedAt(value: number | null, language: "es" | "en", t: Translate): string {
  if (value === null) {
    return t("wow.noFile");
  }

  return new Date(value * 1000).toLocaleString(language === "en" ? "en-US" : "es-ES");
}

function formatAddonStatus(addonStatus: AddonStatus | undefined, t: Translate): string {
  if (!addonStatus?.installed) {
    return t("wow.addonNotInstalled");
  }

  const version = addonStatus.installedVersion ?? t("wow.unknownVersion");

  if (addonStatus.state === "current") {
    return t("wow.addonCurrent", { version });
  }

  if (addonStatus.state === "update-available") {
    return t("wow.addonUpdate", { version });
  }

  return t("wow.addonInstalled", { version, status: addonStatus.message || addonStatus.state });
}

export function WowPage({ addonStatus, initialWow, onGoAddon, onWowChanged }: WowPageProps) {
  const { language, t } = useI18n();
  const [wow, setWow] = useState<WowState>(initialWow);
  const [selected, setSelected] = useState<string[]>(initialWow.selectedAccounts);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWow(initialWow);
    setSelected(initialWow.selectedAccounts);
  }, [initialWow]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function applyWow(nextWow: WowState) {
    setWow(nextWow);
    setSelected(nextWow.selectedAccounts);
    onWowChanged(nextWow);
  }

  async function runAction(action: () => Promise<WowState>, success: string) {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const nextWow = await action();
      applyWow(nextWow);
      setMessage(success);
    } catch (caught) {
      setError(formatWowError(caught, t("wow.error")));
    } finally {
      setLoading(false);
    }
  }

  async function chooseFolder() {
    if (loading) {
      return;
    }

    setError(null);
    setMessage(null);
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: t("onboarding.folderDialog"),
    });
    if (typeof selectedPath !== "string") {
      return;
    }

    await runAction(
      () => selectWowInstall({ path: selectedPath }),
      t("wow.folderSaved"),
    );
  }

  async function saveFolder() {
    const installPath = wow.install.installPath;
    if (!installPath) {
      return;
    }

    await runAction(
      () => selectWowInstall({ path: installPath }),
      t("wow.folderSaved"),
    );
  }

  function toggleAccount(name: string, checked: boolean) {
    setSelected((current) => {
      if (checked) {
        return current.includes(name) ? current : [...current, name];
      }
      return current.filter((item) => item !== name);
    });
  }

  return (
    <section className="wow-panel settings-block" aria-labelledby="wow-title">
      <h3 id="wow-title">{t("wow.title")}</h3>

      <div className="wow-path-label">
        <label htmlFor="wow-install-path">{t("wow.installPath")}</label>
        <span className="wow-path-row">
          <input id="wow-install-path" readOnly title={wow.install.installPath ?? undefined} value={wow.install.installPath ?? ""} />
          <button type="button" onClick={chooseFolder} disabled={loading}>
            <FolderOpen size={18} aria-hidden="true" />
            {t("onboarding.change")}
          </button>
          <button type="button" className="settings-gold-action" onClick={() => void saveFolder()} disabled={loading || !wow.install.installPath}>
            <Save size={18} aria-hidden="true" />
            {t("common.save")}
          </button>
        </span>
      </div>

      <p className="settings-field-label">{t("wow.detectedAccounts")}</p>
      <div className="account-list" aria-label={t("wow.accountsLabel")}>
        {wow.accounts.length === 0 ? (
          <p className="muted">{t("wow.noAccounts")}</p>
        ) : (
          wow.accounts.map((account) => (
            <label className="account-row" key={account.name}>
              <input
                aria-label={`${account.name} ${
                  account.savedVariablesExists
                    ? t("wow.present")
                    : t("wow.absent")
                }`}
                checked={selectedSet.has(account.name)}
                type="checkbox"
                onChange={(event) => toggleAccount(account.name, event.target.checked)}
              />
              <span>
                <strong>{account.name}</strong>
                <small title={account.savedVariablesPath}>{account.savedVariablesPath}</small>
              </span>
              <time>{formatModifiedAt(account.modifiedAt, language, t)}</time>
            </label>
          ))
        )}
      </div>

      <p className={`wow-addon-status ${addonStatus?.installed ? "success" : "muted"}`}>
        {formatAddonStatus(addonStatus, t)}
      </p>

      <div className="actions settings-account-actions">
        <button type="button" onClick={() => runAction(detectWow, t("wow.detectionUpdated"))} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          {t("wow.redetect")}
        </button>
        <button type="button" onClick={() => setSelected(wow.accounts.map((account) => account.name))} disabled={loading || wow.accounts.length === 0}>
          {t("wow.selectAll")}
        </button>
        <button type="button" onClick={onGoAddon} disabled={!onGoAddon}>
          <ExternalLink size={18} aria-hidden="true" />
          {t("wow.goAddon")}
        </button>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {message ? <p className="success" role="status">{message}</p> : null}

      <button
        type="button"
        onClick={() =>
          runAction(() => selectWowAccounts({ accounts: selected }), t("wow.accountsSaved"))
        }
        disabled={loading || selected.length === 0 || wow.accounts.length === 0}
        className="settings-gold-action settings-save-accounts"
      >
        <Save size={18} aria-hidden="true" />
        {t("wow.saveAccounts")}
      </button>
    </section>
  );
}
