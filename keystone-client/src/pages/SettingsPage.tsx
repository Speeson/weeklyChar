import { useEffect, useRef, useState } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
import { ThemeSelector } from "../components/ThemeSelector";
import { OverlayShortcutRecorder } from "../components/OverlayShortcutRecorder";
import { Button } from "../components/ui";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import { configureOverlayShortcut, getOverlayShortcutStatus } from "../core/native";
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

const DEFAULT_OVERLAY_SHORTCUT = "Ctrl+Shift+K";

function withOverlayDefaults(settings: ClientSettings): ClientSettings {
  if (settings.overlayEnabled !== undefined && settings.overlayShortcut !== undefined) {
    return settings;
  }
  return {
    ...settings,
    overlayEnabled: settings.overlayEnabled ?? false,
    overlayShortcut: settings.overlayShortcut ?? DEFAULT_OVERLAY_SHORTCUT,
  };
}

function formatSettingsError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
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
  const [settings, setSettings] = useState<ClientSettings>(() => withOverlayDefaults(initialSettings));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [loadedAutostart, setLoadedAutostart] = useState(false);
  const mountedRef = useRef(true);
  const settingsGenerationRef = useRef(0);
  const persistedSettingsRef = useRef(withOverlayDefaults(initialSettings));
  const languageWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (preview) {
      return;
    }

    let cancelled = false;
    const loadGeneration = settingsGenerationRef.current;
    setLoading(true);
    setError(null);
    setOverlayError(null);
    Promise.all([getSettings(), getAutostartEnabled(), getOverlayShortcutStatus()])
      .then(([loadedSettings, nativeAutostart, overlayStatus]) => {
        if (!cancelled) {
          const loaded = withOverlayDefaults(loadedSettings);
          setAutostartState(nativeAutostart);
          setLoadedAutostart(nativeAutostart);
          if (overlayStatus.lastError) {
            setOverlayError(overlayStatus.lastError);
          }
          if (settingsGenerationRef.current === loadGeneration) {
            persistedSettingsRef.current = loaded;
            setSettings(loaded);
            onSettingsChanged(loaded);
          }
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
    setOverlayError(null);
    let overlayConfigured = false;
    let overlayConfigurationFailed = false;
    const persisted = withOverlayDefaults(persistedSettingsRef.current);
    try {
      await languageWriteQueueRef.current;
      const nativeAutostart = await setAutostartEnabled(autostartEnabled);
      if (nativeAutostart !== autostartEnabled) {
        throw new Error(t("settings.autostartMismatch"));
      }
      try {
        await configureOverlayShortcut(
          settings.overlayEnabled ?? false,
          settings.overlayShortcut ?? DEFAULT_OVERLAY_SHORTCUT,
        );
      } catch (caught) {
        overlayConfigurationFailed = true;
        setOverlayError(formatSettingsError(caught, t("settings.error")));
        throw caught;
      }
      overlayConfigured = true;
      const saved = withOverlayDefaults(await updateSettings(settings));
      persistedSettingsRef.current = saved;
      setSettings(saved);
      onSettingsChanged(saved);
      setLoadedAutostart(nativeAutostart);
      setMessage(t("settings.saved"));
    } catch (caught) {
      if (overlayConfigured) {
        try {
          await configureOverlayShortcut(
            persisted.overlayEnabled ?? false,
            persisted.overlayShortcut ?? DEFAULT_OVERLAY_SHORTCUT,
          );
        } catch {
          // Preserve the original error; runtime status exposes any rollback failure.
        }
      }
      if (autostartEnabled !== loadedAutostart) {
        try {
          setAutostartState(await setAutostartEnabled(loadedAutostart));
        } catch {
          // Preserve the original error; the next Settings load reads OS truth again.
        }
      }
      if (!overlayConfigurationFailed) {
        setError(formatSettingsError(caught, t("settings.error")));
      }
    } finally {
      setSaving(false);
    }
  }

  function persistLanguage(lang: ClientSettings["lang"]) {
    if (settings.lang === lang) return;
    const generation = settingsGenerationRef.current + 1;
    settingsGenerationRef.current = generation;
    setMessage(null);
    setError(null);
    setSettings((current) => ({ ...current, lang }));
    onSettingsChanged({ ...persistedSettingsRef.current, lang });

    languageWriteQueueRef.current = languageWriteQueueRef.current.then(async () => {
      try {
        const saved = await updateSettings({ lang });
        persistedSettingsRef.current = saved;
        if (!mountedRef.current || settingsGenerationRef.current !== generation) return;
        setSettings((current) => ({ ...current, lang: saved.lang }));
        onSettingsChanged(saved);
      } catch (caught) {
        if (!mountedRef.current || settingsGenerationRef.current !== generation) return;
        const persisted = persistedSettingsRef.current;
        setSettings((current) => ({ ...current, lang: persisted.lang }));
        onSettingsChanged(persisted);
        setError(formatSettingsError(caught, t("settings.error")));
      }
    });
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
        <label className="settings-field">
          <span>{t("settings.closeBehavior")}</span>
          <select
            aria-label={t("settings.closeBehavior")}
            value={settings.closeBehavior}
            onChange={(event) => setSettings((current) => ({
              ...current,
              closeBehavior: event.target.value as ClientSettings["closeBehavior"],
            }))}
          >
            <option value="ask">{t("settings.closeAsk")}</option>
            <option value="minimize">{t("settings.closeMinimize")}</option>
            <option value="exit">{t("settings.closeExit")}</option>
          </select>
        </label>
        <label className="check-row">
          <input
            checked={settings.lockWindowAspectRatio ?? false}
            onChange={(event) => setSettings((current) => ({ ...current, lockWindowAspectRatio: event.target.checked }))}
            type="checkbox"
          />
          {t("settings.lockWindowAspectRatio")}
        </label>
        <label className="check-row">
          <input
            checked={settings.overlayEnabled ?? false}
            onChange={(event) => {
              setOverlayError(null);
              setSettings((current) => ({ ...current, overlayEnabled: event.target.checked }));
            }}
            type="checkbox"
          />
          {t("settings.overlayEnabled")}
        </label>
        <div className="settings-field">
          <span>{t("settings.overlayShortcut")}</span>
          <OverlayShortcutRecorder
            disabled={loading || saving}
            error={overlayError}
            onChange={(overlayShortcut) => {
              setOverlayError(null);
              setSettings((current) => ({ ...current, overlayShortcut }));
            }}
            onRestore={() => {
              setOverlayError(null);
              setSettings((current) => ({ ...current, overlayShortcut: DEFAULT_OVERLAY_SHORTCUT }));
            }}
            onStartRecording={() => setOverlayError(null)}
            value={settings.overlayShortcut ?? DEFAULT_OVERLAY_SHORTCUT}
          />
        </div>
      </section>

      <ThemeSelector onThemeChange={setTheme} theme={theme} themes={themes} />

      <section className="settings-block settings-application" aria-labelledby="settings-application-title">
        <h3 id="settings-application-title">{t("settings.application")}</h3>
        <div className="settings-language" role="group" aria-label={t("settings.language")}>
          <span>{t("settings.language")}</span>
          <div className="settings-segmented">
            <button
              aria-pressed={settings.lang === "es"}
              onClick={() => persistLanguage("es")}
              type="button"
            >
              {t("settings.spanish")}
            </button>
            <button
              aria-pressed={settings.lang === "en"}
              onClick={() => persistLanguage("en")}
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
