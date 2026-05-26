import sys
import config as cfg_module
from main_window import MainWindow
from sync_worker import SyncWorker
from tray_app import TrayApp


def main():
    window = MainWindow()
    result = window.run()

    if result != "tray":
        sys.exit(0)

    cfg = cfg_module.load()

    worker = SyncWorker(cfg)
    tray = TrayApp(cfg, worker)

    worker.on_sync = lambda chars: (
        tray.set_status(f"Sync: {', '.join(chars)}"),
        tray.notify(f"Sincronizado: {', '.join(chars)}"),
    )
    worker.on_error = lambda msg: tray.set_status(f"Error: {msg[:50]}")

    worker.start()
    tray.run()


if __name__ == "__main__":
    main()
