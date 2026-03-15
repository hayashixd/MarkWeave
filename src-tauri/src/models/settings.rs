use serde::{Deserialize, Serialize};

/// Rust 側で扱う設定の構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub auto_save: bool,
    pub auto_save_interval_ms: u64,
    pub theme: String,
    pub locale: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_save: true,
            auto_save_interval_ms: 1000,
            theme: "light".to_string(),
            locale: "ja".to_string(),
        }
    }
}
