use serde_json::Value;
use std::sync::Arc;
use tauri::AppHandle;

use crate::bridge::{CoreBridge, CoreBridgeError, TauriCoreEventSink};

#[derive(Clone)]
pub struct CoreBridgeState {
    bridge: Arc<CoreBridge>,
}

impl CoreBridgeState {
    pub fn new(app: AppHandle) -> Self {
        let event_sink = Arc::new(TauriCoreEventSink::new(app.clone()));
        Self {
            bridge: Arc::new(CoreBridge::new(app, event_sink)),
        }
    }

    pub fn request(&self, command: String, payload: Value) -> Result<Value, CoreBridgeError> {
        self.bridge.request(command, payload)
    }

    pub fn shutdown(&self) {
        self.bridge.shutdown();
    }
}
