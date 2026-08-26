import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { AuthState } from "../core/types";
import { useI18n } from "../core/i18n";
import { useThemeAsset } from "../theme/useThemeAsset";
import { ThemedIcon } from "./ThemedIcon";

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
  onChangeAvatar: () => void;
  onLogout: () => void;
  onMinimizeToTray: () => void;
  onMinimizeWindow: () => void;
  onNavigate: (view: KeystoneView) => void;
  onOpenSettings: () => void;
  onOpenWeb: () => void;
  onStartWindowDrag: () => void;
};

export function KeystoneShell({
  auth,
  busyLogout,
  children,
  currentView,
  onCloseWindow,
  onChangeAvatar,
  onLogout,
  onMinimizeToTray,
  onMinimizeWindow,
  onNavigate,
  onOpenSettings,
  onOpenWeb,
  onStartWindowDrag,
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
      data-ui="keystone-shell"
      style={{ "--ks-client-scale": clientScale } as CSSProperties}
    >
      <KeystoneHeader
        auth={auth}
        busyLogout={busyLogout}
        currentView={currentView}
        onCloseWindow={onCloseWindow}
        onChangeAvatar={onChangeAvatar}
        onLogout={onLogout}
        onMinimizeWindow={onMinimizeWindow}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
        onStartWindowDrag={onStartWindowDrag}
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
  onChangeAvatar: () => void;
  onLogout: () => void;
  onMinimizeWindow: () => void;
  onNavigate: (view: KeystoneView) => void;
  onOpenSettings: () => void;
  onStartWindowDrag: () => void;
};

const HEADER_INTERACTIVE_SELECTOR = "button, a, input, select, textarea, [role='button'], [data-no-window-drag]";

function KeystoneHeader({
  auth,
  busyLogout,
  currentView,
  onCloseWindow,
  onChangeAvatar,
  onLogout,
  onMinimizeWindow,
  onNavigate,
  onOpenSettings,
  onStartWindowDrag,
}: KeystoneHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const activeTabIndicator = useThemeAsset("shell-active-tab");
  const inactiveTabIndicator = useThemeAsset("shell-inactive-tab");
  const appIcon = useThemeAsset("brand-mark");
  const avatarFrame = useThemeAsset("shell-avatar-frame");
  const dropdownIcon = useThemeAsset("shell-user-dropdown");
  const settingsButton = useThemeAsset("shell-settings");
  const userPanelFrame = useThemeAsset("shell-user-panel");
  const windowCloseButton = useThemeAsset("shell-window-close");
  const windowMinimizeButton = useThemeAsset("shell-window-minimize");
  const username = auth.username ?? t("shell.user");

  useEffect(() => {
    setUserMenuOpen(false);
  }, [currentView]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && target.closest(HEADER_INTERACTIVE_SELECTOR)) {
      return;
    }
    onStartWindowDrag();
  };

  return (
    <header className="ks-header" data-ui="shell-header" onPointerDown={handleHeaderPointerDown}>
      <div className="ks-brand">
        <img alt="" className="ks-brand__icon" src={appIcon} />
        <span className="ks-brand__name">KeystoneClient</span>
      </div>

      <nav aria-label={t("shell.mainNavigation")} className="ks-tabs" data-ui="shell-tabs">
        <button
          aria-current={currentView === "sync" ? "page" : undefined}
          className="ks-tab"
          data-state={currentView === "sync" ? "selected" : "default"}
          data-ui="shell-tab"
          onClick={() => onNavigate("sync")}
          type="button"
        >
          {t("shell.sync")}
          {currentView === "sync" ? (
            <img alt="" className="ks-tab__decoration ks-tab__decoration--active ks-tab__indicator" src={activeTabIndicator} />
          ) : inactiveTabIndicator ? (
            <img alt="" className="ks-tab__decoration ks-tab__decoration--inactive" src={inactiveTabIndicator} />
          ) : null}
        </button>
        <button
          aria-current={currentView === "addon" ? "page" : undefined}
          className="ks-tab"
          data-state={currentView === "addon" ? "selected" : "default"}
          data-ui="shell-tab"
          onClick={() => onNavigate("addon")}
          type="button"
        >
          Addon
          {currentView === "addon" ? (
            <img alt="" className="ks-tab__decoration ks-tab__decoration--active ks-tab__indicator" src={activeTabIndicator} />
          ) : inactiveTabIndicator ? (
            <img alt="" className="ks-tab__decoration ks-tab__decoration--inactive" src={inactiveTabIndicator} />
          ) : null}
        </button>
      </nav>

      <div className="ks-header-actions">
        <button aria-label={t("shell.settings")} className="ks-icon-control ks-settings-control" data-ui="settings-control" onClick={() => {
          setUserMenuOpen(false);
          onOpenSettings();
        }} type="button">
          <img alt="" src={settingsButton} />
        </button>
        <div className="ks-user-menu" ref={userMenuRef}>
          <button
            aria-controls="ks-user-dropdown"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label={t("shell.userMenu", { name: username })}
            className="ks-user-menu__trigger"
            data-state={userMenuOpen ? "open" : "closed"}
            data-ui="user-menu-trigger"
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
            <div className="ks-user-dropdown" data-ui="user-menu" id="ks-user-dropdown" role="menu">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onChangeAvatar();
                }}
                role="menuitem"
                type="button"
              >
                <ThemedIcon name="edit-avatar" />
                {t("shell.changeAvatar")}
              </button>
              <button
                disabled={busyLogout}
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                role="menuitem"
                type="button"
              >
                <ThemedIcon name="logout" />
                {t("shell.logout")}
              </button>
            </div>
          ) : null}
        </div>
        <div className="ks-window-controls" aria-label={t("shell.windowControls")}>
          <button aria-label={t("shell.minimize")} className="ks-window-button ks-window-button--minimize" data-ui="window-control" data-variant="minimize" onClick={onMinimizeWindow} type="button">
            <img alt="" src={windowMinimizeButton} />
          </button>
          <button aria-label={t("shell.close")} className="ks-window-button ks-window-button--close" data-ui="window-control" data-variant="close" onClick={onCloseWindow} type="button">
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
  const { t } = useI18n();
  const footerTrayButton = useThemeAsset("shell-footer-tray");
  const footerWebButton = useThemeAsset("shell-footer-web");
  return (
    <footer className="ks-footer">
      <button className="ks-footer-action ks-footer-action--web" data-ui="shell-footer-action" data-variant="web" onClick={onOpenWeb} type="button">
        <img alt="" className="ks-footer-action__asset" src={footerWebButton} />
        <span>{t("shell.openWeb")}</span>
      </button>
      <button className="ks-footer-action ks-footer-action--tray" data-ui="shell-footer-action" data-variant="tray" onClick={onMinimizeToTray} type="button">
        {footerTrayButton ? (
          <><img alt="" className="ks-footer-action__asset" src={footerTrayButton} /><span>{t("shell.minimizeTray")}</span></>
        ) : (
          <><ThemedIcon name="download" size={28} />{t("shell.minimizeTray")}</>
        )}
      </button>
    </footer>
  );
}
