from __future__ import annotations

import os
import re
import shutil
import stat
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import requests

import addon_installer


ADDON_REPO = "Speeson/KeystoneSync"
GITHUB_API_URL = f"https://api.github.com/repos/{ADDON_REPO}/releases/latest"
ASSET_TEMPLATE = "KeystoneSync-v{version}.zip"
MAX_ADDON_ZIP_BYTES = 25 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
REQUEST_TIMEOUT_SECONDS = 8
DOWNLOAD_TIMEOUT_SECONDS = 30


class AddonUpdateError(Exception):
    """Expected updater failure with a user-safe message."""


@dataclass(frozen=True)
class ReleaseInfo:
    version: str
    tag: str
    asset_name: str
    download_url: str
    html_url: str = ""
    body: str = ""


@dataclass(frozen=True)
class CachedPackage:
    version: str
    path: Path


@dataclass(frozen=True)
class UpdateCheck:
    status: str
    installed_version: str | None
    latest_version: str | None
    release: ReleaseInfo | None
    cached: CachedPackage | None
    update_available: bool
    install_available: bool
    source: str | None
    message: str


@dataclass(frozen=True)
class InstallResult:
    version: str
    path: str
    source: str
    cache_path: Path | None


def user_agent(client_version: str | None = None) -> str:
    version = (client_version or "0.0.0").strip() or "0.0.0"
    return f"KeystoneClient/{version} addon-updater"


def parse_semver(value: str | None) -> tuple[int, int, int]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", str(value or "").strip())
    if not match:
        raise ValueError(f"Invalid semantic version: {value}")
    return tuple(int(part) for part in match.groups())


def version_text(value: str | tuple[int, int, int]) -> str:
    if isinstance(value, tuple):
        return ".".join(str(part) for part in value)
    return ".".join(str(part) for part in parse_semver(value))


def compare_versions(left: str | None, right: str | None) -> int:
    left_parts = parse_semver(left)
    right_parts = parse_semver(right)
    return (left_parts > right_parts) - (left_parts < right_parts)


def is_newer_version(candidate: str | None, current: str | None) -> bool:
    return compare_versions(candidate, current) > 0


def parse_latest_release(payload: dict[str, Any]) -> ReleaseInfo:
    if payload.get("draft") or payload.get("prerelease"):
        raise AddonUpdateError("No stable addon release is available.")

    tag = str(payload.get("tag_name") or "").strip()
    try:
        version = version_text(tag)
    except ValueError as exc:
        raise AddonUpdateError("Latest addon release tag is not a semantic version.") from exc

    expected_asset = ASSET_TEMPLATE.format(version=version)
    asset = None
    for item in payload.get("assets") or []:
        if item.get("name") == expected_asset and item.get("browser_download_url"):
            asset = item
            break

    if not asset:
        raise AddonUpdateError(f"Missing addon release asset: {expected_asset}")

    asset_version_match = re.fullmatch(r"KeystoneSync-v(\d+\.\d+\.\d+)\.zip", str(asset.get("name") or ""))
    if not asset_version_match or asset_version_match.group(1) != version:
        raise AddonUpdateError("Addon release asset version does not match the release tag.")

    return ReleaseInfo(
        version=version,
        tag=tag,
        asset_name=expected_asset,
        download_url=str(asset["browser_download_url"]),
        html_url=str(payload.get("html_url") or ""),
        body=str(payload.get("body") or ""),
    )


def fetch_latest_release(session=requests, client_version: str | None = None) -> ReleaseInfo:
    try:
        response = session.get(
            GITHUB_API_URL,
            headers={"User-Agent": user_agent(client_version), "Accept": "application/vnd.github+json"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
    except AddonUpdateError:
        raise
    except Exception as exc:
        raise AddonUpdateError("Unable to check addon releases.") from exc

    if not isinstance(payload, dict):
        raise AddonUpdateError("Addon release response is malformed.")
    return parse_latest_release(payload)


def cache_dir(cache_root: str | Path | None = None) -> Path:
    if cache_root:
        return Path(cache_root)
    return Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient" / "addon-cache"


def _cache_path(version: str, cache_root: str | Path | None = None) -> Path:
    return cache_dir(cache_root) / ASSET_TEMPLATE.format(version=version_text(version))


def installed_status(addons_path: str | Path | None) -> dict[str, Any]:
    return addon_installer.installed_info(addons_path)


def _best_cached(candidates: list[CachedPackage]) -> CachedPackage | None:
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: parse_semver(item.version), reverse=True)[0]


def get_cached_release(cache_root: str | Path | None = None) -> CachedPackage | None:
    root = cache_dir(cache_root)
    if not root.exists():
        return None

    valid: list[CachedPackage] = []
    for path in root.glob("KeystoneSync-v*.zip"):
        match = re.fullmatch(r"KeystoneSync-v(\d+\.\d+\.\d+)\.zip", path.name)
        if not match:
            path.unlink(missing_ok=True)
            continue
        version = match.group(1)
        try:
            validate_release_zip(path, version)
        except AddonUpdateError:
            path.unlink(missing_ok=True)
            continue
        valid.append(CachedPackage(version, path))

    keep = _best_cached(valid)
    for package in valid:
        if keep and package.path != keep.path:
            package.path.unlink(missing_ok=True)
    return keep


def check_for_update(
    addons_path: str | Path | None,
    session=requests,
    cache_root: str | Path | None = None,
    client_version: str | None = None,
) -> UpdateCheck:
    installed = installed_status(addons_path)
    installed_version = installed.get("version")
    cached = get_cached_release(cache_root)

    release = None
    remote_error = None
    try:
        release = fetch_latest_release(session=session, client_version=client_version)
    except AddonUpdateError as exc:
        remote_error = exc

    latest_version = release.version if release else (cached.version if cached else None)

    if not installed.get("installed"):
        if release:
            return UpdateCheck("not_installed", None, latest_version, release, cached, True, True, "remote", "Addon install is available.")
        if cached:
            return UpdateCheck("not_installed_cached", None, latest_version, None, cached, False, True, "cache", "Cached addon install is available.")
        return UpdateCheck("offline_no_candidate", None, None, None, None, False, False, None, str(remote_error or "No addon release candidate is available."))

    if installed.get("corrupt") or installed.get("invalid_version"):
        if release:
            return UpdateCheck("installed_unknown", installed_version, latest_version, release, cached, True, True, "remote", "Addon can be repaired.")
        if cached:
            return UpdateCheck("installed_unknown_cached", installed_version, latest_version, None, cached, False, True, "cache", "Cached addon repair is available.")
        return UpdateCheck("offline_no_candidate", installed_version, None, None, None, False, False, None, str(remote_error or "No addon release candidate is available."))

    if release:
        comparison = compare_versions(installed_version, release.version)
        if comparison < 0:
            return UpdateCheck("update_available", installed_version, release.version, release, cached, True, True, "remote", "Addon update is available.")
        if comparison > 0:
            return UpdateCheck("installed_newer", installed_version, release.version, release, cached, False, False, None, "Installed addon is newer than latest stable release.")
        return UpdateCheck("up_to_date", installed_version, release.version, release, cached, False, True, "remote", "Addon is up to date.")

    if cached:
        comparison = compare_versions(installed_version, cached.version)
        if comparison < 0:
            return UpdateCheck("update_available_cached", installed_version, cached.version, None, cached, True, True, "cache", "Cached addon update is available.")
        if comparison == 0:
            return UpdateCheck("up_to_date_cached", installed_version, cached.version, None, cached, False, True, "cache", "Cached reinstall is available.")
        return UpdateCheck("offline_no_candidate", installed_version, cached.version, None, cached, False, False, None, str(remote_error or "Cached addon is older than installed version."))

    return UpdateCheck("offline_no_candidate", installed_version, None, None, None, False, False, None, str(remote_error or "No addon release candidate is available."))


def _content_length(response: Any) -> int | None:
    headers = getattr(response, "headers", {}) or {}
    value = headers.get("Content-Length") or headers.get("content-length")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def download_release_asset(
    release: ReleaseInfo,
    target_dir: str | Path,
    session=requests,
    client_version: str | None = None,
) -> Path:
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    final_path = target_dir / release.asset_name
    part_path = target_dir / f"{release.asset_name}.part"
    written = 0

    try:
        response = session.get(
            release.download_url,
            headers={"User-Agent": user_agent(client_version)},
            stream=True,
            timeout=DOWNLOAD_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        length = _content_length(response)
        if length is not None and length > MAX_ADDON_ZIP_BYTES:
            raise AddonUpdateError("Downloaded addon package is too large.")

        with open(part_path, "wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if not chunk:
                    continue
                written += len(chunk)
                if written > MAX_ADDON_ZIP_BYTES:
                    raise AddonUpdateError("Downloaded addon package is too large.")
                handle.write(chunk)
    except AddonUpdateError:
        part_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        part_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise AddonUpdateError("Unable to download addon package.") from exc

    if written <= 0:
        part_path.unlink(missing_ok=True)
        raise AddonUpdateError("Downloaded addon package is empty.")
    os.replace(part_path, final_path)
    return final_path


def _validate_zip_member(info: zipfile.ZipInfo) -> None:
    raw_name = info.filename
    if "\\" in raw_name:
        raise AddonUpdateError(f"Invalid addon package path: {raw_name}")
    path = PurePosixPath(raw_name)
    if path.is_absolute() or ".." in path.parts:
        raise AddonUpdateError(f"Invalid addon package path: {raw_name}")
    if path.parts and re.fullmatch(r"[A-Za-z]:", path.parts[0]):
        raise AddonUpdateError(f"Invalid addon package path: {raw_name}")
    if not path.parts or path.parts[0] != addon_installer.ADDON_NAME:
        raise AddonUpdateError("Addon package must contain a KeystoneSync/ root folder.")
    mode = (info.external_attr >> 16) & 0o170000
    if mode == stat.S_IFLNK:
        raise AddonUpdateError(f"Addon package must not contain symlinks: {raw_name}")


def validate_release_zip(zip_path: str | Path, expected_version: str) -> None:
    try:
        with zipfile.ZipFile(zip_path) as archive:
            infos = archive.infolist()
            if not infos:
                raise AddonUpdateError("Downloaded addon package is empty.")
            total = 0
            names = set()
            for info in infos:
                _validate_zip_member(info)
                total += info.file_size
                if total > MAX_UNCOMPRESSED_BYTES:
                    raise AddonUpdateError("Downloaded addon package expands to too much data.")
                names.add(info.filename.rstrip("/"))
    except AddonUpdateError:
        raise
    except zipfile.BadZipFile as exc:
        raise AddonUpdateError("Downloaded addon package is not a valid ZIP.") from exc

    if f"{addon_installer.ADDON_NAME}/{addon_installer.TOC_FILE}" not in names:
        raise AddonUpdateError(f"Addon package is missing {addon_installer.TOC_FILE}.")

    with tempfile.TemporaryDirectory(prefix="keystonesync-addon-validate-") as tmp:
        addon_dir = extract_release_zip(zip_path, expected_version, tmp)
        validate_addon_dir(addon_dir, expected_version)


def validate_addon_dir(addon_dir: str | Path, expected_version: str | None = None) -> str:
    try:
        return addon_installer.validate_addon_dir(addon_dir, expected_version=expected_version)
    except Exception as exc:
        raise AddonUpdateError(str(exc)) from exc


def extract_release_zip(zip_path: str | Path, expected_version: str, target_dir: str | Path) -> Path:
    target = Path(target_dir)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(target)
    addon_dir = target / addon_installer.ADDON_NAME
    return addon_dir


def store_validated_cache(
    zip_path: str | Path,
    expected_version: str,
    cache_root: str | Path | None = None,
) -> CachedPackage:
    version = version_text(expected_version)
    validate_release_zip(zip_path, version)

    root = cache_dir(cache_root)
    root.mkdir(parents=True, exist_ok=True)
    target = _cache_path(version, root)
    part = target.with_suffix(target.suffix + ".part")
    shutil.copy2(zip_path, part)
    os.replace(part, target)

    for other in root.glob("KeystoneSync-v*.zip"):
        if other != target:
            other.unlink(missing_ok=True)
    return CachedPackage(version, target)


def install_release_package(addons_path: str | Path, zip_path: str | Path, expected_version: str) -> str:
    version = version_text(expected_version)
    validate_release_zip(zip_path, version)
    with tempfile.TemporaryDirectory(prefix="keystonesync-addon-install-") as tmp:
        addon_dir = extract_release_zip(zip_path, version, tmp)
        validate_addon_dir(addon_dir, expected_version=version)
        installed_path = addon_installer.install_from_source(addons_path, addon_dir, expected_version=version)
    validate_addon_dir(installed_path, expected_version=version)
    return installed_path


def _download_validate_cache(
    release: ReleaseInfo,
    session=requests,
    cache_root: str | Path | None = None,
    client_version: str | None = None,
) -> CachedPackage:
    with tempfile.TemporaryDirectory(prefix="keystonesync-addon-download-") as tmp:
        zip_path = download_release_asset(release, tmp, session=session, client_version=client_version)
        return store_validated_cache(zip_path, release.version, cache_root=cache_root)


def install_from_check(
    addons_path: str | Path,
    check: UpdateCheck,
    session=requests,
    cache_root: str | Path | None = None,
    client_version: str | None = None,
) -> InstallResult:
    installed_version = check.installed_version

    if check.release:
        package = _download_validate_cache(check.release, session=session, cache_root=cache_root, client_version=client_version)
        installed_path = install_release_package(addons_path, package.path, package.version)
        return InstallResult(package.version, installed_path, "remote", package.path)

    if check.cached:
        if installed_version and not check.status.startswith("installed_unknown"):
            comparison = compare_versions(installed_version, check.cached.version)
            if comparison > 0:
                raise AddonUpdateError("Cached addon is older than the installed version.")
        installed_path = install_release_package(addons_path, check.cached.path, check.cached.version)
        return InstallResult(check.cached.version, installed_path, "cache", check.cached.path)

    raise AddonUpdateError("No valid addon release or cache is available.")


def install_best_available(
    addons_path: str | Path,
    session=requests,
    cache_root: str | Path | None = None,
    client_version: str | None = None,
) -> InstallResult:
    check = check_for_update(addons_path, session=session, cache_root=cache_root, client_version=client_version)
    if not check.install_available:
        raise AddonUpdateError(check.message)
    return install_from_check(addons_path, check, session=session, cache_root=cache_root, client_version=client_version)


def update_addon(
    addons_path: str | Path,
    release: ReleaseInfo,
    session=requests,
    cache_root: str | Path | None = None,
    client_version: str | None = None,
) -> str:
    package = _download_validate_cache(release, session=session, cache_root=cache_root, client_version=client_version)
    return install_release_package(addons_path, package.path, package.version)
