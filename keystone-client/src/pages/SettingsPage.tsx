import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemedIcon } from "../components/ThemedIcon";
import { ThemeSelector } from "../components/ThemeSelector";
import { OverlayShortcutRecorder } from "../components/OverlayShortcutRecorder";
import { Button } from "../components/ui";
import { getAutostartEnabled, setAutostartEnabled } from "../core/autostart";
import {
  beginOverlayShortcutCapture,
  configureOverlayShortcut,
  endOverlayShortcutCapture,
  getOverlayShortcutStatus,
  pollOverlayShortcutCapture,
  validateOverlayShortcut,
} from "../core/native";
import { getSettings, updateSettings } from "../core/settings";
import type { ClientSettings } from "../core/types";
import { useI18n } from "../core/i18n";
import { localizedCoreErrorMessage } from "../core/errorDisplay";
import type { UpdaterSnapshot } from "../core/updater";
import { useTheme } from "../theme/useTheme";

type SettingsPageProps = {
  appVersion: string;
  children?: ReactNode;
  initialSettings: ClientSettings;
  onClose?: () => void;
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
const settingsSections = ["general", "accounts", "appearance", "application"] as const;
type SettingsSection = typeof settingsSections[number];

function SettingsToggleCard({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle-card">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" />
      <span aria-hidden="true" className="settings-toggle-track"><span /></span>
    </label>
  );
}

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

export function SettingsPage({
  appVersion,
  children,
  initialSettings,
  onClose,
  onSettingsChanged,
  updater = idleUpdater,
  onCheckUpdates,
  onOpenUpdate,
  onOpenReleases,
  preview = false,
}: SettingsPageProps) {
  const { language, t } = useI18n();
  const { setTheme, theme, themes } = useTheme();
  const [settings, setSettings] = useState<ClientSettings>(() => withOverlayDefaults(initialSettings));
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
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
            setOverlayError(t("settings.overlayShortcutUnavailable"));
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
          setError(localizedCoreErrorMessage(caught, language, t("settings.error")));
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
        setOverlayError(t("settings.overlayShortcutUnavailable"));
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
        setError(localizedCoreErrorMessage(caught, language, t("settings.error")));
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
        setError(localizedCoreErrorMessage(caught, language, t("settings.error")));
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

  async function runOverlayCaptureAction(action: () => Promise<void>) {
    try {
      await action();
    } catch {
      throw new Error(t("settings.overlayShortcutUnavailable"));
    }
  }

  return (
    <div className="settings-modal-body">
      <nav aria-label={t("settings.title")} className="settings-tabs" role="tablist">
        {settingsSections.map((section) => (
          <button
            aria-controls={`settings-panel-${section}`}
            aria-selected={activeSection === section}
            className="ks-tab settings-tab"
            data-state={activeSection === section ? "selected" : "default"}
            id={`settings-tab-${section}`}
            key={section}
            onClick={() => setActiveSection(section)}
            onKeyDown={(event) => {
              const index = settingsSections.indexOf(section);
              const next = event.key === "ArrowRight" ? (index + 1) % settingsSections.length
                : event.key === "ArrowLeft" ? (index - 1 + settingsSections.length) % settingsSections.length
                  : event.key === "Home" ? 0 : event.key === "End" ? settingsSections.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              const target = settingsSections[next];
              setActiveSection(target);
              document.getElementById(`settings-tab-${target}`)?.focus();
            }}
            role="tab"
            tabIndex={activeSection === section ? 0 : -1}
            type="button"
          >
            <span className="ks-tab__label">{section === "accounts" ? t("wow.title") : t(`settings.${section}`)}</span>
          </button>
        ))}
      </nav>
      <div className="ks-modal__content">
        <div className="settings-stage">
        <section className="settings-block settings-general" aria-labelledby="settings-tab-general" hidden={activeSection !== "general"} id="settings-panel-general" role="tabpanel">
          {loading ? <p className="muted">{t("settings.loading")}</p> : null}
          <section aria-labelledby="settings-start-behavior-title" className="settings-general-group">
            <h3 className="settings-section-heading" id="settings-start-behavior-title">{t("settings.startBehavior")}</h3>
            <div className="settings-toggle-grid">
              <SettingsToggleCard checked={autostartEnabled} label={t("settings.autostart")} onChange={setAutostartState} />
              <SettingsToggleCard
                checked={settings.startMinimized}
                label={t("settings.startMinimized")}
                onChange={(startMinimized) => setSettings((current) => ({ ...current, startMinimized }))}
              />
            </div>
            <div className="settings-close-card">
              <span id="settings-close-behavior-label">{t("settings.closeBehavior")}</span>
              <div aria-labelledby="settings-close-behavior-label" className="settings-close-choices" role="radiogroup">
                {(["ask", "minimize", "exit"] as const).map((behavior) => (
                  <label className="settings-close-choice" key={behavior}>
                    <input
                      checked={settings.closeBehavior === behavior}
                      name="settings-close-behavior"
                      onChange={() => setSettings((current) => ({ ...current, closeBehavior: behavior }))}
                      type="radio"
                      value={behavior}
                    />
                    <span>{t(behavior === "ask" ? "settings.closeAsk" : behavior === "minimize" ? "settings.closeMinimize" : "settings.closeExit")}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
          <section aria-labelledby="settings-overlay-window-title" className="settings-general-group">
            <h3 className="settings-section-heading" id="settings-overlay-window-title">{t("settings.overlayAndWindow")}</h3>
            <div className="settings-toggle-grid">
              <SettingsToggleCard
                checked={settings.lockWindowAspectRatio ?? false}
                label={t("settings.lockWindowAspectRatio")}
                onChange={(lockWindowAspectRatio) => setSettings((current) => ({ ...current, lockWindowAspectRatio }))}
              />
              <SettingsToggleCard
                checked={settings.overlayEnabled ?? false}
                label={t("settings.overlayEnabled")}
                onChange={(overlayEnabled) => {
                  setOverlayError(null);
                  setSettings((current) => ({ ...current, overlayEnabled }));
                }}
              />
            </div>
            <div className="settings-shortcut-card">
              <span>{t("settings.overlayShortcut")}</span>
              <OverlayShortcutRecorder
                disabled={loading || saving}
                error={overlayError}
                onChange={(overlayShortcut) => {
                  setOverlayError(null);
                  setSettings((current) => ({ ...current, overlayShortcut }));
                }}
                onPoll={pollOverlayShortcutCapture}
                onRecordingStart={async () => {
                  setOverlayError(null);
                  await runOverlayCaptureAction(beginOverlayShortcutCapture);
                }}
                onRecordingStop={() => runOverlayCaptureAction(endOverlayShortcutCapture)}
                onRestore={() => {
                  setOverlayError(null);
                  setSettings((current) => ({ ...current, overlayShortcut: DEFAULT_OVERLAY_SHORTCUT }));
                }}
                onValidate={(shortcut) => runOverlayCaptureAction(() => validateOverlayShortcut(shortcut))}
                value={settings.overlayShortcut ?? DEFAULT_OVERLAY_SHORTCUT}
              />
            </div>
          </section>
        </section>

        <div aria-labelledby="settings-tab-accounts" className="settings-account-panel" hidden={activeSection !== "accounts"} id="settings-panel-accounts" role="tabpanel">
          {children}
        </div>
        <div aria-labelledby="settings-tab-appearance" className="settings-appearance-panel" hidden={activeSection !== "appearance"} id="settings-panel-appearance" role="tabpanel">
          <ThemeSelector onThemeChange={setTheme} theme={theme} themes={themes} />
        </div>

        <section className="settings-block settings-application" aria-labelledby="settings-tab-application" hidden={activeSection !== "application"} id="settings-panel-application" role="tabpanel">
          <section aria-labelledby="settings-language-title" className="settings-application-group">
            <h3 className="settings-section-heading" id="settings-language-title">{t("settings.language")}</h3>
            <div aria-labelledby="settings-language-title" className="settings-segmented settings-language-selector" role="group">
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
          </section>
          <section aria-labelledby="settings-client-version-title" className="settings-application-group">
            <h3 className="settings-section-heading" id="settings-client-version-title">{t("settings.clientVersion")}</h3>
            <div className="settings-version-row">
              <div className="settings-version-copy">
                <strong>{appVersion}</strong>
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
          </section>
        </section>
        </div>
      </div>
      <div className="ks-modal__footer settings-actions-footer">
        <div className="settings-actions-feedback">
          {error ? <p className="error" role="alert">{error}</p> : null}
          {message ? <p className="success" role="status">{message}</p> : null}
        </div>
        <div className="actions">
          <Button
            disabled={saving || loading}
            icon={<ThemedIcon name="save" size={18} />}
            onClick={saveSettings}
            variant="success"
          >
            {saving ? t("settings.saving") : t("settings.save")}
          </Button>
          {onClose ? (
            <Button disabled={saving} onClick={onClose} variant="danger">
              {t("common.close")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
