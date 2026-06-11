import hashlib
import ctypes
import io
import os
import re
import subprocess
import sys
import tempfile
import time
import tkinter as tk
from tkinter import ttk, filedialog
from pathlib import Path
import urllib.parse
import webbrowser
import winreg
import threading
import requests

import config as cfg_module
import addon_installer
import wow_path

REGISTER_URL = "https://keystonesync.esgarpe.dev/login"
WEB_URL      = "https://keystonesync.esgarpe.dev"
UPDATE_API_URL = "https://api.github.com/repos/Speeson/weeklyChar/releases/latest"
UPDATE_ASSET_NAME = "KeystoneClientSetup.exe"
AUTOSTART_KEY  = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_NAME = "KeystoneClient"

BG_DARK      = "#0d1117"
BANNER_BG    = "#0f1923"
CARD_BG      = "#151f2e"
CHAR_CARD_BG = "#111a26"
CARD_BDR     = "#21303f"
ACCENT       = "#f59e0b"
GREEN        = "#10b981"
RED_COL      = "#f87171"
TEXT         = "#e5e7eb"
MUTED        = "#9ca3af"
FOOTER_BG    = "#0f1923"

BH = 58   # banner height (tabs live here)
FH = 58   # footer height
TH = 32   # card title strip height
P  = 14   # outer padding


def _resource_path(name):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, name)


def _read_client_version():
    try:
        with open(_resource_path("VERSION"), encoding="utf-8") as f:
            return f.read().strip() or "0.0.0"
    except Exception:
        return "0.0.0"


CLIENT_VERSION = _read_client_version()


def _version_tuple(value):
    match = re.search(r"(\d+(?:\.\d+){0,3})", str(value or ""))
    if not match:
        return (0,)
    return tuple(int(part) for part in match.group(1).split("."))


def _is_newer_version(latest, current):
    latest_parts = _version_tuple(latest)
    current_parts = _version_tuple(current)
    size = max(len(latest_parts), len(current_parts))
    latest_parts += (0,) * (size - len(latest_parts))
    current_parts += (0,) * (size - len(current_parts))
    return latest_parts > current_parts

# (full_name) → (display_name, abbreviation)
_DUNGEON_ABBR = {
    # The War Within S1
    "Ara-Kara, City of Echoes":                  ("Ara-Kara",               "AK"),
    "City of Threads":                           ("City of Threads",         "CoT"),
    "The Stonevault":                            ("Stonevault",              "SV"),
    "The Dawnbreaker":                           ("Dawnbreaker",             "DB"),
    "Mists of Tirna Scithe":                     ("Mists of Tirna Scithe",   "MoTS"),
    "The Necrotic Wake":                         ("Necrotic Wake",           "NW"),
    "Siege of Boralus":                          ("Siege of Boralus",        "SoB"),
    "Grim Batol":                                ("Grim Batol",              "GB"),
    # The War Within S2
    "Darkflame Cleft":                           ("Darkflame Cleft",         "DC"),
    "Cinderbrew Meadery":                        ("Cinderbrew Meadery",      "CB"),
    "The Rookery":                               ("The Rookery",             "RK"),
    "Priory of the Sacred Flame":                ("Priory",                  "PSF"),
    "Operation: Floodgate":                      ("Floodgate",               "OF"),
    "The MOTHERLODE!!":                          ("MOTHERLODE!!",            "ML"),
    "Mechagon Workshop":                         ("Mechagon Workshop",       "MW"),
    # Dragonflight
    "Algeth'ar Academy":                         ("Algeth'ar Academy",       "AA"),
    "Brackenhide Hollow":                        ("Brackenhide Hollow",      "BH"),
    "Halls of Infusion":                         ("Halls of Infusion",       "HoI"),
    "Neltharus":                                 ("Neltharus",               "Nel"),
    "Ruby Life Pools":                           ("Ruby Life Pools",         "RLP"),
    "Uldaman: Legacy of Tyr":                    ("Uldaman",                 "ULD"),
    "The Azure Vault":                           ("Azure Vault",             "AV"),
    "The Nokhud Offensive":                      ("Nokhud Offensive",        "NO"),
    # Dawn of the Infinite
    "Dawn of the Infinite: Galakrond's Fall":    ("DotI: Galakrond's Fall",  "DOTG"),
    "Dawn of the Infinite: Murozond's Rise":     ("DotI: Murozond's Rise",   "DOTM"),
    # Shadowlands
    "De Other Side":                             ("De Other Side",           "DOS"),
    "Halls of Atonement":                        ("Halls of Atonement",      "HoA"),
    "Plaguefall":                                ("Plaguefall",              "PF"),
    "Sanguine Depths":                           ("Sanguine Depths",         "SD"),
    "Spires of Ascension":                       ("Spires of Ascension",     "SoA"),
    "Theater of Pain":                           ("Theater of Pain",         "ToP"),
    "Tazavesh: So'leah's Gambit":                ("Tazavesh: Gambit",        "TazG"),
    "Tazavesh: Streets of Wonder":               ("Tazavesh: Streets",       "TazS"),
    # Battle for Azeroth
    "Freehold":                                  ("Freehold",                "FH"),
    "King's Rest":                               ("King's Rest",             "KR"),
    "Shrine of the Storm":                       ("Shrine of the Storm",     "SotS"),
    "Temple of Sethraliss":                      ("Temple of Sethraliss",    "ToS"),
    "Tol Dagor":                                 ("Tol Dagor",               "TD"),
    "The Underrot":                              ("The Underrot",            "UR"),
    "Waycrest Manor":                            ("Waycrest Manor",          "WM"),
    "Operation: Mechagon - Junkyard":            ("Mech. Junkyard",          "OMJ"),
    "Operation: Mechagon - Workshop":            ("Mech. Workshop",          "OMW"),
    # Legion
    "Black Rook Hold":                           ("Black Rook Hold",         "BRH"),
    "Darkheart Thicket":                         ("Darkheart Thicket",       "DHT"),
    "Court of Stars":                            ("Court of Stars",          "CoS"),
    "The Arcway":                                ("The Arcway",              "Arc"),
    "Eye of Azshara":                            ("Eye of Azshara",          "EoA"),
    "Vault of the Wardens":                      ("Vault of the Wardens",    "VotW"),
    "Neltharion's Lair":                         ("Neltharion's Lair",       "NL"),
    "Return to Karazhan: Lower":                 ("Karazhan: Lower",         "KarL"),
    "Return to Karazhan: Upper":                 ("Karazhan: Upper",         "KarU"),
    # Classic / Timewalking
    "The Nexus":                                 ("The Nexus",               "NX"),
    "Magisters' Terrace":                        ("Magisters' Terrace",      "MT"),
    "Magister's Terrace":                        ("Magister's Terrace",      "MT"),
    "Throne of the Tides":                       ("Throne of the Tides",     "TotT"),
    "The Vortex Pinnacle":                       ("Vortex Pinnacle",         "VP"),
    "Halls of Stone":                            ("Halls of Stone",          "HoS"),
    "Halls of Lightning":                        ("Halls of Lightning",      "HoL"),
    "The Oculus":                                ("The Oculus",              "Occ"),
    "Utgarde Pinnacle":                          ("Utgarde Pinnacle",        "UP"),
}

_DUNGEON_ABBR_BY_ID = {
    239: ("Seat of the Triumvirate", "SEAT"),
    556: ("Pit of Saron", "PoS"),
    161: ("Skyreach", "SR"),
    557: ("Windrunner Spire", "WS"),
    558: ("Magister's Terrace", "MT"),
    559: ("Nexus-Point Xenas", "NPX"),
    560: ("Maisara Caverns", "MS"),
    402: ("Algeth'ar Academy", "AA"),
}

WOW_CLASS_COLORS = {
    "Death Knight": "#C41E3A",
    "Demon Hunter": "#A330C9",
    "Druid":        "#FF7C0A",
    "Evoker":       "#33937F",
    "Hunter":       "#AAD372",
    "Mage":         "#3FC7EB",
    "Monk":         "#00FF98",
    "Paladin":      "#F48CBA",
    "Priest":       "#C0C0C0",
    "Rogue":        "#FFF468",
    "Shaman":       "#0070DD",
    "Warlock":      "#8788EE",
    "Warrior":      "#C69B3A",
}

_CLASS_ICON_SLUGS = {
    "Death Knight": "classicon_deathknight",
    "Demon Hunter": "classicon_demonhunter",
    "Druid":        "classicon_druid",
    "Evoker":       "classicon_evoker",
    "Hunter":       "classicon_hunter",
    "Mage":         "classicon_mage",
    "Monk":         "classicon_monk",
    "Paladin":      "classicon_paladin",
    "Priest":       "classicon_priest",
    "Rogue":        "classicon_rogue",
    "Shaman":       "classicon_shaman",
    "Warlock":      "classicon_warlock",
    "Warrior":      "classicon_warrior",
}
_ICON_BASE = "https://wow.zamimg.com/images/wow/icons/medium"


def _lerp_color(c0, c1, t):
    r = int(c0[0] + t * (c1[0] - c0[0]))
    g = int(c0[1] + t * (c1[1] - c0[1]))
    b = int(c0[2] + t * (c1[2] - c0[2]))
    return f"#{r:02x}{g:02x}{b:02x}"


def _gradient_color(value, stops):
    """Interpolate color from a list of (threshold, (r,g,b)) stops."""
    if value <= stops[0][0]:
        c = stops[0][1]
        return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"
    if value >= stops[-1][0]:
        c = stops[-1][1]
        return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"
    for i in range(len(stops) - 1):
        s0, c0 = stops[i]
        s1, c1 = stops[i + 1]
        if s0 <= value <= s1:
            t = (value - s0) / (s1 - s0)
            return _lerp_color(c0, c1, t)
    c = stops[-1][1]
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


# RIO color stops: strictly Green → Blue → Purple → Pink → Orange (no backwards steps)
_RIO_STOPS = [
    (0,    (0,   200,   0)),   # green
    (500,  (0,   200,  70)),   # green (hint of teal)
    (1000, (0,   160, 190)),   # teal→blue
    (1500, (0,   100, 230)),   # blue
    (2000, (80,   50, 240)),   # blue-purple
    (2400, (160,  50, 240)),   # purple
    (2800, (200,  55, 210)),   # purple
    (3200, (235,  65, 170)),   # purple-pink
    (3500, (255,  85, 110)),   # pink
    (3700, (255, 115,  55)),   # orange-pink
    (4000, (255, 145,   0)),   # orange
]

# ilvl color stops: 0=green, 290=orange
_ILVL_STOPS = [
    (0,   (0,   200,   0)),
    (100, (60,  220,  40)),
    (180, (0,   140, 210)),
    (220, (150,  50, 220)),
    (260, (255, 120,   0)),
    (290, (255,  80,   0)),
]


def _rio_color(score):
    if not score or score <= 0:
        return "#9d9d9d"
    return _gradient_color(min(score, 4000), _RIO_STOPS)


def _ilvl_color(ilvl):
    if not ilvl or ilvl <= 0:
        return MUTED
    return _gradient_color(min(ilvl, 290), _ILVL_STOPS)


def _keystone_display(char):
    k = char.get("currentKeystone") or {}
    level = k.get("level")
    if not level:
        return "—"
    challenge_map_id = k.get("challengeMapId")
    if challenge_map_id in _DUNGEON_ABBR_BY_ID:
        display, abbr = _DUNGEON_ABBR_BY_ID[challenge_map_id]
        return f"+{level} {display} ({abbr})"
    dungeon = k.get("dungeon") or ""
    if dungeon in _DUNGEON_ABBR:
        display, abbr = _DUNGEON_ABBR[dungeon]
        return f"+{level} {display} ({abbr})"
    return f"+{level} {dungeon}" if dungeon else f"+{level}"


_TR = {
    "es": {
        "tab_sync":      "Sincronización",
        "tab_addon":     "Addon",
        "col_name":      "Nombre",
        "col_realm":     "Reino",
        "col_key":       "Piedra Angular",
        "sync_title":    "Sincronización",
        "addon_title":   "Addon",
        "last_sync_lbl": "Última sync",
        "never":         "Sin sincronizar",
        "sync_btn":      "Sincronizar",
        "install_btn":   "Instalar / Actualizar",
        "install_addon_btn": "Instalar addon",
        "update_addon_btn": "Actualizar addon",
        "reinstall_addon_btn": "Reinstalar addon",
        "sel_folder_btn":"Seleccionar carpeta de AddOns",
        "open_web":      "Acceder a la Web",
        "autostart":     "Arrancar con Windows",
        "start_minimized": "Arrancar minimizado",
        "minimize_on_close": "Minimizar al cerrar",
        "minimize":      "Minimizar a la bandeja",
        "logout":        "Cerrar sesión",
        "language":      "Idioma",
        "settings":      "Ajustes",
        "settings_general": "General",
        "settings_wow": "World of Warcraft",
        "settings_app": "Aplicación",
        "wow_install_path": "Ruta de WoW",
        "savedvars_path": "SavedVariables",
        "change_btn": "Cambiar",
        "save_btn": "Guardar",
        "redetect_btn": "Redetectar",
        "addon_tab_btn": "Ir a Addon",
        "not_found": "No detectado",
        "close_btn": "Cerrar",
        "installing":    "Instalando...",
        "installed_ok":  "✓ Instalado correctamente",
        "sel_folder_err":"Selecciona la carpeta AddOns primero.",
        "login_sub":     "Inicia sesión para continuar",
        "usr_lbl":       "Usuario",
        "pwd_lbl":       "Contraseña",
        "login_btn":     "Entrar",
        "register_btn":  "Registrarse",
        "wow_setup_title": "Ubicación de World of Warcraft",
        "wow_setup_sub": "Selecciona la carpeta donde está instalado WoW para que KeystoneClient pueda instalar el addon y encontrar los datos.",
        "wow_folder_lbl": "Carpeta de World of Warcraft",
        "browse_btn": "Buscar",
        "save_continue_btn": "Guardar y continuar",
        "wow_folder_err": "Selecciona una carpeta válida de World of Warcraft.",
        "wow_folder_hint": "Ejemplo: C:\\Program Files (x86)\\World of Warcraft",
        "wow_ok":        "WoW detectado",
        "wow_no":        "WoW no encontrado",
        "sync_ready": "Listo para sincronizar",
        "sync_not_ready": "Datos no encontrados",
        "sync_setup_install": "Instala el addon",
        "sync_setup_rest": "y entra con tus personajes para recopilar datos de sincronización.",
        "min_title":     "Minimizado a la bandeja",
        "min_msg":       "KeystoneClient sigue corriendo en la bandeja\ndel sistema. Haz clic en el icono para volver.",
        "ok_btn":        "Entendido",
        "err_fields":    "Introduce usuario y contraseña.",
        "connecting":    "Conectando...",
        "conn_err":      "No se puede conectar con la API.",
        "addon_desc":    "Instala o actualiza el addon de KeystoneClient\nen tu carpeta de World of Warcraft.",
        "addon_status_title": "Estado del addon",
        "addon_not_installed": "No instalado",
        "addon_installed": "Instalado",
        "addon_corrupt": "Instalación incompleta",
        "addon_bundled": "Incluido",
        "addon_update_available": "Actualización disponible",
        "addon_up_to_date": "Al día",
        "client_version": "Version del cliente",
        "update_title": "Actualizacion disponible",
        "update_msg": "Hay una actualizacion disponible.\n\nTu cliente usa la version {current} y la ultima version es {latest}.",
        "update_btn": "Actualizar",
        "cancel_btn": "Cancelar",
        "downloading_update": "Descargando actualizacion...",
        "update_download_error": "No se pudo descargar la actualizacion.",
        "update_launch_error": "No se pudo iniciar el instalador.",
        "changelog_title": "Cambios de la version {version}",
        "changelog_empty": "No hay changelog disponible para esta version.",
        "update_checking": "Comprobando actualizaciones...",
        "update_current": "Actualizado a la ultima version",
        "update_latest_available": "Ultima version disponible {version}",
        "update_current_short": "Actualizado",
        "login_info": "Sincroniza tus personajes de World of Warcraft, instala el addon y consulta tus llaves desde el cliente o la web.",
    },
    "en": {
        "tab_sync":      "Sync",
        "tab_addon":     "Addon",
        "col_name":      "Name",
        "col_realm":     "Realm",
        "col_key":       "Keystone",
        "sync_title":    "Sync",
        "addon_title":   "Addon",
        "last_sync_lbl": "Last sync",
        "never":         "Never synced",
        "sync_btn":      "Sync",
        "install_btn":   "Install / Update",
        "install_addon_btn": "Install addon",
        "update_addon_btn": "Update addon",
        "reinstall_addon_btn": "Reinstall addon",
        "sel_folder_btn":"Select AddOns folder",
        "open_web":      "Open Web",
        "autostart":     "Start with Windows",
        "start_minimized": "Start minimized",
        "minimize_on_close": "Minimize on close",
        "minimize":      "Minimize to tray",
        "logout":        "Logout",
        "language":      "Language",
        "settings":      "Settings",
        "settings_general": "General",
        "settings_wow": "World of Warcraft",
        "settings_app": "Application",
        "wow_install_path": "WoW path",
        "savedvars_path": "SavedVariables",
        "change_btn": "Change",
        "save_btn": "Save",
        "redetect_btn": "Redetect",
        "addon_tab_btn": "Go to Addon",
        "not_found": "Not detected",
        "close_btn": "Close",
        "installing":    "Installing...",
        "installed_ok":  "✓ Installed successfully",
        "sel_folder_err":"Select AddOns folder first.",
        "login_sub":     "Sign in to continue",
        "usr_lbl":       "Username",
        "pwd_lbl":       "Password",
        "login_btn":     "Sign in",
        "register_btn":  "Register",
        "wow_setup_title": "World of Warcraft location",
        "wow_setup_sub": "Select your WoW install folder so KeystoneClient can install the addon and find sync data.",
        "wow_folder_lbl": "World of Warcraft folder",
        "browse_btn": "Browse",
        "save_continue_btn": "Save and continue",
        "wow_folder_err": "Select a valid World of Warcraft folder.",
        "wow_folder_hint": "Example: C:\\Program Files (x86)\\World of Warcraft",
        "wow_ok":        "WoW detected",
        "wow_no":        "WoW not found",
        "sync_ready": "Ready to sync",
        "sync_not_ready": "Data not found",
        "sync_setup_install": "Install the addon",
        "sync_setup_rest": "and log into your characters to collect sync data.",
        "min_title":     "Minimized to tray",
        "min_msg":       "KeystoneClient is still running in the\nsystem tray. Click the icon to return.",
        "ok_btn":        "Got it",
        "err_fields":    "Enter username and password.",
        "connecting":    "Connecting...",
        "conn_err":      "Cannot connect to API.",
        "addon_desc":    "Install or update the KeystoneClient addon\nin your World of Warcraft folder.",
        "addon_status_title": "Addon status",
        "addon_not_installed": "Not installed",
        "addon_installed": "Installed",
        "addon_corrupt": "Incomplete install",
        "addon_bundled": "Bundled",
        "addon_update_available": "Update available",
        "addon_up_to_date": "Up to date",
        "client_version": "Client version",
        "update_title": "Update available",
        "update_msg": "An update is available.\n\nYour client is using version {current} and the latest version is {latest}.",
        "update_btn": "Update",
        "cancel_btn": "Cancel",
        "downloading_update": "Downloading update...",
        "update_download_error": "Could not download the update.",
        "update_launch_error": "Could not start the installer.",
        "changelog_title": "Changes in version {version}",
        "changelog_empty": "No changelog is available for this version.",
        "update_checking": "Checking for updates...",
        "update_current": "Up to date",
        "update_latest_available": "Latest version available {version}",
        "update_current_short": "Updated",
        "login_info": "Sync your World of Warcraft characters, install the addon, and check your keystones from the client or web.",
    },
}


def _tr(lang, key):
    return _TR.get(lang, _TR["es"]).get(key, key)


def _set_autostart(enabled):
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY, 0, winreg.KEY_SET_VALUE)
        if enabled:
            winreg.SetValueEx(key, AUTOSTART_NAME, 0, winreg.REG_SZ, f'"{sys.executable}"')
        else:
            try:
                winreg.DeleteValue(key, AUTOSTART_NAME)
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
    except Exception:
        pass


def _get_autostart():
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, AUTOSTART_KEY, 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, AUTOSTART_NAME)
        winreg.CloseKey(key)
        return True
    except FileNotFoundError:
        return False


class MainWindow:
    def __init__(self):
        self.cfg = cfg_module.load()
        self._worker  = None
        self._tray    = None
        self._lang    = self.cfg.get("lang", "es")

        # Sync state
        self._sync_ok        = False
        self._sync_primary   = ""
        self._sync_secondary = ""

        # Canvas item IDs (reset on tab switch)
        self._sync_icon_id  = None
        self._sync_label_id = None
        self._sync_time_id  = None
        self._sync_date_id  = None
        self._wow_status_id = None

        # Characters
        self._characters       = []
        self._char_photos      = {}
        self._class_icon_photos = {}
        self._char_canvas_items = []

        # Tab / sort
        self._active_tab = "sync"
        self._sort_col   = "rio"
        self._sort_asc   = False

        # Table canvas refs
        self._table_body_cv   = None
        self._table_hdr_cv    = None
        self._table_body_bg_id = None
        self._col_widths      = {}
        self._col_x           = {}
        self._table_w         = 0
        self._table_hdr_h     = 0
        self._table_body_h    = 0

        # Nav tab refs (banner-embedded)
        self._nav_tab_ids = {}

        # Avatar picker
        self._avatar_picker_offset = 0

        # Profile avatar
        self._profile_photo      = None
        self._banner_av_ph       = None
        self._banner_av_img_id   = None
        self._banner_av_fill_id  = None
        self._banner_av_ring_id  = None
        self._banner_av_init_id  = None
        self._selected_avatar_url = None

        # Install button
        self._install_btn      = None
        self._install_fill     = None
        self._install_btn_text = None
        self._install_btn_w    = 0
        self._install_msg_id   = None
        self._addon_status_ids = {}

        self.addons_var = None

        # PIL refs (prevent GC)
        self._photos         = []
        self._banner_icon    = None
        self._bg_pil_orig    = None
        self._bg_pil_content = None

        self._cv      = None
        self._list_cv = None
        self._user_dd = None
        self._user_dropdown_visible = False
        self._avatar_popup         = None
        self._avatar_popup_visible = False
        self._settings_popup         = None
        self._settings_popup_visible = False
        self._startup_minimized_applied = False
        self._drag_offset = None
        self._map_bind_id = None
        self._taskbar_refreshing = False
        self._latest_update_info = None
        self._update_check_done = False
        self._login_update_status_var = None
        self._settings_update_status_var = None
        self._settings_update_button = None

        self.root = tk.Tk()
        self.root.title("KeystoneClient")
        self.root.configure(bg=BG_DARK)
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self._on_close_btn)

        _base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
        self._base = _base

        _icon = os.path.join(_base, "icon.ico")
        if os.path.exists(_icon):
            self.root.iconbitmap(_icon)

        self._bg_path = None
        for _ext in ("bg.png", "bg.jpg", "bg.jpeg"):
            _p = os.path.join(_base, _ext)
            if os.path.exists(_p):
                self._bg_path = _p
                break

        if self._bg_path:
            try:
                from PIL import Image
                self._bg_pil_orig = Image.open(self._bg_path)
            except Exception:
                pass

        self._W, self._H = self._calc_window_size()
        self._setup_styles()

        if cfg_module.is_session_valid(self.cfg):
            self._show_wow_setup_or_main()
        else:
            self._show_login_view()

        self.root.eval("tk::PlaceWindow . center")
        self.root.after(1200, self._show_pending_update_changelog)
        self.root.after(2500, self._check_for_client_updates_async)

    def _calc_window_size(self):
        if self._bg_pil_orig:
            iw, ih = self._bg_pil_orig.size
            aspect = iw / ih
            content_W = 940
            content_H = round(content_W / aspect)
            content_H = max(360, min(700, content_H))
            content_W = round(content_H * aspect)
            content_W = max(740, min(1280, content_W))
            return content_W, content_H + BH + FH
        return 940, 640

    # ── styles ─────────────────────────────────────────────────────────────────

    def _setup_styles(self):
        s = ttk.Style(self.root)
        s.theme_use("clam")
        s.configure("TCheckbutton", background=FOOTER_BG, foreground=TEXT,
                    font=("Segoe UI", 9))
        s.map("TCheckbutton", background=[("active", FOOTER_BG)])
        s.configure("Gold.TButton", background=ACCENT, foreground=BG_DARK,
                    font=("Segoe UI", 10, "bold"), padding=(8, 6))
        s.map("Gold.TButton", background=[("active", "#fbbf24")])
        s.configure("Gray.TButton", background="#374151", foreground="white",
                    font=("Segoe UI", 10), padding=(6, 5))
        s.map("Gray.TButton", background=[("active", "#4b5563")])

    # ── helpers ────────────────────────────────────────────────────────────────

    def _t(self, key):
        return _tr(self._lang, key)

    def _clear(self):
        if getattr(self, "_settings_popup", None):
            try:
                self._settings_popup.destroy()
            except Exception:
                pass
        for w in self.root.winfo_children():
            w.destroy()
        self._photos.clear()
        self._banner_icon     = None
        self._bg_pil_content  = None
        self._cv              = None
        self._list_cv         = None
        self._table_body_cv   = None
        self._table_hdr_cv    = None
        self._table_body_bg_id = None
        self._nav_tab_ids     = {}
        self._col_widths      = {}
        self._col_x           = {}
        self._user_dd         = None
        self._user_dropdown_visible = False
        self._avatar_popup         = None
        self._avatar_popup_visible = False
        self._settings_popup         = None
        self._settings_popup_visible = False
        self._sync_icon_id    = None
        self._sync_label_id   = None
        self._sync_time_id    = None
        self._sync_date_id    = None
        self._wow_status_id   = None
        self._char_canvas_items = []
        self._profile_photo     = None
        self._banner_av_ph      = None
        self._banner_av_img_id  = None
        self._banner_av_fill_id = None
        self._banner_av_ring_id = None
        self._banner_av_init_id = None
        self._install_btn       = None
        self._install_fill      = None
        self._install_btn_text  = None
        self._install_btn_w     = 0
        self._install_msg_id    = None
        self._addon_status_ids  = {}
        self._login_update_status_var = None
        self._login_update_status_label = None
        self._login_banner_update_id = None
        self._settings_update_status_var = None
        self._settings_update_status_label = None
        self._settings_update_button = None
        self.addons_var         = None
        self._class_icon_photos = {}

    def _make_entry(self, parent, textvariable, show=None):
        border = tk.Frame(parent, bg="#374151", padx=2, pady=2)
        inner  = tk.Frame(border, bg="#1f2937")
        inner.pack(fill="both", expand=True)
        e = tk.Entry(inner, textvariable=textvariable, show=show,
                     bg="#1f2937", fg="white", insertbackground=ACCENT,
                     font=("Segoe UI", 12), relief="flat", bd=0)
        e.pack(fill="both", expand=True, padx=10, pady=9)
        return border, e

    def _overlay(self, cv, x, y, w, h, hex_color, alpha, tags=None):
        """Blend bg image region with hex_color. y is in window coords (image starts at BH)."""
        if w <= 0 or h <= 0:
            return
        kw = {"tags": tags} if tags else {}
        if self._bg_pil_content:
            try:
                from PIL import Image, ImageTk
                cy = y - BH
                region = self._bg_pil_content.crop(
                    (x, cy, x + w, cy + h)).convert("RGB")
                r = int(hex_color[1:3], 16)
                g = int(hex_color[3:5], 16)
                b = int(hex_color[5:7], 16)
                ph = ImageTk.PhotoImage(
                    Image.blend(region, Image.new("RGB", (w, h), (r, g, b)), alpha))
                self._photos.append(ph)
                cv.create_image(x, y, anchor="nw", image=ph, **kw)
                return
            except Exception:
                pass
        cv.create_rectangle(x, y, x + w, y + h, fill=hex_color, outline="", **kw)

    def _cw(self, cv, widget, x, y, anchor="nw", width=None, height=None, tags=None):
        kw = {}
        if width  is not None: kw["width"]  = width
        if height is not None: kw["height"] = height
        if tags   is not None: kw["tags"]   = tags
        cv.create_window(x, y, anchor=anchor, window=widget, **kw)

    def _ensure_taskbar_icon(self, refresh=False):
        if os.name != "nt":
            return
        try:
            user32 = ctypes.windll.user32
            GWL_EXSTYLE = -20
            WS_EX_APPWINDOW = 0x00040000
            WS_EX_TOOLWINDOW = 0x00000080

            hwnd = self.root.winfo_id()
            parent = user32.GetParent(hwnd)
            handles = [hwnd]
            if parent:
                handles.append(parent)

            for handle in handles:
                style = user32.GetWindowLongW(handle, GWL_EXSTYLE)
                style = (style | WS_EX_APPWINDOW) & ~WS_EX_TOOLWINDOW
                user32.SetWindowLongW(handle, GWL_EXSTYLE, style)

            if refresh and not self._taskbar_refreshing:
                self._taskbar_refreshing = True
                self.root.withdraw()
                self.root.after(40, self._finish_taskbar_refresh)
        except Exception:
            pass

    def _finish_taskbar_refresh(self):
        try:
            self.root.deiconify()
            self.root.overrideredirect(True)
            self.root.lift()
            self.root.focus_force()
            self._ensure_taskbar_icon(False)
        finally:
            self._taskbar_refreshing = False

    def _savedvars_path(self):
        configured = self.cfg.get("wow_path")
        if configured and os.path.exists(configured):
            return configured

        found = wow_path.find_savedvars(self.cfg.get("wow_install_path"))
        if found:
            self.cfg["wow_path"] = found
            cfg_module.save(self.cfg)
        return found

    def _wow_install_path(self):
        found = wow_path.find_wow_dir(self.cfg.get("wow_install_path"))
        if found and self.cfg.get("wow_install_path") != found:
            self.cfg["wow_install_path"] = found
            cfg_module.save(self.cfg)
        return found

    def _addons_folder(self):
        return addon_installer.find_addons_folder(self.cfg.get("wow_install_path")) or ""

    def _show_wow_setup_or_main(self):
        if self._wow_install_path():
            self._show_main_view()
        else:
            self._show_wow_setup_view()

    def _show_wow_setup_view(self):
        self.root.overrideredirect(False)
        self._clear()
        W, H = self._W, self._H
        self.root.geometry(f"{W}x{H}")

        bg_frame = tk.Frame(self.root, bg=BG_DARK)
        bg_frame.place(x=0, y=0, width=W, height=H)
        outer = tk.Frame(bg_frame, bg=BG_DARK)
        outer.place(relx=0.5, rely=0.5, anchor="center", width=520)

        tk.Label(outer, text=self._t("wow_setup_title"), bg=BG_DARK, fg=ACCENT,
                 font=("Segoe UI", 22, "bold")).pack(anchor="w")
        tk.Label(outer, text=self._t("wow_setup_sub"), bg=BG_DARK, fg=MUTED,
                 font=("Segoe UI", 10), wraplength=500, justify="left").pack(
                     anchor="w", pady=(4, 22))

        tk.Label(outer, text=self._t("wow_folder_lbl"), bg=BG_DARK, fg=TEXT,
                 font=("Segoe UI", 11)).pack(anchor="w")

        row = tk.Frame(outer, bg=BG_DARK)
        row.pack(fill="x", pady=(4, 8))
        self.wow_install_var = tk.StringVar(value=self.cfg.get("wow_install_path") or "")
        entry = tk.Entry(row, textvariable=self.wow_install_var,
                         bg="#1f2937", fg="white", insertbackground=ACCENT,
                         font=("Segoe UI", 10), relief="flat", bd=1)
        entry.pack(side="left", fill="x", expand=True, ipady=8)
        ttk.Button(row, text=self._t("browse_btn"), style="Gray.TButton",
                   command=self._browse_wow_install).pack(side="left", padx=(8, 0))

        tk.Label(outer, text=self._t("wow_folder_hint"), bg=BG_DARK, fg=MUTED,
                 font=("Segoe UI", 8)).pack(anchor="w")

        self.wow_setup_error = tk.StringVar()
        tk.Label(outer, textvariable=self.wow_setup_error, bg=BG_DARK, fg=RED_COL,
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(10, 12))

        ttk.Button(outer, text=self._t("save_continue_btn"), style="Gold.TButton",
                   command=self._save_wow_install_path).pack(fill="x")

    def _browse_wow_install(self):
        folder = filedialog.askdirectory(title=self._t("wow_folder_lbl"))
        if folder and hasattr(self, "wow_install_var"):
            self.wow_install_var.set(folder)

    def _save_wow_install_path(self):
        raw = self.wow_install_var.get().strip() if hasattr(self, "wow_install_var") else ""
        normalized = wow_path.normalize_wow_dir(raw)
        if not normalized or not wow_path.is_wow_dir(normalized):
            self.wow_setup_error.set(self._t("wow_folder_err"))
            return

        self.cfg["wow_install_path"] = str(normalized)
        self.cfg["wow_path"] = wow_path.find_savedvars(normalized)
        cfg_module.save(self.cfg)
        self._show_main_view()

    # =========================================================================
    # LOGIN VIEW
    # =========================================================================

    def _show_login_view(self):
        self.root.overrideredirect(True)
        self._clear()
        W, H = self._W, self._H
        self.root.geometry(f"{W}x{H}")
        self.root.after(100, lambda: self._ensure_taskbar_icon(True))

        content_H = H - BH
        if self._bg_pil_orig:
            try:
                from PIL import Image
                self._bg_pil_content = self._bg_pil_orig.resize(
                    (W, content_H), Image.LANCZOS)
            except Exception:
                self._bg_pil_content = None

        cv = tk.Canvas(self.root, bd=0, highlightthickness=0, bg=BG_DARK)
        cv.place(x=0, y=0, width=W, height=H)
        self._cv = cv

        if self._bg_pil_content:
            try:
                from PIL import ImageTk
                _ph = ImageTk.PhotoImage(self._bg_pil_content)
                self._photos.append(_ph)
                cv.create_image(0, BH, anchor="nw", image=_ph)
            except Exception:
                pass

        cv.create_rectangle(0, 0, W, BH, fill=BANNER_BG, outline="")
        cv.create_line(0, BH, W, BH, fill=CARD_BDR)
        try:
            from PIL import Image, ImageTk
            _ico = Image.open(os.path.join(self._base, "icon.ico")).resize((26, 26), Image.LANCZOS)
            self._banner_icon = ImageTk.PhotoImage(_ico)
            self._cw(cv, tk.Label(cv, image=self._banner_icon, bg=BANNER_BG, bd=0),
                     12, BH // 2, anchor="w")
        except Exception:
            pass
        cv.create_text(46, BH // 2, text="KeystoneClient",
                       fill=ACCENT, font=("Segoe UI", 15, "bold"), anchor="w")
        self._login_banner_update_id = cv.create_text(
            W - 104, BH // 2,
            text=self._client_update_banner_text(),
            fill=self._client_update_status_color(),
            font=("Segoe UI", 9, "bold"),
            anchor="e")
        self._header_controls_left = W - 92
        self._draw_window_control(cv, W - 62, BH // 2, "—", self._minimize_window, "min")
        self._draw_window_control(cv, W - 24, BH // 2, "×", self._quit, "close")
        cv.bind("<ButtonPress-1>", self._start_window_drag, add="+")
        cv.bind("<B1-Motion>", self._drag_window, add="+")
        cv.bind("<ButtonRelease-1>", self._end_window_drag, add="+")

        card_w, card_h = 500, 360
        card_x = (W - card_w) // 2
        card_y = BH + max(26, (content_H - card_h) // 2)
        login_card_bg = "#101a27"
        self._overlay(cv, card_x, card_y, card_w, card_h, login_card_bg, 0.64)
        cv.create_rectangle(card_x, card_y, card_x + card_w, card_y + 4,
                            fill=ACCENT, outline="")
        cv.create_rectangle(card_x, card_y, card_x + card_w, card_y + card_h,
                            outline=CARD_BDR, width=1)
        cv.create_rectangle(card_x + 1, card_y + 1, card_x + card_w - 1, card_y + card_h - 1,
                            outline="#0b1220", width=1)

        inner_x = card_x + 34
        inner_w = card_w - 68
        cv.create_text(inner_x, card_y + 58, text="KeystoneClient",
                       fill=ACCENT, font=("Segoe UI", 25, "bold"), anchor="w")
        cv.create_text(inner_x, card_y + 94, text=self._t("login_sub"),
                       fill=MUTED, font=("Segoe UI", 10, "bold"), anchor="w")
        try:
            from PIL import Image, ImageTk
            _ico = Image.open(os.path.join(self._base, "icon.ico")).resize((64, 64), Image.LANCZOS)
            _ico = _ico.convert("RGBA")
            _mask = Image.new("L", _ico.size, 0)
            from PIL import ImageDraw
            ImageDraw.Draw(_mask).ellipse((0, 0, _ico.size[0] - 1, _ico.size[1] - 1), fill=255)
            _ico.putalpha(_mask)
            self._login_icon = ImageTk.PhotoImage(_ico)
            self._photos.append(self._login_icon)
            cv.create_image(card_x + card_w - 64, card_y + 68, image=self._login_icon, anchor="center")
        except Exception:
            pass

        cv.create_text(inner_x, card_y + 145, text=self._t("usr_lbl"),
                       fill=ACCENT, font=("Segoe UI", 11, "bold"), anchor="w")
        self.username_var = tk.StringVar()
        u_border, u_entry = self._make_entry(cv, self.username_var)
        self._cw(cv, u_border, inner_x, card_y + 158, width=inner_w, height=46)
        u_entry.focus()

        cv.create_text(inner_x, card_y + 236, text=self._t("pwd_lbl"),
                       fill=ACCENT, font=("Segoe UI", 11, "bold"), anchor="w")
        self.password_var = tk.StringVar()
        p_border, _ = self._make_entry(cv, self.password_var, show="*")
        self._cw(cv, p_border, inner_x, card_y + 249, width=inner_w, height=46)

        self.login_error = tk.StringVar()
        self._login_error_text_id = None
        self._login_error_xy = (inner_x, card_y + 304)

        btn_w = (inner_w - 10) // 2
        login_btn = ttk.Button(cv, text=self._t("login_btn"), style="Gold.TButton",
                               command=self._login)
        register_btn = ttk.Button(cv, text=self._t("register_btn"), style="Gray.TButton",
                                  command=lambda: webbrowser.open(REGISTER_URL))
        self._cw(cv, login_btn, inner_x, card_y + 312, width=btn_w, height=34)
        self._cw(cv, register_btn, inner_x + btn_w + 10, card_y + 312, width=btn_w, height=34)

        self.root.bind("<Return>", lambda _: self._login())

    def _login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get()
        if not username or not password:
            self._set_login_error(self._t("err_fields"))
            return
        self._set_login_error(self._t("connecting"), MUTED)
        self.root.update()
        try:
            r = requests.post(f"{self.cfg['api_url']}/api/auth/login",
                              json={"username": username, "password": password}, timeout=10)
            if not r.ok:
                self._set_login_error(r.json().get("detail", "Error de login."))
                return
            token = r.json()["accessToken"]
            me = requests.get(f"{self.cfg['api_url']}/api/me",
                              headers={"Authorization": f"Bearer {token}"}, timeout=10).json()
            self.cfg["sync_token"]    = me["syncToken"]
            self.cfg["username"]      = me["username"]
            self.cfg["access_token"]  = token
            self.cfg["avatar_url"]    = me.get("avatarUrl")
            self.cfg["login_at"]      = time.time()
            self._selected_avatar_url = me.get("avatarUrl")
            cfg_module.save(self.cfg)
            self.root.unbind("<Return>")
            self._show_wow_setup_or_main()
        except requests.exceptions.ConnectionError:
            self._set_login_error(self._t("conn_err"))
        except Exception as e:
            self._set_login_error(f"Error: {e}")

    def _set_login_error(self, message, color=RED_COL):
        self.login_error.set(message)
        if not self._cv:
            return
        if self._login_error_text_id:
            try:
                self._cv.itemconfigure(self._login_error_text_id, text=message, fill=color)
                return
            except Exception:
                self._login_error_text_id = None
        x, y = self._login_error_xy
        self._login_error_text_id = self._cv.create_text(
            x, y, text=message, fill=color, font=("Segoe UI", 9), anchor="w")

    # =========================================================================
    # MAIN VIEW
    # =========================================================================

    def _show_main_view(self):
        self.root.overrideredirect(True)
        self._clear()
        W, H = self._W, self._H
        self.root.geometry(f"{W}x{H}")
        self.root.after(100, lambda: self._ensure_taskbar_icon(True))

        content_H = H - BH - FH

        if self._bg_pil_orig:
            try:
                from PIL import Image
                self._bg_pil_content = self._bg_pil_orig.resize(
                    (W, content_H), Image.LANCZOS)
            except Exception:
                self._bg_pil_content = None

        cv = tk.Canvas(self.root, bd=0, highlightthickness=0, bg=BG_DARK)
        cv.place(x=0, y=0, width=W, height=H)
        self._cv = cv

        # Background image (below banner)
        if self._bg_pil_content:
            try:
                from PIL import ImageTk
                _ph = ImageTk.PhotoImage(self._bg_pil_content)
                self._photos.append(_ph)
                cv.create_image(0, BH, anchor="nw", image=_ph)
            except Exception:
                pass

        # Solid banner
        cv.create_rectangle(0, 0, W, BH, fill=BANNER_BG, outline="")
        cv.create_line(0, BH, W, BH, fill=CARD_BDR)

        # Footer
        cv.create_rectangle(0, H - FH, W, H, fill=FOOTER_BG, outline="")
        cv.create_line(0, H - FH, W, H - FH, fill=CARD_BDR)

        # ── Banner: icon + title ──────────────────────────────────────────────
        try:
            from PIL import Image, ImageTk
            _ico = os.path.join(self._base, "icon.ico")
            _img = Image.open(_ico).resize((26, 26), Image.LANCZOS)
            self._banner_icon = ImageTk.PhotoImage(_img)
            self._cw(cv, tk.Label(cv, image=self._banner_icon, bg=BANNER_BG, bd=0),
                     12, BH // 2, anchor="w")
        except Exception:
            pass
        cv.create_text(46, BH // 2, text="KeystoneClient",
                       fill=ACCENT, font=("Segoe UI", 14, "bold"), anchor="w")

        # ── Tabs in banner (after title) ──────────────────────────────────────
        TAB_W  = 130
        TABS_X = 196
        self._nav_tab_ids = {}

        for i, (tab_id, label_key) in enumerate([("sync", "tab_sync"), ("addon", "tab_addon")]):
            label  = self._t(label_key)
            tx     = TABS_X + i * TAB_W + TAB_W // 2
            active = (self._active_tab == tab_id)
            tag    = f"navtab_{tab_id}"

            # Bottom accent bar (shows active state)
            ind_id = cv.create_rectangle(
                TABS_X + i * TAB_W + 8, BH - 3,
                TABS_X + (i + 1) * TAB_W - 8, BH,
                fill=ACCENT if active else BANNER_BG, outline="", tags=tag)

            # Tab text
            txt_id = cv.create_text(
                tx, BH // 2 - 1, text=label,
                fill=ACCENT if active else MUTED,
                font=("Segoe UI", 9, "bold") if active else ("Segoe UI", 9),
                anchor="center", tags=tag)

            # Invisible click rect over entire tab
            bg_id = cv.create_rectangle(
                TABS_X + i * TAB_W, 0,
                TABS_X + (i + 1) * TAB_W, BH,
                fill="", outline="", tags=tag)

            self._nav_tab_ids[tab_id] = {"ind": ind_id, "txt": txt_id, "bg": bg_id}

            cv.tag_bind(tag, "<Button-1>", lambda _e, t=tab_id: self._switch_tab(t))
            cv.tag_bind(tag, "<Enter>",    lambda _e: cv.configure(cursor="hand2"))
            cv.tag_bind(tag, "<Leave>",    lambda _e: cv.configure(cursor=""))

        # Thin separator between title area and tabs
        cv.create_line(TABS_X - 8, 14, TABS_X - 8, BH - 14, fill=CARD_BDR)

        # ── Username button (right side) ─────────────────────────────────────
        window_controls_w = 86
        user_right_x = W - window_controls_w - 14
        username = self.cfg.get("username", "—")
        self._user_btn = tk.Button(cv, text=f"  {username}  ▾",
                                   bg=BANNER_BG, fg=TEXT, font=("Segoe UI", 10),
                                   relief="flat", bd=0, padx=10, pady=4,
                                   activebackground=CARD_BDR, activeforeground=TEXT,
                                   cursor="hand2", command=self._toggle_user_dropdown)
        self._cw(cv, self._user_btn, user_right_x, BH // 2, anchor="e")
        self.root.update_idletasks()

        # Banner avatar — snug left of username button
        BAV_R  = 13
        _btn_w = self._user_btn.winfo_reqwidth()
        BAV_X  = user_right_x - _btn_w - 6 - BAV_R
        BAV_Y  = BH // 2
        self._banner_av_fill_id = cv.create_oval(
            BAV_X - BAV_R, BAV_Y - BAV_R, BAV_X + BAV_R, BAV_Y + BAV_R,
            fill="#374151", outline=CARD_BDR)
        # Username initial shown until the real avatar loads
        _init = (self.cfg.get("username") or "?")[0].upper()
        self._banner_av_init_id = cv.create_text(
            BAV_X, BAV_Y, text=_init, fill=ACCENT,
            font=("Segoe UI", 9, "bold"), anchor="center")
        self._banner_av_ring_id = cv.create_oval(
            BAV_X - BAV_R, BAV_Y - BAV_R, BAV_X + BAV_R, BAV_Y + BAV_R,
            fill="", outline=CARD_BDR)
        for _oid in (self._banner_av_fill_id, self._banner_av_ring_id,
                     self._banner_av_init_id):
            cv.tag_bind(_oid, "<Button-1>", lambda _e: self._toggle_avatar_popup())
            cv.tag_bind(_oid, "<Enter>",    lambda _e: cv.configure(cursor="hand2"))
            cv.tag_bind(_oid, "<Leave>",    lambda _e: cv.configure(cursor=""))
        self._banner_av_img_id = None
        self._banner_av_x = BAV_X

        # Settings button — kept left of avatar with a clear gap
        settings_x = max(TABS_X + 2 * TAB_W + 22, BAV_X - 44)
        settings_tag = "settings_btn"
        self._settings_btn_bg = cv.create_oval(
            settings_x - 15, BH // 2 - 15, settings_x + 15, BH // 2 + 15,
            fill="#121f2e", outline=CARD_BDR, tags=settings_tag)
        self._settings_btn_ring = cv.create_oval(
            settings_x - 19, BH // 2 - 19, settings_x + 19, BH // 2 + 19,
            fill="", outline=BANNER_BG, tags=settings_tag)
        self._settings_btn_txt = cv.create_text(
            settings_x, BH // 2 - 1, text="⚙", fill="#d1d5db",
            font=("Segoe UI Symbol", 14, "bold"), anchor="center", tags=settings_tag)
        cv.tag_bind(settings_tag, "<Button-1>", lambda _e: self._toggle_settings_popup())
        cv.tag_bind(settings_tag, "<Enter>", lambda _e: self._settings_btn_hover(True))
        cv.tag_bind(settings_tag, "<Leave>", lambda _e: self._settings_btn_hover(False))

        # Custom window controls (native titlebar is disabled in main view)
        self._header_controls_left = settings_x - 24
        self._draw_window_control(cv, W - 62, BH // 2, "—", self._minimize_window, "min")
        self._draw_window_control(cv, W - 26, BH // 2, "×", self._on_close_btn, "close")

        # Start loading cached profile avatar immediately (before characters fetch)
        _cached_av = self.cfg.get("avatar_url") or self._selected_avatar_url
        if _cached_av and not self._profile_photo:
            threading.Thread(
                target=self._preload_banner_avatar,
                args=(_cached_av,), daemon=True).start()

        # ── Footer ────────────────────────────────────────────────────────────
        footer = tk.Frame(cv, bg=FOOTER_BG)
        self._cw(cv, footer, 0, H - FH, anchor="nw", width=W, height=FH)

        ttk.Button(footer, text=self._t("open_web"), style="Gray.TButton",
                   command=lambda: webbrowser.open(WEB_URL)).pack(
                       side="left", padx=(14, 0), pady=10)
        ttk.Button(footer, text=self._t("minimize"), style="Gold.TButton",
                   command=self._minimize_to_tray).pack(side="right", padx=(0, 14), pady=10)

        cv.bind("<Button-1>", self._on_root_click, add="+")
        cv.bind("<ButtonPress-1>", self._start_window_drag, add="+")
        cv.bind("<B1-Motion>", self._drag_window, add="+")
        cv.bind("<ButtonRelease-1>", self._end_window_drag, add="+")

        if self._active_tab == "sync":
            self._render_sync_tab(cv)
        else:
            self._render_addon_tab(cv)

        threading.Thread(target=self._load_characters, daemon=True).start()
        if self._worker is None and self.cfg.get("sync_token"):
            self.root.after(200, self._start_background_services)
        if self.cfg.get("start_minimized") and not self._startup_minimized_applied:
            self._startup_minimized_applied = True
            self.root.after(300, self._minimize_to_tray)

    # ── Tab switching ──────────────────────────────────────────────────────────

    def _render_nav_highlight(self, cv):
        for tab_id in ("sync", "addon"):
            ids    = self._nav_tab_ids.get(tab_id, {})
            active = (self._active_tab == tab_id)
            if ids.get("txt"):
                cv.itemconfigure(ids["txt"],
                                 fill=ACCENT if active else MUTED,
                                 font=("Segoe UI", 9, "bold") if active else ("Segoe UI", 9))
            if ids.get("ind"):
                cv.itemconfigure(ids["ind"], fill=ACCENT if active else BANNER_BG)

    def _switch_tab(self, tab):
        if tab == self._active_tab:
            return
        self._active_tab = tab
        cv = self._cv
        if not (cv and cv.winfo_exists()):
            return

        # Destroy embedded tab widgets
        for attr in ("_table_body_cv", "_table_hdr_cv"):
            w = getattr(self, attr, None)
            if w:
                try: w.destroy()
                except Exception: pass
                setattr(self, attr, None)
        if self._install_btn:
            try: self._install_btn.destroy()
            except Exception: pass
        self.addons_var      = None
        self._install_btn    = None
        self._install_fill   = None
        self._install_btn_text = None
        self._install_btn_w  = 0
        self._install_msg_id = None
        self._addon_status_ids = {}

        # Clear tab content and reset dynamic IDs
        cv.delete("tab_content")
        self._sync_icon_id  = None
        self._sync_label_id = None
        self._sync_time_id  = None
        self._sync_date_id  = None
        self._wow_status_id = None
        self._table_body_bg_id = None

        self._render_nav_highlight(cv)

        if tab == "sync":
            self._render_sync_tab(cv)
        else:
            self._render_addon_tab(cv)

    # ── Sync tab ───────────────────────────────────────────────────────────────

    def _render_sync_tab(self, cv):
        W, H = self._W, self._H

        INNER_W  = W - 2 * P
        TABLE_W  = int(INNER_W * 0.72)
        TABLE_X  = P
        TABLE_Y  = BH + P
        TABLE_H  = H - FH - TABLE_Y - P

        SYNC_X   = TABLE_X + TABLE_W + P
        SYNC_W   = W - SYNC_X - P

        # Light translucent panel borders only (table body uses bg image)
        cv.create_rectangle(TABLE_X, TABLE_Y, TABLE_X + TABLE_W, TABLE_Y + TABLE_H,
                            outline=CARD_BDR, fill="", tags="tab_content")
        cv.create_rectangle(SYNC_X,  TABLE_Y, SYNC_X + SYNC_W,  TABLE_Y + TABLE_H,
                            outline=CARD_BDR, fill="", tags="tab_content")

        # Slight overlay on sync block only
        self._overlay(cv, SYNC_X, TABLE_Y, SYNC_W, TABLE_H, CARD_BG, 0.68, tags="tab_content")
        cv.create_rectangle(SYNC_X, TABLE_Y, SYNC_X + SYNC_W, TABLE_Y + TABLE_H,
                            outline=CARD_BDR, fill="", tags="tab_content")

        self._draw_char_table(cv, TABLE_X, TABLE_Y, TABLE_W, TABLE_H)
        self._draw_sync_block(cv, SYNC_X, TABLE_Y, SYNC_W, TABLE_H)

    def _compute_col_widths(self):
        """Compute column widths: RIO narrow+right, KEY takes all remaining space, NAME/REALM fitted to data."""
        import tkinter.font as tkfont
        w = self._table_w
        if not w:
            return

        AV_W   = 34
        CLS_W  = 22
        ILVL_W = 46
        KEY_MIN = 120

        _nf   = tkfont.Font(family="Segoe UI", size=9,  weight="bold")
        _rf   = tkfont.Font(family="Segoe UI", size=8)
        _hf   = tkfont.Font(family="Segoe UI", size=8,  weight="bold")
        _riof = tkfont.Font(family="Segoe UI", size=10, weight="bold")
        PAD   = 12

        # RIO: wide enough for header label + score, with generous padding
        RIO_W = max(_hf.measure("Raider IO") + 24, _riof.measure("4000") + 24, 82)

        # Name/Realm: measured from actual character data
        name_need  = _hf.measure(self._t("col_name"))  + PAD
        realm_need = _hf.measure(self._t("col_realm")) + PAD
        if self._characters:
            name_need  = max(name_need,  max(_nf.measure(c.get("name")  or "?") + PAD for c in self._characters))
            realm_need = max(realm_need, max(_rf.measure(c.get("realm") or "—") + PAD for c in self._characters))

        # Shrink name+realm proportionally if they'd leave less than KEY_MIN for keystone
        flex = w - AV_W - CLS_W - ILVL_W - RIO_W - KEY_MIN
        if name_need + realm_need > flex:
            total = name_need + realm_need
            name_need  = int(flex * name_need  / total)
            realm_need = flex - name_need

        # Keystone gets everything that's left
        KEY_W = w - AV_W - CLS_W - ILVL_W - name_need - realm_need - RIO_W

        self._col_widths = {
            "av": AV_W, "cls": CLS_W, "name": name_need,
            "realm": realm_need, "ilvl": ILVL_W, "key": KEY_W, "rio": RIO_W,
        }
        cx = 0
        self._col_x = {}
        for col in ("av", "cls", "name", "realm", "ilvl", "key", "rio"):
            self._col_x[col] = cx
            cx += self._col_widths[col]

    def _draw_char_table(self, cv, x, y, w, h):
        HDR_H  = 30
        BODY_H = h - HDR_H

        self._table_w      = w
        self._table_hdr_h  = HDR_H
        self._table_body_h = BODY_H
        self._table_x      = x
        self._table_y      = y

        self._compute_col_widths()

        # Header canvas — dark translucent look
        self._table_hdr_cv = tk.Canvas(cv, bg="#07111d", bd=0,
                                        highlightthickness=0, width=w, height=HDR_H)
        cv.create_window(x, y, anchor="nw", window=self._table_hdr_cv,
                         width=w, height=HDR_H, tags="tab_content")
        self._setup_table_hdr_bg(x, y, w, HDR_H)

        # Body canvas — translucent (bg image shows through)
        self._table_body_cv = tk.Canvas(cv, bd=0, highlightthickness=0,
                                         width=w, height=BODY_H)
        cv.create_window(x, y + HDR_H, anchor="nw", window=self._table_body_cv,
                         width=w, height=BODY_H, tags="tab_content")
        self._setup_table_body_bg(x, y + HDR_H, w, BODY_H)

        self._table_body_cv.bind("<Enter>", lambda e: self._table_body_cv.focus_set())
        self._table_body_cv.bind("<MouseWheel>", self._on_table_scroll)

        self._draw_table_header()
        self._draw_table_rows()

    def _setup_table_hdr_bg(self, x, y, w, h):
        """Render bg image region blended dark as header background."""
        if not self._bg_pil_content or not (self._table_hdr_cv and self._table_hdr_cv.winfo_exists()):
            return
        try:
            from PIL import Image, ImageTk
            iy = y - BH
            region = self._bg_pil_content.crop((x, iy, x + w, iy + h)).convert("RGB")
            dark = Image.new("RGB", (w, h), (7, 17, 29))
            final = Image.blend(region, dark, 0.88)
            ph = ImageTk.PhotoImage(final)
            self._photos.append(ph)
            self._table_hdr_cv.create_image(0, 0, anchor="nw", image=ph)
        except Exception:
            pass

    def _setup_table_body_bg(self, x, y, w, h):
        """Render blurred/dimmed bg image as frosted-glass background for table body."""
        try:
            from PIL import Image, ImageFilter, ImageTk
            if self._bg_pil_content:
                iy = y - BH
                region = self._bg_pil_content.crop((x, iy, x + w, iy + h)).convert("RGB")
                blurred = region.filter(ImageFilter.GaussianBlur(radius=2))
                dark = Image.new("RGB", (w, h), (10, 18, 28))
                final = Image.blend(blurred, dark, 0.65)
            else:
                final = Image.new("RGB", (w, h), (17, 26, 38))

            self._table_body_bg_pil = final
            self._table_body_bg_ph  = ImageTk.PhotoImage(final)

            avg = final.getpixel((w // 2, h // 2))
            self._table_body_cv.configure(bg=f"#{avg[0]:02x}{avg[1]:02x}{avg[2]:02x}")
            self._table_body_bg_id = self._table_body_cv.create_image(
                0, 0, anchor="nw", image=self._table_body_bg_ph)
        except Exception:
            self._table_body_cv.configure(bg=CHAR_CARD_BG)
            self._table_body_bg_id = None

    def _on_table_scroll(self, event):
        bc = self._table_body_cv
        if not (bc and bc.winfo_exists()):
            return
        bc.yview_scroll(int(-1 * (event.delta / 120)), "units")
        # Keep bg image visually fixed as rows scroll
        bg_id = getattr(self, "_table_body_bg_id", None)
        if bg_id:
            try:
                sy = int(bc.canvasy(0))
                bc.coords(bg_id, 0, sy)
                bc.lower(bg_id)
            except Exception:
                pass

    def _draw_table_header(self):
        hdr = self._table_hdr_cv
        if not (hdr and hdr.winfo_exists()):
            return
        hdr.delete("all")
        self._setup_table_hdr_bg(
            self._table_x, self._table_y, self._table_w, self._table_hdr_h)

        w     = self._table_w
        HDR_H = self._table_hdr_h

        sortable = [
            ("name",  self._t("col_name")),
            ("realm", self._t("col_realm")),
            ("ilvl",  "ilvl"),
            ("key",   self._t("col_key")),
            ("rio",   "Raider IO"),
        ]
        for col_id, label in sortable:
            cx     = self._col_x[col_id] + self._col_widths[col_id] // 2
            active = (self._sort_col == col_id)
            color  = ACCENT if active else MUTED
            ind    = (" ▲" if self._sort_asc else " ▼") if active else ""
            hdr.create_text(cx, HDR_H // 2, text=label + ind,
                            fill=color, font=("Segoe UI", 8, "bold"), anchor="center")
            # Column separator line
            rx = self._col_x[col_id]
            hdr.create_line(rx, 4, rx, HDR_H - 4, fill=CARD_BDR)
            # Click rect
            cid = hdr.create_rectangle(rx, 0, rx + self._col_widths[col_id], HDR_H,
                                        fill="", outline="")
            hdr.tag_bind(cid, "<Button-1>",
                         lambda _e, c=col_id: self._sort_table(c))
            hdr.tag_bind(cid, "<Enter>",   lambda _e: hdr.configure(cursor="hand2"))
            hdr.tag_bind(cid, "<Leave>",   lambda _e: hdr.configure(cursor=""))

        hdr.create_line(0, HDR_H - 1, w, HDR_H - 1, fill=CARD_BDR)

    def _draw_table_rows(self):
        bc = self._table_body_cv
        if not (bc and bc.winfo_exists()):
            return

        try:
            from PIL import Image, ImageTk
            _pil_ok = True
        except ImportError:
            _pil_ok = False

        # Recompute column widths now that characters may have loaded
        old_widths = dict(self._col_widths)
        self._compute_col_widths()
        if self._col_widths != old_widths:
            self._draw_table_header()

        # Keep bg at current scroll position
        bg_id = getattr(self, "_table_body_bg_id", None)
        try:
            sy = int(bc.canvasy(0))
        except Exception:
            sy = 0
        if bg_id:
            try:
                bc.delete("all")
                bc.create_image(0, sy, anchor="nw", image=self._table_body_bg_ph)
                self._table_body_bg_id = bc.find_withtag("all")[0] if bc.find_withtag("all") else None
            except Exception:
                bc.delete("all")
                self._table_body_bg_id = None
        else:
            bc.delete("all")

        chars   = self._characters
        w       = self._table_w
        CHAR_CH = 38
        GAP     = 1

        if not chars:
            bc.create_text(w // 2, 50, text="Sin personajes sincronizados",
                           fill=MUTED, font=("Segoe UI", 9), anchor="center")
            bc.configure(scrollregion=(0, 0, w, 100))
            return

        total_h = max(self._table_body_h, len(chars) * (CHAR_CH + GAP))
        bc.configure(scrollregion=(0, 0, w, total_h))

        AV = 26

        for i, char in enumerate(chars):
            ry  = i * (CHAR_CH + GAP)
            tag = f"row_{i}"

            # Translucent alternating row tint — blend bg image region with subtle color
            if i % 2 == 1:
                bg_pil = getattr(self, "_table_body_bg_pil", None)
                if _pil_ok and bg_pil:
                    try:
                        pil_y = max(0, min(ry - sy, bg_pil.height - CHAR_CH - 1))
                        row_bg = bg_pil.crop((0, pil_y, w, pil_y + CHAR_CH))
                        blended = Image.blend(row_bg, Image.new("RGB", (w, CHAR_CH), (28, 52, 82)), 0.22)
                        _rph = ImageTk.PhotoImage(blended)
                        self._photos.append(_rph)
                        bc.create_image(0, ry, anchor="nw", image=_rph, tags=tag)
                    except Exception:
                        bc.create_rectangle(0, ry, w, ry + CHAR_CH, fill="#0c1a28", outline="", tags=tag)
                else:
                    bc.create_rectangle(0, ry, w, ry + CHAR_CH, fill="#0c1a28", outline="", tags=tag)

            name        = char.get("name") or "?"
            realm       = char.get("realm") or "—"
            wow_class   = char.get("wowClass") or ""
            class_color = WOW_CLASS_COLORS.get(wow_class, TEXT)
            rio_score   = char.get("rioScore")
            ilvl        = char.get("ilvl")
            region      = (char.get("region") or "eu").lower()
            rio_url     = (f"https://raider.io/characters/{region}/"
                           f"{urllib.parse.quote(realm.lower())}/"
                           f"{urllib.parse.quote(name.lower())}")

            cy = ry + CHAR_CH // 2

            # Avatar
            av_cx = self._col_x["av"] + self._col_widths["av"] // 2
            ph = self._char_photos.get(name)
            if ph:
                bc.create_image(av_cx, cy, anchor="center", image=ph, tags=tag)
            else:
                r = AV // 2
                bc.create_oval(av_cx - r, cy - r, av_cx + r, cy + r,
                               fill=WOW_CLASS_COLORS.get(wow_class, "#374151"),
                               outline="", tags=tag)
                bc.create_text(av_cx, cy, text=name[0].upper(),
                               fill=BG_DARK, font=("Segoe UI", 8, "bold"),
                               anchor="center", tags=tag)

            # Class icon (or colored dot fallback)
            cls_cx = self._col_x["cls"] + self._col_widths["cls"] // 2
            cls_ph = self._class_icon_photos.get(wow_class)
            if cls_ph:
                bc.create_image(cls_cx, cy, anchor="center", image=cls_ph, tags=tag)
            else:
                r = 6
                bc.create_oval(cls_cx - r, cy - r, cls_cx + r, cy + r,
                               fill=class_color if wow_class else "#374151",
                               outline="", tags=tag)

            # Name
            name_x = self._col_x["name"] + 4
            bc.create_text(name_x, cy, text=name,
                           fill=class_color, font=("Segoe UI", 9, "bold"),
                           anchor="w", tags=tag)

            # Realm
            realm_x = self._col_x["realm"] + 4
            bc.create_text(realm_x, cy, text=realm,
                           fill=MUTED, font=("Segoe UI", 8),
                           anchor="w", tags=tag)

            # ilvl
            ilvl_cx  = self._col_x["ilvl"] + self._col_widths["ilvl"] // 2
            ilvl_txt = str(int(round(ilvl))) if ilvl else "—"
            bc.create_text(ilvl_cx, cy, text=ilvl_txt,
                           fill=_ilvl_color(ilvl) if ilvl else MUTED,
                           font=("Segoe UI", 9, "bold"), anchor="center", tags=tag)

            # Keystone — centered in the (wide) key column
            key_cx  = self._col_x["key"] + self._col_widths["key"] // 2
            key_txt = _keystone_display(char)
            key_col = ACCENT if key_txt != "—" else MUTED
            bc.create_text(key_cx, cy, text=key_txt, fill=key_col,
                           font=("Segoe UI", 9, "bold"), anchor="center", tags=tag)

            # RIO
            rio_cx = self._col_x["rio"] + self._col_widths["rio"] // 2
            if rio_score:
                bc.create_text(rio_cx, cy, text=f"{int(rio_score)}",
                               fill=_rio_color(rio_score),
                               font=("Segoe UI", 10, "bold"),
                               anchor="center", tags=tag)
            else:
                bc.create_text(rio_cx, cy, text="—", fill=MUTED,
                               font=("Segoe UI", 9), anchor="center", tags=tag)

            # Row separator — very faint so background image shows through
            bc.create_line(0, ry + CHAR_CH, w, ry + CHAR_CH,
                           fill="#0f1e2d", tags=tag)

            # Click → Raider.IO
            bc.tag_bind(tag, "<Button-1>",
                        lambda _e, url=rio_url: webbrowser.open(url))
            bc.tag_bind(tag, "<Enter>",
                        lambda _e, b=bc: b.configure(cursor="hand2"))
            bc.tag_bind(tag, "<Leave>",
                        lambda _e, b=bc: b.configure(cursor=""))

        # Restore bg to bottom of z-stack after all rows
        if bg_id:
            try:
                bc.lower(bg_id)
            except Exception:
                pass

    def _sort_table(self, col):
        if self._sort_col == col:
            self._sort_asc = not self._sort_asc
        else:
            self._sort_col = col
            self._sort_asc = col in ("name", "realm")

        key_funcs = {
            "name":  lambda c: (c.get("name") or "").lower(),
            "realm": lambda c: (c.get("realm") or "").lower(),
            "ilvl":  lambda c: c.get("ilvl") or 0,
            "key":   lambda c: (c.get("currentKeystone") or {}).get("level") or 0,
            "rio":   lambda c: c.get("rioScore") or 0,
        }
        self._characters = sorted(
            self._characters,
            key=key_funcs.get(col, lambda c: 0),
            reverse=not self._sort_asc)
        self._draw_table_header()
        self._draw_table_rows()

    def _draw_sync_block(self, cv, x, y, w, h):
        HDR_H   = 30
        BTN_H   = 38
        BTN_PAD = 10

        savedvars_found = bool(self._savedvars_path())
        wow_found = bool(savedvars_found or self._addons_folder() or self._wow_install_path())
        addon_info = addon_installer.installed_info(self._addons_folder())
        addon_ready = bool(addon_info.get("installed") and not addon_info.get("corrupt"))
        setup_pending = bool(wow_found and not addon_ready and not savedvars_found)

        cv.create_rectangle(x, y, x + w, y + HDR_H,
                            fill="#07111d", outline=CARD_BDR, tags="tab_content")
        header_text = self._t("sync_ready") if savedvars_found else (
            self._t("wow_ok") if wow_found else self._t("wow_no"))
        self._wow_status_id = cv.create_text(
            x + w // 2, y + HDR_H // 2,
            text=f"● {header_text}",
            fill=GREEN if wow_found else RED_COL,
            font=("Segoe UI", 9, "bold"), anchor="center", tags="tab_content")

        body_y = y + HDR_H
        body_h = h - HDR_H
        avail  = body_h - BTN_H - BTN_PAD * 2
        mid_y  = body_y + avail // 2

        _lbl = self._t("last_sync_lbl") if self._sync_ok else \
               (self._sync_primary or self._t("never"))

        if setup_pending:
            link_tag = "sync_setup_addon_link"
            self._sync_icon_id = None
            self._sync_label_id = cv.create_text(
                x + w // 2, mid_y - 30,
                text=self._t("sync_setup_install"),
                fill=ACCENT, font=("Segoe UI", 15, "bold"),
                anchor="center", tags=("tab_content", link_tag))
            self._sync_time_id = cv.create_text(
                x + w // 2, mid_y + 2,
                text=self._t("sync_setup_rest"),
                fill=TEXT, font=("Segoe UI", 10),
                width=w - 26, justify=tk.CENTER,
                anchor="center", tags="tab_content")
            self._sync_date_id = cv.create_text(
                x + w // 2, mid_y + 38,
                text=self._t("sync_not_ready"),
                fill=MUTED, font=("Segoe UI", 9),
                anchor="center", tags="tab_content")
            cv.tag_bind(link_tag, "<Button-1>", lambda _e: self._switch_tab("addon"))
            cv.tag_bind(link_tag, "<Enter>", lambda _e: cv.configure(cursor="hand2"))
            cv.tag_bind(link_tag, "<Leave>", lambda _e: cv.configure(cursor=""))
        else:
            self._sync_icon_id = cv.create_text(
                x + w // 2, mid_y - 38,
                text="✓" if self._sync_ok else "✗",
                fill=GREEN if self._sync_ok else RED_COL,
                font=("Segoe UI", 30, "bold"), anchor="center", tags="tab_content")

            self._sync_label_id = cv.create_text(
                x + w // 2, mid_y + 4,
                text=_lbl, fill=TEXT if not self._sync_ok else MUTED,
                font=("Segoe UI", 11, "bold" if not self._sync_ok else "normal"),
                anchor="center", tags="tab_content")

            self._sync_time_id = cv.create_text(
                x + w // 2, mid_y + 28,
                text=self._sync_primary if self._sync_ok else "",
                fill=TEXT, font=("Segoe UI", 16, "bold"),
                anchor="center", tags="tab_content")

            self._sync_date_id = cv.create_text(
                x + w // 2, mid_y + 48,
                text=self._sync_secondary if self._sync_ok else "",
                fill=MUTED, font=("Segoe UI", 9),
                anchor="center", tags="tab_content")

        btn_y = y + h - BTN_H - BTN_PAD
        self._cw(cv, ttk.Button(cv, text=self._t("sync_btn"), style="Gold.TButton",
                                command=self._manual_sync),
                 x + 8, btn_y, anchor="nw", width=w - 16, height=BTN_H,
                 tags="tab_content")

    # ── Addon tab ──────────────────────────────────────────────────────────────

    def _render_addon_tab(self, cv):
        W, H = self._W, self._H

        AX  = P
        AY  = BH + P
        AW  = W - 2 * P
        AH  = H - FH - AY - P
        ACX = AX + AW // 2

        self._overlay(cv, AX, AY, AW, AH, CARD_BG, 0.70, tags="tab_content")
        cv.create_rectangle(AX, AY, AX + AW, AY + AH,
                            outline=CARD_BDR, fill="", tags="tab_content")

        cv.create_text(AX + 16, AY + TH // 2, text=self._t("addon_title"),
                       fill=ACCENT, font=("Segoe UI", 11, "bold"), anchor="w",
                       tags="tab_content")
        cv.create_line(AX, AY + TH, AX + AW, AY + TH, fill=CARD_BDR, tags="tab_content")

        status_w = min(280, max(230, AW // 3))
        status_x = AX + AW - status_w - 18
        status_y = AY + TH + 12
        status_h = 76
        cv.create_rectangle(status_x, status_y, status_x + status_w, status_y + status_h,
                            outline=CARD_BDR, fill="#111827", tags="tab_content")
        cv.create_text(status_x + 12, status_y + 10, text=self._t("addon_status_title"),
                       fill=ACCENT, font=("Segoe UI", 9, "bold"), anchor="nw",
                       tags="tab_content")
        self._addon_status_ids = {
            "state": cv.create_text(status_x + 12, status_y + 32, text="",
                                    fill=MUTED, font=("Segoe UI", 9, "bold"),
                                    anchor="nw", tags="tab_content"),
            "detail": cv.create_text(status_x + 12, status_y + 52, text="",
                                     fill=MUTED, font=("Segoe UI", 8),
                                     anchor="nw", tags="tab_content"),
        }

        desc_w = max(260, AW - status_w - 70)
        cv.create_text(AX + 22, AY + TH + 18, text=self._t("addon_desc"),
                       fill=MUTED, font=("Segoe UI", 9), justify="left",
                       width=desc_w, anchor="nw", tags="tab_content")

        content_start = AY + TH + 56
        avail  = AH - TH - 56 - 56
        block  = 32 + 10 + 28
        top_off = max(10, (avail - block) // 2)

        sel_y   = content_start + top_off
        entry_y = sel_y + 32 + 10
        msg_y   = entry_y + 28 + 10

        sel_btn_w = min(AW - 40, 340)
        self._cw(cv, ttk.Button(cv, text=self._t("sel_folder_btn"),
                                style="Gray.TButton",
                                command=self._browse_addons),
                 ACX, sel_y, anchor="n", width=sel_btn_w, height=32,
                 tags="tab_content")

        self.addons_var = tk.StringVar(value=self._addons_folder())
        self.addons_var.trace_add("write", lambda *_: self._refresh_addon_status())
        self._cw(cv, tk.Entry(cv, textvariable=self.addons_var,
                              bg="#1f2937", fg="white", insertbackground=ACCENT,
                              font=("Segoe UI", 9), relief="flat", bd=1),
                 AX + 20, entry_y, anchor="nw", width=AW - 40, height=28,
                 tags="tab_content")

        self._install_msg_id = cv.create_text(
            ACX, msg_y, text="", fill=RED_COL, font=("Segoe UI", 9),
            width=AW - 40, justify=tk.CENTER, anchor="n", tags="tab_content")

        ibw = AW - 40
        ibh = 38
        ib  = tk.Canvas(cv, width=ibw, height=ibh,
                        bg=ACCENT, highlightthickness=0, cursor="hand2")
        self._install_fill     = ib.create_rectangle(0, 0, 0, ibh, fill=GREEN, outline="")
        self._install_btn_text = ib.create_text(ibw // 2, ibh // 2,
                                                text=self._t("install_btn"),
                                                fill=BG_DARK, font=("Segoe UI", 10, "bold"))
        ib.tag_raise(self._install_btn_text)
        ib.bind("<Button-1>", lambda e: self._do_install())
        ib.bind("<Enter>", lambda e: ib.configure(bg="#fbbf24"))
        ib.bind("<Leave>", lambda e: ib.configure(bg=ACCENT))
        self._install_btn   = ib
        self._install_btn_w = ibw
        install_y = AY + AH - ibh - 14
        self._cw(cv, ib, AX + 20, install_y, anchor="nw",
                 width=ibw, height=ibh, tags="tab_content")
        self._refresh_addon_status()

    # ── User dropdown ──────────────────────────────────────────────────────────

    def _toggle_user_dropdown(self):
        if self._user_dropdown_visible:
            self._hide_user_dropdown()
        else:
            self._show_user_dropdown()

    def _show_user_dropdown(self):
        DD_W = 200
        x = self._W - DD_W - 14
        self._user_dd = tk.Frame(self.root, bg=CARD_BG, bd=1, relief="solid",
                                  highlightbackground=CARD_BDR, highlightthickness=1)
        self._user_dd.place(x=x, y=BH, width=DD_W)
        self._user_dd.lift()

        tk.Label(self._user_dd, text=self._t("language"),
                 bg=CARD_BG, fg=MUTED, font=("Segoe UI", 8)).pack(
                     anchor="w", padx=10, pady=(8, 2))
        lang_row = tk.Frame(self._user_dd, bg=CARD_BG)
        lang_row.pack(anchor="w", padx=10, pady=(0, 8))
        for code, label in [("es", "Español"), ("en", "English")]:
            active = self._lang == code
            tk.Button(lang_row, text=label,
                      bg=ACCENT if active else "#374151",
                      fg=BG_DARK if active else TEXT,
                      font=("Segoe UI", 9), relief="flat", bd=0,
                      padx=8, pady=4, cursor="hand2",
                      activebackground=ACCENT, activeforeground=BG_DARK,
                      command=lambda c=code: self._set_lang(c)).pack(
                          side="left", padx=(0, 4))

        tk.Frame(self._user_dd, bg=CARD_BDR, height=1).pack(fill="x")
        tk.Button(self._user_dd, text=f"  {self._t('logout')}",
                  bg=CARD_BG, fg=RED_COL, font=("Segoe UI", 10),
                  relief="flat", bd=0, padx=10, pady=9, anchor="w", cursor="hand2",
                  activebackground="#1f2937", activeforeground=RED_COL,
                  command=self._logout).pack(fill="x")
        self._user_dropdown_visible = True

    def _toggle_settings_popup(self):
        if self._settings_popup_visible:
            self._hide_settings_popup()
        else:
            self._hide_user_dropdown()
            self._hide_avatar_popup()
            self._show_settings_popup()

    def _settings_btn_hover(self, active):
        cv = self._cv
        if not (cv and cv.winfo_exists()):
            return
        cv.configure(cursor="hand2" if active else "")
        try:
            cv.itemconfigure(self._settings_btn_bg,
                             fill="#1f2937" if active else "#121f2e",
                             outline=ACCENT if active else CARD_BDR)
            cv.itemconfigure(self._settings_btn_ring,
                             outline="#3b2f14" if active else BANNER_BG)
            cv.itemconfigure(self._settings_btn_txt,
                             fill=ACCENT if active else "#d1d5db")
        except Exception:
            pass

    def _draw_window_control(self, cv, x, y, text, command, role):
        tag = f"window_control_{role}"
        bg = cv.create_rectangle(x - 15, y - 13, x + 15, y + 13,
                                 fill=BANNER_BG, outline=CARD_BDR, tags=tag)
        fg = cv.create_text(x, y - 1, text=text, fill=MUTED,
                            font=("Segoe UI", 13, "bold"), anchor="center", tags=tag)
        cv.tag_bind(tag, "<Button-1>", lambda _e: command())
        cv.tag_bind(tag, "<Enter>", lambda _e, t=tag, r=role: self._window_control_hover(t, r, True))
        cv.tag_bind(tag, "<Leave>", lambda _e, t=tag, r=role: self._window_control_hover(t, r, False))
        return bg, fg

    def _window_control_hover(self, tag, role, active):
        cv = self._cv
        if not (cv and cv.winfo_exists()):
            return
        cv.configure(cursor="hand2" if active else "")
        fill = RED_COL if role == "close" and active else ("#1f2937" if active else BANNER_BG)
        fg = BG_DARK if role == "close" and active else (ACCENT if active else MUTED)
        try:
            for item in cv.find_withtag(tag):
                if cv.type(item) == "rectangle":
                    cv.itemconfigure(item, fill=fill, outline=ACCENT if active else CARD_BDR)
                elif cv.type(item) == "text":
                    cv.itemconfigure(item, fill=fg)
        except Exception:
            pass

    def _start_window_drag(self, event):
        if event.y > BH:
            self._drag_offset = None
            return

        tabs_left = 188
        tabs_right = 196 + 2 * 130
        if tabs_left <= event.x <= tabs_right:
            self._drag_offset = None
            return
        if event.x >= getattr(self, "_header_controls_left", self._W - 220):
            self._drag_offset = None
            return

        self._drag_offset = (
            event.x_root - self.root.winfo_x(),
            event.y_root - self.root.winfo_y(),
        )

    def _drag_window(self, event):
        if not self._drag_offset:
            return
        dx, dy = self._drag_offset
        self.root.geometry(f"+{event.x_root - dx}+{event.y_root - dy}")

    def _end_window_drag(self, _event=None):
        self._drag_offset = None

    def _minimize_window(self):
        self._hide_user_dropdown()
        self._hide_avatar_popup()
        self._hide_settings_popup()
        try:
            self.root.overrideredirect(False)
            self.root.iconify()
            self._map_bind_id = self.root.bind("<Map>", self._restore_custom_chrome, add="+")
        except Exception:
            self.root.withdraw()

    def _restore_custom_chrome(self, _event=None):
        try:
            if self.root.state() == "normal":
                self.root.overrideredirect(True)
                self._ensure_taskbar_icon(True)
                if self._map_bind_id:
                    self.root.unbind("<Map>", self._map_bind_id)
                    self._map_bind_id = None
        except Exception:
            pass

    def _hide_settings_popup(self):
        if self._settings_popup:
            try:
                self._settings_popup.grab_release()
            except Exception:
                pass
            try:
                self._settings_popup.destroy()
            except Exception:
                pass
            self._settings_popup = None
        self._settings_popup_visible = False

    def _settings_section(self, parent, title):
        tk.Label(parent, text=title, bg=CARD_BG, fg=ACCENT,
                 font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(14, 6))

    def _settings_check(self, parent, text, variable, command):
        return tk.Checkbutton(
            parent, text=text, variable=variable, command=command,
            bg=CARD_BG, fg=TEXT, selectcolor="#111827",
            activebackground=CARD_BG, activeforeground=TEXT,
            font=("Segoe UI", 9), relief="flat", bd=0,
            cursor="hand2", anchor="w")

    def _show_settings_popup(self):
        if self._settings_popup_visible:
            return

        dlg = tk.Toplevel(self.root)
        dlg.withdraw()
        self._settings_popup = dlg
        self._settings_popup_visible = True
        dlg.title(self._t("settings"))
        dlg.configure(bg=BG_DARK)
        dlg.resizable(False, False)
        dlg.transient(self.root)
        dlg.overrideredirect(True)
        dlg.protocol("WM_DELETE_WINDOW", self._hide_settings_popup)

        wrap = tk.Frame(dlg, bg=CARD_BG, padx=18, pady=16,
                        highlightbackground=CARD_BDR, highlightthickness=1)
        wrap.pack(fill="both", expand=True)

        head = tk.Frame(wrap, bg=CARD_BG)
        head.pack(fill="x")
        tk.Label(head, text=self._t("settings"), bg=CARD_BG, fg=ACCENT,
                 font=("Segoe UI", 15, "bold")).pack(side="left")
        tk.Button(head, text="×", bg=CARD_BG, fg=MUTED,
                  activebackground=CARD_BG, activeforeground=TEXT,
                  relief="flat", bd=0, font=("Segoe UI", 14, "bold"),
                  cursor="hand2", command=self._hide_settings_popup).pack(side="right")

        self._settings_section(wrap, self._t("settings_general"))
        self.settings_autostart_var = tk.BooleanVar(value=_get_autostart())
        self._settings_check(
            wrap, self._t("autostart"), self.settings_autostart_var,
            self._toggle_autostart).pack(fill="x", pady=2)

        self.settings_start_minimized_var = tk.BooleanVar(
            value=bool(self.cfg.get("start_minimized")))
        self._settings_check(
            wrap, self._t("start_minimized"), self.settings_start_minimized_var,
            self._toggle_start_minimized).pack(fill="x", pady=2)

        self.settings_minimize_on_close_var = tk.BooleanVar(
            value=bool(self.cfg.get("minimize_on_close")))
        self._settings_check(
            wrap, self._t("minimize_on_close"), self.settings_minimize_on_close_var,
            self._toggle_minimize_on_close).pack(fill="x", pady=2)

        self._settings_section(wrap, self._t("settings_wow"))
        path_row = tk.Frame(wrap, bg=CARD_BG)
        path_row.pack(fill="x", pady=(0, 8))
        tk.Label(path_row, text=self._t("wow_install_path"), bg=CARD_BG, fg=MUTED,
                 font=("Segoe UI", 8)).pack(anchor="w")
        self.settings_wow_path_var = tk.StringVar(value=self.cfg.get("wow_install_path") or "")
        entry_row = tk.Frame(path_row, bg=CARD_BG)
        entry_row.pack(fill="x", pady=(3, 0))
        tk.Entry(entry_row, textvariable=self.settings_wow_path_var,
                 bg="#1f2937", fg=TEXT, insertbackground=ACCENT,
                 font=("Segoe UI", 9), relief="flat", bd=1).pack(
                     side="left", fill="x", expand=True, ipady=5)
        ttk.Button(entry_row, text=self._t("change_btn"), style="Gray.TButton",
                   command=self._settings_browse_wow).pack(side="left", padx=(8, 0))
        ttk.Button(entry_row, text=self._t("save_btn"), style="Gold.TButton",
                   command=self._settings_save_wow_path).pack(side="left", padx=(6, 0))

        savedvars = self._savedvars_path() or self._t("not_found")
        sv_row = tk.Frame(wrap, bg=CARD_BG)
        sv_row.pack(fill="x", pady=(0, 8))
        tk.Label(sv_row, text=self._t("savedvars_path"), bg=CARD_BG, fg=MUTED,
                 font=("Segoe UI", 8)).pack(anchor="w")
        sv_entry = tk.Entry(sv_row, bg="#1f2937", fg=MUTED,
                            font=("Segoe UI", 9), relief="flat", bd=1)
        sv_entry.insert(0, savedvars)
        sv_entry.configure(state="readonly", readonlybackground="#1f2937")
        sv_entry.pack(fill="x", pady=(3, 0), ipady=5)

        addon_state, addon_detail, addon_color, _ = self._addon_status_for_path(self._addons_folder())
        tk.Label(wrap, text=f"{addon_state} · {addon_detail}",
                 bg=CARD_BG, fg=addon_color, font=("Segoe UI", 9, "bold"),
                 wraplength=640, justify="left").pack(anchor="w", pady=(0, 8))

        wow_btns = tk.Frame(wrap, bg=CARD_BG)
        wow_btns.pack(fill="x")
        ttk.Button(wow_btns, text=self._t("redetect_btn"), style="Gray.TButton",
                   command=self._settings_redetect_wow).pack(side="left")
        ttk.Button(wow_btns, text=self._t("addon_tab_btn"), style="Gold.TButton",
                   command=self._settings_go_addon).pack(side="left", padx=(8, 0))

        self._settings_section(wrap, self._t("settings_app"))
        lang_row = tk.Frame(wrap, bg=CARD_BG)
        lang_row.pack(anchor="w", pady=(0, 12))
        tk.Label(lang_row, text=self._t("language"), bg=CARD_BG, fg=MUTED,
                 font=("Segoe UI", 8)).pack(side="left", padx=(0, 8))
        for code, label in [("es", "Español"), ("en", "English")]:
            active = self._lang == code
            tk.Button(lang_row, text=label,
                      bg=ACCENT if active else "#374151",
                      fg=BG_DARK if active else TEXT,
                      font=("Segoe UI", 9), relief="flat", bd=0,
                      padx=8, pady=4, cursor="hand2",
                      activebackground=ACCENT, activeforeground=BG_DARK,
                      command=lambda c=code: self._set_lang(c)).pack(
                          side="left", padx=(0, 4))

        update_row = tk.Frame(wrap, bg=CARD_BG)
        update_row.pack(fill="x", pady=(0, 10))
        self._settings_update_status_var = tk.StringVar(value=self._client_update_status_text())
        self._settings_update_status_label = tk.Label(
            update_row, textvariable=self._settings_update_status_var,
            bg=CARD_BG, fg=self._client_update_status_color(),
            font=("Segoe UI", 9, "bold"))
        self._settings_update_status_label.pack(side="left", anchor="w")
        self._settings_update_button = ttk.Button(
            update_row, text=self._t("update_btn"), style="Gold.TButton",
            command=self._manual_update_from_settings)
        self._settings_update_button.pack(side="right")
        if not (self._latest_update_info and self._latest_update_info.get("is_update")):
            self._settings_update_button.configure(state="disabled")

        bottom = tk.Frame(wrap, bg=CARD_BG)
        bottom.pack(fill="x", pady=(4, 0))
        ttk.Button(bottom, text=self._t("close_btn"), style="Gray.TButton",
                   command=self._hide_settings_popup).pack(side="right")

        dlg.update_idletasks()
        px, py = self.root.winfo_x(), self.root.winfo_y()
        pw, ph = self.root.winfo_width(), self.root.winfo_height()
        dw, dh = dlg.winfo_width(), dlg.winfo_height()
        dw = max(680, dw)
        dlg.geometry(f"{dw}x{dh}+{px + (pw - dw) // 2}+{py + (ph - dh) // 2}")
        dlg.deiconify()
        dlg.lift()
        dlg.focus_force()
        dlg.grab_set()

    def _addon_status_for_path(self, path):
        previous = self.addons_var
        try:
            self.addons_var = tk.StringVar(value=path or "")
            return self._addon_status()
        finally:
            self.addons_var = previous

    def _settings_browse_wow(self):
        folder = filedialog.askdirectory(title=self._t("wow_folder_lbl"))
        if folder and hasattr(self, "settings_wow_path_var"):
            self.settings_wow_path_var.set(folder)

    def _settings_save_wow_path(self):
        raw = self.settings_wow_path_var.get().strip() if hasattr(self, "settings_wow_path_var") else ""
        normalized = wow_path.normalize_wow_dir(raw)
        if not normalized or not wow_path.is_wow_dir(normalized):
            return
        self.cfg["wow_install_path"] = str(normalized)
        self.cfg["wow_path"] = wow_path.find_savedvars(normalized)
        cfg_module.save(self.cfg)
        self._hide_settings_popup()
        self._show_main_view()

    def _settings_redetect_wow(self):
        self.cfg["wow_install_path"] = None
        self.cfg["wow_path"] = None
        found = self._wow_install_path()
        self.cfg["wow_path"] = wow_path.find_savedvars(found) if found else None
        cfg_module.save(self.cfg)
        self._hide_settings_popup()
        self._show_main_view()

    def _settings_go_addon(self):
        self._hide_settings_popup()
        self._switch_tab("addon")

    def _toggle_avatar_popup(self):
        if self._avatar_popup_visible:
            self._hide_avatar_popup()
        else:
            self._hide_user_dropdown()
            self._show_avatar_popup()

    def _show_avatar_popup(self):
        PER_PAGE = 3
        chars_wa  = [c for c in self._characters if c.get("avatarUrl")
                     and self._char_photos.get(c.get("name", ""))]
        popup_w   = 196
        av_x      = getattr(self, "_banner_av_x", self._W - 160)
        x         = max(4, min(av_x - popup_w // 2, self._W - popup_w - 4))

        self._avatar_popup = tk.Frame(self.root, bg=CARD_BG, bd=1, relief="solid",
                                       highlightbackground=CARD_BDR, highlightthickness=1)
        self._avatar_popup.place(x=x, y=BH, width=popup_w)
        self._avatar_popup.lift()

        tk.Label(self._avatar_popup, text="Foto de perfil",
                 bg=CARD_BG, fg=MUTED, font=("Segoe UI", 8)).pack(
                     anchor="w", padx=10, pady=(8, 4))

        if not chars_wa:
            tk.Label(self._avatar_popup,
                     text="Sincroniza para\nver avatares",
                     bg=CARD_BG, fg="#4b5563", font=("Segoe UI", 8),
                     justify="center").pack(padx=10, pady=(0, 10))
            self._avatar_popup_visible = True
            return

        total    = len(chars_wa)
        offset   = max(0, min(self._avatar_picker_offset, total - 1))
        self._avatar_picker_offset = offset
        page     = chars_wa[offset:offset + PER_PAGE]
        paginate = total > PER_PAGE

        av_row = tk.Frame(self._avatar_popup, bg=CARD_BG)
        av_row.pack(anchor="w", padx=10, pady=(0, 10))

        if paginate:
            can_prev = offset > 0
            tk.Button(av_row, text="◀",
                      bg=CARD_BG, fg=TEXT if can_prev else "#4b5563",
                      font=("Segoe UI", 10), relief="flat", bd=0, padx=3, pady=0,
                      cursor="hand2" if can_prev else "",
                      activebackground=CARD_BG,
                      command=self._avatar_prev if can_prev else lambda: None,
                      ).pack(side="left", padx=(0, 4))

        for char in page:
            url    = char["avatarUrl"]
            ph     = self._char_photos[char["name"]]
            is_sel = (self._selected_avatar_url == url)
            tk.Button(av_row, image=ph,
                      relief="solid", bd=2, bg=CARD_BG, cursor="hand2",
                      highlightthickness=2,
                      highlightbackground=ACCENT if is_sel else CARD_BDR,
                      activebackground=CARD_BG,
                      command=lambda u=url: self._select_avatar(u),
                      ).pack(side="left", padx=(0, 4))

        if paginate:
            can_next = offset + PER_PAGE < total
            tk.Button(av_row, text="▶",
                      bg=CARD_BG, fg=TEXT if can_next else "#4b5563",
                      font=("Segoe UI", 10), relief="flat", bd=0, padx=3, pady=0,
                      cursor="hand2" if can_next else "",
                      activebackground=CARD_BG,
                      command=self._avatar_next if can_next else lambda: None,
                      ).pack(side="left")

        self._avatar_popup_visible = True

    def _hide_avatar_popup(self):
        if self._avatar_popup:
            try:
                self._avatar_popup.destroy()
            except Exception:
                pass
            self._avatar_popup = None
        self._avatar_popup_visible = False

    def _avatar_prev(self):
        self._avatar_picker_offset = max(0, self._avatar_picker_offset - 3)
        self._hide_avatar_popup()
        self._show_avatar_popup()

    def _avatar_next(self):
        chars_wa = [c for c in self._characters if c.get("avatarUrl")
                    and self._char_photos.get(c.get("name", ""))]
        self._avatar_picker_offset = min(
            len(chars_wa) - 1, self._avatar_picker_offset + 3)
        self._hide_avatar_popup()
        self._show_avatar_popup()

    def _hide_user_dropdown(self):
        if self._user_dd:
            try:
                self._user_dd.destroy()
            except Exception:
                pass
            self._user_dd = None
        self._user_dropdown_visible = False

    def _on_root_click(self, event):
        if self._user_dropdown_visible and self._user_dd:
            try:
                dx, dy = self._user_dd.winfo_x(), self._user_dd.winfo_y()
                dw, dh = self._user_dd.winfo_width(), self._user_dd.winfo_height()
                if not (dx <= event.x <= dx + dw and dy <= event.y <= dy + dh):
                    self._hide_user_dropdown()
            except Exception:
                pass
        if self._avatar_popup_visible and self._avatar_popup:
            try:
                # If the click landed on the avatar circle itself, the tag_bind already
                # handled it (toggle) — don't close here or it would cancel that open.
                av_x = getattr(self, "_banner_av_x", -999)
                R = 16
                if abs(event.x - av_x) <= R and abs(event.y - BH // 2) <= R:
                    return
                px, py = self._avatar_popup.winfo_x(), self._avatar_popup.winfo_y()
                pw, ph = self._avatar_popup.winfo_width(), self._avatar_popup.winfo_height()
                if not (px <= event.x <= px + pw and py <= event.y <= py + ph):
                    self._hide_avatar_popup()
            except Exception:
                pass

    def _set_lang(self, lang):
        self._lang = lang
        self.cfg["lang"] = lang
        cfg_module.save(self.cfg)
        self._hide_settings_popup()
        self._show_main_view()

    # ── Sync ───────────────────────────────────────────────────────────────────

    def _manual_sync(self):
        if self._worker:
            self._worker.force_sync()
            return
        self._update_sync_ui(False, self._t("connecting"))

        def _run():
            try:
                from sync_worker import SyncWorker
                sv_path = self._savedvars_path()
                if not sv_path:
                    self.root.after(0, lambda: self._update_sync_ui(False, self._t("wow_no")))
                    return
                w = SyncWorker(self.cfg)

                def _done(_chars):
                    ts = time.strftime("%H:%M")
                    ds = time.strftime("%d/%m/%Y")
                    self.root.after(0, lambda: self._update_sync_ui(True, ts, ds))
                    threading.Thread(target=self._load_characters, daemon=True).start()

                def _err(msg):
                    self.root.after(0, lambda: self._update_sync_ui(False, f"Error: {msg}"))

                w.on_sync  = _done
                w.on_error = _err
                w._sync(sv_path)
            except Exception as e:
                self.root.after(0, lambda: self._update_sync_ui(False, f"Error: {e}"))

        threading.Thread(target=_run, daemon=True).start()

    def _update_sync_ui(self, ok, primary="", secondary=""):
        self._sync_ok        = ok
        self._sync_primary   = primary
        self._sync_secondary = secondary

        cv = self._cv
        if not (cv and cv.winfo_exists()):
            return

        if self._sync_icon_id:
            cv.itemconfigure(self._sync_icon_id,
                             text="✓" if ok else "✗",
                             fill=GREEN if ok else RED_COL)
        if ok:
            if self._sync_label_id:
                cv.itemconfigure(self._sync_label_id,
                                 text=self._t("last_sync_lbl"), fill=MUTED)
            if self._sync_time_id:
                cv.itemconfigure(self._sync_time_id, text=primary, fill=TEXT)
            if self._sync_date_id:
                cv.itemconfigure(self._sync_date_id, text=secondary, fill=MUTED)
        else:
            if self._sync_label_id:
                cv.itemconfigure(self._sync_label_id, text=primary, fill=MUTED)
            if self._sync_time_id:
                cv.itemconfigure(self._sync_time_id, text="", fill=TEXT)
            if self._sync_date_id:
                cv.itemconfigure(self._sync_date_id, text="", fill=MUTED)

    # ── Character data & avatars ───────────────────────────────────────────────

    def _refresh_char_list(self):
        if getattr(self, "_table_body_cv", None) and self._table_body_cv.winfo_exists():
            self._draw_table_rows()

    def _download_avatar(self, url: str, size: int = 26):
        try:
            from PIL import Image, ImageTk, ImageDraw
            cache_dir  = Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient" / "avatars"
            cache_file = cache_dir / f"{hashlib.md5(url.encode()).hexdigest()}_{size}.png"
            if cache_file.exists():
                return ImageTk.PhotoImage(Image.open(cache_file).convert("RGB"))
            resp = requests.get(url, timeout=8)
            resp.raise_for_status()
            raw  = Image.open(io.BytesIO(resp.content)).resize((size, size), Image.LANCZOS).convert("RGBA")
            mask = Image.new("L", (size, size), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
            base = Image.new("RGBA", (size, size), (17, 26, 38, 255))
            base.paste(raw, (0, 0), mask)
            img = base.convert("RGB")
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                img.save(cache_file, "PNG")
            except Exception:
                pass
            return ImageTk.PhotoImage(img)
        except Exception:
            return None

    def _download_class_icon(self, class_name: str, size: int = 18):
        slug = _CLASS_ICON_SLUGS.get(class_name)
        if not slug:
            return None
        try:
            from PIL import Image, ImageTk
            cache_dir  = Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient" / "class_icons"
            cache_file = cache_dir / f"{slug}_{size}.png"
            if cache_file.exists():
                return ImageTk.PhotoImage(
                    Image.open(cache_file).resize((size, size), Image.LANCZOS).convert("RGBA"))
            url  = f"{_ICON_BASE}/{slug}.jpg"
            resp = requests.get(url, timeout=8)
            resp.raise_for_status()
            img  = Image.open(io.BytesIO(resp.content)).resize((size, size), Image.LANCZOS).convert("RGBA")
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                img.save(cache_file, "PNG")
            except Exception:
                pass
            return ImageTk.PhotoImage(img)
        except Exception:
            return None

    def _load_class_icons(self):
        unique = {c.get("wowClass") for c in self._characters if c.get("wowClass")}
        changed = False
        for cls in unique:
            if cls not in self._class_icon_photos:
                ph = self._download_class_icon(cls, size=18)
                if ph:
                    self._class_icon_photos[cls] = ph
                    changed = True
        if changed:
            self.root.after(0, self._refresh_char_list)

    def _load_characters(self):
        # Phase 1: cached data
        cached = self.cfg.get("cached_characters") or []
        if cached and not self._characters:
            self._characters = sorted(cached,
                                      key=lambda c: (c.get("rioScore") or 0), reverse=True)
            for c in self._characters:
                url  = c.get("avatarUrl")
                name = c.get("name", "")
                if url and name not in self._char_photos:
                    ph = self._download_avatar(url, size=26)
                    if ph:
                        self._char_photos[name] = ph
            self.root.after(0, self._refresh_char_list)
            threading.Thread(target=self._load_class_icons, daemon=True).start()

            profile_url = self.cfg.get("avatar_url") or self._selected_avatar_url
            if profile_url and not self._profile_photo:
                ph = self._download_avatar(profile_url, size=26)
                if ph:
                    self._profile_photo = ph
                    self.root.after(0, self._update_banner_avatar_ui)

        # Phase 2: API refresh
        try:
            token = self.cfg.get("access_token") or self.cfg.get("sync_token", "")
            if not token:
                return
            headers   = {"Authorization": f"Bearer {token}"}
            sync_hdrs = {"Authorization": f"Bearer {self.cfg.get('sync_token', '')}",
                         "Content-Type": "application/json"}
            api_url   = self.cfg["api_url"]

            r = requests.get(f"{api_url}/api/me/characters", headers=headers, timeout=10)
            if not r.ok:
                return
            chars = r.json()

            from sync_worker import SyncWorker
            _sw = SyncWorker(self.cfg)
            for c in chars:
                if c.get("avatarUrl") and c.get("rioScore") and c.get("wowClass"):
                    continue
                av, score, klass, _ilvl = _sw._fetch_raiderio(
                    c.get("name", ""), c.get("realm", ""), c.get("region", "eu"))
                if av:                c["avatarUrl"] = av
                if score is not None: c["rioScore"]  = score
                if klass:             c["wowClass"]  = klass
                if av or score or klass:
                    try:
                        requests.post(
                            f"{api_url}/api/me/characters/enrich",
                            json={"name": c.get("name"), "realm": c.get("realm"),
                                  "region": c.get("region", "eu"),
                                  "avatarUrl": av, "rioScore": score,
                                  "wowClass": klass},
                            headers=sync_hdrs, timeout=8)
                    except Exception:
                        pass

            chars = sorted(chars, key=lambda c: (c.get("rioScore") or 0), reverse=True)
            self._characters = chars
            self.cfg["cached_characters"] = chars
            cfg_module.save(self.cfg)

            for c in self._characters:
                url  = c.get("avatarUrl")
                name = c.get("name", "")
                if url and name not in self._char_photos:
                    ph = self._download_avatar(url, size=26)
                    if ph:
                        self._char_photos[name] = ph

            self.root.after(0, self._refresh_char_list)
            threading.Thread(target=self._load_class_icons, daemon=True).start()

            profile_url = self.cfg.get("avatar_url") or self._selected_avatar_url
            if profile_url and not self._profile_photo:
                ph = self._download_avatar(profile_url, size=26)
                if ph:
                    self._profile_photo = ph
                    self.root.after(0, self._update_banner_avatar_ui)
        except Exception:
            pass

    def _preload_banner_avatar(self, url: str):
        ph = self._download_avatar(url, size=26)
        if ph:
            self._profile_photo = ph
            self.root.after(0, self._update_banner_avatar_ui)

    def _update_banner_avatar_ui(self):
        cv = self._cv
        if not (cv and cv.winfo_exists()) or not self._profile_photo:
            return
        x = getattr(self, "_banner_av_x", self._W - 14 - 140)
        R = 13
        for attr in ("_banner_av_img_id", "_banner_av_fill_id",
                     "_banner_av_ring_id", "_banner_av_init_id"):
            _id = getattr(self, attr, None)
            if _id:
                try: cv.delete(_id)
                except Exception: pass
                setattr(self, attr, None)
        self._banner_av_img_id = cv.create_image(x, BH // 2,
                                                   anchor="center",
                                                   image=self._profile_photo)
        self._banner_av_ring_id = cv.create_oval(
            x - R, BH // 2 - R, x + R, BH // 2 + R, fill="", outline=CARD_BDR)
        cv.tag_bind(self._banner_av_ring_id, "<Button-1>",
                    lambda _e: self._toggle_avatar_popup())
        cv.tag_bind(self._banner_av_img_id, "<Button-1>",
                    lambda _e: self._toggle_avatar_popup())
        cv.tag_bind(self._banner_av_img_id, "<Enter>",
                    lambda _e: cv.configure(cursor="hand2"))
        cv.tag_bind(self._banner_av_img_id, "<Leave>",
                    lambda _e: cv.configure(cursor=""))

    def _select_avatar(self, url: str):
        self._hide_user_dropdown()
        self._hide_avatar_popup()
        self.cfg["avatar_url"]    = url
        self._selected_avatar_url = url
        cfg_module.save(self.cfg)

        def _do():
            ph = self._download_avatar(url, size=26)
            if ph:
                self._profile_photo = ph
                self.root.after(0, self._update_banner_avatar_ui)
            try:
                token = self.cfg.get("access_token") or self.cfg.get("sync_token", "")
                if token:
                    headers = {"Authorization": f"Bearer {token}",
                               "Content-Type": "application/json"}
                    requests.patch(f"{self.cfg['api_url']}/api/me/avatar",
                                   json={"avatarUrl": url}, headers=headers, timeout=10)
            except Exception:
                pass
        threading.Thread(target=_do, daemon=True).start()

    # ── Addon ──────────────────────────────────────────────────────────────────

    def _addon_status(self):
        path = self.addons_var.get().strip() if self.addons_var else ""
        info = addon_installer.installed_info(path)
        installed = info.get("installed")
        corrupt = info.get("corrupt")
        installed_version = info.get("version")
        bundled_version = info.get("bundled_version")

        if not installed:
            return (
                self._t("addon_not_installed"),
                f"{self._t('addon_bundled')}: v{bundled_version or '?'}",
                RED_COL,
                self._t("install_addon_btn"),
            )

        if corrupt:
            return (
                self._t("addon_corrupt"),
                f"{self._t('addon_bundled')}: v{bundled_version or '?'}",
                RED_COL,
                self._t("reinstall_addon_btn"),
            )

        if bundled_version and installed_version and installed_version != bundled_version:
            return (
                self._t("addon_update_available"),
                f"v{installed_version} -> v{bundled_version}",
                ACCENT,
                self._t("update_addon_btn"),
            )

        return (
            f"{self._t('addon_installed')}: v{installed_version or '?'}",
            self._t("addon_up_to_date"),
            GREEN,
            self._t("reinstall_addon_btn"),
        )

    def _refresh_addon_status(self):
        cv = self._cv
        if not (cv and cv.winfo_exists()):
            return

        state, detail, color, button_text = self._addon_status()
        ids = getattr(self, "_addon_status_ids", {})
        if ids.get("state"):
            cv.itemconfigure(ids["state"], text=state, fill=color)
        if ids.get("detail"):
            cv.itemconfigure(ids["detail"], text=detail, fill=MUTED)
        if self._install_btn and self._install_btn_text:
            self._install_btn.itemconfigure(self._install_btn_text, text=button_text)

    def _browse_addons(self):
        folder = filedialog.askdirectory(title="Selecciona la carpeta AddOns")
        if folder and self.addons_var:
            self.addons_var.set(folder)
            self._refresh_addon_status()

    def _set_install_progress(self, val):
        ib = self._install_btn
        if not (ib and ib.winfo_exists()):
            return
        fill_w = max(0, int(self._install_btn_w * val / 100))
        ib.coords(self._install_fill, 0, 0, fill_w, 38)

    def _set_install_msg(self, text, color=RED_COL):
        cv = self._cv
        if cv and cv.winfo_exists() and self._install_msg_id:
            cv.itemconfigure(self._install_msg_id, text=text, fill=color)

    def _do_install(self):
        path = (self.addons_var.get().strip() if self.addons_var else "")
        if not path:
            self._set_install_msg(self._t("sel_folder_err"))
            return
        self._set_install_msg("")
        self._set_install_progress(0)
        self.root.update()
        try:
            self._set_install_progress(40)
            self.root.update()
            addon_installer.install(path)
            self._set_install_progress(100)
            self._set_install_msg(self._t("installed_ok"), color=GREEN)
            self._refresh_addon_status()
        except Exception as e:
            self._set_install_progress(0)
            self._set_install_msg(f"Error: {e}")

    def _toggle_autostart(self):
        var = getattr(self, "settings_autostart_var", None)
        _set_autostart(bool(var.get()) if var else False)

    def _toggle_start_minimized(self):
        var = getattr(self, "settings_start_minimized_var", None)
        self.cfg["start_minimized"] = bool(var.get()) if var else False
        cfg_module.save(self.cfg)

    def _toggle_minimize_on_close(self):
        var = getattr(self, "settings_minimize_on_close_var", None)
        self.cfg["minimize_on_close"] = bool(var.get()) if var else False
        cfg_module.save(self.cfg)

    # ── Logout ─────────────────────────────────────────────────────────────────

    def _logout(self):
        self._hide_user_dropdown()
        self._hide_settings_popup()
        if self._worker: self._worker.stop(); self._worker = None
        if self._tray:   self._tray.stop();   self._tray   = None
        self.cfg.update({"sync_token": None, "access_token": None,
                         "login_at": None, "username": None, "avatar_url": None,
                         "cached_characters": []})
        cfg_module.save(self.cfg)
        self._characters          = []
        self._char_photos         = {}
        self._class_icon_photos   = {}
        self._profile_photo       = None
        self._selected_avatar_url = None
        self._avatar_picker_offset = 0
        self._show_login_view()

    # ── Tray ───────────────────────────────────────────────────────────────────

    def _minimize_to_tray(self):
        if not self.cfg.get("wow_path"):
            path = self._savedvars_path()
            if path:
                self.cfg["wow_path"] = path
                cfg_module.save(self.cfg)
        if self._tray is None:
            self._start_background_services()
        self.root.withdraw()

    def _start_background_services(self):
        if self._worker is not None:
            return

        from sync_worker import SyncWorker
        from tray_app import TrayApp

        self._worker = SyncWorker(self.cfg)
        self._tray   = TrayApp(self.cfg, self._worker,
                               on_open=self._show_from_tray, on_quit=self._quit)

        def _on_sync(_chars):
            ts = time.strftime("%H:%M")
            ds = time.strftime("%d/%m/%Y")
            self._tray.set_status(f"Sync: {ts}")
            self.root.after(0, lambda: self._update_sync_ui(True, ts, ds))
            threading.Thread(target=self._load_characters, daemon=True).start()

        self._worker.on_sync  = _on_sync
        self._worker.on_error = lambda msg: self._tray.set_status(f"Error: {msg[:50]}")
        self._worker.start()
        self._tray.run_detached()

    def _show_from_tray(self):
        self.root.after(0, self.root.deiconify)
        self.root.after(0, self.root.lift)
        self.root.after(0, self.root.focus_force)

    # ── Client updates ────────────────────────────────────────────────────────

    def _check_for_client_updates_async(self):
        threading.Thread(target=self._check_for_client_updates, daemon=True).start()

    def _check_for_client_updates(self):
        info = self._fetch_latest_update_info()
        self._latest_update_info = info
        self._update_check_done = True
        self.root.after(0, self._refresh_client_update_status_ui)
        if info and info.get("is_update"):
            self.root.after(0, lambda: self._show_update_available_dialog(info))

    def _fetch_latest_update_info(self):
        try:
            r = requests.get(UPDATE_API_URL, timeout=8)
            if not r.ok:
                return None
            release = r.json()
            latest = release.get("tag_name") or release.get("name") or ""

            asset = None
            for item in release.get("assets", []):
                if item.get("name") == UPDATE_ASSET_NAME and item.get("browser_download_url"):
                    asset = item
                    break

            match = re.search(r"(\d+(?:\.\d+){0,3})", latest)
            if not match:
                return None

            return {
                "version": match.group(1),
                "download_url": asset["browser_download_url"] if asset else None,
                "body": release.get("body") or "",
                "is_update": _is_newer_version(latest, CLIENT_VERSION) and bool(asset),
            }
        except Exception:
            return None

    def _client_update_status_text(self):
        if not self._update_check_done:
            return f"{self._t('client_version')}: {CLIENT_VERSION} · {self._t('update_checking')}"
        if self._latest_update_info and self._latest_update_info.get("is_update"):
            return f"{self._t('client_version')}: {CLIENT_VERSION} · {self._t('update_latest_available').format(version=self._latest_update_info['version'])}"
        return f"{self._t('client_version')}: {CLIENT_VERSION} · {self._t('update_current')}"

    def _client_update_banner_text(self):
        if not self._update_check_done:
            return f"v{CLIENT_VERSION}"
        if self._latest_update_info and self._latest_update_info.get("is_update"):
            return f"v{CLIENT_VERSION} ({self._t('update_latest_available').format(version=self._latest_update_info['version'])})"
        return f"v{CLIENT_VERSION} ({self._t('update_current_short')})"

    def _client_update_status_color(self):
        if self._latest_update_info and self._latest_update_info.get("is_update"):
            return RED_COL
        if self._update_check_done:
            return GREEN
        return MUTED

    def _refresh_client_update_status_ui(self):
        text = self._client_update_status_text()
        color = self._client_update_status_color()
        if self._login_update_status_var:
            self._login_update_status_var.set(text)
            try:
                self._login_update_status_label.configure(fg=color)
            except Exception:
                pass
        if self._login_banner_update_id and self._cv:
            try:
                self._cv.itemconfigure(
                    self._login_banner_update_id,
                    text=self._client_update_banner_text(),
                    fill=color,
                )
            except Exception:
                pass
        if self._settings_update_status_var:
            self._settings_update_status_var.set(text)
            try:
                self._settings_update_status_label.configure(fg=color)
            except Exception:
                pass
        if self._settings_update_button:
            state = "normal" if self._latest_update_info and self._latest_update_info.get("is_update") else "disabled"
            try:
                self._settings_update_button.configure(state=state)
            except Exception:
                pass

    def _manual_update_from_settings(self):
        if self._latest_update_info and self._latest_update_info.get("is_update"):
            self._show_update_available_dialog(self._latest_update_info)
            return
        self._settings_update_status_var.set(self._t("update_checking"))
        threading.Thread(target=self._manual_update_check, daemon=True).start()

    def _manual_update_check(self):
        info = self._fetch_latest_update_info()
        self._latest_update_info = info
        self._update_check_done = True
        self.root.after(0, self._refresh_client_update_status_ui)
        if info and info.get("is_update"):
            self.root.after(0, lambda: self._show_update_available_dialog(info))

    def _show_update_available_dialog(self, info):
        if getattr(self, "_update_dialog_visible", False):
            return
        self._update_dialog_visible = True

        dlg = tk.Toplevel(self.root)
        dlg.title(self._t("update_title"))
        dlg.configure(bg=BG_DARK)
        dlg.resizable(False, False)
        dlg.transient(self.root)
        dlg.grab_set()
        dlg.protocol("WM_DELETE_WINDOW", lambda: self._close_update_dialog(dlg))

        wrap = tk.Frame(dlg, bg=CARD_BG, padx=22, pady=20,
                        highlightbackground=CARD_BDR, highlightthickness=1)
        wrap.pack(fill="both", expand=True)

        tk.Label(wrap, text=self._t("update_title"), bg=CARD_BG, fg=ACCENT,
                 font=("Segoe UI", 16, "bold")).pack(anchor="w")
        msg = self._t("update_msg").format(current=CLIENT_VERSION, latest=info["version"])
        tk.Label(wrap, text=msg, bg=CARD_BG, fg=TEXT, justify="left",
                 font=("Segoe UI", 10), wraplength=390).pack(anchor="w", pady=(10, 14))

        status_var = tk.StringVar(value="")
        tk.Label(wrap, textvariable=status_var, bg=CARD_BG, fg=MUTED,
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 10))

        btns = tk.Frame(wrap, bg=CARD_BG)
        btns.pack(fill="x")
        cancel_btn = ttk.Button(
            btns, text=self._t("cancel_btn"), style="Gray.TButton",
            command=lambda: self._close_update_dialog(dlg))
        cancel_btn.pack(side="right")
        update_btn = ttk.Button(
            btns, text=self._t("update_btn"), style="Gold.TButton",
            command=lambda: self._start_update_download(info, dlg, status_var, update_btn, cancel_btn))
        update_btn.pack(side="right", padx=(0, 8))

        dlg.update_idletasks()
        px, py = self.root.winfo_x(), self.root.winfo_y()
        pw, ph = self.root.winfo_width(), self.root.winfo_height()
        dw, dh = dlg.winfo_width(), dlg.winfo_height()
        dlg.geometry(f"{dw}x{dh}+{px + (pw - dw) // 2}+{py + (ph - dh) // 2}")
        dlg.lift()
        dlg.focus_force()

    def _close_update_dialog(self, dlg):
        self._update_dialog_visible = False
        try:
            dlg.grab_release()
            dlg.destroy()
        except Exception:
            pass

    def _start_update_download(self, info, dlg, status_var, update_btn, cancel_btn):
        update_btn.configure(state="disabled")
        cancel_btn.configure(state="disabled")
        status_var.set(self._t("downloading_update"))
        threading.Thread(
            target=self._download_and_launch_update,
            args=(info, dlg, status_var),
            daemon=True,
        ).start()

    def _download_and_launch_update(self, info, dlg, status_var):
        installer_path = os.path.join(
            tempfile.gettempdir(),
            f"KeystoneClientSetup-{info['version']}.exe",
        )
        try:
            with requests.get(info["download_url"], stream=True, timeout=30) as r:
                r.raise_for_status()
                with open(installer_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 256):
                        if chunk:
                            f.write(chunk)
        except Exception:
            self.root.after(0, lambda: status_var.set(self._t("update_download_error")))
            return

        try:
            self.cfg["pending_update_version"] = info["version"]
            self.cfg["pending_update_changelog"] = info.get("body") or ""
            cfg_module.save(self.cfg)
            subprocess.Popen([installer_path], close_fds=True)
            self.root.after(250, self._quit)
        except Exception:
            self.root.after(0, lambda: status_var.set(self._t("update_launch_error")))
            return

    def _show_pending_update_changelog(self):
        version = self.cfg.get("pending_update_version")
        body = self.cfg.get("pending_update_changelog")
        if not version or self.cfg.get("last_changelog_version") == version:
            return
        if not _is_newer_version(CLIENT_VERSION, version) and _version_tuple(CLIENT_VERSION) != _version_tuple(version):
            return

        self.cfg["last_changelog_version"] = version
        self.cfg["pending_update_version"] = None
        self.cfg["pending_update_changelog"] = None
        cfg_module.save(self.cfg)

        self._show_changelog_dialog(version, body or self._t("changelog_empty"))

    def _show_changelog_dialog(self, version, body):
        dlg = tk.Toplevel(self.root)
        dlg.title(self._t("changelog_title").format(version=version))
        dlg.configure(bg=BG_DARK)
        dlg.resizable(False, False)
        dlg.transient(self.root)
        dlg.grab_set()

        wrap = tk.Frame(dlg, bg=CARD_BG, padx=18, pady=16,
                        highlightbackground=CARD_BDR, highlightthickness=1)
        wrap.pack(fill="both", expand=True)

        tk.Label(wrap, text=self._t("changelog_title").format(version=version),
                 bg=CARD_BG, fg=ACCENT, font=("Segoe UI", 15, "bold")).pack(anchor="w")

        text = tk.Text(wrap, width=62, height=14, bg="#111827", fg=TEXT,
                       insertbackground=ACCENT, relief="flat", bd=0,
                       font=("Segoe UI", 9), wrap="word")
        text.pack(fill="both", expand=True, pady=(12, 12))
        text.insert("1.0", body)
        text.configure(state="disabled")

        ttk.Button(wrap, text=self._t("ok_btn"), style="Gold.TButton",
                   command=lambda: (dlg.grab_release(), dlg.destroy())).pack(anchor="e")

        dlg.update_idletasks()
        px, py = self.root.winfo_x(), self.root.winfo_y()
        pw, ph = self.root.winfo_width(), self.root.winfo_height()
        dw, dh = dlg.winfo_width(), dlg.winfo_height()
        dlg.geometry(f"{dw}x{dh}+{px + (pw - dw) // 2}+{py + (ph - dh) // 2}")
        dlg.lift()
        dlg.focus_force()

    def _quit(self):
        if self._worker:
            self._worker.stop()
            self._worker = None
        if self._tray:
            self._tray.stop()
            self._tray = None
        self.root.after(0, self.root.destroy)

    # ── Close button ───────────────────────────────────────────────────────────

    def _on_close_btn(self):
        if self.cfg.get("minimize_on_close"):
            self._minimize_to_tray()
        else:
            self._quit()

    def _show_minimized_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title("KeystoneClient")
        dlg.configure(bg=BG_DARK)
        dlg.resizable(False, False)
        dlg.transient(self.root)
        dlg.grab_set()
        f = tk.Frame(dlg, bg=BG_DARK, padx=32, pady=28)
        f.pack()
        tk.Label(f, text=self._t("min_title"), bg=BG_DARK, fg=ACCENT,
                 font=("Segoe UI", 13, "bold")).pack(pady=(0, 10))
        tk.Label(f, text=self._t("min_msg"), bg=BG_DARK, fg=MUTED,
                 font=("Segoe UI", 11), justify="center").pack(pady=(0, 20))
        ttk.Button(f, text=self._t("ok_btn"), style="Gold.TButton",
                   command=lambda: (dlg.destroy(), self._minimize_to_tray())).pack(fill="x")
        dlg.update_idletasks()
        px, py = self.root.winfo_x(), self.root.winfo_y()
        pw, ph = self.root.winfo_width(), self.root.winfo_height()
        dw, dh = dlg.winfo_width(), dlg.winfo_height()
        dlg.geometry(f"+{px + (pw - dw) // 2}+{py + (ph - dh) // 2}")

    def run(self):
        self.root.mainloop()
