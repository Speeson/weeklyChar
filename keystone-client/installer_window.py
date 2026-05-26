import tkinter as tk
from tkinter import ttk, filedialog
import addon_installer


def show_installer_window():
    root = tk.Tk()
    root.title("Instalar Addon — KeystoneClient")
    root.resizable(False, False)
    root.geometry("460x220")
    root.eval("tk::PlaceWindow . center")
    root.configure(bg="#111827")

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure("TLabel", background="#111827", foreground="#d1d5db", font=("Segoe UI", 10))
    style.configure("TEntry", fieldbackground="#1f2937", foreground="white", font=("Segoe UI", 10))
    style.configure("TButton", background="#f59e0b", foreground="#111827",
                    font=("Segoe UI", 10, "bold"), padding=6)
    style.map("TButton", background=[("active", "#fbbf24")])
    style.configure("Gray.TButton", background="#374151", foreground="white",
                    font=("Segoe UI", 10), padding=6)
    style.map("Gray.TButton", background=[("active", "#4b5563")])

    frame = tk.Frame(root, bg="#111827", padx=24, pady=20)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="Instalar KeystoneSync", bg="#111827", fg="#f59e0b",
             font=("Segoe UI", 13, "bold")).grid(row=0, column=0, columnspan=3,
                                                  sticky="w", pady=(0, 16))

    tk.Label(frame, text="Carpeta AddOns:", bg="#111827", fg="#9ca3af",
             font=("Segoe UI", 9)).grid(row=1, column=0, sticky="w", pady=(0, 4))

    detected = addon_installer.find_addons_folder() or ""
    path_var = tk.StringVar(value=detected)

    path_entry = ttk.Entry(frame, textvariable=path_var, width=40)
    path_entry.grid(row=2, column=0, columnspan=2, sticky="ew", padx=(0, 8))

    def browse():
        folder = filedialog.askdirectory(title="Selecciona la carpeta AddOns de WoW")
        if folder:
            path_var.set(folder)

    ttk.Button(frame, text="Examinar", style="Gray.TButton", command=browse).grid(
        row=2, column=2, sticky="ew"
    )

    status_var = tk.StringVar()
    status_label = tk.Label(frame, textvariable=status_var, bg="#111827",
                            fg="#6b7280", font=("Segoe UI", 9), wraplength=400)
    status_label.grid(row=3, column=0, columnspan=3, sticky="w", pady=(10, 0))

    def install():
        path = path_var.get().strip()
        if not path:
            status_var.set("Selecciona la carpeta AddOns primero.")
            status_label.config(fg="#f87171")
            return
        try:
            dest = addon_installer.install(path)
            status_var.set(f"Instalado correctamente en:\n{dest}")
            status_label.config(fg="#34d399")
        except Exception as e:
            status_var.set(f"Error: {e}")
            status_label.config(fg="#f87171")

    ttk.Button(frame, text="Instalar KeystoneSync", command=install).grid(
        row=4, column=0, columnspan=3, sticky="ew", pady=(14, 0)
    )

    frame.columnconfigure(0, weight=1)
    root.mainloop()
