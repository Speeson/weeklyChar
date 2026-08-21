from __future__ import annotations

import sys

from sync_addon import main


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:], check_only=True))
