import "./App.css";
import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import packageJson from "../package.json";
import { ThemedIcon } from "./components/ThemedIcon";
import { KeystoneShell, type KeystoneView } from "./components/KeystoneShell";
import { ChangelogModal } from "./components/ChangelogModal";
import { UpdateModal } from "./components/UpdateModal";
import { logout } from "./core/auth";
import { findPostUpdateChangelog, markChangelogSeen, type PostUpdateChangelog } from "./core/changelog";
import { coreRequest } from "./core/client";
import { classColor } from "./core/characterDisplay";
import { listenCoreEvents } from "./core/events";
import {
  exitApplication,
  listenWindowCloseRequested,
  minimizeToTray,
  minimizeWindow,
  openReleases,
  openWeb,
  startWindowDragging,
} from "./core/native";
import { getPreviewState, isTeamsPreview } from "./core/preview";
import { liveTeamsDataSource, type TeamsDataSource } from "./core/teams";
import { getTeamsPreviewDataSource } from "./core/teamsPreview";
import { clearTeamsSessionCache, prefetchTeamsSession } from "./core/teamsSessionCache";
import { setProfileAvatar } from "./core/profile";
import { updateSettings } from "./core/settings";
import { tauriUpdaterAdapter } from "./core/tauriUpdater";
import { UpdateController, type UpdaterSnapshot } from "./core/updater";
import { I18nProvider, translate } from "./core/i18n";
import { bundledRelease } from "./generated/release";
import { useThemeAsset } from "./theme/useThemeAsset";
import type {
  AddonStatus,
  AuthState,
  ClientSettings,
  CharacterState,
  CoreError,
  PingResult,
  SyncStatus,
  SystemState,
  WowState,
} from "./core/types";
import { AddonPage } from "./pages/AddonPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SyncPage } from "./pages/SyncPage";
import { TeamsPage } from "./pages/TeamsPage";
import { WowPage } from "./pages/WowPage";

type BridgeStatus = "loading" | "ready" | "error";
type ActionName = "startup" | "logout";

const initialUpdater: UpdaterSnapshot = {
  status: "idle",
  currentVersion: packageJson.version,
  availableVersion: null,
  notes: "",
  releaseDate: null,
  downloadedBytes: 0,
  totalBytes: null,
  lastCheckedAt: null,
  error: null,
};

function AvatarChoice({
  avatarUrl,
  name,
  selected,
  wowClass,
}: {
  avatarUrl: string | null;
  name: string;
  selected: boolean;
  wowClass: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ks-avatar-choice__portrait" style={{ backgroundColor: classColor(wowClass) }}>
      <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      {avatarUrl && !failed ? <img alt="" onError={() => setFailed(true)} src={avatarUrl} /> : null}
      {selected ? <ThemedIcon className="ks-avatar-choice__check" name="confirm" /> : null}
    </span>
  );
}

function formatError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return fallback;
}

function App() {
  const appIcon = useThemeAsset("brand-mark");
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("loading");
  const [busyAction, setBusyAction] = useState<ActionName | null>("startup");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [wow, setWow] = useState<WowState | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [characters, setCharacters] = useState<CharacterState | null>(null);
  const [addon, setAddon] = useState<AddonStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentView, setCurrentView] = useState<KeystoneView>("sync");
  const [teamsDataSource] = useState<TeamsDataSource>(() => getTeamsPreviewDataSource() ?? liveTeamsDataSource);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [rememberCloseChoice, setRememberCloseChoice] = useState(false);
  const [closeChoiceSaving, setCloseChoiceSaving] = useState(false);
  const [closeChoiceError, setCloseChoiceError] = useState<string | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  const [updater, setUpdater] = useState<UpdaterSnapshot>(initialUpdater);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [postUpdateChangelog, setPostUpdateChangelog] = useState<PostUpdateChangelog | null>(null);
  const updaterController = useRef<UpdateController | null>(null);
  const teamsSessionOwner = useRef<string | null | undefined>(undefined);
  const settingsRef = useRef<ClientSettings | null>(null);
  const closeDialogOpenRef = useRef(false);

  settingsRef.current = settings;

  const applySystemState = useCallback((state: SystemState) => {
    setAuth(state.auth);
    setSettings(state.settings);
    setWow(state.wow);
    setSync(state.sync);
    setCharacters(state.characters);
    setAddon(state.addon);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unlisten = listenCoreEvents((event) => {
      if (cancelled) {
        return;
      }
      if (event.event === "system.ready") {
        setBridgeStatus("ready");
      }
      if (event.event === "addon.check.completed" || event.event === "addon.status.changed") {
        setAddon(event.data);
      }
      if (event.event === "characters.updated") {
        setCharacters(event.data);
      }
      if (event.event === "addon.install.completed") {
        setAddon(event.data.status);
      }
      if (event.event === "addon.install.started" || event.event === "addon.install.progress") {
        setAddon((current) => (current ? { ...current, operation: event.data } : current));
      }
      if (event.event === "addon.install.failed") {
        setAddon((current) => current ? {
          ...current,
          state: "error",
          message: event.data.error.message,
          operation: event.data.operation,
        } : current);
      }
    });

    async function runStartupCheck() {
      try {
        const previewState = getPreviewState();
        const state = previewState ?? (await coreRequest<SystemState>("system.get_state"));
        const firstPing = previewState ? { pong: true } : await coreRequest<PingResult>("system.ping");
        if (cancelled) {
          return;
        }

        applySystemState(state);
        setPreviewMode(previewState !== null);
        if (previewState && isTeamsPreview()) setCurrentView("teams");
        setBridgeStatus(firstPing.pong ? "ready" : "error");
        setError(null);
        document.title = `KeystoneClient - ${state.bridge}`;
      } catch (caught: unknown) {
        if (cancelled) {
          return;
        }
        setBridgeStatus("error");
        setError(formatError(caught, translate("es", "common.bridgeError")));
        document.title = "KeystoneClient - Error";
      } finally {
        if (!cancelled) {
          setBusyAction(null);
        }
      }
    }

    void runStartupCheck();

    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, [applySystemState]);

  useEffect(() => {
    if (!isTauri()) {
      const previewParams = new URLSearchParams(window.location.search);
      if (import.meta.env.DEV && previewParams.get("updater") === "available") {
        setUpdater({
          ...initialUpdater,
          status: "available",
          availableVersion: "0.4.0",
          notes: "# KeystoneClient 0.4.0\n\n## Cambios\n\n- Nuevo instalador Tauri con actualizaciones firmadas.\n- Mejoras de estabilidad y rendimiento.",
          releaseDate: "2026-08-23T12:00:00Z",
          lastCheckedAt: "2026-08-23T12:00:00Z",
        });
        setUpdateModalOpen(true);
      }
      if (import.meta.env.DEV && previewParams.get("changelog") === "post-update") {
        setPostUpdateChangelog({ version: bundledRelease.version, notes: bundledRelease.notes });
      }
      return;
    }
    const controller = new UpdateController(packageJson.version, tauriUpdaterAdapter);
    updaterController.current = controller;
    const unsubscribe = controller.subscribe((snapshot) => {
      setUpdater(snapshot);
      if (snapshot.status === "available") {
        setUpdateModalOpen(true);
      } else if (snapshot.status === "current") {
        setUpdateModalOpen(false);
      }
    });
    void controller.check();
    return () => {
      unsubscribe();
      updaterController.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    try {
      setPostUpdateChangelog(
        findPostUpdateChangelog(localStorage, bundledRelease.version, bundledRelease.notes),
      );
    } catch {
      // A blocked WebView storage backend must not prevent client startup.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unlisten = listenWindowCloseRequested(() => {
      if (!cancelled) {
        handleCloseRequest();
      }
    });
    return () => {
      cancelled = true;
      unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    if (!closeDialogOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissCloseDialog();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDialogOpen]);

  const handleSettingsChanged = useCallback((nextSettings: ClientSettings) => {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }, []);

  const handleSessionExpired = useCallback(() => {
    clearTeamsSessionCache();
    setAuth({ authenticated: false, username: null, avatarUrl: null });
    setCharacters(current => current ? { ...current, characters: [], source: "none", lastRefreshAt: null, lastError: null } : current);
    setCurrentView("sync");
    setError(null);
  }, []);

  const handleWowChanged = useCallback((nextWow: WowState) => {
    setWow(nextWow);
  }, []);

  async function handleLogout() {
    const previousAuth = auth;
    setBusyAction("logout");
    setError(null);
    clearTeamsSessionCache();
    setAuth({ authenticated: false, username: null, avatarUrl: null });
    setCharacters((current) => current ? { ...current, characters: [], source: "none", lastRefreshAt: null, lastError: null } : current);
    setSettingsOpen(false);
    setAvatarPickerOpen(false);
    setOnboardingSkipped(false);
    try {
      const nextAuth = await logout();
      setAuth((current) => current?.authenticated ? current : nextAuth);
    } catch (caught) {
      setAuth((current) => current?.authenticated ? current : previousAuth);
      setError(formatError(caught, t("common.bridgeError")));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAuthenticated(nextAuth: AuthState) {
    clearTeamsSessionCache();
    setAuth(nextAuth);
    setBusyAction("startup");
    setError(null);
    try {
      const state = await coreRequest<SystemState>("system.get_state");
      applySystemState(state);
    } catch (caught) {
      setError(formatError(caught, t("common.bridgeError")));
    } finally {
      setBusyAction(null);
    }
  }

  const authenticatedUsername = auth?.authenticated ? auth.username : null;

  useEffect(() => {
    if (teamsSessionOwner.current === authenticatedUsername) return;
    clearTeamsSessionCache();
    teamsSessionOwner.current = authenticatedUsername;
  }, [authenticatedUsername]);

  useEffect(() => {
    if (!auth?.authenticated || bridgeStatus !== "ready" || !settings || !wow || !sync || !characters || !addon
      || (previewMode && !isTeamsPreview())) return;
    let cancelled = false;
    void prefetchTeamsSession(teamsDataSource).catch(caught => {
      if (!cancelled && typeof caught === "object" && caught !== null && "code" in caught
        && String((caught as CoreError).code) === "SESSION_EXPIRED") {
        handleSessionExpired();
      }
    });
    return () => { cancelled = true; };
  }, [addon, auth?.authenticated, bridgeStatus, characters, handleSessionExpired, previewMode,
    settings, sync, teamsDataSource, wow]);

  async function handleAvatarSelect(avatarUrl: string) {
    if (avatarSaving) {
      return;
    }
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const nextAuth = previewMode
        ? { ...auth!, avatarUrl }
        : await setProfileAvatar({ avatarUrl });
      setAuth(nextAuth);
      setAvatarPickerOpen(false);
    } catch (caught) {
      setAvatarError(formatError(caught, t("common.bridgeError")));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function runNativeAction(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(formatError(caught, t("common.bridgeError")));
    }
  }

  function openCloseDialog() {
    closeDialogOpenRef.current = true;
    setSettingsOpen(false);
    setAvatarPickerOpen(false);
    setCloseChoiceError(null);
    setCloseDialogOpen(true);
  }

  function dismissCloseDialog() {
    closeDialogOpenRef.current = false;
    setRememberCloseChoice(false);
    setCloseChoiceError(null);
    setCloseDialogOpen(false);
  }

  function performCloseAction(behavior: Exclude<ClientSettings["closeBehavior"], "ask">) {
    dismissCloseDialog();
    void runNativeAction(behavior === "minimize" ? minimizeToTray : exitApplication);
  }

  function handleCloseRequest() {
    const behavior = settingsRef.current?.closeBehavior ?? "ask";
    if (behavior !== "ask") {
      performCloseAction(behavior);
      return;
    }
    if (closeDialogOpenRef.current) {
      performCloseAction("exit");
      return;
    }
    openCloseDialog();
  }

  async function chooseCloseAction(behavior: Exclude<ClientSettings["closeBehavior"], "ask">) {
    if (closeChoiceSaving) return;
    if (rememberCloseChoice) {
      if (previewMode) {
        setSettings((current) => current ? { ...current, closeBehavior: behavior } : current);
      } else {
        setCloseChoiceSaving(true);
        setCloseChoiceError(null);
        try {
          const saved = await updateSettings({ closeBehavior: behavior });
          handleSettingsChanged(saved);
        } catch (caught) {
          setCloseChoiceError(formatError(caught, t("settings.error")));
          setCloseChoiceSaving(false);
          return;
        }
        setCloseChoiceSaving(false);
      }
    }
    performCloseAction(behavior);
  }

  function checkForUpdates() {
    void updaterController.current?.check();
  }

  function closePostUpdateChangelog() {
    try {
      markChangelogSeen(localStorage, bundledRelease.version);
    } catch {
      // The changelog can still be dismissed for this process when storage is unavailable.
    }
    setPostUpdateChangelog(null);
  }

  const usableSelectedAccounts = wow?.accounts.filter(
    (account) => account.savedVariablesExists && wow.selectedAccounts.includes(account.name),
  ).length ?? 0;
  const needsOnboarding = Boolean(
    auth?.authenticated
      && wow
      && (!wow.install.detected
        || wow.configurationComplete === false
        || usableSelectedAccounts === 0),
  );
  const language = settings?.lang ?? "es";
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values);

  return (
    <I18nProvider language={language}>
    <main className="shell">
      {auth?.authenticated && settings && wow && sync && characters && addon && (!needsOnboarding || onboardingSkipped) ? (
        <KeystoneShell
          auth={auth}
          busyLogout={busyAction === "logout"}
          currentView={currentView}
          onCloseWindow={handleCloseRequest}
          onChangeAvatar={() => {
            setAvatarError(null);
            setAvatarPickerOpen(true);
          }}
          onLogout={() => void handleLogout()}
          onMinimizeToTray={() => void runNativeAction(minimizeToTray)}
          onMinimizeWindow={() => void runNativeAction(minimizeWindow)}
          onNavigate={setCurrentView}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenWeb={() => void runNativeAction(openWeb)}
          onStartWindowDrag={() => void runNativeAction(startWindowDragging)}
        >
          {error ? <p className="error ks-global-error" role="alert">{error}</p> : null}
          {currentView === "sync" ? (
            <SyncPage
              appVersion={packageJson.version}
              initialAddon={addon}
              initialCharacters={characters}
              initialSync={sync}
              initialWow={wow}
              preview={previewMode}
            />
          ) : currentView === "teams" ? (
            <TeamsPage
              dataSource={teamsDataSource}
              onOpenWeb={() => void runNativeAction(openWeb)}
              onSessionExpired={handleSessionExpired}
            />
          ) : (
            <AddonPage
              initialAddon={addon}
              initialWow={wow}
              onWowChanged={setWow}
              preview={previewMode}
            />
          )}
          {settingsOpen ? (
            <div aria-labelledby="settings-modal-title" aria-modal="true" className="ks-modal" role="dialog">
              <div className="ks-modal__panel">
                <div className="ks-modal__header">
                  <div>
                    <p className="shell__eyebrow">KeystoneClient</p>
                    <h2 id="settings-modal-title">{t("settings.title")}</h2>
                  </div>
                  <button
                    aria-label={t("settings.close")}
                    className="ks-modal__close"
                    onClick={() => setSettingsOpen(false)}
                    type="button"
                  >
                    <ThemedIcon name="close" size={20} />
                  </button>
                </div>
                <div className="ks-modal__content">
                  <SettingsPage
                    appVersion={packageJson.version}
                    initialSettings={settings}
                    onCheckUpdates={checkForUpdates}
                    onOpenReleases={() => void runNativeAction(openReleases)}
                    onOpenUpdate={() => setUpdateModalOpen(true)}
                    onSettingsChanged={handleSettingsChanged}
                    preview={previewMode}
                    updater={updater}
                  />
                  <WowPage
                    addonStatus={addon}
                    initialWow={wow}
                    onGoAddon={() => {
                      setSettingsOpen(false);
                      setCurrentView("addon");
                    }}
                    onWowChanged={handleWowChanged}
                  />
                  <div className="ks-modal__footer">
                    <button onClick={() => setSettingsOpen(false)} type="button">{t("common.close")}</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {avatarPickerOpen ? (
            <div aria-labelledby="avatar-picker-title" aria-modal="true" className="ks-modal ks-avatar-picker" role="dialog">
              <div className="ks-modal__panel ks-avatar-picker__panel">
                <div className="ks-modal__header">
                  <div>
                    <p className="shell__eyebrow">{t("avatar.profile")}</p>
                    <h2 id="avatar-picker-title">{t("avatar.title")}</h2>
                  </div>
                  <button aria-label={t("avatar.close")} className="ks-modal__close" onClick={() => setAvatarPickerOpen(false)} type="button">
                    <ThemedIcon name="close" size={20} />
                  </button>
                </div>
                <div className="ks-avatar-picker__content">
                  {characters.characters.length === 0 ? <p className="muted">{t("avatar.empty")}</p> : (
                    <div className="ks-avatar-picker__grid">
                      {characters.characters.map((character) => (
                        <button
                          aria-pressed={Boolean(character.avatarUrl && auth.avatarUrl === character.avatarUrl)}
                          className="ks-avatar-choice"
                          disabled={avatarSaving || !character.avatarUrl}
                          key={character.id}
                          onClick={() => character.avatarUrl && void handleAvatarSelect(character.avatarUrl)}
                          type="button"
                        >
                          <AvatarChoice
                            avatarUrl={character.avatarUrl}
                            name={character.name}
                            selected={Boolean(character.avatarUrl && auth.avatarUrl === character.avatarUrl)}
                            wowClass={character.wowClass}
                          />
                          <span><strong>{character.name}</strong><small>{character.realm}</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                  {avatarError ? <p className="error" role="alert">{avatarError}</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </KeystoneShell>
      ) : auth?.authenticated && wow && settings && sync && characters && addon ? (
        <OnboardingPage
          initialWow={wow}
          onComplete={(nextWow) => {
            handleWowChanged(nextWow);
            setOnboardingSkipped(false);
          }}
          onOpenAddon={() => {
            setCurrentView("addon");
            setOnboardingSkipped(true);
          }}
          onWowChanged={handleWowChanged}
          preview={previewMode}
        />
      ) : (
        <section className="ks-login-shell" aria-label="KeystoneClient">
          <img alt="" className="ks-login-shell__icon" src={appIcon} />
          <div>
            <p className="shell__eyebrow">
              {bridgeStatus === "loading" ? t("login.connecting") : bridgeStatus === "ready" ? "KeystoneClient" : t("common.error")}
            </p>
            <h1>KeystoneClient</h1>
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <LoginPage onAuthenticated={(nextAuth) => void handleAuthenticated(nextAuth)} />
        </section>
      )}
      {closeDialogOpen ? (
        <div aria-labelledby="close-dialog-title" aria-modal="true" className="ks-modal ks-choice-modal" role="dialog">
          <div className="ks-modal__panel ks-choice-modal__panel">
            <div className="ks-modal__header">
              <div>
                <p className="shell__eyebrow">KeystoneClient</p>
                <h2 id="close-dialog-title">{t("close.title")}</h2>
              </div>
              <button aria-label={t("close.cancelLabel")} className="ks-modal__close" onClick={dismissCloseDialog} type="button">
                <ThemedIcon name="close" size={20} />
              </button>
            </div>
            <label className="check-row ks-choice-modal__remember">
              <input checked={rememberCloseChoice} onChange={(event) => setRememberCloseChoice(event.target.checked)} type="checkbox" />
              {t("close.remember")}
            </label>
            <div className="ks-choice-modal__actions">
              <button autoFocus disabled={closeChoiceSaving} onClick={() => void chooseCloseAction("minimize")} type="button">{t("shell.minimizeTray")}</button>
              <button className="ks-choice-modal__exit" disabled={closeChoiceSaving} onClick={() => void chooseCloseAction("exit")} type="button">{t("close.exit")}</button>
              <button className="ks-choice-modal__cancel" disabled={closeChoiceSaving} onClick={dismissCloseDialog} type="button">{t("common.cancel")}</button>
            </div>
            {closeChoiceError ? <p className="error" role="alert">{closeChoiceError}</p> : null}
          </div>
        </div>
      ) : null}
      {updateModalOpen && ["available", "checking", "downloading", "installing", "error"].includes(updater.status) ? (
        <UpdateModal
          onClose={() => setUpdateModalOpen(false)}
          onInstall={() => void updaterController.current?.installAndRelaunch()}
          onRetry={checkForUpdates}
          snapshot={updater}
        />
      ) : null}
      {postUpdateChangelog ? (
        <ChangelogModal
          notes={postUpdateChangelog.notes}
          onClose={closePostUpdateChangelog}
          version={postUpdateChangelog.version}
        />
      ) : null}
    </main>
    </I18nProvider>
  );
}

export default App;
