//! AI API 外部通信コマンド（セキュリティ設計書 §4.6 準拠）
//!
//! CSP `connect-src` 制限により WebView から外部 API を直接呼べないため、
//! すべての AI API 通信を Tauri コマンド（Rust）経由で行う。
//!
//! - モデルはホワイトリスト制（フロントから任意指定不可）
//! - API key は Rust 側設定ストアから取得（フロントに渡さない）
//! - プロンプト長・max_tokens に上限を設ける

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

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

/// max_tokens の上限
const MAX_TOKENS_LIMIT: u32 = 8192;

/// HTTP タイムアウト (秒)
const REQUEST_TIMEOUT_SECS: u64 = 120;

#[derive(Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub model: String,
    pub prompt: String,
    pub max_tokens: u32,
}

#[derive(Serialize, Clone)]
pub struct AiResponse {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// API key をストアから取得するヘルパー。
/// `tauri-plugin-store` の設定ファイルから `ai_api_keys.<provider>` を読む。
fn get_api_key(app: &tauri::AppHandle, provider: &str) -> Result<String, String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("設定ストアを開けません: {e}"))?;

    let key_path = format!("ai_api_keys.{provider}");
    store
        .get(&key_path)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("{provider} の API key が設定されていません"))
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
