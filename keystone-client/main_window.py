import time
import tkinter as tk
from tkinter import ttk, filedialog
import webbrowser
import winreg
import requests

import config as cfg_module
import addon_installer
import wow_path

REGISTER_URL = "https://weekly-char.vercel.app/login"
WEB_URL      = "https://weekly-char.vercel.app"
AUTOSTART_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
AUTOSTART_NAME = "KeystoneClient"


def _set_autostart(enabled: bool):
    import sys
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


def _get_autostart() -> bool:
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
        self._worker = None
        self._tray = None
        self._addon_panel_visible = False
        self._sync_status = "Sin sincronizar"

        self.root = tk.Tk()
        self.root.title("KeystoneClient")
        self.root.resizable(False, False)
        self.root.configure(bg="#111827")
        self.root.protocol("WM_DELETE_WINDOW", self._on_close_btn)

        import sys as _sys, os as _os
        _base = getattr(_sys, '_MEIPASS', _os.path.dirname(_os.path.abspath(__file__)))
        _icon = _os.path.join(_base, 'icon.ico')
        if _os.path.exists(_icon):
            self.root.iconbitmap(_icon)

        self._setup_styles()

        if cfg_module.is_session_valid(self.cfg):
            self._show_main_view()
        else:
            self._show_login_view()

        self.root.eval("tk::PlaceWindow . center")

    # ------------------------------------------------------------------ styles

    def _setup_styles(self):
        s = ttk.Style(self.root)
        s.theme_use("clam")
        s.configure("TLabel",       background="#111827", foreground="#d1d5db", font=("Segoe UI", 10))
        s.configure("TEntry",       fieldbackground="#1f2937", foreground="white", font=("Segoe UI", 10))
        s.configure("TCheckbutton", background="#111827", foreground="#9ca3af", font=("Segoe UI", 9))
        s.map("TCheckbutton",       background=[("active", "#111827")])

        s.configure("Gold.TButton", background="#f59e0b", foreground="#111827",
                    font=("Segoe UI", 10, "bold"), padding=8)
        s.map("Gold.TButton",       background=[("active", "#fbbf24")])

        s.configure("Gray.TButton", background="#374151", foreground="white",
                    font=("Segoe UI", 10), padding=8)
        s.map("Gray.TButton",       background=[("active", "#4b5563")])

        s.configure("Red.TButton",  background="#991b1b", foreground="white",
                    font=("Segoe UI", 9, "bold"), padding=4)
        s.map("Red.TButton",        background=[("active", "#dc2626")])

        s.configure("Link.TButton", background="#111827", foreground="#6b7280",
                    font=("Segoe UI", 9), relief="flat", padding=2)
        s.map("Link.TButton",       foreground=[("active", "#f59e0b")],
                                    background=[("active", "#111827")])

        s.configure("Gray.Horizontal.TProgressbar",  troughcolor="#1f2937", background="#374151")
        s.configure("Green.Horizontal.TProgressbar", troughcolor="#1f2937", background="#10b981")

    # ------------------------------------------------------------------ helpers

    def _clear(self):
        for w in self.root.winfo_children():
            w.destroy()

    def _make_entry(self, parent, textvariable, show=None):
        """Bordered, padded entry field."""
        border = tk.Frame(parent, bg="#374151", padx=2, pady=2)
        inner = tk.Frame(border, bg="#1f2937")
        inner.pack(fill="both", expand=True)
        e = tk.Entry(inner, textvariable=textvariable, show=show,
                     bg="#1f2937", fg="white", insertbackground="#f59e0b",
                     font=("Segoe UI", 12), relief="flat", bd=0)
        e.pack(fill="both", expand=True, padx=10, pady=9)
        return border, e

    # ================================================================ LOGIN VIEW

    def _show_login_view(self):
        self._clear()
        self.root.geometry("520x420")

        outer = tk.Frame(self.root, bg="#111827")
        outer.pack(fill="both", expand=True, padx=50, pady=36)

        # Title + subtitle
        tk.Label(outer, text="KeystoneClient", bg="#111827", fg="#f59e0b",
                 font=("Segoe UI", 24, "bold")).pack(anchor="w")
        tk.Label(outer, text="Inicia sesión para continuar", bg="#111827", fg="#6b7280",
                 font=("Segoe UI", 10)).pack(anchor="w", pady=(2, 24))

        # Username
        tk.Label(outer, text="Usuario", bg="#111827", fg="#d1d5db",
                 font=("Segoe UI", 11)).pack(anchor="w")
        self.username_var = tk.StringVar()
        u_border, u_entry = self._make_entry(outer, self.username_var)
        u_border.pack(fill="x", pady=(4, 14))
        u_entry.focus()

        # Password
        tk.Label(outer, text="Contraseña", bg="#111827", fg="#d1d5db",
                 font=("Segoe UI", 11)).pack(anchor="w")
        self.password_var = tk.StringVar()
        p_border, _ = self._make_entry(outer, self.password_var, show="*")
        p_border.pack(fill="x", pady=(4, 6))

        self.login_error = tk.StringVar()
        tk.Label(outer, textvariable=self.login_error, bg="#111827", fg="#f87171",
                 font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 10))

        btn_frame = tk.Frame(outer, bg="#111827")
        btn_frame.pack(fill="x")
        ttk.Button(btn_frame, text="Entrar", style="Gold.TButton",
                   command=self._login).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Button(btn_frame, text="Registrarse", style="Gray.TButton",
                   command=lambda: webbrowser.open(REGISTER_URL)).pack(side="left", fill="x", expand=True)

        self.root.bind("<Return>", lambda _: self._login())

    def _login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get()
        if not username or not password:
            self.login_error.set("Introduce usuario y contraseña.")
            return
        self.login_error.set("Conectando...")
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
            self.cfg["sync_token"] = me["syncToken"]
            self.cfg["username"] = me["username"]
            self.cfg["login_at"] = time.time()
            cfg_module.save(self.cfg)
            self.root.unbind("<Return>")
            self._show_main_view()
        except requests.exceptions.ConnectionError:
            self.login_error.set("No se puede conectar con la API.")
        except Exception as e:
            self.login_error.set(f"Error: {e}")

    # ================================================================ MAIN VIEW

    def _show_main_view(self):
        self._clear()
        self.root.geometry("560x460")
        self._addon_panel_visible = False

        root_frame = tk.Frame(self.root, bg="#111827")
        root_frame.pack(fill="both", expand=True, padx=30, pady=20)

        # --- Header row ---
        header = tk.Frame(root_frame, bg="#111827")
        header.pack(fill="x", pady=(0, 16))

        tk.Label(header, text="KeystoneClient", bg="#111827", fg="#f59e0b",
                 font=("Segoe UI", 20, "bold")).pack(side="left")

        ttk.Button(header, text="Cerrar sesión", style="Red.TButton",
                   command=self._logout).pack(side="right", padx=(8, 0))
        tk.Label(header, text=f"@{self.cfg.get('username', '')}",
                 bg="#111827", fg="#9ca3af", font=("Segoe UI", 10)).pack(side="right")

        # --- WoW status row ---
        wow_found = bool(self.cfg.get("wow_path") or wow_path.find_savedvars())
        wow_color = "#10b981" if wow_found else "#f87171"
        wow_text  = "WoW detectado" if wow_found else "WoW no encontrado"
        status_row = tk.Frame(root_frame, bg="#111827")
        status_row.pack(fill="x", pady=(0, 4))
        tk.Label(status_row, text="●", bg="#111827", fg=wow_color,
                 font=("Segoe UI", 11)).pack(side="left")
        tk.Label(status_row, text=f" {wow_text}", bg="#111827", fg="#6b7280",
                 font=("Segoe UI", 10)).pack(side="left")

        # --- Sync status ---
        self.sync_status_var = tk.StringVar(value=self._sync_status)
        tk.Label(root_frame, textvariable=self.sync_status_var,
                 bg="#111827", fg="#6b7280", font=("Segoe UI", 10),
                 anchor="w").pack(fill="x", pady=(0, 16))

        # --- Addon section toggle button ---
        self.addon_toggle_btn = ttk.Button(root_frame, text="▶  Instalar / Actualizar Addon",
                                           style="Gray.TButton", command=self._toggle_addon_panel)
        self.addon_toggle_btn.pack(fill="x", pady=(0, 2))

        # --- Collapsible addon panel ---
        self.addon_panel = tk.Frame(root_frame, bg="#1f2937", padx=16, pady=12)

        tk.Label(self.addon_panel, text="Carpeta AddOns de WoW:", bg="#1f2937", fg="#9ca3af",
                 font=("Segoe UI", 9)).pack(anchor="w")

        path_row = tk.Frame(self.addon_panel, bg="#1f2937")
        path_row.pack(fill="x", pady=(4, 10))
        self.addons_var = tk.StringVar(value=addon_installer.find_addons_folder() or "")
        ttk.Entry(path_row, textvariable=self.addons_var).pack(side="left", fill="x", expand=True)
        ttk.Button(path_row, text="...", style="Gray.TButton",
                   command=self._browse_addons, width=3).pack(side="left", padx=(6, 0))

        self.progress_var = tk.IntVar(value=0)
        self.progress_bar = ttk.Progressbar(self.addon_panel, variable=self.progress_var,
                                             maximum=100, style="Gray.Horizontal.TProgressbar")
        self.progress_bar.pack(fill="x", pady=(0, 6))

        self.install_status_var = tk.StringVar()
        tk.Label(self.addon_panel, textvariable=self.install_status_var,
                 bg="#1f2937", fg="#6b7280", font=("Segoe UI", 9)).pack(anchor="w", pady=(0, 6))

        ttk.Button(self.addon_panel, text="Instalar / Actualizar",
                   style="Gold.TButton", command=self._do_install).pack(fill="x")

        # Collapse panel when clicking outside it
        root_frame.bind("<Button-1>", self._on_outer_click)
        for widget in [header, status_row]:
            widget.bind("<Button-1>", self._on_outer_click)

        # --- Bottom area ---
        bottom = tk.Frame(root_frame, bg="#111827")
        bottom.pack(fill="x", side="bottom", pady=(16, 0))

        ttk.Button(bottom, text="🌐  Abrir web", style="Gray.TButton",
                   command=lambda: webbrowser.open(WEB_URL)).pack(side="left")

        self.autostart_var = tk.BooleanVar(value=_get_autostart())
        ttk.Checkbutton(bottom, text="Arrancar con Windows",
                        variable=self.autostart_var,
                        command=self._toggle_autostart).pack(side="left", padx=(12, 0))

        ttk.Button(bottom, text="Minimizar a la bandeja",
                   style="Gold.TButton", command=self._minimize_to_tray).pack(side="right")

    def _on_outer_click(self, event):
        if self._addon_panel_visible:
            self._hide_addon_panel()

    def _toggle_addon_panel(self):
        if self._addon_panel_visible:
            self._hide_addon_panel()
        else:
            self._show_addon_panel()

    def _show_addon_panel(self):
        self.addon_panel.pack(fill="x", pady=(0, 2))
        self.addon_toggle_btn.configure(text="▼  Instalar / Actualizar Addon")
        self._addon_panel_visible = True
        self.root.geometry("560x560")

    def _hide_addon_panel(self):
        self.addon_panel.pack_forget()
        self.addon_toggle_btn.configure(text="▶  Instalar / Actualizar Addon")
        self._addon_panel_visible = False
        self.root.geometry("560x460")

    def _browse_addons(self):
        folder = filedialog.askdirectory(title="Selecciona la carpeta AddOns")
        if folder:
            self.addons_var.set(folder)

    def _do_install(self):
        path = self.addons_var.get().strip()
        if not path:
            self.install_status_var.set("Selecciona la carpeta AddOns primero.")
            return
        self.progress_var.set(0)
        self.progress_bar.configure(style="Gray.Horizontal.TProgressbar")
        self.install_status_var.set("Instalando...")
        self.root.update()
        try:
            self.progress_var.set(40)
            self.root.update()
            addon_installer.install(path)
            self.progress_var.set(100)
            self.progress_bar.configure(style="Green.Horizontal.TProgressbar")
            self.install_status_var.set("✓ Instalado correctamente")
        except Exception as e:
            self.progress_var.set(0)
            self.install_status_var.set(f"Error: {e}")

    def _toggle_autostart(self):
        _set_autostart(self.autostart_var.get())

    def _logout(self):
        if self._worker:
            self._worker.stop()
            self._worker = None
        if self._tray:
            self._tray.stop()
            self._tray = None
        self.cfg["sync_token"] = None
        self.cfg["login_at"] = None
        self.cfg["username"] = None
        cfg_module.save(self.cfg)
        self._show_login_view()

    # ================================================================ TRAY

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
        self._tray = TrayApp(
            self.cfg,
            self._worker,
            on_open=self._show_from_tray,
            on_quit=self._quit,
        )

        def _on_sync(chars):
            names = ", ".join(chars)
            ts = time.strftime("%H:%M")
            self._sync_status = f"Última sync: {ts} — {names}"
            self._tray.set_status(f"Sync: {names}")
            if hasattr(self, "sync_status_var"):
                self.root.after(0, lambda: self.sync_status_var.set(self._sync_status))

        self._worker.on_sync = _on_sync
        self._worker.on_error = lambda msg: self._tray.set_status(f"Error: {msg[:50]}")
        self._worker.start()
        self._tray.run_detached()

    def _show_from_tray(self):
        self.root.after(0, self.root.deiconify)
        self.root.after(0, self.root.lift)
        self.root.after(0, self.root.focus_force)

    def _quit(self):
        if self._worker:
            self._worker.stop()
        self.root.after(0, self.root.destroy)

    # ================================================================ CLOSE BUTTON

    def _on_close_btn(self):
        if not cfg_module.is_session_valid(self.cfg):
            self.root.destroy()
            return
        self._show_minimized_dialog()

    def _show_minimized_dialog(self):
        dlg = tk.Toplevel(self.root)
        dlg.title("KeystoneClient")
        dlg.configure(bg="#111827")
        dlg.resizable(False, False)
        dlg.transient(self.root)
        dlg.grab_set()

        f = tk.Frame(dlg, bg="#111827", padx=32, pady=28)
        f.pack()

        tk.Label(f, text="Minimizado a la bandeja", bg="#111827", fg="#f59e0b",
                 font=("Segoe UI", 13, "bold")).pack(pady=(0, 10))
        tk.Label(f, text="KeystoneClient sigue corriendo en la bandeja\ndel sistema. Haz clic en el icono para volver.",
                 bg="#111827", fg="#9ca3af", font=("Segoe UI", 11), justify="center").pack(pady=(0, 20))

        ttk.Button(f, text="Entendido", style="Gold.TButton",
                   command=lambda: (dlg.destroy(), self._minimize_to_tray())).pack(fill="x")

        # Center over parent window
        dlg.update_idletasks()
        px = self.root.winfo_x()
        py = self.root.winfo_y()
        pw = self.root.winfo_width()
        ph = self.root.winfo_height()
        dw = dlg.winfo_width()
        dh = dlg.winfo_height()
        dlg.geometry(f"+{px + (pw - dw) // 2}+{py + (ph - dh) // 2}")

    # ================================================================ RUN

    def run(self):
        self.root.mainloop()
