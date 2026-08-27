import { useEffect, useState } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
import { ThemeSelector } from "../components/ThemeSelector";
import { Button } from "../components/ui";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import { getSettings, updateSettings } from "../core/settings";
import type { ClientSettings, CoreError } from "../core/types";
import { useI18n } from "../core/i18n";
import type { UpdaterSnapshot } from "../core/updater";
import { useTheme } from "../theme/useTheme";

type SettingsPageProps = {
  appVersion: string;
  initialSettings: ClientSettings;
  onSettingsChanged: (settings: ClientSettings) => void;
  updater?: UpdaterSnapshot;
  onCheckUpdates?: () => void;
  onOpenUpdate?: () => void;
  onOpenReleases?: () => void;
  preview?: boolean;
};

const idleUpdater: UpdaterSnapshot = {
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  notes: "",
  releaseDate: null,
  downloadedBytes: 0,
  totalBytes: null,
  lastCheckedAt: null,
  error: null,
};

function formatSettingsError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return fallback;
}

export function SettingsPage({
  appVersion,
  initialSettings,
  onSettingsChanged,
  updater = idleUpdater,
  onCheckUpdates,
  onOpenUpdate,
  onOpenReleases,
  preview = false,
}: SettingsPageProps) {
  const { t } = useI18n();
  const { setTheme, theme, themes } = useTheme();
  const [settings, setSettings] = useState<ClientSettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [loadedAutostart, setLoadedAutostart] = useState(false);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getSettings(), getAutostartEnabled()])
      .then(([loaded, nativeAutostart]) => {
        if (!cancelled) {
          setSettings(loaded);
          setAutostartState(nativeAutostart);
          setLoadedAutostart(nativeAutostart);
          onSettingsChanged(loaded);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(formatSettingsError(caught, t("settings.error")));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onSettingsChanged, preview]);

  async function saveSettings() {
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const nativeAutostart = await setAutostartEnabled(autostartEnabled);
      if (nativeAutostart !== autostartEnabled) {
        throw new Error(t("settings.autostartMismatch"));
      }
      const saved = await updateSettings(settings);
      setSettings(saved);
      onSettingsChanged(saved);
      setLoadedAutostart(nativeAutostart);
      setMessage(t("settings.saved"));
    } catch (caught) {
      if (autostartEnabled !== loadedAutostart) {
        try {
          setAutostartState(await setAutostartEnabled(loadedAutostart));
        } catch {
          // Preserve the original error; the next Settings load reads OS truth again.
        }
      }
      setError(formatSettingsError(caught, t("settings.error")));
    } finally {
      setSaving(false);
    }
  }

  const checkingUpdate = updater.status === "checking";
  const updateAvailable = updater.status === "available";
  const updateStatus = updateAvailable
    ? t("settings.updateAvailable", { version: updater.availableVersion ?? appVersion })
    : updater.status === "current"
      ? t("settings.updateCurrent")
      : updater.status === "error"
        ? t("settings.updateError")
        : null;
  const lastCheck = updater.lastCheckedAt
    ? t("settings.lastCheckAt", {
        date: new Date(updater.lastCheckedAt).toLocaleString(settings.lang === "es" ? "es-ES" : "en-US"),
      })
    : t("settings.lastCheck");

  return (
    <>
      <section className="settings-block settings-general" aria-labelledby="settings-general-title">
        <h3 id="settings-general-title">{t("settings.general")}</h3>
        {loading ? <p className="muted">{t("settings.loading")}</p> : null}
        <label className="check-row">
          <input checked={autostartEnabled} onChange={(event) => setAutostartState(event.target.checked)} type="checkbox" />
          {t("settings.autostart")}
        </label>
        <label className="check-row">
          <input
            checked={settings.startMinimized}
            type="checkbox"
            onChange={(event) =>
              setSettings((current) => ({ ...current, startMinimized: event.target.checked }))
            }
          />
          {t("settings.startMinimized")}
        </label>
      </section>

      <ThemeSelector onThemeChange={setTheme} theme={theme} themes={themes} />

      <section className="settings-block settings-application" aria-labelledby="settings-application-title">
        <h3 id="settings-application-title">{t("settings.application")}</h3>
        <div className="settings-language" role="group" aria-label={t("settings.language")}>
          <span>{t("settings.language")}</span>
          <div className="settings-segmented">
            <button
              aria-pressed={settings.lang === "es"}
              onClick={() => setSettings((current) => {
                const next = { ...current, lang: "es" as const };
                onSettingsChanged(next);
                return next;
              })}
              type="button"
            >
              {t("settings.spanish")}
            </button>
            <button
              aria-pressed={settings.lang === "en"}
              onClick={() => setSettings((current) => {
                const next = { ...current, lang: "en" as const };
                onSettingsChanged(next);
                return next;
              })}
              type="button"
            >
              {t("settings.english")}
            </button>
          </div>
        </div>
        <div className="settings-version-row">
          <div className="settings-version-copy">
            <strong>{t("settings.clientVersion", { version: appVersion })}</strong>
            {updateStatus ? <span>{updateStatus}</span> : null}
          </div>
          <div className="actions">
            <button disabled={!updateAvailable} onClick={onOpenUpdate} type="button">{t("settings.update")}</button>
            <button onClick={onOpenReleases} type="button">{t("settings.releases")}</button>
            <button disabled={checkingUpdate} onClick={onCheckUpdates} type="button">
              {checkingUpdate ? t("addon.checking") : t("settings.checkUpdates")}
            </button>
          </div>
        </div>
        <p className="muted settings-last-check">{lastCheck}</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        {message ? <p className="success" role="status">{message}</p> : null}
        <Button icon={<ThemedIcon name="save" size={18} />} onClick={saveSettings} disabled={saving || loading}>
          {saving ? t("settings.saving") : t("settings.save")}
        </Button>
      </section>
    </>
  );
}
