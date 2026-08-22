from __future__ import annotations

import sys
import tempfile
import unittest
import os
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from build_client_sidecar import (  # noqa: E402
    LOGICAL_SIDECAR_NAME,
    SidecarBuildError,
    copy_sidecar_output,
    determine_target_triple,
    physical_sidecar_filename,
    pyinstaller_command,
    sidecar_sources,
    sidecar_needs_rebuild,
)


class SidecarBuildTests(unittest.TestCase):
    def test_physical_filename_uses_tauri_target_suffix_on_windows(self) -> None:
        self.assertEqual(
            physical_sidecar_filename(
                LOGICAL_SIDECAR_NAME, "x86_64-pc-windows-msvc", "win32"
            ),
            "keystone-client-core-x86_64-pc-windows-msvc.exe",
        )

    def test_explicit_target_wins_without_calling_rustc(self) -> None:
        with mock.patch("build_client_sidecar.subprocess.run") as run:
            self.assertEqual(determine_target_triple("custom-target"), "custom-target")
            run.assert_not_called()

    def test_rustc_host_tuple_is_trimmed(self) -> None:
        completed = mock.Mock(stdout="x86_64-pc-windows-msvc\n")
        with mock.patch("build_client_sidecar.subprocess.run", return_value=completed):
            self.assertEqual(determine_target_triple(), "x86_64-pc-windows-msvc")

    def test_pyinstaller_command_uses_bridge_entrypoint_and_temp_dirs(self) -> None:
        command = pyinstaller_command(
            python_executable="python",
            repo_root=REPO_ROOT,
            temp_dir=REPO_ROOT / ".tmp" / "client-sidecar",
        )

        self.assertIn("-m", command)
        self.assertIn("PyInstaller", command)
        self.assertIn("--onefile", command)
        self.assertIn("--console", command)
        self.assertIn("--hidden-import", command)
        self.assertIn("requests", command)
        self.assertIn(str(REPO_ROOT / "keystone-client" / "bridge_main.py"), command)
        self.assertNotIn("main.py", command)
        self.assertNotIn("bg.jpg", command)

    def test_missing_pyinstaller_output_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(SidecarBuildError):
                copy_sidecar_output(Path(tmp) / "missing.exe", Path(tmp) / "out.exe")

    def test_existing_output_is_rebuilt_only_when_source_is_newer(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "sidecar.exe"
            source = Path(tmp) / "bridge_main.py"
            source.write_text("source", encoding="utf-8")
            output.write_text("output", encoding="utf-8")

            self.assertFalse(sidecar_needs_rebuild(output, [source]))

            source.write_text("new source", encoding="utf-8")
            os.utime(source, (output.stat().st_mtime + 10, output.stat().st_mtime + 10))
            self.assertTrue(sidecar_needs_rebuild(output, [source]))

    def test_sidecar_sources_include_auth_settings_wow_and_sync_services(self) -> None:
        sources = {path.name for path in sidecar_sources(REPO_ROOT)}

        self.assertIn("auth_service.py", sources)
        self.assertIn("settings_service.py", sources)
        self.assertIn("sync_service.py", sources)
        self.assertIn("sync_worker.py", sources)
        self.assertIn("wow_path.py", sources)
        self.assertIn("wow_service.py", sources)


if __name__ == "__main__":
    unittest.main()
