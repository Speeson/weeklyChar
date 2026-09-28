use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::SystemTime,
};
use tauri::{AppHandle, Manager};

use crate::bridge::CoreBridgeError;

const CACHE_DIRECTORY: &str = "avatar-cache-v1";
const PROFILE_CACHE_FILE: &str = "profile-avatar-v1.json";
const MAX_AVATAR_BYTES: usize = 256 * 1024;
const MAX_AVATAR_ENTRIES: usize = 100;
const MAX_CACHE_FILE_BYTES: u64 = 384 * 1024;
const ALLOWED_CONTENT_TYPES: [&str; 3] = ["image/jpeg", "image/png", "image/webp"];

static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CachedAvatar {
    url: String,
    content_type: String,
    data: String,
}

pub fn load(app: &AppHandle, url: &str) -> Result<Option<String>, CoreBridgeError> {
    let root = cache_root(app)?;
    Ok(load_from_path(&profile_path(&root), url)
        .or_else(|| load_from_path(&entry_path(&root, url), url)))
}

pub fn store(
    app: &AppHandle,
    url: &str,
    data_url: &str,
    profile: bool,
) -> Result<(), CoreBridgeError> {
    let root = cache_root(app)?;
    store_in_root(&root, url, data_url, profile).map_err(|_| cache_error())
}

pub fn remove(app: &AppHandle, url: &str) -> Result<(), CoreBridgeError> {
    let root = cache_root(app)?;
    remove_from_root(&root, url).map_err(|_| cache_error())
}

pub fn clear(app: &AppHandle) -> Result<(), CoreBridgeError> {
    let root = cache_root(app)?;
    let cache_dir = root.join(CACHE_DIRECTORY);
    if cache_dir.exists() {
        fs::remove_dir_all(cache_dir).map_err(|_| cache_error())?;
    }
    let profile = profile_path(&root);
    if profile.exists() {
        fs::remove_file(profile).map_err(|_| cache_error())?;
    }
    Ok(())
}

fn cache_root(app: &AppHandle) -> Result<PathBuf, CoreBridgeError> {
    if let Some(appdata) = std::env::var_os("APPDATA").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(appdata).join("KeystoneClient"));
    }
    app.path().app_data_dir().map_err(|_| cache_error())
}

fn store_in_root(root: &Path, url: &str, data_url: &str, profile: bool) -> std::io::Result<()> {
    let normalized_url = normalized_https_url(url).ok_or_else(invalid_data)?;
    let (content_type, bytes) = decode_data_url(data_url).ok_or_else(invalid_data)?;
    let entry = CachedAvatar {
        url: normalized_url.clone(),
        content_type: content_type.to_string(),
        data: STANDARD.encode(bytes),
    };
    let serialized = serde_json::to_vec(&entry).map_err(invalid_json)?;
    let target = entry_path(root, &normalized_url);
    write_file(&target, &serialized)?;
    trim_cache(root)?;
    if profile {
        write_file(&profile_path(root), &serialized)?;
    }
    Ok(())
}

fn load_from_path(path: &Path, url: &str) -> Option<String> {
    let normalized_url = normalized_https_url(url)?;
    if fs::metadata(path).ok()?.len() > MAX_CACHE_FILE_BYTES {
        let _ = fs::remove_file(path);
        return None;
    }
    let raw = fs::read(path).ok()?;
    let entry: CachedAvatar = serde_json::from_slice(&raw).ok()?;
    if entry.url != normalized_url || !ALLOWED_CONTENT_TYPES.contains(&entry.content_type.as_str())
    {
        return None;
    }
    let bytes = STANDARD.decode(&entry.data).ok()?;
    if bytes.is_empty() || bytes.len() > MAX_AVATAR_BYTES {
        let _ = fs::remove_file(path);
        return None;
    }
    Some(format!(
        "data:{};base64,{}",
        entry.content_type,
        STANDARD.encode(bytes)
    ))
}

fn remove_from_root(root: &Path, url: &str) -> std::io::Result<()> {
    let Some(normalized_url) = normalized_https_url(url) else {
        return Ok(());
    };
    remove_if_exists(&entry_path(root, &normalized_url))?;
    let profile = profile_path(root);
    if load_from_path(&profile, &normalized_url).is_some() {
        remove_if_exists(&profile)?;
    }
    Ok(())
}

fn normalized_https_url(value: &str) -> Option<String> {
    let parsed = url::Url::parse(value).ok()?;
    if parsed.scheme() != "https" || !parsed.username().is_empty() || parsed.password().is_some() {
        return None;
    }
    Some(parsed.to_string())
}

fn decode_data_url(value: &str) -> Option<(&str, Vec<u8>)> {
    let (metadata, encoded) = value.split_once(',')?;
    let content_type = metadata.strip_prefix("data:")?.strip_suffix(";base64")?;
    if !ALLOWED_CONTENT_TYPES.contains(&content_type) {
        return None;
    }
    let bytes = STANDARD.decode(encoded).ok()?;
    if bytes.is_empty() || bytes.len() > MAX_AVATAR_BYTES {
        return None;
    }
    Some((content_type, bytes))
}

fn entry_path(root: &Path, url: &str) -> PathBuf {
    let digest = Sha256::digest(url.as_bytes());
    root.join(CACHE_DIRECTORY).join(format!("{digest:x}.json"))
}

fn profile_path(root: &Path) -> PathBuf {
    root.join(PROFILE_CACHE_FILE)
}

fn write_file(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let parent = path.parent().ok_or_else(invalid_data)?;
    fs::create_dir_all(parent)?;
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(".avatar-{}-{sequence}.tmp", std::process::id()));
    fs::write(&temporary, contents)?;
    remove_if_exists(path)?;
    match fs::rename(&temporary, path) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(temporary);
            Err(error)
        }
    }
}

fn trim_cache(root: &Path) -> std::io::Result<()> {
    let directory = root.join(CACHE_DIRECTORY);
    let mut entries = fs::read_dir(directory)?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|value| value.to_str()) == Some("json"))
        .map(|entry| {
            let modified = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            (modified, entry.path())
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.0);
    let excess = entries.len().saturating_sub(MAX_AVATAR_ENTRIES);
    for (_, path) in entries.into_iter().take(excess) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

fn remove_if_exists(path: &Path) -> std::io::Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn invalid_data() -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid avatar cache data")
}

fn invalid_json(error: serde_json::Error) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, error)
}

fn cache_error() -> CoreBridgeError {
    CoreBridgeError {
        code: "AVATAR_CACHE_FAILED".to_string(),
        message: "KeystoneClient could not access the local avatar cache.".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock must be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "keystone-client-avatar-{name}-{}-{nonce}",
            std::process::id()
        ))
    }

    #[test]
    fn stores_and_reloads_profile_avatar_outside_webview_storage() {
        let root = test_root("profile");
        let url = "https://img.test/profile.jpg";
        let data_url = "data:image/jpeg;base64,cG9ydHJhaXQ=";

        store_in_root(&root, url, data_url, true).expect("avatar should be stored");

        assert_eq!(
            load_from_path(&profile_path(&root), url).as_deref(),
            Some(data_url)
        );
        assert_eq!(
            load_from_path(&entry_path(&root, url), url).as_deref(),
            Some(data_url)
        );
        fs::remove_dir_all(root).expect("test cache should be removable");
    }

    #[test]
    fn rejects_unsafe_urls_and_oversized_payloads() {
        let root = test_root("invalid");
        assert!(store_in_root(
            &root,
            "http://img.test/profile.jpg",
            "data:image/jpeg;base64,cG9ydHJhaXQ=",
            true,
        )
        .is_err());
        let oversized = STANDARD.encode(vec![0; MAX_AVATAR_BYTES + 1]);
        assert!(store_in_root(
            &root,
            "https://img.test/profile.jpg",
            &format!("data:image/jpeg;base64,{oversized}"),
            true,
        )
        .is_err());
        assert!(!root.exists());
    }

    #[test]
    fn removing_an_avatar_only_clears_the_matching_profile_copy() {
        let root = test_root("remove");
        let profile_url = "https://img.test/profile.jpg";
        let other_url = "https://img.test/other.jpg";
        let data_url = "data:image/jpeg;base64,cG9ydHJhaXQ=";
        store_in_root(&root, profile_url, data_url, true).expect("profile should be stored");
        store_in_root(&root, other_url, data_url, false).expect("other avatar should be stored");

        remove_from_root(&root, other_url).expect("other avatar should be removed");
        assert!(profile_path(&root).exists());
        remove_from_root(&root, profile_url).expect("profile should be removed");
        assert!(!profile_path(&root).exists());
        fs::remove_dir_all(root).expect("test cache should be removable");
    }
}
