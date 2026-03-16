//! ライセンス認証コマンド
//!
//! Gumroad 組み込みライセンス機能を使ったオンライン検証。
//! 初回アクティベート時のみ Gumroad API を呼び出し、結果をローカルにキャッシュする。
//! 以降の起動ではキャッシュを参照するためオフラインでも動作する。
//!
//! 商品ページ: https://xdhyskh.gumroad.com/l/qwctrq
//! 検証 API:   POST https://api.gumroad.com/v2/licenses/verify

use std::path::Path;
use std::path::PathBuf;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::models::error::AppError;

const GUMROAD_PRODUCT_ID: &str = "0_ml-BRsSAwHNWSsPjywng==";
const GUMROAD_VERIFY_URL: &str = "https://api.gumroad.com/v2/licenses/verify";
const REQUEST_TIMEOUT_SECS: u64 = 15;

// ---- Gumroad API レスポンス型 ----

#[derive(Debug, Deserialize)]
pub(crate) struct GumroadVerifyResponse {
    pub success: bool,
    pub message: Option<String>,
    pub purchase: Option<GumroadPurchase>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct GumroadPurchase {
    pub email: String,
    pub refunded: bool,
    pub chargebacked: bool,
    #[allow(dead_code)]
    pub disputed: bool,
}

// ---- ローカルキャッシュ ----

/// ライセンスファイルのデータ構造（app_data_dir/license.json）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct LicenseData {
    pub key: String,
    pub email: String,
    /// Unix エポック秒
    pub activated_at: u64,
}

// ---- フロントエンド向け型 ----

/// フロントエンドに返すライセンス状態
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub activated: bool,
    pub email: Option<String>,
    /// Unix エポック秒。フロントエンド側でフォーマットする
    pub activated_at: Option<u64>,
}

// ---- テスタブルな内部関数 ----

/// ライセンスキャッシュファイルを読み込む。
/// ファイルが存在しない・壊れている場合は None を返す。
pub(crate) fn read_cached_license_at(path: &Path) -> Option<LicenseData> {
    let json = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&json).ok()
}

/// ライセンスキャッシュをファイルに書き込む。
/// 親ディレクトリが存在しない場合は作成する。
pub(crate) fn write_cached_license_at(path: &Path, data: &LicenseData) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Unknown { message: e.to_string() })?;
    }
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| AppError::Unknown { message: e.to_string() })?;
    std::fs::write(path, json).map_err(|e| AppError::from_io(e, &path.to_string_lossy()))
}

/// Gumroad API を呼び出してライセンスキーを検証する。
/// テストでは `api_url` に mockito のアドレスを渡す。
pub(crate) async fn call_gumroad_verify(
    client: &Client,
    api_url: &str,
    product_permalink: &str,
    key: &str,
) -> Result<GumroadVerifyResponse, String> {
    let response = client
        .post(api_url)
        .form(&[
            ("product_id", product_permalink),
            ("license_key", key),
            ("increment_uses_count", "true"),
        ])
        .send()
        .await
        .map_err(|e| {
            let msg = if e.is_timeout() {
                "接続がタイムアウトしました。インターネット接続を確認してください。".to_string()
            } else {
                format!("ネットワークエラー: {}", e)
            };
            serde_json::to_string(&AppError::Unknown { message: msg }).unwrap_or_default()
        })?;

    response.json::<GumroadVerifyResponse>().await.map_err(|e| {
        serde_json::to_string(&AppError::Unknown { message: e.to_string() }).unwrap_or_default()
    })
}

/// Gumroad レスポンスを解釈して LicenseData を返すか、エラー文字列を返す。
pub(crate) fn interpret_gumroad_response(
    response: GumroadVerifyResponse,
    key: &str,
) -> Result<LicenseData, String> {
    if !response.success {
        let msg = response
            .message
            .unwrap_or_else(|| "ライセンスキーが無効です".to_string());
        return Err(
            serde_json::to_string(&AppError::Unknown { message: msg }).unwrap_or_default()
        );
    }

    let purchase = response.purchase.ok_or_else(|| {
        serde_json::to_string(&AppError::LicenseInvalid).unwrap_or_default()
    })?;

    if purchase.refunded || purchase.chargebacked {
        let msg =
            "このライセンスは返金または異議申し立て済みのため使用できません。".to_string();
        return Err(
            serde_json::to_string(&AppError::Unknown { message: msg }).unwrap_or_default()
        );
    }

    Ok(LicenseData {
        key: key.to_string(),
        email: purchase.email,
        activated_at: now_unix_secs(),
    })
}

// ---- ヘルパー ----

fn license_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| AppError::Unknown { message: e.to_string() })?;
    Ok(data_dir.join("license.json"))
}

pub(crate) fn now_unix_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ---- Tauri コマンド ----

/// ライセンスキーを Gumroad API で検証してアクティベートする。
#[tauri::command]
pub async fn activate_license(app: AppHandle, key: String) -> Result<LicenseStatus, String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err(serde_json::to_string(&AppError::LicenseInvalid).unwrap_or_default());
    }

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| {
            serde_json::to_string(&AppError::Unknown { message: e.to_string() })
                .unwrap_or_default()
        })?;

    let response =
        call_gumroad_verify(&client, GUMROAD_VERIFY_URL, GUMROAD_PRODUCT_ID, &key)
            .await?;

    let license = interpret_gumroad_response(response, &key)?;

    let path = license_file_path(&app).map_err(|e| String::from(e))?;
    write_cached_license_at(&path, &license).map_err(|e| String::from(e))?;

    Ok(LicenseStatus {
        activated: true,
        email: Some(license.email),
        activated_at: Some(license.activated_at),
    })
}

/// キャッシュからライセンス状態を返す（オフライン）。
#[tauri::command]
pub fn get_license_status(app: AppHandle) -> LicenseStatus {
    let Some(path) = license_file_path(&app).ok() else {
        return LicenseStatus { activated: false, email: None, activated_at: None };
    };
    match read_cached_license_at(&path) {
        Some(lic) => LicenseStatus {
            activated: true,
            email: Some(lic.email),
            activated_at: Some(lic.activated_at),
        },
        None => LicenseStatus { activated: false, email: None, activated_at: None },
    }
}

/// ライセンスキャッシュを削除する（デバイス移行・再認証用）。
#[tauri::command]
pub fn remove_license(app: AppHandle) -> Result<(), String> {
    let path = license_file_path(&app).map_err(|e| String::from(e))?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| String::from(AppError::from_io(e, &path.to_string_lossy())))?;
    }
    Ok(())
}

// ---- 試用期間 ----

const TRIAL_DAYS: i64 = 30;

/// 試用期間データ（app_data_dir/trial.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct TrialData {
    /// 初回起動時の Unix エポック秒
    pub first_launch: u64,
}

/// フロントエンドに返す試用期間状態
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrialStatus {
    /// 残り日数（0 以下なら期限切れ）
    pub days_remaining: i64,
    pub is_expired: bool,
}

fn trial_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| AppError::Unknown { message: e.to_string() })?;
    Ok(data_dir.join("trial.json"))
}

/// 試用期間状態を返す。初回呼び出し時に trial.json を作成して起算日を記録する。
#[tauri::command]
pub fn get_trial_status(app: AppHandle) -> TrialStatus {
    let Ok(path) = trial_file_path(&app) else {
        // パス取得失敗時は未期限扱いにしてアプリを止めない
        return TrialStatus { days_remaining: TRIAL_DAYS, is_expired: false };
    };

    let first_launch = if path.exists() {
        let json = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str::<TrialData>(&json)
            .ok()
            .map(|d| d.first_launch)
            .unwrap_or_else(now_unix_secs)
    } else {
        // 初回起動: trial.json を作成
        let now = now_unix_secs();
        let data = TrialData { first_launch: now };
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&data) {
            let _ = std::fs::write(&path, json);
        }
        now
    };

    let now = now_unix_secs();
    let elapsed_days = now.saturating_sub(first_launch) / 86400;
    let days_remaining = (TRIAL_DAYS - elapsed_days as i64).max(0);

    TrialStatus { days_remaining, is_expired: elapsed_days as i64 >= TRIAL_DAYS }
}

// ---- テスト ----

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    // =========================================================================
    // ストレージ層: read_cached_license_at
    // =========================================================================

    #[test]
    fn read_returns_none_when_file_does_not_exist() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        assert!(read_cached_license_at(&path).is_none());
    }

    #[test]
    fn read_returns_none_for_malformed_json() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        fs::write(&path, "{ not valid json }").unwrap();
        assert!(read_cached_license_at(&path).is_none());
    }

    #[test]
    fn read_returns_none_for_empty_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        fs::write(&path, "").unwrap();
        assert!(read_cached_license_at(&path).is_none());
    }

    #[test]
    fn read_returns_none_for_json_missing_required_fields() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        // email フィールドが欠落
        fs::write(&path, r#"{"key":"abc","activated_at":1000}"#).unwrap();
        assert!(read_cached_license_at(&path).is_none());
    }

    #[test]
    fn read_returns_data_for_valid_json() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        let data = LicenseData {
            key: "ABCD-1234-EFGH-5678".to_string(),
            email: "user@example.com".to_string(),
            activated_at: 1_700_000_000,
        };
        let json = serde_json::to_string(&data).unwrap();
        fs::write(&path, json).unwrap();

        let result = read_cached_license_at(&path).unwrap();
        assert_eq!(result, data);
    }

    // =========================================================================
    // ストレージ層: write_cached_license_at
    // =========================================================================

    #[test]
    fn write_creates_file_with_correct_content() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        let data = LicenseData {
            key: "TEST-KEY".to_string(),
            email: "writer@example.com".to_string(),
            activated_at: 1_700_000_000,
        };

        write_cached_license_at(&path, &data).unwrap();

        assert!(path.exists());
        let read_back = read_cached_license_at(&path).unwrap();
        assert_eq!(read_back, data);
    }

    #[test]
    fn write_creates_parent_directories_if_missing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("nested").join("deep").join("license.json");
        let data = LicenseData {
            key: "KEY".to_string(),
            email: "e@example.com".to_string(),
            activated_at: 1,
        };

        write_cached_license_at(&path, &data).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn write_overwrites_existing_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        let original = LicenseData {
            key: "OLD-KEY".to_string(),
            email: "old@example.com".to_string(),
            activated_at: 1_000,
        };
        let updated = LicenseData {
            key: "NEW-KEY".to_string(),
            email: "new@example.com".to_string(),
            activated_at: 2_000,
        };

        write_cached_license_at(&path, &original).unwrap();
        write_cached_license_at(&path, &updated).unwrap();

        let result = read_cached_license_at(&path).unwrap();
        assert_eq!(result, updated);
    }

    // =========================================================================
    // ストレージ層: 往復テスト
    // =========================================================================

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        let data = LicenseData {
            key: "ROUNDTRIP-KEY-ABCDEF".to_string(),
            email: "roundtrip@test.example.com".to_string(),
            activated_at: 1_750_000_000,
        };

        write_cached_license_at(&path, &data).unwrap();
        let result = read_cached_license_at(&path).unwrap();
        assert_eq!(result.key, data.key);
        assert_eq!(result.email, data.email);
        assert_eq!(result.activated_at, data.activated_at);
    }

    // =========================================================================
    // interpret_gumroad_response
    // =========================================================================

    fn make_valid_response(email: &str) -> GumroadVerifyResponse {
        GumroadVerifyResponse {
            success: true,
            message: None,
            purchase: Some(GumroadPurchase {
                email: email.to_string(),
                refunded: false,
                chargebacked: false,
                disputed: false,
            }),
        }
    }

    #[test]
    fn interpret_success_response_returns_license_data() {
        let resp = make_valid_response("buyer@example.com");
        let result = interpret_gumroad_response(resp, "TEST-KEY").unwrap();
        assert_eq!(result.key, "TEST-KEY");
        assert_eq!(result.email, "buyer@example.com");
        assert!(result.activated_at > 0);
    }

    #[test]
    fn interpret_failure_response_returns_gumroad_message() {
        let resp = GumroadVerifyResponse {
            success: false,
            message: Some("That license does not exist for the provided product.".to_string()),
            purchase: None,
        };
        let err = interpret_gumroad_response(resp, "BAD-KEY").unwrap_err();
        assert!(
            err.contains("That license does not exist"),
            "エラーにGumroadのメッセージが含まれるべき: {err}"
        );
    }

    #[test]
    fn interpret_failure_with_no_message_returns_default_message() {
        let resp = GumroadVerifyResponse {
            success: false,
            message: None,
            purchase: None,
        };
        let err = interpret_gumroad_response(resp, "KEY").unwrap_err();
        assert!(err.contains("無効"), "デフォルトのエラーメッセージが含まれるべき: {err}");
    }

    #[test]
    fn interpret_success_with_no_purchase_returns_error() {
        // Gumroad が success: true を返したが purchase フィールドがない（異常ケース）
        let resp = GumroadVerifyResponse { success: true, message: None, purchase: None };
        assert!(interpret_gumroad_response(resp, "KEY").is_err());
    }

    #[test]
    fn interpret_refunded_purchase_returns_error() {
        let resp = GumroadVerifyResponse {
            success: true,
            message: None,
            purchase: Some(GumroadPurchase {
                email: "refunded@example.com".to_string(),
                refunded: true,
                chargebacked: false,
                disputed: false,
            }),
        };
        let err = interpret_gumroad_response(resp, "KEY").unwrap_err();
        assert!(err.contains("返金"), "返金エラーメッセージが含まれるべき: {err}");
    }

    #[test]
    fn interpret_chargebacked_purchase_returns_error() {
        let resp = GumroadVerifyResponse {
            success: true,
            message: None,
            purchase: Some(GumroadPurchase {
                email: "cb@example.com".to_string(),
                refunded: false,
                chargebacked: true,
                disputed: false,
            }),
        };
        let err = interpret_gumroad_response(resp, "KEY").unwrap_err();
        assert!(err.contains("異議申し立て"), "チャージバックエラーが含まれるべき: {err}");
    }

    #[test]
    fn interpret_both_refunded_and_chargebacked_returns_error() {
        let resp = GumroadVerifyResponse {
            success: true,
            message: None,
            purchase: Some(GumroadPurchase {
                email: "both@example.com".to_string(),
                refunded: true,
                chargebacked: true,
                disputed: false,
            }),
        };
        assert!(interpret_gumroad_response(resp, "KEY").is_err());
    }

    // =========================================================================
    // call_gumroad_verify (mockito でHTTPモック)
    // =========================================================================

    fn rt() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
    }

    #[test]
    fn call_gumroad_verify_success_response_is_parsed() {
        let rt = rt();
        rt.block_on(async {
            let mut server = mockito::Server::new_async().await;
            let _m = server
                .mock("POST", "/v2/licenses/verify")
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body(
                    r#"{
                      "success": true,
                      "purchase": {
                        "email": "buyer@example.com",
                        "refunded": false,
                        "chargebacked": false,
                        "disputed": false
                      }
                    }"#,
                )
                .create_async()
                .await;

            let client = Client::new();
            let url = format!("{}/v2/licenses/verify", server.url());
            let resp = call_gumroad_verify(&client, &url, "qwctrq", "VALID-KEY")
                .await
                .unwrap();

            assert!(resp.success);
            let purchase = resp.purchase.unwrap();
            assert_eq!(purchase.email, "buyer@example.com");
            assert!(!purchase.refunded);
        });
    }

    #[test]
    fn call_gumroad_verify_invalid_key_response_is_parsed() {
        let rt = rt();
        rt.block_on(async {
            let mut server = mockito::Server::new_async().await;
            let _m = server
                .mock("POST", "/v2/licenses/verify")
                .with_status(404)
                .with_header("content-type", "application/json")
                .with_body(
                    r#"{
                      "success": false,
                      "message": "That license does not exist for the provided product."
                    }"#,
                )
                .create_async()
                .await;

            let client = Client::new();
            let url = format!("{}/v2/licenses/verify", server.url());
            let resp = call_gumroad_verify(&client, &url, "qwctrq", "BAD-KEY")
                .await
                .unwrap();

            assert!(!resp.success);
            assert!(resp.message.unwrap().contains("does not exist"));
        });
    }

    #[test]
    fn call_gumroad_verify_returns_error_on_malformed_json() {
        let rt = rt();
        rt.block_on(async {
            let mut server = mockito::Server::new_async().await;
            let _m = server
                .mock("POST", "/v2/licenses/verify")
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body("not json at all")
                .create_async()
                .await;

            let client = Client::new();
            let url = format!("{}/v2/licenses/verify", server.url());
            let result = call_gumroad_verify(&client, &url, "qwctrq", "KEY").await;
            assert!(result.is_err(), "不正なJSONはエラーになるべき");
        });
    }

    #[test]
    fn call_gumroad_verify_returns_error_on_connection_refused() {
        let rt = rt();
        rt.block_on(async {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(2))
                .build()
                .unwrap();
            // 存在しないポートに接続 → 接続拒否
            let result = call_gumroad_verify(
                &client,
                "http://127.0.0.1:1", // 使われていないポート
                "qwctrq",
                "KEY",
            )
            .await;
            assert!(result.is_err(), "接続拒否はエラーになるべき");
        });
    }

    #[test]
    fn call_gumroad_verify_sends_correct_form_fields() {
        let rt = rt();
        rt.block_on(async {
            let mut server = mockito::Server::new_async().await;
            // フォームフィールドが正しく送信されることを確認
            let _m = server
                .mock("POST", "/v2/licenses/verify")
                .match_body(mockito::Matcher::AllOf(vec![
                    mockito::Matcher::Regex("product_id=qwctrq".to_string()),
                    mockito::Matcher::Regex("license_key=MY-KEY".to_string()),
                    mockito::Matcher::Regex("increment_uses_count=true".to_string()),
                ]))
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body(
                    r#"{"success":true,"purchase":{"email":"x@y.com","refunded":false,"chargebacked":false,"disputed":false}}"#,
                )
                .create_async()
                .await;

            let client = Client::new();
            let url = format!("{}/v2/licenses/verify", server.url());
            let result = call_gumroad_verify(&client, &url, "qwctrq", "MY-KEY").await;
            assert!(result.is_ok());
            // モックが呼ばれたことを検証 (フィールド不一致なら mock は 501 を返す)
        });
    }

    // =========================================================================
    // 完全フロー: interpret + write + read
    // =========================================================================

    #[test]
    fn full_activate_flow_writes_cache_and_is_readable() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");

        let resp = make_valid_response("full@example.com");
        let license = interpret_gumroad_response(resp, "FULL-FLOW-KEY").unwrap();
        write_cached_license_at(&path, &license).unwrap();

        let status_data = read_cached_license_at(&path).unwrap();
        assert_eq!(status_data.key, "FULL-FLOW-KEY");
        assert_eq!(status_data.email, "full@example.com");
        assert!(status_data.activated_at > 0);
    }

    #[test]
    fn remove_license_file_deletes_existing_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("license.json");
        let data = LicenseData {
            key: "K".to_string(),
            email: "e@e.com".to_string(),
            activated_at: 1,
        };
        write_cached_license_at(&path, &data).unwrap();
        assert!(path.exists());

        fs::remove_file(&path).unwrap();
        assert!(!path.exists());

        // 削除後に read → None
        assert!(read_cached_license_at(&path).is_none());
    }

    #[test]
    fn remove_nonexistent_file_is_noop() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("ghost.json");
        // ファイルが存在しなくてもパニックしない
        if path.exists() {
            fs::remove_file(&path).unwrap();
        }
        // exists() が false のときは remove_file を呼ばない（Tauriコマンドの実装と同じ）
        assert!(!path.exists());
    }

    // =========================================================================
    // 空キーのバリデーション
    // =========================================================================

    #[test]
    fn empty_key_after_trim_is_invalid() {
        // activate_license コマンド相当のバリデーション
        let key = "   ".trim().to_string();
        assert!(key.is_empty(), "空白のみのキーはトリム後に空になるべき");
    }

    #[test]
    fn key_with_leading_trailing_spaces_is_trimmed() {
        let key = "  ABCD-1234  ".trim().to_string();
        assert_eq!(key, "ABCD-1234");
    }

    // =========================================================================
    // 実Gumroad API 統合テスト
    //
    // デフォルトでは skip される (#[ignore])。
    // 実行方法:
    //   $env:MARKWEAVE_TEST_LICENSE_KEY="XXXX-XXXX-XXXX-XXXX"  (PowerShell)
    //   cargo test -- --include-ignored real_gumroad
    // =========================================================================

    /// 有効なライセンスキーで Gumroad API を呼び出し、成功レスポンスを検証する。
    /// MARKWEAVE_TEST_LICENSE_KEY 環境変数が未設定の場合はスキップ。
    #[test]
    #[ignore = "実際のGumroad APIを呼ぶ統合テスト。MARKWEAVE_TEST_LICENSE_KEY 必須"]
    fn real_gumroad_valid_key_returns_success() {
        let key = match std::env::var("MARKWEAVE_TEST_LICENSE_KEY") {
            Ok(k) => k,
            Err(_) => {
                eprintln!("MARKWEAVE_TEST_LICENSE_KEY が未設定のためスキップ");
                return;
            }
        };

        let rt = rt();
        rt.block_on(async {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap();

            let resp = call_gumroad_verify(
                &client,
                GUMROAD_VERIFY_URL,
                GUMROAD_PRODUCT_ID,
                key.trim(),
            )
            .await
            .expect("Gumroad API の呼び出しに失敗");

            assert!(
                resp.success,
                "有効なキーは success: true を返すべき。Gumroadメッセージ: {:?}\n\
                 ヒント: 商品設定で「Generate unique license key」が有効か確認してください",
                resp.message
            );

            let purchase = resp.purchase.expect("success: true なら purchase が存在するべき");
            assert!(!purchase.email.is_empty(), "email が空であってはならない");
            assert!(!purchase.refunded, "テスト購入は返金済みであってはならない");
            assert!(!purchase.chargebacked, "テスト購入はチャージバック済みであってはならない");

            eprintln!("✅ Gumroad 認証成功: email={}", purchase.email);

            // interpret まで通して LicenseData になることを確認
            let resp2 = call_gumroad_verify(
                &client,
                GUMROAD_VERIFY_URL,
                GUMROAD_PRODUCT_ID,
                key.trim(),
            )
            .await
            .unwrap();
            let license = interpret_gumroad_response(resp2, key.trim())
                .expect("interpret_gumroad_response が失敗");
            assert_eq!(license.key, key.trim());
            assert!(!license.email.is_empty());
            assert!(license.activated_at > 0);

            eprintln!("✅ フルフロー確認完了: key={} email={}", &license.key[..8], license.email);
        });
    }

    /// 存在しないキーで Gumroad API を呼び出し、失敗レスポンスを検証する。
    #[test]
    #[ignore = "実際のGumroad APIを呼ぶ統合テスト"]
    fn real_gumroad_invalid_key_returns_failure() {
        let rt = rt();
        rt.block_on(async {
            let client = Client::new();
            let resp = call_gumroad_verify(
                &client,
                GUMROAD_VERIFY_URL,
                GUMROAD_PRODUCT_ID,
                "00000000-00000000-00000000-00000000",
            )
            .await
            .expect("Gumroad API の呼び出し自体は成功するべき");

            assert!(!resp.success, "存在しないキーは success: false を返すべき");
            assert!(
                resp.message.is_some(),
                "失敗レスポンスには message が含まれるべき"
            );
            eprintln!("✅ 無効キー確認: message={:?}", resp.message);
        });
    }

    /// 有効キー → キャッシュ書き込み → 読み出し の完全フローを実APIで検証。
    #[test]
    #[ignore = "実際のGumroad APIを呼ぶ統合テスト。MARKWEAVE_TEST_LICENSE_KEY 必須"]
    fn real_gumroad_full_activate_and_cache_flow() {
        let key = match std::env::var("MARKWEAVE_TEST_LICENSE_KEY") {
            Ok(k) => k,
            Err(_) => {
                eprintln!("MARKWEAVE_TEST_LICENSE_KEY が未設定のためスキップ");
                return;
            }
        };

        let rt = rt();
        rt.block_on(async {
            let client = Client::new();
            let resp = call_gumroad_verify(
                &client,
                GUMROAD_VERIFY_URL,
                GUMROAD_PRODUCT_ID,
                key.trim(),
            )
            .await
            .unwrap();

            assert!(
                resp.success,
                "有効なキーは success: true を返すべき。Gumroadメッセージ: {:?}",
                resp.message
            );
            let license = interpret_gumroad_response(resp, key.trim()).unwrap();

            // tempdir にキャッシュを書いて読み直す
            let dir = tempdir().unwrap();
            let cache_path = dir.path().join("license.json");
            write_cached_license_at(&cache_path, &license).unwrap();

            let loaded = read_cached_license_at(&cache_path)
                .expect("書き込んだキャッシュが読み出せない");
            assert_eq!(loaded.key, license.key);
            assert_eq!(loaded.email, license.email);
            assert_eq!(loaded.activated_at, license.activated_at);

            eprintln!(
                "✅ キャッシュ往復確認完了: email={} activated_at={}",
                loaded.email, loaded.activated_at
            );
        });
    }
}
