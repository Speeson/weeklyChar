use base64::{engine::general_purpose::STANDARD, Engine as _};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::{env, fs, path::Path};

fn verify(artifact: &Path, signature_path: &Path, config_path: &Path) -> Result<(), String> {
    let config: Value = serde_json::from_slice(
        &fs::read(config_path).map_err(|error| format!("could not read Tauri config: {error}"))?,
    )
    .map_err(|error| format!("could not parse Tauri config: {error}"))?;
    let public_key = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or_else(|| "Tauri updater public key is missing".to_string())?;
    let decoded_public_key = STANDARD
        .decode(public_key)
        .map_err(|error| format!("Tauri updater public key is invalid: {error}"))?;
    let decoded_public_key = String::from_utf8(decoded_public_key)
        .map_err(|error| format!("Tauri updater public key is invalid UTF-8: {error}"))?;
    let public_key = PublicKey::decode(&decoded_public_key)
        .map_err(|error| format!("Tauri updater public key is invalid: {error}"))?;

    let signature = fs::read_to_string(signature_path)
        .map_err(|error| format!("could not read updater signature: {error}"))?;
    let decoded_signature = STANDARD
        .decode(signature.trim())
        .map_err(|error| format!("updater signature is invalid: {error}"))?;
    let decoded_signature = String::from_utf8(decoded_signature)
        .map_err(|error| format!("updater signature is invalid UTF-8: {error}"))?;
    let signature = Signature::decode(&decoded_signature)
        .map_err(|error| format!("updater signature is invalid: {error}"))?;
    let artifact =
        fs::read(artifact).map_err(|error| format!("could not read updater artifact: {error}"))?;

    public_key
        .verify(&artifact, &signature, true)
        .map_err(|error| format!("updater signature verification failed: {error}"))
}

fn main() {
    let args: Vec<_> = env::args_os().skip(1).collect();
    if args.len() != 3 {
        eprintln!("usage: verify_updater_signature <artifact> <signature> <tauri-config>");
        std::process::exit(2);
    }
    if let Err(error) = verify(
        Path::new(&args[0]),
        Path::new(&args[1]),
        Path::new(&args[2]),
    ) {
        eprintln!("{error}");
        std::process::exit(1);
    }
    println!("Updater signature verified.");
}
