import tkinter as tk
from tkinter import ttk, filedialog
import requests
import time
import config as cfg_module
import addon_installer
import wow_path


class MainWindow:
    def __init__(self):
        self.cfg = cfg_module.load()
        self._result = None

        self.root = tk.Tk()
        self.root.title("KeystoneClient")
        self.root.resizable(False, False)
        self.root.eval("tk::PlaceWindow . center")
        self.root.configure(bg="#111827")
        self.root.protocol("WM_DELETE_WINDOW", self.root.destroy)  # overridden in main view

        self._setup_styles()

        tk.Label(self.root, text="KeystoneClient", bg="#111827", fg="#f59e0b",
                 font=("Segoe UI", 18, "bold")).pack(pady=(20, 4))

        self.frame = tk.Frame(self.root, bg="#111827", padx=30, pady=10)
        self.frame.pack(fill="both", expand=True)

        if cfg_module.is_session_valid(self.cfg):
            self._show_main_view()
        else:
            self._show_login_view()

    def _setup_styles(self):
        s = ttk.Style(self.root)
        s.theme_use("clam")
        s.configure("TLabel", background="#111827", foreground="#d1d5db", font=("Segoe UI", 10))
        s.configure("TEntry", fieldbackground="#1f2937", foreground="white", font=("Segoe UI", 10))
        s.configure("Gold.TButton", background="#f59e0b", foreground="#111827",
                    font=("Segoe UI", 10, "bold"), padding=8)
        s.map("Gold.TButton", background=[("active", "#fbbf24")])
        s.configure("Gray.TButton", background="#374151", foreground="white",
                    font=("Segoe UI", 10), padding=8)
        s.map("Gray.TButton", background=[("active", "#4b5563")])

    def _clear(self):
        for w in self.frame.winfo_children():
            w.destroy()

    # --- Login view ---

    def _show_login_view(self):
        self.root.geometry("360x260")
        self._clear()

        ttk.Label(self.frame, text="Usuario").grid(row=0, column=0, sticky="w", pady=5)
        self.username_var = tk.StringVar()
        entry = ttk.Entry(self.frame, textvariable=self.username_var, width=24)
        entry.grid(row=0, column=1, pady=5, padx=(10, 0))
        entry.focus()

        ttk.Label(self.frame, text="Contraseña").grid(row=1, column=0, sticky="w", pady=5)
        self.password_var = tk.StringVar()
        ttk.Entry(self.frame, textvariable=self.password_var, show="*", width=24).grid(
            row=1, column=1, pady=5, padx=(10, 0))

        self.login_error = tk.StringVar()
        tk.Label(self.frame, textvariable=self.login_error, bg="#111827", fg="#f87171",
                 font=("Segoe UI", 9)).grid(row=2, column=0, columnspan=2, pady=3)

        ttk.Button(self.frame, text="Entrar", style="Gold.TButton",
                   command=self._login).grid(row=3, column=0, columnspan=2, sticky="ew", pady=5)

        tk.Label(self.frame, text="¿Sin cuenta? Regístrate en weekly-char.vercel.app",
                 bg="#111827", fg="#6b7280", font=("Segoe UI", 8)).grid(
            row=4, column=0, columnspan=2, pady=(4, 0))

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

    # --- Main view ---

    def _show_main_view(self):
        self.root.geometry("400x300")
        self._clear()
        self.root.protocol("WM_DELETE_WINDOW", self._go_to_tray)

        username = self.cfg.get("username", "usuario")
        tk.Label(self.frame, text=f"Conectado como {username}", bg="#111827", fg="#34d399",
                 font=("Segoe UI", 10)).grid(row=0, column=0, columnspan=3, pady=(0, 14))

        tk.Label(self.frame, text="Carpeta AddOns de WoW:", bg="#111827", fg="#9ca3af",
                 font=("Segoe UI", 9)).grid(row=1, column=0, columnspan=3, sticky="w")

        self.addons_var = tk.StringVar(value=addon_installer.find_addons_folder() or "")
        ttk.Entry(self.frame, textvariable=self.addons_var, width=32).grid(
            row=2, column=0, columnspan=2, sticky="ew", pady=(4, 0))
        ttk.Button(self.frame, text="...", style="Gray.TButton",
                   command=self._browse).grid(row=2, column=2, pady=(4, 0), padx=(6, 0))

        self.addon_status = tk.StringVar()
        self.addon_status_label = tk.Label(self.frame, textvariable=self.addon_status,
                                           bg="#111827", fg="#6b7280",
                                           font=("Segoe UI", 9), wraplength=340)
        self.addon_status_label.grid(row=3, column=0, columnspan=3, pady=5)

        ttk.Button(self.frame, text="Instalar / Actualizar Addon", style="Gray.TButton",
                   command=self._install_addon).grid(
            row=4, column=0, columnspan=3, sticky="ew", pady=(0, 8))

        ttk.Button(self.frame, text="Minimizar a la bandeja y sincronizar",
                   style="Gold.TButton", command=self._go_to_tray).grid(
            row=5, column=0, columnspan=3, sticky="ew")

        self.frame.columnconfigure(0, weight=1)

    def _browse(self):
        folder = filedialog.askdirectory(title="Selecciona la carpeta AddOns")
        if folder:
            self.addons_var.set(folder)

    def _install_addon(self):
        path = self.addons_var.get().strip()
        if not path:
            self.addon_status.set("Selecciona la carpeta AddOns primero.")
            self.addon_status_label.config(fg="#f87171")
            return
        try:
            dest = addon_installer.install(path)
            self.addon_status.set(f"✓ Instalado correctamente")
            self.addon_status_label.config(fg="#34d399")
        except Exception as e:
            self.addon_status.set(f"Error: {e}")
            self.addon_status_label.config(fg="#f87171")

    def _go_to_tray(self):
        if not self.cfg.get("wow_path"):
            path = wow_path.find_savedvars()
            if path:
                self.cfg["wow_path"] = path
                cfg_module.save(self.cfg)
        self._result = "tray"
        self.root.destroy()

    def run(self) -> str | None:
        self.root.mainloop()
        return self._result
