use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{channel, sync_channel, Receiver, Sender, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
#[cfg(test)]
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

const PROTOCOL_VERSION: u64 = 1;
pub const CORE_EVENT_NAME: &str = "core://event";
pub const SIDECAR_LOGICAL_NAME: &str = "keystone-client-core";
const DEFAULT_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CoreBridgeError {
    pub code: String,
    pub message: String,
}

impl CoreBridgeError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
        }
    }
}

impl std::fmt::Display for CoreBridgeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CoreBridgeError {}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoreEventPayload {
    pub protocol_version: u64,
    pub event: String,
    pub data: Value,
}

pub trait CoreEventSink: Send + Sync {
    fn emit_core_event(&self, event: CoreEventPayload);
}

pub struct TauriCoreEventSink {
    app: AppHandle,
}

impl TauriCoreEventSink {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl CoreEventSink for TauriCoreEventSink {
    fn emit_core_event(&self, event: CoreEventPayload) {
        let event_name = event.event.clone();
        let event_data = event.data.clone();
        let _ = self.app.emit(CORE_EVENT_NAME, event);

        let app = self.app.clone();
        let _ = self.app.run_on_main_thread(move || {
            crate::tray::update_sync_event(&app, &event_name, &event_data);
        });
    }
}

trait BridgeInput: Send {
    fn write_all(&mut self, bytes: &[u8]) -> std::io::Result<()>;
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

trait BridgeChild: Send {
    #[cfg(test)]
    fn id(&self) -> Option<u32> {
        None
    }

    fn kill(&mut self);
    fn wait(&mut self);
}

struct LaunchedBridge {
    child: Box<dyn BridgeChild>,
    stdin: Box<dyn BridgeInput>,
    stdout: Receiver<String>,
    stderr: Receiver<String>,
}

trait BridgeLauncher: Send + Sync {
    fn spawn(&self) -> Result<LaunchedBridge, CoreBridgeError>;
}

#[derive(Clone)]
pub struct TauriSidecarLauncher {
    app: AppHandle,
}

impl TauriSidecarLauncher {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl BridgeLauncher for TauriSidecarLauncher {
    fn spawn(&self) -> Result<LaunchedBridge, CoreBridgeError> {
        let sidecar = self
            .app
            .shell()
            .sidecar(SIDECAR_LOGICAL_NAME)
            .map_err(|_| {
                CoreBridgeError::new(
                    "BRIDGE_START_FAILED",
                    "Packaged KeystoneClient core sidecar was not found.",
                )
            })?;

        let (mut rx, child) = sidecar.spawn().map_err(|_| {
            CoreBridgeError::new(
                "BRIDGE_START_FAILED",
                "Packaged KeystoneClient core sidecar failed to start.",
            )
        })?;
        let child = Arc::new(Mutex::new(Some(child)));
        let (stdout_sender, stdout) = channel();
        let (stderr_sender, stderr) = channel();

        tauri::async_runtime::spawn(async move {
            let mut stdout_buffer = Vec::new();
            let mut stderr_buffer = Vec::new();

            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => {
                        send_complete_lines(&mut stdout_buffer, &bytes, &stdout_sender);
                    }
                    CommandEvent::Stderr(bytes) => {
                        send_complete_lines(&mut stderr_buffer, &bytes, &stderr_sender);
                    }
                    CommandEvent::Terminated(_) => break,
                    _ => {}
                }
            }

            send_trailing_line(&mut stdout_buffer, &stdout_sender);
            send_trailing_line(&mut stderr_buffer, &stderr_sender);
        });

        Ok(LaunchedBridge {
            child: Box::new(SidecarChild {
                child: Arc::clone(&child),
            }),
            stdin: Box::new(SidecarInput { child }),
            stdout,
            stderr,
        })
    }
}

struct SidecarInput {
    child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
}

impl BridgeInput for SidecarInput {
    fn write_all(&mut self, bytes: &[u8]) -> std::io::Result<()> {
        let mut child = self.child.lock().expect("sidecar child lock poisoned");
        let child = child.as_mut().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::BrokenPipe, "sidecar is not running")
        })?;
        child
            .write(bytes)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::BrokenPipe, error.to_string()))
    }
}

struct SidecarChild {
    child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
}

impl BridgeChild for SidecarChild {
    fn kill(&mut self) {
        if let Some(child) = self
            .child
            .lock()
            .expect("sidecar child lock poisoned")
            .take()
        {
            let _ = child.kill();
        }
    }

    fn wait(&mut self) {}
}

#[cfg(test)]
#[derive(Clone)]
struct PackagedSidecarTestLauncher {
    executable: PathBuf,
    appdata_dir: PathBuf,
}

#[cfg(test)]
impl PackagedSidecarTestLauncher {
    fn new() -> Self {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let extension = if cfg!(windows) { ".exe" } else { "" };
        let binary_name = format!(
            "{}-{}{}",
            SIDECAR_LOGICAL_NAME,
            env!("TAURI_ENV_TARGET_TRIPLE"),
            extension
        );

        let appdata_dir = std::env::temp_dir().join(format!(
            "keystone-client-sidecar-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&appdata_dir);
        let _ = fs::create_dir_all(&appdata_dir);

        Self {
            executable: manifest_dir.join("binaries").join(binary_name),
            appdata_dir,
        }
    }
}

#[cfg(test)]
impl BridgeLauncher for PackagedSidecarTestLauncher {
    fn spawn(&self) -> Result<LaunchedBridge, CoreBridgeError> {
        let mut child = Command::new(&self.executable)
            .env("APPDATA", &self.appdata_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|_| {
                CoreBridgeError::new(
                    "BRIDGE_START_FAILED",
                    "Packaged Python bridge failed to start.",
                )
            })?;

        let stdin = child.stdin.take().ok_or_else(|| {
            CoreBridgeError::new(
                "BRIDGE_START_FAILED",
                "Python bridge stdin was unavailable.",
            )
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            CoreBridgeError::new(
                "BRIDGE_START_FAILED",
                "Python bridge stdout was unavailable.",
            )
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            CoreBridgeError::new(
                "BRIDGE_START_FAILED",
                "Python bridge stderr was unavailable.",
            )
        })?;

        Ok(LaunchedBridge {
            child: Box::new(StdBridgeChild { child }),
            stdin: Box::new(StdBridgeInput { stdin }),
            stdout: spawn_line_reader(stdout),
            stderr: spawn_line_reader(stderr),
        })
    }
}

#[cfg(test)]
struct StdBridgeInput {
    stdin: ChildStdin,
}

#[cfg(test)]
impl BridgeInput for StdBridgeInput {
    fn write_all(&mut self, bytes: &[u8]) -> std::io::Result<()> {
        self.stdin.write_all(bytes)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.stdin.flush()
    }
}

#[cfg(test)]
struct StdBridgeChild {
    child: Child,
}

#[cfg(test)]
impl BridgeChild for StdBridgeChild {
    #[cfg(test)]
    fn id(&self) -> Option<u32> {
        Some(self.child.id())
    }

    fn kill(&mut self) {
        let _ = self.child.kill();
    }

    fn wait(&mut self) {
        let _ = self.child.wait();
    }
}

#[derive(Clone, Default)]
pub struct PendingRequests {
    inner: Arc<Mutex<HashMap<String, SyncSender<Result<Value, CoreBridgeError>>>>>,
}

impl PendingRequests {
    pub fn insert(&self, id: String) -> Receiver<Result<Value, CoreBridgeError>> {
        let (sender, receiver) = sync_channel(1);
        self.inner
            .lock()
            .expect("pending requests lock poisoned")
            .insert(id, sender);
        receiver
    }

    pub fn complete_success(&self, id: &str, data: Value) -> bool {
        if let Some(sender) = self
            .inner
            .lock()
            .expect("pending requests lock poisoned")
            .remove(id)
        {
            let _ = sender.send(Ok(data));
            true
        } else {
            false
        }
    }

    fn complete_error(&self, id: &str, error: CoreBridgeError) -> bool {
        if let Some(sender) = self
            .inner
            .lock()
            .expect("pending requests lock poisoned")
            .remove(id)
        {
            let _ = sender.send(Err(error));
            true
        } else {
            false
        }
    }

    pub fn remove(&self, id: &str) -> bool {
        self.inner
            .lock()
            .expect("pending requests lock poisoned")
            .remove(id)
            .is_some()
    }

    fn fail_all(&self, error: CoreBridgeError) {
        let pending =
            std::mem::take(&mut *self.inner.lock().expect("pending requests lock poisoned"));
        for sender in pending.into_values() {
            let _ = sender.send(Err(error.clone()));
        }
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.inner
            .lock()
            .expect("pending requests lock poisoned")
            .len()
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct ProtocolErrorPayload {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ProtocolMessage {
    Response {
        id: String,
        ok: bool,
        data: Option<Value>,
        error: Option<ProtocolErrorPayload>,
    },
    Event {
        protocol_version: u64,
        event: String,
        data: Value,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawProtocolMessage {
    protocol_version: u64,
    #[serde(rename = "type")]
    message_type: String,
    id: Option<String>,
    ok: Option<bool>,
    data: Option<Value>,
    error: Option<ProtocolErrorPayload>,
    event: Option<String>,
}

pub fn is_command_allowed(command: &str) -> bool {
    matches!(
        command,
        "system.ping"
            | "system.get_state"
            | "auth.login"
            | "auth.register"
            | "auth.logout"
            | "profile.set_avatar"
            | "settings.get"
            | "settings.update"
            | "wow.detect"
            | "wow.list_accounts"
            | "wow.select_accounts"
            | "wow.select_install"
            | "sync.get_status"
            | "sync.start"
            | "sync.stop"
            | "sync.force"
            | "characters.get"
            | "characters.refresh"
            | "teams.list"
            | "teams.get"
            | "teams.keystone_selector"
            | "addon.get_status"
            | "addon.check"
            | "addon.install"
            | "addon.update"
            | "addon.reinstall"
    )
}

pub fn build_request_envelope(
    id: &str,
    command: &str,
    payload: Value,
) -> Result<Value, CoreBridgeError> {
    if !payload.is_object() {
        return Err(CoreBridgeError::new(
            "INVALID_REQUEST",
            "Bridge payload must be a JSON object.",
        ));
    }

    Ok(json!({
        "protocolVersion": PROTOCOL_VERSION,
        "id": id,
        "command": command,
        "payload": payload,
    }))
}

pub fn parse_protocol_line(line: &str) -> Result<ProtocolMessage, CoreBridgeError> {
    let raw: RawProtocolMessage = serde_json::from_str(line).map_err(|_| {
        CoreBridgeError::new(
            "BRIDGE_PROTOCOL_ERROR",
            "Python bridge emitted invalid JSON.",
        )
    })?;

    if raw.protocol_version != PROTOCOL_VERSION {
        return Err(CoreBridgeError::new(
            "BRIDGE_PROTOCOL_ERROR",
            "Python bridge emitted an unsupported protocol version.",
        ));
    }

    match raw.message_type.as_str() {
        "response" => Ok(ProtocolMessage::Response {
            id: raw.id.ok_or_else(|| {
                CoreBridgeError::new("BRIDGE_PROTOCOL_ERROR", "Bridge response missed id.")
            })?,
            ok: raw.ok.ok_or_else(|| {
                CoreBridgeError::new("BRIDGE_PROTOCOL_ERROR", "Bridge response missed ok.")
            })?,
            data: raw.data,
            error: raw.error,
        }),
        "event" => Ok(ProtocolMessage::Event {
            protocol_version: raw.protocol_version,
            event: raw.event.ok_or_else(|| {
                CoreBridgeError::new("BRIDGE_PROTOCOL_ERROR", "Bridge event missed name.")
            })?,
            data: raw.data.unwrap_or(Value::Null),
        }),
        _ => Err(CoreBridgeError::new(
            "BRIDGE_PROTOCOL_ERROR",
            "Python bridge emitted an unknown message type.",
        )),
    }
}

struct RunningBridge {
    child: Box<dyn BridgeChild>,
    stdin: Box<dyn BridgeInput>,
    pending: PendingRequests,
    healthy: Arc<AtomicBool>,
}

pub struct CoreBridge {
    launcher: Arc<dyn BridgeLauncher>,
    event_sink: Arc<dyn CoreEventSink>,
    request_timeout: Duration,
    next_request_id: AtomicU64,
    running: Mutex<Option<RunningBridge>>,
}

impl CoreBridge {
    pub fn new(app: AppHandle, event_sink: Arc<dyn CoreEventSink>) -> Self {
        Self::with_launcher(
            Arc::new(TauriSidecarLauncher::new(app)),
            event_sink,
            DEFAULT_REQUEST_TIMEOUT,
        )
    }

    fn with_launcher(
        launcher: Arc<dyn BridgeLauncher>,
        event_sink: Arc<dyn CoreEventSink>,
        request_timeout: Duration,
    ) -> Self {
        Self {
            launcher,
            event_sink,
            request_timeout,
            next_request_id: AtomicU64::new(1),
            running: Mutex::new(None),
        }
    }

    pub fn request(&self, command: String, payload: Value) -> Result<Value, CoreBridgeError> {
        if !is_command_allowed(&command) {
            return Err(CoreBridgeError::new(
                "UNKNOWN_COMMAND",
                "Command is not allowed by the Rust host.",
            ));
        }

        let id = self
            .next_request_id
            .fetch_add(1, Ordering::SeqCst)
            .to_string();
        let envelope = build_request_envelope(&id, &command, payload)?;
        let line = serde_json::to_string(&envelope).map_err(|_| {
            CoreBridgeError::new("INTERNAL_ERROR", "Bridge request could not be serialized.")
        })? + "\n";

        let receiver = {
            let mut running = self.running.lock().expect("bridge lock poisoned");
            self.ensure_running(&mut running)?;
            let bridge = running
                .as_mut()
                .expect("bridge must be running after ensure_running");
            if !bridge.healthy.load(Ordering::SeqCst) {
                return Err(CoreBridgeError::new(
                    "BRIDGE_UNHEALTHY",
                    "Python bridge is not healthy.",
                ));
            }

            let receiver = bridge.pending.insert(id.clone());
            if bridge
                .stdin
                .write_all(line.as_bytes())
                .and_then(|_| bridge.stdin.flush())
                .is_err()
            {
                bridge.pending.remove(&id);
                bridge.healthy.store(false, Ordering::SeqCst);
                return Err(CoreBridgeError::new(
                    "BRIDGE_UNHEALTHY",
                    "Python bridge input channel is unavailable.",
                ));
            }
            receiver
        };

        match receiver.recv_timeout(self.request_timeout) {
            Ok(result) => result,
            Err(_) => {
                if let Some(bridge) = self.running.lock().expect("bridge lock poisoned").as_ref() {
                    bridge.pending.remove(&id);
                }
                Err(CoreBridgeError::new(
                    "REQUEST_TIMEOUT",
                    "Python bridge request timed out.",
                ))
            }
        }
    }

    fn ensure_running(&self, running: &mut Option<RunningBridge>) -> Result<(), CoreBridgeError> {
        if let Some(bridge) = running.as_ref() {
            if bridge.healthy.load(Ordering::SeqCst) {
                return Ok(());
            }
            return Err(CoreBridgeError::new(
                "BRIDGE_UNHEALTHY",
                "Python bridge stopped and must be restarted by the host.",
            ));
        }

        let launched = self.launcher.spawn()?;
        let pending = PendingRequests::default();
        let healthy = Arc::new(AtomicBool::new(true));
        let (ready_sender, ready_receiver) = sync_channel(1);

        spawn_stdout_reader(
            launched.stdout,
            pending.clone(),
            healthy.clone(),
            self.event_sink.clone(),
            ready_sender,
        );
        spawn_stderr_reader(launched.stderr);

        let mut child = launched.child;
        match ready_receiver.recv_timeout(STARTUP_TIMEOUT) {
            Ok(Ok(())) => {
                *running = Some(RunningBridge {
                    child,
                    stdin: launched.stdin,
                    pending,
                    healthy,
                });
                Ok(())
            }
            Ok(Err(error)) => {
                child.kill();
                Err(error)
            }
            Err(_) => {
                child.kill();
                Err(CoreBridgeError::new(
                    "BRIDGE_START_TIMEOUT",
                    "Python bridge did not become ready in time.",
                ))
            }
        }
    }

    pub fn shutdown(&self) {
        if let Some(mut bridge) = self.running.lock().expect("bridge lock poisoned").take() {
            bridge.healthy.store(false, Ordering::SeqCst);
            drop(bridge.stdin);
            bridge.child.kill();
            bridge.child.wait();
            bridge.pending.fail_all(CoreBridgeError::new(
                "BRIDGE_SHUTDOWN",
                "Python bridge is shutting down.",
            ));
        }
    }
}

impl Drop for CoreBridge {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn spawn_stdout_reader(
    stdout: Receiver<String>,
    pending: PendingRequests,
    healthy: Arc<AtomicBool>,
    event_sink: Arc<dyn CoreEventSink>,
    ready_sender: SyncSender<Result<(), CoreBridgeError>>,
) {
    let (event_sender, event_receiver) = channel();
    thread::spawn(move || {
        for event in event_receiver {
            event_sink.emit_core_event(event);
        }
    });

    thread::spawn(move || {
        let mut ready_sender = Some(ready_sender);
        for line in stdout {
            match parse_protocol_line(&line) {
                Ok(ProtocolMessage::Response {
                    id,
                    ok,
                    data,
                    error,
                }) => {
                    if ok {
                        pending.complete_success(&id, data.unwrap_or(Value::Null));
                    } else {
                        let error = error
                            .map(|error| CoreBridgeError {
                                code: error.code,
                                message: error.message,
                            })
                            .unwrap_or_else(|| {
                                CoreBridgeError::new(
                                    "BRIDGE_PROTOCOL_ERROR",
                                    "Bridge error response missed error payload.",
                                )
                            });
                        pending.complete_error(&id, error);
                    }
                }
                Ok(ProtocolMessage::Event {
                    protocol_version,
                    event,
                    data,
                }) => {
                    if event == "system.ready" {
                        if let Some(sender) = ready_sender.take() {
                            let _ = sender.send(Ok(()));
                        }
                    }
                    let _ = event_sender.send(CoreEventPayload {
                        protocol_version,
                        event,
                        data,
                    });
                }
                Err(error) => {
                    healthy.store(false, Ordering::SeqCst);
                    pending.fail_all(error.clone());
                    if let Some(sender) = ready_sender.take() {
                        let _ = sender.send(Err(error));
                    }
                    return;
                }
            }
        }

        let error = CoreBridgeError::new("BRIDGE_EXITED", "Python bridge process exited.");
        healthy.store(false, Ordering::SeqCst);
        pending.fail_all(error.clone());
        if let Some(sender) = ready_sender.take() {
            let _ = sender.send(Err(error));
        }
    });
}

fn spawn_stderr_reader(stderr: Receiver<String>) {
    thread::spawn(move || {
        for line in stderr {
            if !line.is_empty() {
                eprintln!("Python bridge stderr diagnostic received.");
            }
        }
    });
}

#[cfg(test)]
fn spawn_line_reader(read: impl std::io::Read + Send + 'static) -> Receiver<String> {
    let (sender, receiver) = channel();
    thread::spawn(move || {
        for line in BufReader::new(read).lines() {
            match line {
                Ok(line) => {
                    let _ = sender.send(line);
                }
                Err(_) => return,
            }
        }
    });
    receiver
}

fn send_complete_lines(buffer: &mut Vec<u8>, bytes: &[u8], sender: &Sender<String>) {
    buffer.extend_from_slice(bytes);
    while let Some(position) = buffer.iter().position(|byte| *byte == b'\n') {
        let line: Vec<u8> = buffer.drain(..=position).collect();
        let line = String::from_utf8_lossy(&line[..line.len().saturating_sub(1)]).to_string();
        let _ = sender.send(line.trim_end_matches('\r').to_string());
    }
}

fn send_trailing_line(buffer: &mut Vec<u8>, sender: &Sender<String>) {
    if !buffer.is_empty() {
        let line = String::from_utf8_lossy(buffer).to_string();
        let _ = sender.send(line.trim_end_matches(['\r', '\n']).to_string());
        buffer.clear();
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use std::fs;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::{
        atomic::AtomicBool,
        mpsc::{channel, Receiver},
        Arc, Mutex,
    };
    use std::time::Duration;

    use super::{
        build_request_envelope, is_command_allowed, parse_protocol_line, spawn_stdout_reader,
        CoreBridge, CoreEventPayload, CoreEventSink, PackagedSidecarTestLauncher, PendingRequests,
        ProtocolMessage, SIDECAR_LOGICAL_NAME,
    };

    #[derive(Default)]
    struct RecordingSink {
        events: Mutex<Vec<CoreEventPayload>>,
    }

    impl CoreEventSink for RecordingSink {
        fn emit_core_event(&self, event: CoreEventPayload) {
            self.events.lock().unwrap().push(event);
        }
    }

    struct BlockingSink {
        release: Mutex<Receiver<()>>,
    }

    impl CoreEventSink for BlockingSink {
        fn emit_core_event(&self, event: CoreEventPayload) {
            if event.event == "sync.status" {
                let _ = self.release.lock().unwrap().recv();
            }
        }
    }

    #[test]
    fn sidecar_logical_name_matches_tauri_configuration() {
        assert_eq!(SIDECAR_LOGICAL_NAME, "keystone-client-core");
    }

    #[test]
    fn command_allowlist_exposes_only_supported_commands() {
        assert!(is_command_allowed("system.ping"));
        assert!(is_command_allowed("system.get_state"));
        assert!(is_command_allowed("auth.login"));
        assert!(is_command_allowed("auth.register"));
        assert!(is_command_allowed("auth.logout"));
        assert!(is_command_allowed("settings.get"));
        assert!(is_command_allowed("settings.update"));
        assert!(is_command_allowed("wow.detect"));
        assert!(is_command_allowed("wow.list_accounts"));
        assert!(is_command_allowed("wow.select_accounts"));
        assert!(is_command_allowed("wow.select_install"));
        assert!(is_command_allowed("sync.get_status"));
        assert!(is_command_allowed("sync.start"));
        assert!(is_command_allowed("sync.stop"));
        assert!(is_command_allowed("sync.force"));
        assert!(is_command_allowed("characters.get"));
        assert!(is_command_allowed("characters.refresh"));
        assert!(is_command_allowed("teams.list"));
        assert!(is_command_allowed("teams.get"));
        assert!(is_command_allowed("teams.keystone_selector"));
        assert!(is_command_allowed("addon.get_status"));
        assert!(is_command_allowed("addon.check"));
        assert!(is_command_allowed("addon.install"));
        assert!(is_command_allowed("addon.update"));
        assert!(is_command_allowed("addon.reinstall"));
        assert!(is_command_allowed("profile.set_avatar"));
        assert!(!is_command_allowed("auth.get_state"));
        assert!(!is_command_allowed("sync.pause"));
        assert!(!is_command_allowed("addon.install_from_zip"));
        assert!(!is_command_allowed("shell.open"));
    }

    #[test]
    fn request_envelope_does_not_log_or_return_payload() {
        let envelope = build_request_envelope(
            "43",
            "auth.login",
            json!({"username": "demo", "password": "secret"}),
        )
        .unwrap();

        assert_eq!(envelope["payload"]["password"], "secret");
        assert_eq!(
            format!("{:?}", super::CoreBridgeError::new("X", "Y")),
            "CoreBridgeError { code: \"X\", message: \"Y\" }"
        );
    }

    #[test]
    fn request_envelope_is_generated_by_rust() {
        let envelope = build_request_envelope("42", "system.ping", json!({})).unwrap();

        assert_eq!(
            envelope,
            json!({
                "protocolVersion": 1,
                "id": "42",
                "command": "system.ping",
                "payload": {}
            })
        );
    }

    #[test]
    fn request_payload_must_be_object() {
        let error = build_request_envelope("42", "system.ping", json!([])).unwrap_err();

        assert_eq!(error.code, "INVALID_REQUEST");
    }

    #[test]
    fn protocol_event_is_parsed() {
        let parsed = parse_protocol_line(
            r#"{"protocolVersion":1,"type":"event","event":"system.ready","data":{"capabilities":["system.ping"]}}"#,
        )
        .unwrap();

        assert_eq!(
            parsed,
            ProtocolMessage::Event {
                protocol_version: 1,
                event: "system.ready".to_string(),
                data: json!({"capabilities":["system.ping"]}),
            }
        );
    }

    #[test]
    fn protocol_response_is_parsed() {
        let parsed = parse_protocol_line(
            r#"{"protocolVersion":1,"type":"response","id":"7","ok":true,"data":{"pong":true},"error":null}"#,
        )
        .unwrap();

        assert_eq!(
            parsed,
            ProtocolMessage::Response {
                id: "7".to_string(),
                ok: true,
                data: Some(json!({"pong": true})),
                error: None,
            }
        );
    }

    #[test]
    fn malformed_protocol_line_is_error() {
        let error = parse_protocol_line("{not-json}").unwrap_err();

        assert_eq!(error.code, "BRIDGE_PROTOCOL_ERROR");
    }

    #[test]
    fn pending_requests_correlate_out_of_order_responses() {
        let pending = PendingRequests::default();
        let first = pending.insert("1".to_string());
        let second = pending.insert("2".to_string());

        assert!(pending.complete_success("2", json!({"order": 2})));
        assert!(pending.complete_success("1", json!({"order": 1})));

        assert_eq!(second.recv().unwrap().unwrap(), json!({"order": 2}));
        assert_eq!(first.recv().unwrap().unwrap(), json!({"order": 1}));
        assert_eq!(pending.len(), 0);
    }

    #[test]
    fn unknown_response_id_is_ignored() {
        let pending = PendingRequests::default();

        assert!(!pending.complete_success("missing", json!({})));
        assert_eq!(pending.len(), 0);
    }

    #[test]
    fn timeout_cleanup_removes_pending_waiter() {
        let pending = PendingRequests::default();
        let _receiver = pending.insert("timeout".to_string());

        assert!(pending.remove("timeout"));
        assert_eq!(pending.len(), 0);
    }

    #[test]
    fn slow_event_consumer_does_not_block_following_response() {
        let (stdout_sender, stdout_receiver) = channel();
        let (ready_sender, ready_receiver) = std::sync::mpsc::sync_channel(1);
        let (release_sender, release_receiver) = channel();
        let pending = PendingRequests::default();
        let response = pending.insert("force".to_string());

        spawn_stdout_reader(
            stdout_receiver,
            pending,
            Arc::new(AtomicBool::new(true)),
            Arc::new(BlockingSink {
                release: Mutex::new(release_receiver),
            }),
            ready_sender,
        );
        stdout_sender
            .send(
                r#"{"protocolVersion":1,"type":"event","event":"system.ready","data":{}}"#
                    .to_string(),
            )
            .unwrap();
        ready_receiver
            .recv_timeout(Duration::from_secs(1))
            .unwrap()
            .unwrap();
        stdout_sender
            .send(r#"{"protocolVersion":1,"type":"event","event":"sync.status","data":{"state":"syncing"}}"#.to_string())
            .unwrap();
        stdout_sender
            .send(r#"{"protocolVersion":1,"type":"response","id":"force","ok":true,"data":{"state":"syncing"},"error":null}"#.to_string())
            .unwrap();

        let result = response.recv_timeout(Duration::from_millis(100));
        release_sender.send(()).unwrap();

        assert_eq!(result.unwrap().unwrap(), json!({"state": "syncing"}));
    }

    #[test]
    fn real_packaged_sidecar_round_trip_reuses_one_process_and_fails_cleanly_after_death() {
        let sink = std::sync::Arc::new(RecordingSink::default());
        let launcher = PackagedSidecarTestLauncher::new();
        let bridge = CoreBridge::with_launcher(
            std::sync::Arc::new(launcher.clone()),
            sink.clone(),
            std::time::Duration::from_secs(15),
        );

        let state = bridge
            .request("system.get_state".to_string(), json!({}))
            .expect("get_state should start the packaged sidecar");
        let first_child_id = bridge
            .running
            .lock()
            .unwrap()
            .as_ref()
            .expect("bridge should be running")
            .child
            .id();

        assert_eq!(
            state,
            json!({
                "protocolVersion": 1,
                "bridge": "ready",
                "auth": {"authenticated": false, "username": null, "avatarUrl": null},
                "settings": {"startMinimized": false, "minimizeOnClose": false, "lang": "es"},
                "wow": {
                    "install": {"detected": false, "installPath": null, "retailPath": null, "addonsPath": null},
                    "accounts": [],
                    "selectedAccounts": [],
                    "configurationComplete": false
                },
                "sync": {
                    "running": false,
                    "state": "idle",
                    "lastSyncAt": null,
                    "lastSuccessAt": null,
                    "lastError": null,
                    "selectedAccounts": 0
                },
                "characters": {
                    "characters": [],
                    "refreshing": false,
                    "source": "none",
                    "lastRefreshAt": null,
                    "lastError": null
                },
                "addon": {
                    "installed": false,
                    "installedVersion": null,
                    "latestVersion": null,
                    "state": "not-installed",
                    "cacheAvailable": false,
                    "lastCheckAt": null,
                    "source": null,
                    "message": "",
                    "operation": null
                }
            })
        );
        assert_eq!(
            sink.events.lock().unwrap()[0],
            CoreEventPayload {
                protocol_version: 1,
                event: "system.ready".to_string(),
                data: json!({"capabilities":["system.ping","system.get_state","auth.login","auth.register","auth.logout","profile.set_avatar","settings.get","settings.update","wow.detect","wow.list_accounts","wow.select_accounts","wow.select_install","sync.get_status","sync.start","sync.stop","sync.force","characters.get","characters.refresh","teams.list","teams.get","teams.keystone_selector","addon.get_status","addon.check","addon.install","addon.update","addon.reinstall"]}),
            }
        );

        let ping = bridge
            .request("system.ping".to_string(), json!({}))
            .unwrap();
        let second_child_id = bridge.running.lock().unwrap().as_ref().unwrap().child.id();

        assert_eq!(ping, json!({"pong": true}));
        assert_eq!(first_child_id, second_child_id);

        let settings = bridge
            .request("settings.get".to_string(), json!({}))
            .unwrap();
        assert_eq!(
            settings,
            json!({"startMinimized": false, "minimizeOnClose": false, "lang": "es"})
        );

        let updated_settings = bridge
            .request(
                "settings.update".to_string(),
                json!({"startMinimized": true, "lang": "en"}),
            )
            .unwrap();
        assert_eq!(
            updated_settings,
            json!({"startMinimized": true, "minimizeOnClose": false, "lang": "en"})
        );

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut chunk = [0_u8; 1024];
            loop {
                let count = stream.read(&mut chunk).unwrap();
                request.extend_from_slice(&chunk[..count]);
                if count == 0 || request.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8(request).unwrap();
            assert!(request
                .to_ascii_lowercase()
                .contains("authorization: bearer bridge-secret"));
            assert!(request.starts_with("GET /api/teams HTTP/1.1"));
            let body = r#"[{"id":7,"name":"Raid","memberCount":2,"inviteCode":"must-not-cross"}]"#;
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        });
        fs::write(
            launcher.appdata_dir.join("KeystoneClient").join("config.json"),
            json!({
                "api_url": format!("http://{}", address),
                "access_token": "bridge-secret",
                "sync_token": "bridge-sync-secret",
                "login_at": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                "start_minimized": true,
                "lang": "en"
            }).to_string(),
        ).unwrap();

        let teams = bridge.request("teams.list".to_string(), json!({})).unwrap();
        worker.join().unwrap();
        assert_eq!(teams, json!([{"id": 7, "name": "Raid", "memberCount": 2}]));
        assert!(!teams.to_string().contains("bridge-secret"));
        assert!(!teams.to_string().contains("must-not-cross"));
        bridge
            .request("auth.logout".to_string(), json!({}))
            .unwrap();

        let wow_root = launcher.appdata_dir.join("World of Warcraft");
        let retail = wow_root.join("_retail_");
        fs::create_dir_all(retail.join("Interface").join("AddOns")).unwrap();
        fs::write(retail.join("Wow.exe"), "").unwrap();
        fs::create_dir_all(
            retail
                .join("WTF")
                .join("Account")
                .join("ACCOUNT_A")
                .join("SavedVariables"),
        )
        .unwrap();
        fs::write(
            retail
                .join("WTF")
                .join("Account")
                .join("ACCOUNT_A")
                .join("SavedVariables")
                .join("KeystoneSync.lua"),
            "",
        )
        .unwrap();
        fs::create_dir_all(
            retail
                .join("WTF")
                .join("Account")
                .join("ACCOUNT_B")
                .join("SavedVariables"),
        )
        .unwrap();

        let selected_install = bridge
            .request(
                "wow.select_install".to_string(),
                json!({"path": retail.to_string_lossy()}),
            )
            .unwrap();
        assert_eq!(selected_install["install"]["detected"], true);
        assert_eq!(
            selected_install["install"]["installPath"],
            json!(wow_root.to_string_lossy().to_string())
        );
        assert_eq!(selected_install["accounts"][0]["name"], "ACCOUNT_A");
        assert_eq!(
            selected_install["accounts"][0]["savedVariablesExists"],
            true
        );
        assert_eq!(selected_install["accounts"][1]["name"], "ACCOUNT_B");
        assert_eq!(
            selected_install["accounts"][1]["savedVariablesExists"],
            false
        );

        let selected_accounts = bridge
            .request(
                "wow.select_accounts".to_string(),
                json!({"accounts": ["ACCOUNT_A", "ACCOUNT_A"]}),
            )
            .unwrap();
        assert_eq!(selected_accounts["selectedAccounts"], json!(["ACCOUNT_A"]));

        let persisted_wow = bridge
            .request("wow.list_accounts".to_string(), json!({}))
            .unwrap();
        assert_eq!(persisted_wow["selectedAccounts"], json!(["ACCOUNT_A"]));

        let sync_status = bridge
            .request("sync.get_status".to_string(), json!({}))
            .unwrap();
        assert_eq!(sync_status["running"], json!(false));
        assert_eq!(sync_status["state"], json!("idle"));
        assert_eq!(sync_status["selectedAccounts"], json!(1));

        let sync_start_error = bridge
            .request("sync.start".to_string(), json!({}))
            .unwrap_err();
        assert_eq!(sync_start_error.code, "SYNC_NOT_AUTHENTICATED");

        {
            let mut running = bridge.running.lock().unwrap();
            let running = running.as_mut().unwrap();
            running
                .healthy
                .store(false, std::sync::atomic::Ordering::SeqCst);
            running.child.kill();
            running.child.wait();
        }

        let error = bridge
            .request("system.ping".to_string(), json!({}))
            .unwrap_err();
        assert_eq!(error.code, "BRIDGE_UNHEALTHY");

        bridge.shutdown();

        let restarted = CoreBridge::with_launcher(
            std::sync::Arc::new(launcher),
            std::sync::Arc::new(RecordingSink::default()),
            std::time::Duration::from_secs(15),
        );
        let persisted_settings = restarted
            .request("settings.get".to_string(), json!({}))
            .unwrap();
        assert_eq!(
            persisted_settings,
            json!({"startMinimized": true, "minimizeOnClose": false, "lang": "en"})
        );
        restarted.shutdown();
    }
}
