import { Download, LogOut } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { AuthState } from "../core/types";
import appIcon from "../assets/keystone-ui/app-icon.png";
import activeTabIndicator from "../assets/keystone-ui/02-active-tab-indicator.png.png";
import footerWebButton from "../assets/keystone-ui/05-footer-web-button.png.png";
import settingsButton from "../assets/keystone-ui/03-settings-button.png.png";
import userPanelFrame from "../assets/keystone-ui/13-current-status-panel-frame.png.png";
import windowCloseButton from "../assets/keystone-ui/16-window-close-button.png.png";
import windowMinimizeButton from "../assets/keystone-ui/15-window-minimize-button.png.png";
import dropdownIcon from "../assets/keystone-ui/25-dropdown-icon.png";
import avatarFrame from "../assets/keystone-ui/26-avatar.png";

const CLIENT_WIDTH = 1672;
const CLIENT_HEIGHT = 941;

function getClientScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  return Math.min(window.innerWidth / CLIENT_WIDTH, window.innerHeight / CLIENT_HEIGHT);
}

export type KeystoneView = "sync" | "addon";

type KeystoneShellProps = {
  auth: AuthState;
  busyLogout: boolean;
  children: ReactNode;
  currentView: KeystoneView;
  onCloseWindow: () => void;
  onLogout: () => void;
  onMinimizeToTray: () => void;
  onMinimizeWindow: () => void;
  onNavigate: (view: KeystoneView) => void;
  onOpenSettings: () => void;
  onOpenWeb: () => void;
};

export function KeystoneShell({
  auth,
  busyLogout,
  children,
  currentView,
  onCloseWindow,
  onLogout,
  onMinimizeToTray,
  onMinimizeWindow,
  onNavigate,
  onOpenSettings,
  onOpenWeb,
}: KeystoneShellProps) {
  const [clientScale, setClientScale] = useState(getClientScale);

  useEffect(() => {
    const updateScale = () => setClientScale(getClientScale());
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      className="ks-app-frame"
      style={{ "--ks-client-scale": clientScale } as CSSProperties}
    >
      <KeystoneHeader
        auth={auth}
        busyLogout={busyLogout}
        currentView={currentView}
        onCloseWindow={onCloseWindow}
        onLogout={onLogout}
        onMinimizeWindow={onMinimizeWindow}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
      />
      <div className="ks-view">{children}</div>
      <KeystoneFooter onMinimizeToTray={onMinimizeToTray} onOpenWeb={onOpenWeb} />
    </div>
  );
}

type KeystoneHeaderProps = {
  auth: AuthState;
  busyLogout: boolean;
  currentView: KeystoneView;
  onCloseWindow: () => void;
  onLogout: () => void;
  onMinimizeWindow: () => void;
  onNavigate: (view: KeystoneView) => void;
  onOpenSettings: () => void;
};

function KeystoneHeader({
  auth,
  busyLogout,
  currentView,
  onCloseWindow,
  onLogout,
  onMinimizeWindow,
  onNavigate,
  onOpenSettings,
}: KeystoneHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const username = auth.username ?? "Usuario";

  return (
    <header className="ks-header">
      <div className="ks-brand">
        <img alt="" className="ks-brand__icon" src={appIcon} />
        <span className="ks-brand__name">KeystoneClient</span>
      </div>

      <nav aria-label="Principal" className="ks-tabs">
        <button
          aria-current={currentView === "sync" ? "page" : undefined}
          className="ks-tab"
          onClick={() => onNavigate("sync")}
          type="button"
        >
          Sincronizacion
          {currentView === "sync" ? <img alt="" className="ks-tab__indicator" src={activeTabIndicator} /> : null}
        </button>
        <button
          aria-current={currentView === "addon" ? "page" : undefined}
          className="ks-tab"
          onClick={() => onNavigate("addon")}
          type="button"
        >
          Addon
          {currentView === "addon" ? <img alt="" className="ks-tab__indicator" src={activeTabIndicator} /> : null}
        </button>
      </nav>

      <div className="ks-header-actions">
        <button aria-label="Configuracion" className="ks-icon-control ks-settings-control" onClick={onOpenSettings} type="button">
          <img alt="" src={settingsButton} />
        </button>
        <div className="ks-user-menu">
          <button
            aria-controls="ks-user-dropdown"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label={`Menu de usuario de ${username}`}
            className="ks-user-menu__trigger"
            onClick={() => setUserMenuOpen((open) => !open)}
            type="button"
          >
            <img alt="" className="ks-user-menu__shell" src={userPanelFrame} />
            <span className="ks-user-menu__avatar">
              {auth.avatarUrl ? <img alt="" className="ks-user-menu__avatar-image" src={auth.avatarUrl} /> : null}
              <img alt="" className="ks-user-menu__avatar-frame" src={avatarFrame} />
            </span>
            <span className="ks-user-menu__name">{username}</span>
            <img alt="" className="ks-user-menu__dropdown-icon" src={dropdownIcon} />
          </button>
          {userMenuOpen ? (
            <div className="ks-user-dropdown" id="ks-user-dropdown" role="menu">
              <button
                disabled={busyLogout}
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                role="menuitem"
                type="button"
              >
                <LogOut aria-hidden="true" />
                Cerrar sesion
              </button>
            </div>
          ) : null}
        </div>
        <div className="ks-window-controls" aria-label="Controles de ventana">
          <button aria-label="Minimizar" className="ks-window-button ks-window-button--minimize" onClick={onMinimizeWindow} type="button">
            <img alt="" src={windowMinimizeButton} />
          </button>
          <button aria-label="Cerrar" className="ks-window-button ks-window-button--close" onClick={onCloseWindow} type="button">
            <img alt="" src={windowCloseButton} />
          </button>
        </div>
      </div>
    </header>
  );
}

type KeystoneFooterProps = {
  onMinimizeToTray: () => void;
  onOpenWeb: () => void;
};

function KeystoneFooter({ onMinimizeToTray, onOpenWeb }: KeystoneFooterProps) {
  return (
    <footer className="ks-footer">
      <button className="ks-footer-action ks-footer-action--web" onClick={onOpenWeb} type="button">
        <img alt="" className="ks-footer-action__asset" src={footerWebButton} />
        <span>Acceder a la Web</span>
      </button>
      <button className="ks-footer-action ks-footer-action--tray" onClick={onMinimizeToTray} type="button">
        <Download aria-hidden="true" size={28} />
        Minimizar a la bandeja
      </button>
    </footer>
  );
}
