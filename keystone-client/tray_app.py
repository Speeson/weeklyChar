import threading
import pystray
from PIL import Image, ImageDraw


def _make_icon() -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy, r = 32, 32, 26
    draw.polygon(
        [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)],
        fill="#F59E0B",
    )
    return img


class TrayApp:
    def __init__(self, config: dict, worker):
        self.config = config
        self.worker = worker
        self._status = "Esperando cambios..."
        self._icon = pystray.Icon(
            "KeystoneClient",
            _make_icon(),
            "KeystoneClient",
            menu=self._build_menu(),
        )

    def _build_menu(self):
        username = self.config.get("username", "usuario")
        return pystray.Menu(
            pystray.MenuItem(f"Conectado: {username}", None, enabled=False),
            pystray.MenuItem(lambda _: self._status, None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sincronizar ahora", self._on_sync_now),
            pystray.MenuItem("Instalar Addon", self._on_install_addon),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Salir", self._on_quit),
        )

    def set_status(self, text: str):
        self._status = text

    def notify(self, message: str):
        try:
            self._icon.notify("KeystoneClient", message)
        except Exception:
            pass

    def _on_sync_now(self, icon, item):
        self.worker.force_sync()

    def _on_install_addon(self, icon, item):
        from installer_window import show_installer_window
        threading.Thread(target=show_installer_window, daemon=True).start()

    def _on_quit(self, icon, item):
        self.worker.stop()
        icon.stop()

    def run(self):
        self._icon.run()
