from __future__ import annotations

import os
import sys
import tempfile
import unittest
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
        self.assertIn(
            str(REPO_ROOT / "keystone-client" / "sidecar" / "bridge_main.py"),
            command,
        )
        self.assertIn(str(REPO_ROOT / "keystone-client" / "sidecar"), command)
        self.assertIn(
            f"{REPO_ROOT / 'keystone-client' / 'VERSION'}{os.pathsep}.",
            command,
        )
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

    def test_sidecar_sources_discover_python_modules_and_build_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            sidecar_dir = repo_root / "keystone-client" / "sidecar"
            sidecar_dir.mkdir(parents=True)
            (sidecar_dir / "bridge_main.py").write_text("", encoding="utf-8")
            (sidecar_dir / "new_domain_service.py").write_text("", encoding="utf-8")
            (sidecar_dir / "requirements.txt").write_text("requests\n", encoding="utf-8")
            (sidecar_dir / "ignored.txt").write_text("", encoding="utf-8")
            (sidecar_dir / "__pycache__").mkdir()
            (repo_root / "keystone-client" / "VERSION").write_text(
                "0.4.0\n", encoding="utf-8"
            )
            scripts_dir = repo_root / "scripts"
            scripts_dir.mkdir()
            (scripts_dir / "build_client_sidecar.py").write_text("", encoding="utf-8")

            sources = set(sidecar_sources(repo_root))

            self.assertEqual(
                sources,
                {
                    sidecar_dir / "bridge_main.py",
                    sidecar_dir / "new_domain_service.py",
                    sidecar_dir / "requirements.txt",
                    repo_root / "keystone-client" / "VERSION",
                    scripts_dir / "build_client_sidecar.py",
                },
            )


if __name__ == "__main__":
    unittest.main()
