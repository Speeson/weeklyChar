import os
import sys
import threading
import pystray
from PIL import Image, ImageDraw


def _load_icon() -> Image.Image:
    _base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    _ico  = os.path.join(_base, "icon.ico")
    try:
        return Image.open(_ico).resize((64, 64), Image.LANCZOS).convert("RGBA")
    except Exception:
        # fallback: simple diamond shape
        img  = Image.new("RGB", (64, 64), (17, 24, 39))
        draw = ImageDraw.Draw(img)
        cx, cy, r = 32, 32, 26
        draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)],
                     fill=(245, 158, 11))
        return img


class TrayApp:
    def __init__(self, config: dict, worker, on_open=None, on_quit=None):
        self.config   = config
        self.worker   = worker
        self._on_open = on_open
        self._on_quit = on_quit
        self._status  = "Esperando cambios..."
        self._icon    = pystray.Icon(
            "KeystoneClient",
            _load_icon(),
            "KeystoneClient",
            menu=self._build_menu(),
        )

    def _build_menu(self):
        username = self.config.get("username", "usuario")
        return pystray.Menu(
            pystray.MenuItem("Abrir KeystoneClient", self._handle_open, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(f"Conectado: {username}", None, enabled=False),
            pystray.MenuItem(lambda _: self._status,   None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sincronizar ahora", self._handle_sync),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Salir", self._handle_quit),
        )

    def set_status(self, text: str):
        self._status = text

    def notify(self, message: str):
        try:
            self._icon.notify(message, "KeystoneClient")
        except Exception:
            pass

    def _handle_open(self, icon, item):
        if self._on_open:
            self._on_open()

    def _handle_sync(self, icon, item):
        self.worker.force_sync()

    def _handle_quit(self, icon, item):
        self.worker.stop()
        icon.stop()
        if self._on_quit:
            self._on_quit()

    def run_detached(self):
        t = threading.Thread(target=self._icon.run, daemon=True)
        t.start()
        return t

    def stop(self):
        try:
            self._icon.stop()
        except Exception:
            pass
