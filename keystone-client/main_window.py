import os
import sys
import time
import tkinter as tk
from tkinter import ttk, filedialog
import urllib.parse
import webbrowser
import winreg
import threading
import requests

import config as cfg_module
import addon_installer
import wow_path

REGISTER_URL = "https://weekly-char.vercel.app/login"
WEB_URL      = "https://weekly-char.vercel.app"
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

BH     = 58    # banner height (solid, no image)
FH     = 58    # footer height (solid, no image)
TH     = 32    # card title bar height
CARD_H = 260   # card height
P      = 14    # outer padding

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


def _rio_color(score):
    if not score:      return MUTED
    if score < 500:    return "#9d9d9d"
    if score < 1000:   return "#1eff00"
    if score < 1500:   return "#0070dd"
    if score < 2000:   return "#a335ee"
    if score < 2500:   return "#ff8000"
    return "#e6cc80"


_TR = {
    "es": {
        "sync_title":    "Estado de Sincronización",
        "addon_title":   "Addon",
        "last_sync_lbl": "Última sync",
        "never":         "Sin sincronizar",
        "sync_btn":      "Sincronizar",
        "install_btn":   "Instalar / Actualizar",
        "sel_folder_btn":"Seleccionar carpeta de AddOns",
        "open_web":      "Acceder a la Web",
        "autostart":     "Arrancar con Windows",
        "minimize":      "Minimizar a la bandeja",
        "logout":        "Cerrar sesión",
        "language":      "Idioma",
        "installing":    "Instalando...",
        "installed_ok":  "✓ Instalado correctamente",
        "sel_folder_err":"Selecciona la carpeta AddOns primero.",
        "login_sub":     "Inicia sesión para continuar",
        "usr_lbl":       "Usuario",
        "pwd_lbl":       "Contraseña",
        "login_btn":     "Entrar",
        "register_btn":  "Registrarse",
        "wow_ok":        "WoW detectado",
        "wow_no":        "WoW no encontrado",
        "min_title":     "Minimizado a la bandeja",
        "min_msg":       "KeystoneClient sigue corriendo en la bandeja\ndel sistema. Haz clic en el icono para volver.",
        "ok_btn":        "Entendido",
        "err_fields":    "Introduce usuario y contraseña.",
        "connecting":    "Conectando...",
        "conn_err":      "No se puede conectar con la API.",
    },
    "en": {
        "sync_title":    "Sync Status",
        "addon_title":   "Addon",
        "last_sync_lbl": "Last sync",
        "never":         "Never synced",
        "sync_btn":      "Sync",
        "install_btn":   "Install / Update",
        "sel_folder_btn":"Select AddOns folder",
        "open_web":      "Open Web",
        "autostart":     "Start with Windows",
        "minimize":      "Minimize to tray",
        "logout":        "Logout",
        "language":      "Language",
        "installing":    "Installing...",
        "installed_ok":  "✓ Installed successfully",
        "sel_folder_err":"Select AddOns folder first.",
        "login_sub":     "Sign in to continue",
        "usr_lbl":       "Username",
        "pwd_lbl":       "Password",
        "login_btn":     "Sign in",
        "register_btn":  "Register",
        "wow_ok":        "WoW detected",
        "wow_no":        "WoW not found",
        "min_title":     "Minimized to tray",
        "min_msg":       "KeystoneClient is still running in the\nsystem tray. Click the icon to return.",
        "ok_btn":        "Got it",
        "err_fields":    "Enter username and password.",
        "connecting":    "Connecting...",
        "conn_err":      "Cannot connect to API.",
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

        # Canvas item IDs for dynamic text
        self._sync_icon_id  = None
        self._sync_label_id = None
        self._sync_time_id  = None
        self._sync_date_id  = None
        self._wow_status_id = None

        # Character list (for sync card)
        self._characters       = []
        self._char_photos      = {}   # name -> ImageTk.PhotoImage
        self._char_canvas_items = []  # canvas item IDs to refresh

        # Avatar picker page state
        self._avatar_picker_offset = 0

        # Profile avatar
        self._profile_photo      = None   # ImageTk.PhotoImage for banner
        self._banner_av_ph       = None   # placeholder PhotoImage
        self._banner_av_img_id   = None   # canvas item ID for avatar image
        self._banner_av_fill_id  = None   # canvas item ID for placeholder circle
        self._banner_av_ring_id  = None   # canvas item ID for border ring
        self._selected_avatar_url = None

        # Install progress button refs
        self._install_btn   = None
        self._install_fill  = None
        self._install_btn_text = None
        self._install_btn_w = 0
        self._install_msg_id = None

        # Addon entry var
        self.addons_var = None

        # PIL image refs (prevent GC)
        self._photos      = []
        self._banner_icon = None
        self._bg_pil_orig    = None
        self._bg_pil_content = None

        self._cv      = None
        self._list_cv = None
        self._user_dd = None
        self._user_dropdown_visible = False

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
            self._show_main_view()
        else:
            self._show_login_view()

        self.root.eval("tk::PlaceWindow . center")

    def _calc_window_size(self):
        """Window size = image aspect ratio for content area + solid banner + solid footer."""
        if self._bg_pil_orig:
            iw, ih = self._bg_pil_orig.size
            aspect = iw / ih
            content_W = 880
            content_H = round(content_W / aspect)
            content_H = max(300, min(700, content_H))
            content_W = round(content_H * aspect)
            content_W = max(680, min(1280, content_W))
            return content_W, content_H + BH + FH
        return 880, 580

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
        for w in self.root.winfo_children():
            w.destroy()
        self._photos.clear()
        self._banner_icon    = None
        self._bg_pil_content = None
        self._cv             = None
        self._list_cv        = None
        self._user_dd        = None
        self._user_dropdown_visible = False
        self._sync_icon_id   = None
        self._sync_label_id  = None
        self._sync_time_id   = None
        self._sync_date_id   = None
        self._wow_status_id  = None
        self._char_canvas_items = []
        self._profile_photo     = None
        self._banner_av_ph      = None
        self._banner_av_img_id  = None
        self._banner_av_fill_id = None
        self._banner_av_ring_id = None
        self._install_btn    = None
        self._install_fill   = None
        self._install_btn_text = None
        self._install_btn_w  = 0
        self._install_msg_id = None
        self.addons_var      = None

    def _make_entry(self, parent, textvariable, show=None):
        border = tk.Frame(parent, bg="#374151", padx=2, pady=2)
        inner  = tk.Frame(border, bg="#1f2937")
        inner.pack(fill="both", expand=True)
        e = tk.Entry(inner, textvariable=textvariable, show=show,
                     bg="#1f2937", fg="white", insertbackground=ACCENT,
                     font=("Segoe UI", 12), relief="flat", bd=0)
        e.pack(fill="both", expand=True, padx=10, pady=9)
        return border, e

    def _overlay(self, cv, x, y, w, h, hex_color, alpha):
        """Blend content-area bg region with hex_color. y is in window coords."""
        if w <= 0 or h <= 0:
            return
        if self._bg_pil_content:
            try:
                from PIL import Image, ImageTk
                cy = y - BH  # convert to content-image coords
                region = self._bg_pil_content.crop(
                    (x, cy, x + w, cy + h)).convert("RGB")
                r = int(hex_color[1:3], 16)
                g = int(hex_color[3:5], 16)
                b = int(hex_color[5:7], 16)
                ph = ImageTk.PhotoImage(
                    Image.blend(region, Image.new("RGB", (w, h), (r, g, b)), alpha))
                self._photos.append(ph)
                cv.create_image(x, y, anchor="nw", image=ph)
                return
            except Exception:
                pass
        cv.create_rectangle(x, y, x + w, y + h, fill=hex_color, outline="")

    def _cw(self, cv, widget, x, y, anchor="nw", width=None, height=None):
        kw = {}
        if width  is not None: kw["width"]  = width
        if height is not None: kw["height"] = height
        cv.create_window(x, y, anchor=anchor, window=widget, **kw)

    # =========================================================================
    # LOGIN VIEW
    # =========================================================================

    def _show_login_view(self):
        self._clear()
        self.root.geometry("520x420")
        outer = tk.Frame(self.root, bg=BG_DARK)
        outer.pack(fill="both", expand=True, padx=50, pady=36)

        tk.Label(outer, text="KeystoneClient", bg=BG_DARK, fg=ACCENT,
                 font=("Segoe UI", 24, "bold")).pack(anchor="w")
        tk.Label(outer, text=self._t("login_sub"), bg=BG_DARK, fg=MUTED,
                 font=("Segoe UI", 10)).pack(anchor="w", pady=(2, 24))

        tk.Label(outer, text=self._t("usr_lbl"), bg=BG_DARK, fg=TEXT,
                 font=("Segoe UI", 11)).pack(anchor="w")
        self.username_var = tk.StringVar()
        u_border, u_entry = self._make_entry(outer, self.username_var)
        u_border.pack(fill="x", pady=(4, 14))
        u_entry.focus()

        tk.Label(outer, text=self._t("pwd_lbl"), bg=BG_DARK, fg=TEXT,
                 font=("Segoe UI", 11)).pack(anchor="w")
        self.password_var = tk.StringVar()
        p_border, _ = self._make_entry(outer, self.password_var, show="*")
        p_border.pack(fill="x", pady=(4, 6))

        self.login_error = tk.StringVar()
        tk.Label(outer, textvariable=self.login_error, bg=BG_DARK, fg=RED_COL,
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 10))

        bf = tk.Frame(outer, bg=BG_DARK)
        bf.pack(fill="x")
        ttk.Button(bf, text=self._t("login_btn"), style="Gold.TButton",
                   command=self._login).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Button(bf, text=self._t("register_btn"), style="Gray.TButton",
                   command=lambda: webbrowser.open(REGISTER_URL)).pack(
                       side="left", fill="x", expand=True)

        self.root.bind("<Return>", lambda _: self._login())

    def _login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get()
        if not username or not password:
            self.login_error.set(self._t("err_fields"))
            return
        self.login_error.set(self._t("connecting"))
        self.root.update()
        try:
            r = requests.post(f"{self.cfg['api_url']}/api/auth/login",
                              json={"username": username, "password": password}, timeout=10)
            if not r.ok:
                self.login_error.set(r.json().get("detail", "Error de login."))
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
            self._show_main_view()
        except requests.exceptions.ConnectionError:
            self.login_error.set(self._t("conn_err"))
        except Exception as e:
            self.login_error.set(f"Error: {e}")

    # =========================================================================
    # MAIN VIEW
    # =========================================================================

    def _show_main_view(self):
        self._clear()
        W, H = self._W, self._H
        self.root.geometry(f"{W}x{H}")

        content_H = H - BH - FH
        CARD_W    = (W - P * 3) // 2
        CARD_Y    = BH + max(P, (content_H - CARD_H) // 2)

        # Prepare content-area PIL image (no modifications)
        if self._bg_pil_orig:
            try:
                from PIL import Image
                self._bg_pil_content = self._bg_pil_orig.resize(
                    (W, content_H), Image.LANCZOS)
            except Exception:
                self._bg_pil_content = None

        # Canvas
        cv = tk.Canvas(self.root, bd=0, highlightthickness=0, bg=BG_DARK)
        cv.place(x=0, y=0, width=W, height=H)
        self._cv = cv

        # ── Content-area background image (BH → H-FH) ────────────────────────
        if self._bg_pil_content:
            try:
                from PIL import ImageTk
                _ph = ImageTk.PhotoImage(self._bg_pil_content)
                self._photos.append(_ph)
                cv.create_image(0, BH, anchor="nw", image=_ph)
            except Exception:
                pass

        # ── Solid banner (no image) ───────────────────────────────────────────
        cv.create_rectangle(0, 0, W, BH, fill=BANNER_BG, outline="")
        cv.create_line(0, BH, W, BH, fill=CARD_BDR)

        # ── Solid footer (no image) ───────────────────────────────────────────
        cv.create_rectangle(0, H - FH, W, H, fill=FOOTER_BG, outline="")
        cv.create_line(0, H - FH, W, H - FH, fill=CARD_BDR)

        # ── Card overlays (blended over content image) ────────────────────────
        for cx in (P, P * 2 + CARD_W):
            self._overlay(cv, cx, CARD_Y, CARD_W, CARD_H, CARD_BG, 0.65)
            self._overlay(cv, cx, CARD_Y, CARD_W, TH, BANNER_BG, 0.82)
            cv.create_line(cx, CARD_Y + TH, cx + CARD_W, CARD_Y + TH, fill=CARD_BDR)
            cv.create_rectangle(cx, CARD_Y, cx + CARD_W, CARD_Y + CARD_H,
                                 outline=CARD_BDR, fill="")

        # ── Banner: icon + title + avatar + user button ──────────────────────────
        try:
            from PIL import Image, ImageTk
            _ico = os.path.join(self._base, "icon.ico")
            _img = Image.open(_ico).resize((28, 28), Image.LANCZOS)
            self._banner_icon = ImageTk.PhotoImage(_img)
            self._cw(cv, tk.Label(cv, image=self._banner_icon, bg=BANNER_BG, bd=0),
                     14, BH // 2, anchor="w")
        except Exception:
            pass

        cv.create_text(50, BH // 2, text="KeystoneClient",
                       fill=ACCENT, font=("Segoe UI", 15, "bold"), anchor="w")

        # Username button — placed first so we can measure its width
        username = self.cfg.get("username", "—")
        self._user_btn = tk.Button(cv, text=f"  {username}  ▾",
                                   bg=BANNER_BG, fg=TEXT, font=("Segoe UI", 10),
                                   relief="flat", bd=0, padx=10, pady=4,
                                   activebackground=CARD_BDR, activeforeground=TEXT,
                                   cursor="hand2", command=self._toggle_user_dropdown)
        self._cw(cv, self._user_btn, W - 14, BH // 2, anchor="e")
        self.root.update_idletasks()

        # Banner avatar — snug to the left of the username button
        BAV_R  = 13
        _btn_w = self._user_btn.winfo_reqwidth()
        BAV_X  = W - 14 - _btn_w - 6 - BAV_R
        BAV_Y  = BH // 2
        self._banner_av_fill_id = cv.create_oval(
            BAV_X - BAV_R, BAV_Y - BAV_R,
            BAV_X + BAV_R, BAV_Y + BAV_R,
            fill="#374151", outline=CARD_BDR)
        self._banner_av_ring_id = cv.create_oval(
            BAV_X - BAV_R, BAV_Y - BAV_R,
            BAV_X + BAV_R, BAV_Y + BAV_R,
            fill="", outline=CARD_BDR)
        for _oid in (self._banner_av_fill_id, self._banner_av_ring_id):
            cv.tag_bind(_oid, "<Button-1>", lambda _e: self._toggle_user_dropdown())
            cv.tag_bind(_oid, "<Enter>",    lambda _e: cv.configure(cursor="hand2"))
            cv.tag_bind(_oid, "<Leave>",    lambda _e: cv.configure(cursor=""))
        self._banner_av_img_id = None
        self._banner_av_x = BAV_X

        # ── Sync card ─────────────────────────────────────────────────────────
        LIST_W  = int(CARD_W * 0.54)     # left section width (character cards)
        STAT_W  = CARD_W - LIST_W        # right section width (sync status)
        STAT_CX = P + LIST_W + STAT_W // 2
        SC_CT   = CARD_Y + TH

        # Title: "Estado de Sincronización"
        cv.create_text(P + 14, CARD_Y + TH // 2, text=self._t("sync_title"),
                       fill=ACCENT, font=("Segoe UI", 10, "bold"), anchor="w")

        # WoW status dot+text right-aligned in title bar
        wow_found = bool(self.cfg.get("wow_path") or wow_path.find_savedvars())
        self._wow_status_id = cv.create_text(
            P + CARD_W - 12, CARD_Y + TH // 2,
            text=f"● {self._t('wow_ok' if wow_found else 'wow_no')}",
            fill=GREEN if wow_found else RED_COL,
            font=("Segoe UI", 8), anchor="e")

        # Dashed divider between list and status panels
        cv.create_line(P + LIST_W, SC_CT + 6, P + LIST_W, CARD_Y + CARD_H - 50,
                       fill=CARD_BDR, dash=(3, 4))

        # ── Sync status (right panel) — vertically centred ───────────────────
        _lbl       = self._t("last_sync_lbl") if self._sync_ok else \
                     (self._sync_primary or self._t("never"))
        _s_avail   = CARD_H - TH - 50          # px available in right panel
        _s_mid     = SC_CT + _s_avail // 2     # vertical centre of panel

        self._sync_icon_id = cv.create_text(
            STAT_CX, _s_mid - 42,
            text="✓" if self._sync_ok else "✗",
            fill=GREEN if self._sync_ok else RED_COL,
            font=("Segoe UI", 32, "bold"), anchor="center")

        self._sync_label_id = cv.create_text(
            STAT_CX, _s_mid + 4,
            text=_lbl, fill=MUTED, font=("Segoe UI", 8), anchor="center")

        self._sync_time_id = cv.create_text(
            STAT_CX, _s_mid + 22,
            text=self._sync_primary if self._sync_ok else "",
            fill=TEXT, font=("Segoe UI", 18, "bold"), anchor="center")

        self._sync_date_id = cv.create_text(
            STAT_CX, _s_mid + 44,
            text=self._sync_secondary if self._sync_ok else "",
            fill=MUTED, font=("Segoe UI", 9), anchor="center")

        # ── Character list (left panel) — scrollable inner canvas ────────────
        _CHAR_CH   = 40
        _CHAR_GAP  = 4
        _VISIBLE   = 4
        _list_vis_h = _VISIBLE * _CHAR_CH + (_VISIBLE - 1) * _CHAR_GAP + 8  # 180px
        _list_inner_w = LIST_W - 8
        self._list_cv = tk.Canvas(cv, bg=CARD_BG, bd=0, highlightthickness=0,
                                   width=_list_inner_w, height=_list_vis_h)
        cv.create_window(P + 4, SC_CT + 6, anchor="nw", window=self._list_cv,
                          width=_list_inner_w, height=_list_vis_h)
        self._list_cv.bind("<Enter>", lambda e: self._list_cv.focus_set())
        self._list_cv.bind("<MouseWheel>",
                            lambda e: self._list_cv.yview_scroll(
                                int(-1 * (e.delta / 120)), "units"))
        self._render_char_list(self._list_cv, _list_inner_w)

        # Sync button (full width, bottom of card)
        self._cw(cv, ttk.Button(cv, text=self._t("sync_btn"), style="Gold.TButton",
                                command=self._manual_sync),
                 P + 10, CARD_Y + CARD_H - 44, anchor="nw", width=CARD_W - 20)

        # ── Addon card ────────────────────────────────────────────────────────
        ACX   = P * 2 + CARD_W
        AC_CT = CARD_Y + TH
        AC_CX = ACX + CARD_W // 2   # card center x

        cv.create_text(ACX + 14, CARD_Y + TH // 2, text=self._t("addon_title"),
                       fill=ACCENT, font=("Segoe UI", 10, "bold"), anchor="w")

        # Vertically center the top content (select btn + entry)
        # in the space above the install button
        install_area = 44 + 10   # install btn height + bottom pad
        avail = CARD_H - TH - install_area          # px available for top content
        block = 32 + 10 + 28                         # select_btn + gap + entry
        top_off = (avail - block) // 2               # top margin within content

        sel_y   = AC_CT + top_off
        entry_y = sel_y + 32 + 10
        msg_y   = entry_y + 28 + 8

        # "Select folder" button (centered)
        sel_btn_w = min(CARD_W - 40, 260)
        self._cw(cv,
                 ttk.Button(cv, text=self._t("sel_folder_btn"), style="Gray.TButton",
                            command=self._browse_addons),
                 AC_CX, sel_y, anchor="n", width=sel_btn_w, height=32)

        # Entry (full width, no browse button)
        self.addons_var = tk.StringVar(value=addon_installer.find_addons_folder() or "")
        self._cw(cv,
                 tk.Entry(cv, textvariable=self.addons_var,
                          bg="#1f2937", fg="white", insertbackground=ACCENT,
                          font=("Segoe UI", 9), relief="flat", bd=1),
                 ACX + 10, entry_y, anchor="nw", width=CARD_W - 20, height=28)

        # Error/status message (canvas text — no bg box)
        self._install_msg_id = cv.create_text(
            AC_CX, msg_y,
            text="", fill=RED_COL, font=("Segoe UI", 9),
            width=CARD_W - 28, justify=tk.CENTER, anchor="n")

        # Custom install button with left-to-right green progress fill
        ibw = CARD_W - 20
        ibh = 36
        ib  = tk.Canvas(cv, width=ibw, height=ibh,
                         bg=ACCENT, highlightthickness=0, cursor="hand2")
        self._install_fill     = ib.create_rectangle(0, 0, 0, ibh, fill=GREEN, outline="")
        self._install_btn_text = ib.create_text(
            ibw // 2, ibh // 2,
            text=self._t("install_btn"), fill=BG_DARK,
            font=("Segoe UI", 10, "bold"))
        ib.tag_raise(self._install_btn_text)
        ib.bind("<Button-1>", lambda e: self._do_install())
        # Hover effect
        ib.bind("<Enter>", lambda e: ib.configure(bg="#fbbf24"))
        ib.bind("<Leave>", lambda e: ib.configure(bg=ACCENT))
        self._install_btn   = ib
        self._install_btn_w = ibw
        self._cw(cv, ib, ACX + 10, CARD_Y + CARD_H - 44, anchor="nw",
                 width=ibw, height=ibh)

        # ── Footer ────────────────────────────────────────────────────────────
        footer = tk.Frame(cv, bg=FOOTER_BG)
        self._cw(cv, footer, 0, H - FH, anchor="nw", width=W, height=FH)

        ttk.Button(footer, text=self._t("open_web"), style="Gray.TButton",
                   command=lambda: webbrowser.open(WEB_URL)).pack(
                       side="left", padx=(14, 0), pady=10)

        self.autostart_var = tk.BooleanVar(value=_get_autostart())
        ttk.Checkbutton(footer, text=self._t("autostart"),
                        variable=self.autostart_var,
                        command=self._toggle_autostart).pack(side="left", padx=(14, 0))

        ttk.Button(footer, text=self._t("minimize"), style="Gold.TButton",
                   command=self._minimize_to_tray).pack(side="right", padx=(0, 14), pady=10)

        cv.bind("<Button-1>", self._on_root_click, add="+")

        # Start background character + avatar load
        threading.Thread(target=self._load_characters, daemon=True).start()

    # ── user dropdown ──────────────────────────────────────────────────────────

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

        # ── Avatar picker ──────────────────────────────────────────────────────
        chars_with_avatar = [c for c in self._characters if c.get("avatarUrl")
                              and self._char_photos.get(c.get("name", ""))]
        if chars_with_avatar:
            PER_PAGE = 3
            total    = len(chars_with_avatar)
            offset   = max(0, min(self._avatar_picker_offset, total - 1))
            self._avatar_picker_offset = offset
            page     = chars_with_avatar[offset:offset + PER_PAGE]
            paginate = total > PER_PAGE

            tk.Label(self._user_dd, text="Avatar de perfil",
                     bg=CARD_BG, fg=MUTED, font=("Segoe UI", 8)).pack(
                         anchor="w", padx=10, pady=(8, 4))

            av_row = tk.Frame(self._user_dd, bg=CARD_BG)
            av_row.pack(anchor="w", padx=10, pady=(0, 8))

            if paginate:
                can_prev = offset > 0
                tk.Button(av_row, text="◀",
                          bg=CARD_BG, fg=TEXT if can_prev else "#4b5563",
                          font=("Segoe UI", 10), relief="flat", bd=0,
                          padx=3, pady=0,
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
                          font=("Segoe UI", 10), relief="flat", bd=0,
                          padx=3, pady=0,
                          cursor="hand2" if can_next else "",
                          activebackground=CARD_BG,
                          command=self._avatar_next if can_next else lambda: None,
                          ).pack(side="left")

            tk.Frame(self._user_dd, bg=CARD_BDR, height=1).pack(fill="x")

        # ── Language ───────────────────────────────────────────────────────────
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

    def _avatar_prev(self):
        self._avatar_picker_offset = max(0, self._avatar_picker_offset - 3)
        self._hide_user_dropdown()
        self._show_user_dropdown()

    def _avatar_next(self):
        chars_with_avatar = [c for c in self._characters if c.get("avatarUrl")
                              and self._char_photos.get(c.get("name", ""))]
        self._avatar_picker_offset = min(
            len(chars_with_avatar) - 1, self._avatar_picker_offset + 3)
        self._hide_user_dropdown()
        self._show_user_dropdown()

    def _hide_user_dropdown(self):
        if self._user_dd:
            try:
                self._user_dd.destroy()
            except Exception:
                pass
            self._user_dd = None
        self._user_dropdown_visible = False

    def _on_root_click(self, event):
        if not self._user_dropdown_visible or not self._user_dd:
            return
        try:
            dx, dy = self._user_dd.winfo_x(), self._user_dd.winfo_y()
            dw, dh = self._user_dd.winfo_width(), self._user_dd.winfo_height()
            if not (dx <= event.x <= dx + dw and dy <= event.y <= dy + dh):
                self._hide_user_dropdown()
        except Exception:
            pass

    def _set_lang(self, lang):
        self._lang = lang
        self.cfg["lang"] = lang
        cfg_module.save(self.cfg)
        self._show_main_view()

    # ── sync ───────────────────────────────────────────────────────────────────

    def _manual_sync(self):
        if self._worker:
            self._worker.force_sync()
            return
        self._update_sync_ui(False, self._t("connecting"))

        def _run():
            try:
                from sync_worker import SyncWorker
                sv_path = self.cfg.get("wow_path") or wow_path.find_savedvars()
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
        """
        ok=True:  primary = time "HH:MM", secondary = date "DD/MM/YYYY"
        ok=False: primary = status/error message
        """
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

    # ── character cards ────────────────────────────────────────────────────────

    def _render_char_list(self, list_cv, list_w):
        """Draw character cards on the inner scroll canvas."""
        CHAR_CW  = list_w - 4
        CHAR_CH  = 40
        CHAR_GAP = 4
        AV       = 30
        RIO_W    = 46   # width reserved on right for score

        chars = self._characters
        n     = len(chars)

        if n == 0:
            list_cv.create_text(
                list_w // 2, 30,
                text="Sin personajes\nsincronizados",
                fill=MUTED, font=("Segoe UI", 9),
                justify="center", anchor="center")
            list_cv.configure(scrollregion=(0, 0, list_w, 60))
            return

        total_h = n * CHAR_CH + (n - 1) * CHAR_GAP + 4
        list_cv.configure(scrollregion=(0, 0, list_w, total_h))

        for i, char in enumerate(chars):
            cy    = 2 + i * (CHAR_CH + CHAR_GAP)
            cx    = 2
            end_x = cx + CHAR_CW
            tag   = f"char_{i}"

            name        = char.get("name") or "?"
            wow_class   = char.get("wowClass") or ""
            class_color = WOW_CLASS_COLORS.get(wow_class, TEXT)
            rio_score   = char.get("rioScore")
            ilvl        = char.get("ilvl")
            region      = (char.get("region") or "eu").lower()
            realm       = (char.get("realm") or "").lower()
            rio_url     = (f"https://raider.io/characters/{region}/"
                           f"{urllib.parse.quote(realm)}/"
                           f"{urllib.parse.quote(name.lower())}")

            # Card background + border
            list_cv.create_rectangle(cx, cy, end_x, cy + CHAR_CH,
                                      fill=CHAR_CARD_BG, outline=CARD_BDR, tags=tag)

            # Avatar circle
            av_cx = cx + 5 + AV // 2
            av_cy = cy + CHAR_CH // 2
            ph = self._char_photos.get(name)
            if ph:
                list_cv.create_image(av_cx, av_cy, anchor="center", image=ph, tags=tag)
            else:
                color = WOW_CLASS_COLORS.get(wow_class, "#4b5563")
                list_cv.create_oval(cx + 5, cy + (CHAR_CH - AV) // 2,
                                     cx + 5 + AV, cy + (CHAR_CH - AV) // 2 + AV,
                                     fill=color, outline="", tags=tag)
                list_cv.create_text(av_cx, av_cy, text=name[0].upper(),
                                     fill=BG_DARK, font=("Segoe UI", 11, "bold"),
                                     anchor="center", tags=tag)

            # Text area (between avatar and RIO column)
            txt_x = cx + 5 + AV + 8

            # Name — top half, class colour
            list_cv.create_text(txt_x, cy + 12,
                                  text=name[:15], fill=class_color,
                                  font=("Segoe UI", 9, "bold"), anchor="w", tags=tag)

            # ilvl — bottom half, muted
            ilvl_txt = f"ilvl {ilvl}" if ilvl else "—"
            list_cv.create_text(txt_x, cy + CHAR_CH - 12,
                                  text=ilvl_txt, fill=MUTED,
                                  font=("Segoe UI", 8), anchor="w", tags=tag)

            # RIO score — right column, big, colour-coded
            rio_cx = end_x - RIO_W // 2 - 2
            if rio_score:
                list_cv.create_text(rio_cx, cy + CHAR_CH // 2,
                                     text=f"{int(rio_score)}",
                                     fill=_rio_color(rio_score),
                                     font=("Segoe UI", 12, "bold"),
                                     anchor="center", tags=tag)
            else:
                list_cv.create_text(rio_cx, cy + CHAR_CH // 2,
                                     text="—", fill=MUTED,
                                     font=("Segoe UI", 11), anchor="center", tags=tag)

            # Click → Raider.IO profile
            list_cv.tag_bind(tag, "<Button-1>",
                              lambda _e, url=rio_url: webbrowser.open(url))
            list_cv.tag_bind(tag, "<Enter>",
                              lambda _e, lc=list_cv: lc.configure(cursor="hand2"))
            list_cv.tag_bind(tag, "<Leave>",
                              lambda _e, lc=list_cv: lc.configure(cursor=""))

    def _refresh_char_list(self):
        """Clear and re-draw character cards in the inner scroll canvas."""
        lc = getattr(self, "_list_cv", None)
        if not (lc and lc.winfo_exists()):
            return
        lc.delete("all")
        W            = self._W
        CARD_W       = (W - P * 3) // 2
        LIST_INNER_W = int(CARD_W * 0.54) - 8
        self._render_char_list(lc, LIST_INNER_W)

    def _download_avatar(self, url: str, size: int = 30):
        """Download URL, return circular PIL PhotoImage or None."""
        try:
            import io
            from PIL import Image, ImageTk, ImageDraw
            resp = requests.get(url, timeout=8)
            resp.raise_for_status()
            img  = Image.open(io.BytesIO(resp.content)).resize((size, size), Image.LANCZOS).convert("RGBA")
            mask = Image.new("L", (size, size), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
            base = Image.new("RGBA", (size, size), (17, 26, 38, 255))
            base.paste(img, (0, 0), mask)
            return ImageTk.PhotoImage(base.convert("RGB"))
        except Exception:
            return None

    def _load_characters(self):
        """Background: fetch characters from API, enrich missing RIO data, download avatars."""
        try:
            token = self.cfg.get("access_token") or self.cfg.get("sync_token", "")
            if not token:
                return
            headers     = {"Authorization": f"Bearer {token}"}
            sync_hdrs   = {"Authorization": f"Bearer {self.cfg.get('sync_token', '')}",
                           "Content-Type": "application/json"}
            api_url     = self.cfg["api_url"]

            r = requests.get(f"{api_url}/api/me/characters", headers=headers, timeout=10)
            if not r.ok:
                return
            chars = r.json()

            # Enrich chars that lack RIO data by calling Raider.IO directly
            from sync_worker import SyncWorker
            _sw = SyncWorker(self.cfg)
            enriched_any = False
            for c in chars:
                if c.get("avatarUrl") and c.get("rioScore") and c.get("wowClass") and c.get("ilvl"):
                    continue
                av, score, klass, ilvl = _sw._fetch_raiderio(
                    c.get("name", ""), c.get("realm", ""), c.get("region", "eu"))
                if av:
                    c["avatarUrl"] = av
                if score is not None:
                    c["rioScore"] = score
                if klass:
                    c["wowClass"] = klass
                if ilvl is not None:
                    c["ilvl"] = ilvl
                # Persist enrichment to server (no keystone side-effect)
                if av or score or klass or ilvl:
                    try:
                        requests.post(
                            f"{api_url}/api/me/characters/enrich",
                            json={"name": c.get("name"), "realm": c.get("realm"),
                                  "region": c.get("region", "eu"),
                                  "avatarUrl": av, "rioScore": score, "wowClass": klass,
                                  "ilvl": ilvl},
                            headers=sync_hdrs, timeout=8)
                        enriched_any = True
                    except Exception:
                        pass

            chars = sorted(chars, key=lambda c: (c.get("rioScore") or 0), reverse=True)
            self._characters = chars

            # Download avatar images
            for c in self._characters:
                url  = c.get("avatarUrl")
                name = c.get("name", "")
                if url and name not in self._char_photos:
                    ph = self._download_avatar(url, size=30)
                    if ph:
                        self._char_photos[name] = ph

            self.root.after(0, self._refresh_char_list)

            # Banner avatar
            profile_url = self.cfg.get("avatar_url") or self._selected_avatar_url
            if profile_url and not self._profile_photo:
                ph = self._download_avatar(profile_url, size=26)
                if ph:
                    self._profile_photo = ph
                    self.root.after(0, self._update_banner_avatar_ui)
        except Exception:
            pass

    def _update_banner_avatar_ui(self):
        """Replace banner placeholder circle with the profile avatar image."""
        cv = self._cv
        if not (cv and cv.winfo_exists()) or not self._profile_photo:
            return
        x = getattr(self, "_banner_av_x", self._W - 14 - 140)
        R = 13
        # Delete previous image and placeholder
        for attr in ("_banner_av_img_id", "_banner_av_fill_id", "_banner_av_ring_id"):
            _id = getattr(self, attr, None)
            if _id:
                try:
                    cv.delete(_id)
                except Exception:
                    pass
                setattr(self, attr, None)
        # Draw image and ring
        self._banner_av_img_id = cv.create_image(x, BH // 2,
                                                   anchor="center",
                                                   image=self._profile_photo)
        self._banner_av_ring_id = cv.create_oval(
            x - R, BH // 2 - R, x + R, BH // 2 + R,
            fill="", outline=CARD_BDR)
        # Re-bind click on ring
        cv.tag_bind(self._banner_av_ring_id, "<Button-1>",
                    lambda _e: self._toggle_user_dropdown())
        cv.tag_bind(self._banner_av_img_id, "<Button-1>",
                    lambda _e: self._toggle_user_dropdown())
        cv.tag_bind(self._banner_av_img_id, "<Enter>",
                    lambda _e: cv.configure(cursor="hand2"))
        cv.tag_bind(self._banner_av_img_id, "<Leave>",
                    lambda _e: cv.configure(cursor=""))

    def _select_avatar(self, url: str):
        """Set character avatar as profile picture. Updates UI immediately, persists to API."""
        self._hide_user_dropdown()
        # Save locally at once so config persists even if API call fails
        self.cfg["avatar_url"]    = url
        self._selected_avatar_url = url
        cfg_module.save(self.cfg)

        def _do():
            # Download image first, update banner
            ph = self._download_avatar(url, size=26)
            if ph:
                self._profile_photo = ph
                self.root.after(0, self._update_banner_avatar_ui)
            # Then persist to server (fire-and-forget)
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

    # ── addon ──────────────────────────────────────────────────────────────────

    def _browse_addons(self):
        folder = filedialog.askdirectory(title="Selecciona la carpeta AddOns")
        if folder and self.addons_var:
            self.addons_var.set(folder)

    def _set_install_progress(self, val):
        ib = self._install_btn
        if not (ib and ib.winfo_exists()):
            return
        fill_w = max(0, int(self._install_btn_w * val / 100))
        ib.coords(self._install_fill, 0, 0, fill_w, 36)

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
        except Exception as e:
            self._set_install_progress(0)
            self._set_install_msg(f"Error: {e}")

    def _toggle_autostart(self):
        _set_autostart(self.autostart_var.get())

    # ── logout ─────────────────────────────────────────────────────────────────

    def _logout(self):
        self._hide_user_dropdown()
        if self._worker: self._worker.stop(); self._worker = None
        if self._tray:   self._tray.stop();   self._tray   = None
        self.cfg.update({"sync_token": None, "access_token": None,
                         "login_at": None, "username": None, "avatar_url": None})
        cfg_module.save(self.cfg)
        self._characters          = []
        self._char_photos         = {}
        self._profile_photo       = None
        self._selected_avatar_url = None
        self._avatar_picker_offset = 0
        self._show_login_view()

    # ── tray ───────────────────────────────────────────────────────────────────

    def _minimize_to_tray(self):
        if not self.cfg.get("wow_path"):
            path = wow_path.find_savedvars()
            if path:
                self.cfg["wow_path"] = path
                cfg_module.save(self.cfg)
        if self._tray is None:
            self._start_background_services()
        self.root.withdraw()

    def _start_background_services(self):
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
            # Refresh character cards with updated scores/avatars
            threading.Thread(target=self._load_characters, daemon=True).start()

        self._worker.on_sync  = _on_sync
        self._worker.on_error = lambda msg: self._tray.set_status(f"Error: {msg[:50]}")
        self._worker.start()
        self._tray.run_detached()

    def _show_from_tray(self):
        self.root.after(0, self.root.deiconify)
        self.root.after(0, self.root.lift)
        self.root.after(0, self.root.focus_force)

    def _quit(self):
        if self._worker: self._worker.stop()
        self.root.after(0, self.root.destroy)

    # ── close button ───────────────────────────────────────────────────────────

    def _on_close_btn(self):
        if not cfg_module.is_session_valid(self.cfg):
            self.root.destroy()
            return
        if self.root.state() == "iconic":
            return
        self._show_minimized_dialog()

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
