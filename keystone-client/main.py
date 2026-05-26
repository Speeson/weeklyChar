import sys
import config
import wow_path
from auth import show_login_window
from sync_worker import SyncWorker
from tray_app import TrayApp


def main():
    cfg = config.load()

    if not cfg.get("sync_token"):
        result = show_login_window(cfg["api_url"])
        if not result:
            sys.exit(0)
        cfg["sync_token"] = result["sync_token"]
        cfg["username"] = result["username"]
        config.save(cfg)

    if not cfg.get("wow_path"):
        path = wow_path.find_savedvars()
        if path:
            cfg["wow_path"] = path
            config.save(cfg)

    def on_sync(chars):
        names = ", ".join(chars)
        tray.set_status(f"Sync: {names}")
        tray.notify(f"Sincronizado: {names}")

    def on_error(msg):
        tray.set_status(f"Error: {msg[:50]}")

    worker = SyncWorker(cfg, on_sync=on_sync, on_error=on_error)
    tray = TrayApp(cfg, worker)

    if not cfg.get("wow_path"):
        tray.set_status("WoW no encontrado — configura la ruta")

    worker.start()
    tray.run()


if __name__ == "__main__":
    main()
