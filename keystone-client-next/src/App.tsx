import "./App.css";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import packageJson from "../package.json";
import appIcon from "./assets/keystone-ui/app-icon.png";
import bgImage from "./assets/keystone-ui/bg.jpg";
import { KeystoneShell, type KeystoneView } from "./components/KeystoneShell";
import { logout } from "./core/auth";
import { coreRequest } from "./core/client";
import { listenCoreEvents } from "./core/events";
import { closeWindow, minimizeToTray, minimizeWindow, openWeb } from "./core/native";
import { getPreviewState } from "./core/preview";
import type {
  AddonStatus,
  AuthState,
  ClientSettings,
  CoreError,
  CoreEvent,
  PingResult,
  SyncStatus,
  SystemState,
  WowState,
} from "./core/types";
import { AddonPage } from "./pages/AddonPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SyncPage } from "./pages/SyncPage";
import { WowPage } from "./pages/WowPage";

type BridgeStatus = "loading" | "ready" | "error";
type ActionName = "startup" | "logout";

function formatError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as CoreError).message);
  }

  return "The Python bridge returned a controlled error.";
}

function App() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("loading");
  const [busyAction, setBusyAction] = useState<ActionName | null>("startup");
  const [lastEvent, setLastEvent] = useState<CoreEvent | null>(null);
  const [coreState, setCoreState] = useState<SystemState | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [wow, setWow] = useState<WowState | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [addon, setAddon] = useState<AddonStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentView, setCurrentView] = useState<KeystoneView>("sync");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unlisten = listenCoreEvents((event) => {
      if (cancelled) {
        return;
      }
      setLastEvent(event);
      if (event.event === "system.ready") {
        setBridgeStatus("ready");
      }
      if (event.event === "addon.check.completed" || event.event === "addon.status.changed") {
        setAddon(event.data);
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

        setCoreState(state);
        setAuth(state.auth);
        setSettings(state.settings);
        setWow(state.wow);
        setSync(state.sync);
        setAddon(state.addon);
        setPreviewMode(previewState !== null);
        setBridgeStatus(firstPing.pong ? "ready" : "error");
        setError(null);
        document.title = `KeystoneClient Next - ${state.bridge}`;
      } catch (caught: unknown) {
        if (cancelled) {
          return;
        }
        setBridgeStatus("error");
        setError(formatError(caught));
        document.title = "KeystoneClient Next - Error";
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
  }, []);

  const handleSettingsChanged = useCallback((nextSettings: ClientSettings) => {
    setSettings(nextSettings);
  }, []);

  const handleWowChanged = useCallback((nextWow: WowState) => {
    setWow(nextWow);
    setCoreState((current) => (current ? { ...current, wow: nextWow } : current));
  }, []);

  async function handleLogout() {
    setBusyAction("logout");
    setError(null);
    try {
      const nextAuth = await logout();
      setAuth(nextAuth);
      setSettingsOpen(false);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function runNativeAction(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(formatError(caught));
    }
  }

  return (
    <main className="shell" style={{ "--ks-bg-image": `url(${bgImage})` } as React.CSSProperties}>
      {auth?.authenticated && settings && wow && sync && addon ? (
        <KeystoneShell
          auth={auth}
          busyLogout={busyAction === "logout"}
          currentView={currentView}
          onCloseWindow={() => void runNativeAction(closeWindow)}
          onLogout={() => void handleLogout()}
          onMinimizeToTray={() => void runNativeAction(minimizeToTray)}
          onMinimizeWindow={() => void runNativeAction(minimizeWindow)}
          onNavigate={setCurrentView}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenWeb={() => void runNativeAction(openWeb)}
        >
          {error ? <p className="error ks-global-error" role="alert">{error}</p> : null}
          {currentView === "sync" ? (
            <SyncPage
              appVersion={packageJson.version}
              initialAddon={addon}
              initialSync={sync}
              initialWow={wow}
              preview={previewMode}
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
                    <h2 id="settings-modal-title">Ajustes</h2>
                  </div>
                  <button
                    aria-label="Cerrar configuracion"
                    className="ks-modal__close"
                    onClick={() => setSettingsOpen(false)}
                    type="button"
                  >
                    <X aria-hidden="true" size={20} />
                  </button>
                </div>
                <div className="ks-modal__content">
                  <SettingsPage
                    appVersion={packageJson.version}
                    initialSettings={settings}
                    onSettingsChanged={handleSettingsChanged}
                    preview={previewMode}
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
                    <button onClick={() => setSettingsOpen(false)} type="button">Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </KeystoneShell>
      ) : (
        <section className="ks-login-shell" aria-label="KeystoneClient">
          <img alt="" className="ks-login-shell__icon" src={appIcon} />
          <div>
            <p className="shell__eyebrow">
              {bridgeStatus === "loading" ? "Conectando" : bridgeStatus === "ready" ? "KeystoneClient" : "Error"}
            </p>
            <h1>KeystoneClient</h1>
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <LoginPage onAuthenticated={setAuth} />
          {lastEvent ? <p className="muted">Core: {lastEvent.event}</p> : null}
          {coreState ? <p className="muted">Bridge: {coreState.bridge}</p> : null}
        </section>
      )}
    </main>
  );
}

export default App;
