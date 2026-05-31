import tkinter as tk
from tkinter import ttk
import requests


def show_login_window(api_url: str) -> dict | None:
    result = {}

    root = tk.Tk()
    root.title("KeystoneClient")
    root.resizable(False, False)
    root.geometry("340x230")
    root.eval("tk::PlaceWindow . center")
    root.configure(bg="#111827")

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure("TLabel", background="#111827", foreground="#d1d5db", font=("Segoe UI", 10))
    style.configure("TEntry", fieldbackground="#1f2937", foreground="white", font=("Segoe UI", 10))
    style.configure("TButton", background="#f59e0b", foreground="#111827", font=("Segoe UI", 10, "bold"), padding=6)
    style.map("TButton", background=[("active", "#fbbf24")])

    frame = tk.Frame(root, bg="#111827", padx=30, pady=20)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="KeystoneClient", bg="#111827", fg="#f59e0b",
             font=("Segoe UI", 16, "bold")).grid(row=0, column=0, columnspan=2, pady=(0, 18))

    ttk.Label(frame, text="Usuario").grid(row=1, column=0, sticky="w", pady=4)
    username_var = tk.StringVar()
    username_entry = ttk.Entry(frame, textvariable=username_var, width=22)
    username_entry.grid(row=1, column=1, pady=4, padx=(10, 0))
    username_entry.focus()

    ttk.Label(frame, text="Contraseña").grid(row=2, column=0, sticky="w", pady=4)
    password_var = tk.StringVar()
    ttk.Entry(frame, textvariable=password_var, show="*", width=22).grid(row=2, column=1, pady=4, padx=(10, 0))

    error_var = tk.StringVar()
    tk.Label(frame, textvariable=error_var, bg="#111827", fg="#f87171",
             font=("Segoe UI", 9)).grid(row=3, column=0, columnspan=2, pady=4)

    def attempt_login():
        username = username_var.get().strip()
        password = password_var.get()
        if not username or not password:
            error_var.set("Introduce usuario y contraseña.")
            return
        error_var.set("Conectando...")
        root.update()
        try:
            r = requests.post(
                f"{api_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10,
            )
            if not r.ok:
                error_var.set(r.json().get("detail", "Error de login."))
                return
            token = r.json()["accessToken"]
            me = requests.get(
                f"{api_url}/api/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            ).json()
            result["sync_token"] = me["syncToken"]
            result["username"] = me["username"]
            root.destroy()
        except requests.exceptions.ConnectionError:
            error_var.set("No se puede conectar con la API.")
        except Exception as e:
            error_var.set(f"Error: {e}")

    root.bind("<Return>", lambda _: attempt_login())
    ttk.Button(frame, text="Entrar", command=attempt_login).grid(
        row=4, column=0, columnspan=2, pady=(8, 0), sticky="ew"
    )

    tk.Label(frame, text="¿No tienes cuenta? Regístrate en keystonesync.esgarpe.dev",
             bg="#111827", fg="#6b7280", font=("Segoe UI", 8)).grid(
        row=5, column=0, columnspan=2, pady=(8, 0)
    )

    root.mainloop()
    return result if result else None
