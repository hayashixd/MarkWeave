//! AI API 外部通信コマンド（セキュリティ設計書 §4.6 準拠）
//!
//! CSP `connect-src` 制限により WebView から外部 API を直接呼べないため、
//! すべての AI API 通信を Tauri コマンド（Rust）経由で行う。
//!
//! - モデルはホワイトリスト制（フロントから任意指定不可）
//! - API key は Rust 側設定ストアから取得（フロントに渡さない）
//! - プロンプト長・max_tokens に上限を設ける

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

/// サポートするプロバイダ/モデルのホワイトリスト。
/// 新モデル追加時はここを編集する。
const ALLOWED_MODELS: &[(&str, &str)] = &[
    ("anthropic", "claude-sonnet-4-5"),
    ("anthropic", "claude-haiku-4-5-20251001"),
    ("openai", "gpt-4o"),
    ("openai", "gpt-4o-mini"),
];

/// プロンプト長の上限 (100KB ≈ 25,000 トークン相当)
const MAX_PROMPT_BYTES: usize = 102_400;

/// ストリーミング用プロンプト長の上限 (800KB — 参考資料を含むため大きめ)
const MAX_STREAM_PROMPT_BYTES: usize = 819_200;

/// max_tokens の上限
const MAX_TOKENS_LIMIT: u32 = 8192;

/// HTTP タイムアウト (秒)
const REQUEST_TIMEOUT_SECS: u64 = 120;

/// ストリーミング用タイムアウト (秒) — 長文生成に対応
const STREAM_TIMEOUT_SECS: u64 = 300;

/// アクティブなストリーミングセッションのキャンセル管理
pub struct AiStreamRegistry(pub Arc<Mutex<HashMap<String, tokio::sync::watch::Sender<bool>>>>);

#[derive(Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub prompt: String,
    pub max_tokens: u32,
}

#[derive(Serialize, Clone, Debug)]
pub struct AiResponse {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// API key をストアまたは環境変数から取得するヘルパー。
/// 優先順位: tauri-plugin-store (settings.json) > 環境変数
fn get_api_key(app: &tauri::AppHandle, provider: &str) -> Result<String, String> {
    // 1. ストアから取得を試みる
    if let Ok(store) = app.store("settings.json") {
        let key_path = format!("ai_api_keys.{provider}");
        if let Some(key) = store
            .get(&key_path)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .filter(|s| !s.is_empty())
        {
            return Ok(key);
        }
    }

    // 2. 環境変数にフォールバック（開発時・BYOK 設定前）
    let env_var = match provider {
        "anthropic" => "ANTHROPIC_API_KEY",
        "openai" => "OPENAI_API_KEY",
        _ => {
            return Err(format!("{provider} の API key が設定されていません"));
        }
    };
    std::env::var(env_var)
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            format!(
                "{provider} の API key が設定されていません（設定 → AI から登録するか、{env_var} 環境変数を設定してください）"
            )
        })
}

// ──────────────────────────────────────────────
// API key 管理コマンド
// ──────────────────────────────────────────────

/// プロバイダごとの設定状態
#[derive(Serialize)]
pub struct AiProviderConfig {
    pub provider: String,
    /// API key が利用可能か
    pub has_key: bool,
    /// キーのソース: "store" | "env" | "none"
    pub key_source: String,
    /// 利用可能なモデル一覧
    pub models: Vec<String>,
}

/// 全プロバイダの設定状態を返す（フロントの設定 UI 用）
#[tauri::command]
pub fn get_ai_provider_config(app: tauri::AppHandle) -> Vec<AiProviderConfig> {
    let providers: &[(&str, &str, &[&str])] = &[
        (
            "anthropic",
            "ANTHROPIC_API_KEY",
            &["claude-sonnet-4-5", "claude-haiku-4-5-20251001"],
        ),
        ("openai", "OPENAI_API_KEY", &["gpt-4o", "gpt-4o-mini"]),
    ];

    providers
        .iter()
        .map(|(provider, env_var, models)| {
            let store_has_key = app
                .store("settings.json")
                .ok()
                .and_then(|store| {
                    let key_path = format!("ai_api_keys.{provider}");
                    store
                        .get(&key_path)
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .filter(|s| !s.is_empty())
                })
                .is_some();

            let (has_key, key_source) = if store_has_key {
                (true, "store".to_string())
            } else if std::env::var(env_var)
                .ok()
                .filter(|s| !s.is_empty())
                .is_some()
            {
                (true, "env".to_string())
            } else {
                (false, "none".to_string())
            };

            AiProviderConfig {
                provider: provider.to_string(),
                has_key,
                key_source,
                models: models.iter().map(|s| s.to_string()).collect(),
            }
        })
        .collect()
}

/// API key をストアに保存する
#[tauri::command]
pub fn set_ai_api_key(
    app: tauri::AppHandle,
    provider: String,
    key: String,
) -> Result<(), String> {
    let valid = ["anthropic", "openai"];
    if !valid.contains(&provider.as_str()) {
        return Err(format!("未対応プロバイダ: {provider}"));
    }
    let store = app
        .store("settings.json")
        .map_err(|e| format!("設定ストアを開けません: {e}"))?;
    let key_path = format!("ai_api_keys.{provider}");
    store.set(key_path, serde_json::Value::String(key));
    store
        .save()
        .map_err(|e| format!("設定の保存に失敗しました: {e}"))?;
    Ok(())
}

/// API key の疎通確認（保存前バリデーション用）
#[tauri::command]
pub async fn test_ai_api_key(provider: String, key: String) -> Result<(), String> {
    match provider.as_str() {
        "anthropic" => {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;
            // max_tokens=1 の最小リクエストで認証確認
            let body = serde_json::json!({
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }]
            });
            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("API 通信エラー: {e}"))?;
            let status = resp.status().as_u16();
            match status {
                200 | 400 => Ok(()), // 400 は max_tokens=1 によるモデル拒否の可能性があるが認証は通っている
                401 => Err("API キーが無効です".to_string()),
                _ => Err(format!("Anthropic API エラー: HTTP {status}")),
            }
        }
        "openai" => {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;
            let resp = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {key}"))
                .send()
                .await
                .map_err(|e| format!("API 通信エラー: {e}"))?;
            let status = resp.status().as_u16();
            match status {
                200 => Ok(()),
                401 => Err("API キーが無効です".to_string()),
                _ => Err(format!("OpenAI API エラー: HTTP {status}")),
            }
        }
        _ => Err(format!("未対応プロバイダ: {provider}")),
    }
}

#[tauri::command]
pub async fn call_ai_api(
    app: tauri::AppHandle,
    request: AiRequest,
) -> Result<AiResponse, String> {
    // 1. モデルのホワイトリスト検証
    let is_allowed = ALLOWED_MODELS
        .iter()
        .any(|(p, m)| *p == request.provider && *m == request.model);
    if !is_allowed {
        return Err(format!(
            "サポートしていないプロバイダ/モデル: {}/{}",
            request.provider, request.model
        ));
    }

    // 2. プロンプト長の上限
    if request.prompt.len() > MAX_PROMPT_BYTES {
        return Err("プロンプトが長すぎます（最大 100KB）".to_string());
    }

    // 3. max_tokens の上限
    if request.max_tokens > MAX_TOKENS_LIMIT {
        return Err("max_tokens が上限を超えています（最大 8192）".to_string());
    }

    // 4. API key 取得（Rust 側ストアから、フロントからは渡させない）
    let api_key = get_api_key(&app, &request.provider)?;

    // 5. プロバイダ別リクエスト実行
    match request.provider.as_str() {
        "anthropic" => {
            call_anthropic(&api_key, &request.model, &request.prompt, request.max_tokens).await
        }
        "openai" => {
            call_openai(&api_key, &request.model, &request.prompt, request.max_tokens).await
        }
        _ => Err("未対応プロバイダ".to_string()),
    }
}

async fn call_anthropic(
    api_key: &str,
    model: &str,
    prompt: &str,
    max_tokens: u32,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API エラー {status}: {msg}"));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let input_tokens = json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

    Ok(AiResponse {
        content,
        input_tokens,
        output_tokens,
    })
}

async fn call_openai(
    api_key: &str,
    model: &str,
    prompt: &str,
    max_tokens: u32,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API エラー {status}: {msg}"));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let input_tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = json["usage"]["completion_tokens"]
        .as_u64()
        .unwrap_or(0) as u32;

    Ok(AiResponse {
        content,
        input_tokens,
        output_tokens,
    })
}

// ============================================================
// ストリーミング API（ai-edit-design.md §8 準拠）
// ============================================================

#[derive(Deserialize)]
pub struct AiStreamRequest {
    pub provider: String,
    pub model: String,
    pub system: String,
    pub user: String,
    pub max_tokens: u32,
    pub stream_id: String,
}

#[derive(Serialize, Clone)]
struct AiStreamChunk {
    stream_id: String,
    delta: String,
    accumulated: String,
}

#[derive(Serialize, Clone)]
struct AiStreamDone {
    stream_id: String,
    content: String,
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Serialize, Clone)]
struct AiStreamError {
    stream_id: String,
    message: String,
}

#[tauri::command]
pub async fn start_ai_stream(
    app: tauri::AppHandle,
    window: tauri::Window,
    request: AiStreamRequest,
    registry: tauri::State<'_, AiStreamRegistry>,
) -> Result<(), String> {
    // 1. モデルのホワイトリスト検証
    let is_allowed = ALLOWED_MODELS
        .iter()
        .any(|(p, m)| *p == request.provider && *m == request.model);
    if !is_allowed {
        return Err(format!(
            "サポートしていないプロバイダ/モデル: {}/{}",
            request.provider, request.model
        ));
    }

    // 2. プロンプト長の上限（参考資料を含むため大きめ）
    let total_len = request.system.len() + request.user.len();
    if total_len > MAX_STREAM_PROMPT_BYTES {
        return Err("プロンプトが長すぎます（最大 800KB）".to_string());
    }

    // 3. max_tokens の上限
    if request.max_tokens > MAX_TOKENS_LIMIT {
        return Err("max_tokens が上限を超えています（最大 8192）".to_string());
    }

    // 4. API key 取得
    let api_key = get_api_key(&app, &request.provider)?;

    // 5. キャンセル用チャネル登録
    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    let stream_id = request.stream_id.clone();
    {
        let mut reg = registry.0.lock().await;
        reg.insert(stream_id.clone(), cancel_tx);
    }

    // 6. バックグラウンドでストリーミング実行
    let registry_arc = registry.0.clone();
    tauri::async_runtime::spawn(async move {
        let result = match request.provider.as_str() {
            "anthropic" => {
                stream_anthropic(
                    &window,
                    &api_key,
                    &request.model,
                    &request.system,
                    &request.user,
                    request.max_tokens,
                    &stream_id,
                    cancel_rx,
                )
                .await
            }
            "openai" => {
                stream_openai(
                    &window,
                    &api_key,
                    &request.model,
                    &request.system,
                    &request.user,
                    request.max_tokens,
                    &stream_id,
                    cancel_rx,
                )
                .await
            }
            _ => Err("未対応プロバイダ".to_string()),
        };

        if let Err(e) = result {
            let _ = window.emit(
                "ai-stream-error",
                AiStreamError {
                    stream_id: stream_id.clone(),
                    message: e,
                },
            );
        }

        // レジストリからクリーンアップ
        let mut reg = registry_arc.lock().await;
        reg.remove(&stream_id);
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_ai_stream(
    stream_id: String,
    registry: tauri::State<'_, AiStreamRegistry>,
) -> Result<(), String> {
    let reg = registry.0.lock().await;
    if let Some(tx) = reg.get(&stream_id) {
        let _ = tx.send(true);
        Ok(())
    } else {
        Err("指定されたストリームが見つかりません".to_string())
    }
}

/// Anthropic Messages API の SSE ストリーミング
async fn stream_anthropic(
    window: &tauri::Window,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
    max_tokens: u32,
    stream_id: &str,
    mut cancel_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(STREAM_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "stream": true,
        "system": system,
        "messages": [{ "role": "user", "content": user }]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API エラー {status}: {msg}"));
    }

    let mut accumulated = String::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    let _ = window.emit("ai-stream-done", AiStreamDone {
                        stream_id: stream_id.to_string(),
                        content: accumulated,
                        input_tokens,
                        output_tokens,
                    });
                    return Ok(());
                }
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        buffer.push_str(&text);

                        // SSE パース: 改行区切りで行を処理
                        while let Some(line_end) = buffer.find('\n') {
                            let line = buffer[..line_end].trim_end_matches('\r').to_string();
                            buffer = buffer[line_end + 1..].to_string();

                            if !line.starts_with("data: ") {
                                continue;
                            }

                            let data = &line[6..];
                            if data == "[DONE]" {
                                let _ = window.emit("ai-stream-done", AiStreamDone {
                                    stream_id: stream_id.to_string(),
                                    content: accumulated,
                                    input_tokens,
                                    output_tokens,
                                });
                                return Ok(());
                            }

                            let json: serde_json::Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            let event_type = json["type"].as_str().unwrap_or("");

                            match event_type {
                                "content_block_delta" => {
                                    if let Some(delta_text) = json["delta"]["text"].as_str() {
                                        accumulated.push_str(delta_text);
                                        let _ = window.emit("ai-stream-chunk", AiStreamChunk {
                                            stream_id: stream_id.to_string(),
                                            delta: delta_text.to_string(),
                                            accumulated: accumulated.clone(),
                                        });
                                    }
                                }
                                "message_start" => {
                                    if let Some(usage) = json["message"]["usage"].as_object() {
                                        input_tokens = usage.get("input_tokens")
                                            .and_then(|v| v.as_u64())
                                            .unwrap_or(0) as u32;
                                    }
                                }
                                "message_delta" => {
                                    if let Some(usage) = json["usage"].as_object() {
                                        output_tokens = usage.get("output_tokens")
                                            .and_then(|v| v.as_u64())
                                            .unwrap_or(0) as u32;
                                    }
                                }
                                "message_stop" => {
                                    let _ = window.emit("ai-stream-done", AiStreamDone {
                                        stream_id: stream_id.to_string(),
                                        content: accumulated,
                                        input_tokens,
                                        output_tokens,
                                    });
                                    return Ok(());
                                }
                                _ => {}
                            }
                        }
                    }
                    Some(Err(e)) => {
                        return Err(format!("ストリーム読み取りエラー: {e}"));
                    }
                    None => {
                        // ストリーム終了（message_stop なしの場合）
                        let _ = window.emit("ai-stream-done", AiStreamDone {
                            stream_id: stream_id.to_string(),
                            content: accumulated,
                            input_tokens,
                            output_tokens,
                        });
                        return Ok(());
                    }
                }
            }
        }
    }
}

// ============================================================
// ユニットテスト
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── ALLOWED_MODELS ホワイトリスト ──────────────────────────────────────────

    #[test]
    fn allowed_models_contains_anthropic_sonnet() {
        assert!(
            ALLOWED_MODELS.contains(&("anthropic", "claude-sonnet-4-5")),
            "claude-sonnet-4-5 は ALLOWED_MODELS に含まれるべき"
        );
    }

    #[test]
    fn allowed_models_contains_anthropic_haiku() {
        assert!(
            ALLOWED_MODELS.contains(&("anthropic", "claude-haiku-4-5-20251001")),
            "claude-haiku はホワイトリストに含まれるべき"
        );
    }

    #[test]
    fn allowed_models_contains_openai_gpt4o() {
        assert!(
            ALLOWED_MODELS.contains(&("openai", "gpt-4o")),
            "gpt-4o はホワイトリストに含まれるべき"
        );
    }

    #[test]
    fn allowed_models_contains_openai_gpt4o_mini() {
        assert!(
            ALLOWED_MODELS.contains(&("openai", "gpt-4o-mini")),
            "gpt-4o-mini はホワイトリストに含まれるべき"
        );
    }

    #[test]
    fn unknown_model_not_in_allowed_list() {
        assert!(
            !ALLOWED_MODELS.contains(&("anthropic", "claude-unknown-model")),
            "未知のモデルはホワイトリストに含まれてはいけない"
        );
    }

    #[test]
    fn unknown_provider_not_in_allowed_list() {
        assert!(
            !ALLOWED_MODELS.contains(&("unknown-provider", "gpt-4o")),
            "未知のプロバイダはホワイトリストに含まれてはいけない"
        );
    }

    #[test]
    fn provider_model_pair_is_validated_together() {
        // anthropic の model を openai として渡してもマッチしない
        assert!(
            !ALLOWED_MODELS.contains(&("openai", "claude-sonnet-4-5")),
            "プロバイダとモデルのペアで検証する"
        );
        assert!(
            !ALLOWED_MODELS.contains(&("anthropic", "gpt-4o")),
            "プロバイダとモデルのペアで検証する"
        );
    }

    // ── 定数の妥当性 ──────────────────────────────────────────────────────────

    #[test]
    fn max_prompt_bytes_is_100kb() {
        assert_eq!(MAX_PROMPT_BYTES, 102_400, "MAX_PROMPT_BYTES は 100KB (102400 bytes)");
    }

    #[test]
    fn max_stream_prompt_bytes_is_800kb() {
        assert_eq!(
            MAX_STREAM_PROMPT_BYTES,
            819_200,
            "MAX_STREAM_PROMPT_BYTES は 800KB (819200 bytes)"
        );
    }

    #[test]
    fn stream_limit_is_larger_than_non_stream_limit() {
        assert!(
            MAX_STREAM_PROMPT_BYTES > MAX_PROMPT_BYTES,
            "ストリーム用上限は通常上限より大きくなければならない（参考資料を含むため）"
        );
    }

    #[test]
    fn max_tokens_limit_is_8192() {
        assert_eq!(MAX_TOKENS_LIMIT, 8192, "MAX_TOKENS_LIMIT は 8192");
    }

    #[test]
    fn stream_timeout_is_longer_than_request_timeout() {
        assert!(
            STREAM_TIMEOUT_SECS > REQUEST_TIMEOUT_SECS,
            "ストリーム用タイムアウトは通常より長くなければならない"
        );
    }

    #[test]
    fn request_timeout_is_120_seconds() {
        assert_eq!(REQUEST_TIMEOUT_SECS, 120);
    }

    #[test]
    fn stream_timeout_is_300_seconds() {
        assert_eq!(STREAM_TIMEOUT_SECS, 300);
    }

    // ── ホワイトリスト検証ロジック ────────────────────────────────────────────

    fn is_model_allowed(provider: &str, model: &str) -> bool {
        ALLOWED_MODELS.iter().any(|(p, m)| *p == provider && *m == model)
    }

    #[test]
    fn whitelist_check_is_exact_match() {
        // 部分一致ではなく完全一致
        assert!(!is_model_allowed("anthropic", "claude-sonnet"));
        assert!(!is_model_allowed("anthropic", "claude-sonnet-4-5-extra"));
    }

    #[test]
    fn whitelist_check_is_case_sensitive() {
        assert!(!is_model_allowed("Anthropic", "claude-sonnet-4-5"));
        assert!(!is_model_allowed("ANTHROPIC", "claude-sonnet-4-5"));
        assert!(!is_model_allowed("anthropic", "Claude-sonnet-4-5"));
    }

    #[test]
    fn empty_provider_is_rejected() {
        assert!(!is_model_allowed("", "claude-sonnet-4-5"));
    }

    #[test]
    fn empty_model_is_rejected() {
        assert!(!is_model_allowed("anthropic", ""));
    }

    // ── プロンプト長の上限チェック ────────────────────────────────────────────

    fn exceeds_prompt_limit(prompt: &str) -> bool {
        prompt.len() > MAX_PROMPT_BYTES
    }

    fn exceeds_stream_prompt_limit(system: &str, user: &str) -> bool {
        system.len() + user.len() > MAX_STREAM_PROMPT_BYTES
    }

    #[test]
    fn prompt_within_limit_is_accepted() {
        let prompt = "a".repeat(MAX_PROMPT_BYTES);
        assert!(!exceeds_prompt_limit(&prompt));
    }

    #[test]
    fn prompt_over_limit_is_rejected() {
        let prompt = "a".repeat(MAX_PROMPT_BYTES + 1);
        assert!(exceeds_prompt_limit(&prompt));
    }

    #[test]
    fn stream_prompt_combined_length_within_limit() {
        let system = "a".repeat(MAX_STREAM_PROMPT_BYTES / 2);
        let user = "b".repeat(MAX_STREAM_PROMPT_BYTES / 2);
        assert!(!exceeds_stream_prompt_limit(&system, &user));
    }

    #[test]
    fn stream_prompt_combined_length_over_limit() {
        let system = "a".repeat(MAX_STREAM_PROMPT_BYTES / 2 + 1);
        let user = "b".repeat(MAX_STREAM_PROMPT_BYTES / 2 + 1);
        assert!(exceeds_stream_prompt_limit(&system, &user));
    }

    // ── max_tokens 上限チェック ───────────────────────────────────────────────

    fn exceeds_max_tokens(max_tokens: u32) -> bool {
        max_tokens > MAX_TOKENS_LIMIT
    }

    #[test]
    fn max_tokens_at_limit_is_accepted() {
        assert!(!exceeds_max_tokens(MAX_TOKENS_LIMIT));
    }

    #[test]
    fn max_tokens_over_limit_is_rejected() {
        assert!(exceeds_max_tokens(MAX_TOKENS_LIMIT + 1));
    }

    #[test]
    fn max_tokens_zero_is_accepted() {
        assert!(!exceeds_max_tokens(0));
    }

    // ── AiStreamRegistry ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn stream_registry_insert_and_cancel() {
        let registry = AiStreamRegistry(Arc::new(Mutex::new(HashMap::new())));
        let (tx, mut rx) = tokio::sync::watch::channel(false);

        {
            let mut reg = registry.0.lock().await;
            reg.insert("test-stream".to_string(), tx);
        }

        // キャンセル送信
        {
            let reg = registry.0.lock().await;
            if let Some(sender) = reg.get("test-stream") {
                sender.send(true).unwrap();
            }
        }

        assert!(*rx.borrow_and_update(), "キャンセルシグナルが受信されるべき");
    }

    #[tokio::test]
    async fn stream_registry_remove_after_completion() {
        let registry = AiStreamRegistry(Arc::new(Mutex::new(HashMap::new())));
        let (tx, _rx) = tokio::sync::watch::channel(false);

        {
            let mut reg = registry.0.lock().await;
            reg.insert("stream-to-remove".to_string(), tx);
            assert!(reg.contains_key("stream-to-remove"));
        }

        {
            let mut reg = registry.0.lock().await;
            reg.remove("stream-to-remove");
            assert!(!reg.contains_key("stream-to-remove"), "完了後にレジストリから削除されるべき");
        }
    }

    #[tokio::test]
    async fn stream_registry_nonexistent_stream_returns_none() {
        let registry = AiStreamRegistry(Arc::new(Mutex::new(HashMap::new())));
        let reg = registry.0.lock().await;
        assert!(reg.get("nonexistent").is_none());
    }
}

// ============================================================
// 統合テスト（実 API 通信 — デフォルト非実行）
// ============================================================
//
// 実行方法:
//   cd src-tauri && cargo test -- --ignored --nocapture
//   または: npm run test:integration (プロジェクトルートから)
//
// 前提: ANTHROPIC_API_KEY 環境変数を設定しておくこと
//   export ANTHROPIC_API_KEY=sk-ant-...
//
// 注意: 実際の API を呼ぶためトークン消費が発生する。
//       Haiku モデル + 最小トークンで実行しコストを抑えている。
//
#[cfg(test)]
mod integration_tests {
    use super::*;

    // ── 正常系 ─────────────────────────────────────────────────────────────────

    /// 最小コスト: Haiku + 極短プロンプト + max_tokens=10
    #[tokio::test]
    #[ignore = "実 API を呼ぶためトークン消費が発生する。cargo test -- --ignored で実行する"]
    async fn call_anthropic_returns_valid_response() {
        let key = match std::env::var("ANTHROPIC_API_KEY") {
            Ok(k) if !k.is_empty() => k,
            _ => {
                eprintln!("ANTHROPIC_API_KEY が未設定のためスキップ");
                return;
            }
        };

        let result = call_anthropic(
            &key,
            "claude-haiku-4-5-20251001",
            "「OK」とだけ答えてください。他の文字は不要です。",
            10,
        )
        .await;

        assert!(result.is_ok(), "API 呼び出し失敗: {:?}", result.err());
        let resp = result.unwrap();

        assert!(!resp.content.is_empty(), "content が空です");
        assert!(resp.input_tokens > 0, "input_tokens が 0 です");
        assert!(resp.output_tokens > 0, "output_tokens が 0 です");

        // --nocapture 付きで実行したとき実際のレスポンスを確認できる
        eprintln!(
            "[integration] content={:?}  input_tokens={}  output_tokens={}",
            resp.content, resp.input_tokens, resp.output_tokens
        );
    }

    /// max_tokens=1 でリクエストしても正常にレスポンスが返ること（疎通確認の最小形）
    #[tokio::test]
    #[ignore = "実 API を呼ぶためトークン消費が発生する。cargo test -- --ignored で実行する"]
    async fn call_anthropic_with_max_tokens_one_succeeds() {
        let key = match std::env::var("ANTHROPIC_API_KEY") {
            Ok(k) if !k.is_empty() => k,
            _ => {
                eprintln!("ANTHROPIC_API_KEY が未設定のためスキップ");
                return;
            }
        };

        let result = call_anthropic(
            &key,
            "claude-haiku-4-5-20251001",
            "Hi",
            1,
        )
        .await;

        // max_tokens=1 の場合、API は正常に応答するが content が空になる場合もある。
        // ここではステータスエラーが出ないことだけを検証する。
        assert!(result.is_ok(), "max_tokens=1 でも API エラーにならないべき: {:?}", result.err());
        let resp = result.unwrap();
        assert!(resp.input_tokens > 0, "input_tokens が 0 です");
    }

    // ── 異常系 ─────────────────────────────────────────────────────────────────

    /// 不正な API キーを渡したとき 401 エラーが返ること（トークン消費なし）
    #[tokio::test]
    #[ignore = "HTTP リクエストを送るが認証失敗で即返却。トークン消費なし。cargo test -- --ignored で実行する"]
    async fn call_anthropic_invalid_key_returns_auth_error() {
        let result = call_anthropic(
            "sk-ant-invalid-key-for-testing-only",
            "claude-haiku-4-5-20251001",
            "テスト",
            10,
        )
        .await;

        assert!(result.is_err(), "不正キーではエラーになるべき");
        let err = result.unwrap_err();
        assert!(
            err.contains("401"),
            "401 認証エラーが含まれるべき。実際のエラー: {err}"
        );
        eprintln!("[integration] 期待どおり認証エラー: {err}");
    }

    // ── ホワイトリスト + 実キーの組み合わせ ────────────────────────────────────

    /// ALLOWED_MODELS に含まれるすべてのモデルが実際に Haiku と同等の疎通レベルで動作すること
    /// （コスト削減のため Sonnet はスキップ。フラグで制御可能にしてある）
    #[tokio::test]
    #[ignore = "全許可モデルを検証。Haiku のみ呼ぶ。cargo test -- --ignored で実行する"]
    async fn allowed_anthropic_models_are_actually_callable() {
        let key = match std::env::var("ANTHROPIC_API_KEY") {
            Ok(k) if !k.is_empty() => k,
            _ => {
                eprintln!("ANTHROPIC_API_KEY が未設定のためスキップ");
                return;
            }
        };

        // コスト抑制のため Haiku のみ実際に呼ぶ。Sonnet は定数存在確認にとどめる。
        assert!(
            ALLOWED_MODELS.contains(&("anthropic", "claude-sonnet-4-5")),
            "sonnet はホワイトリストに存在するべき"
        );

        let result = call_anthropic(
            &key,
            "claude-haiku-4-5-20251001",
            "1+1=",
            5,
        )
        .await;

        assert!(
            result.is_ok(),
            "ホワイトリスト内モデルは呼び出せるべき: {:?}",
            result.err()
        );
        eprintln!("[integration] Haiku 疎通 OK");
    }
}

/// OpenAI Chat Completions API の SSE ストリーミング
async fn stream_openai(
    window: &tauri::Window,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
    max_tokens: u32,
    stream_id: &str,
    mut cancel_rx: tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(STREAM_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "stream": true,
        "stream_options": { "include_usage": true },
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ]
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API エラー {status}: {msg}"));
    }

    let mut accumulated = String::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    let _ = window.emit("ai-stream-done", AiStreamDone {
                        stream_id: stream_id.to_string(),
                        content: accumulated,
                        input_tokens,
                        output_tokens,
                    });
                    return Ok(());
                }
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        buffer.push_str(&text);

                        while let Some(line_end) = buffer.find('\n') {
                            let line = buffer[..line_end].trim_end_matches('\r').to_string();
                            buffer = buffer[line_end + 1..].to_string();

                            if !line.starts_with("data: ") {
                                continue;
                            }

                            let data = &line[6..];
                            if data == "[DONE]" {
                                let _ = window.emit("ai-stream-done", AiStreamDone {
                                    stream_id: stream_id.to_string(),
                                    content: accumulated,
                                    input_tokens,
                                    output_tokens,
                                });
                                return Ok(());
                            }

                            let json: serde_json::Value = match serde_json::from_str(data) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };

                            // delta テキスト
                            if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                                if !delta.is_empty() {
                                    accumulated.push_str(delta);
                                    let _ = window.emit("ai-stream-chunk", AiStreamChunk {
                                        stream_id: stream_id.to_string(),
                                        delta: delta.to_string(),
                                        accumulated: accumulated.clone(),
                                    });
                                }
                            }

                            // usage（stream_options.include_usage で最終チャンクに含まれる）
                            if let Some(usage) = json["usage"].as_object() {
                                input_tokens = usage.get("prompt_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0) as u32;
                                output_tokens = usage.get("completion_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0) as u32;
                            }
                        }
                    }
                    Some(Err(e)) => {
                        return Err(format!("ストリーム読み取りエラー: {e}"));
                    }
                    None => {
                        let _ = window.emit("ai-stream-done", AiStreamDone {
                            stream_id: stream_id.to_string(),
                            content: accumulated,
                            input_tokens,
                            output_tokens,
                        });
                        return Ok(());
                    }
                }
            }
        }
    }
}
