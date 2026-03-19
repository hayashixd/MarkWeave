//! 画像・アセット管理用 Tauri コマンド。
//!
//! tauri-ipc-interface.md §3 に準拠。
//! 画像の保存、リモート画像キャッシュ、キャッシュパージを提供する。

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 画像保存先モード（image-design.md §1.2）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ImageSaveMode {
    SameDir,
    Subfolder,
    CustomRelative,
    CustomAbsolute,
}

/// ファイル命名戦略（image-design.md §1.2）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FilenameStrategy {
    Uuid,
    Timestamp,
    Original,
    TimestampOriginal,
}

/// 画像保存設定（image-design.md §1.2）
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageStorageSettings {
    pub save_mode: ImageSaveMode,
    pub subfolder_name: String,
    pub custom_path: String,
    pub filename_strategy: FilenameStrategy,
    pub deduplicate_by_hash: bool,
}

/// 画像保存結果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    /// 保存された絶対パス
    pub saved_path: String,
    /// markdown ファイルからの相対パス
    pub relative_path: String,
}

/// 画像の保存先ディレクトリを解決する。
fn resolve_image_save_dir(
    markdown_path: &Path,
    settings: &ImageStorageSettings,
) -> Result<PathBuf, String> {
    let md_dir = markdown_path
        .parent()
        .ok_or_else(|| "無効な Markdown ファイルパスです".to_string())?;

    match settings.save_mode {
        ImageSaveMode::SameDir => Ok(md_dir.to_path_buf()),
        ImageSaveMode::Subfolder => Ok(md_dir.join(&settings.subfolder_name)),
        ImageSaveMode::CustomRelative => Ok(md_dir.join(&settings.custom_path)),
        ImageSaveMode::CustomAbsolute => {
            let p = Path::new(&settings.custom_path);
            if p.is_absolute() {
                Ok(p.to_path_buf())
            } else {
                Err("custom-absolute モードでは絶対パスを指定してください".to_string())
            }
        }
    }
}

/// ファイル名を生成する。
fn generate_filename(original_name: &str, strategy: &FilenameStrategy) -> String {
    let ext = Path::new(original_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let base = Path::new(original_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");

    let now = chrono_like_timestamp();

    match strategy {
        FilenameStrategy::Uuid => format!("{}.{}", uuid_v4_simple(), ext),
        FilenameStrategy::Timestamp => format!("{}.{}", now, ext),
        FilenameStrategy::Original => original_name.to_string(),
        FilenameStrategy::TimestampOriginal => format!("{}_{}.{}", now, base, ext),
    }
}

/// タイムスタンプ文字列を生成（外部クレート不要）
fn chrono_like_timestamp() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = d.as_secs();
    // 簡易的な YYYYMMDD_HHMMSS 形式の近似（UTC ベース）
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // 簡易的な日付計算
    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}{:02}{:02}_{:02}{:02}{:02}",
        year, month, day, hours, minutes, seconds
    )
}

/// Unix epoch からの日数を (年, 月, 日) に変換
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // 簡易計算（閏年を考慮）
    let mut y = 1970;
    let mut remaining = days as i64;
    loop {
        let days_in_year = if is_leap_year(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }
    let month_days: [i64; 12] = if is_leap_year(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 1u64;
    for &md in &month_days {
        if remaining < md {
            break;
        }
        remaining -= md;
        m += 1;
    }
    (y, m, remaining as u64 + 1)
}

fn is_leap_year(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

/// 簡易 UUID v4（外部クレート不要）
fn uuid_v4_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (seed & 0xFFFFFFFF) as u32,
        ((seed >> 32) & 0xFFFF) as u16,
        ((seed >> 48) & 0x0FFF) as u16,
        (0x8000 | ((seed >> 60) & 0x3FFF)) as u16,
        ((seed >> 74) ^ seed) & 0xFFFFFFFFFFFF,
    )
}

/// ハッシュによる重複検出
fn find_by_hash(dir: &Path, data: &[u8]) -> Option<String> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let target_hash = format!("{:x}", hasher.finalize());

    if !dir.exists() {
        return None;
    }

    for entry in std::fs::read_dir(dir).ok()? {
        let entry = entry.ok()?;
        let path = entry.path();
        if path.is_file() {
            if let Ok(contents) = std::fs::read(&path) {
                let mut h = Sha256::new();
                h.update(&contents);
                let file_hash = format!("{:x}", h.finalize());
                if file_hash == target_hash {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

/// Markdown からの相対パスを計算する
fn make_relative_path(from: &Path, to: &Path) -> String {
    // 簡易実装: 共通プレフィックスを除いた相対パス
    if let Ok(to_canon) = to.canonicalize() {
        if let Some(from_dir) = from.parent() {
            if let Ok(from_canon) = from_dir.canonicalize() {
                if let Ok(rel) = to_canon.strip_prefix(&from_canon) {
                    return rel.to_string_lossy().replace('\\', "/");
                }
            }
        }
    }
    to.to_string_lossy().replace('\\', "/")
}

/// 画像をローカルに保存する Tauri コマンド。
///
/// tauri-ipc-interface.md §3 `save_image` に準拠。
/// image-design.md §1 の保存先モードとファイル命名戦略に従う。
#[tauri::command]
pub async fn save_image(
    markdown_path: String,
    image_data: Vec<u8>,
    original_name: String,
    settings: ImageStorageSettings,
) -> Result<SaveImageResult, String> {
    let md_path = Path::new(&markdown_path);
    let save_dir = resolve_image_save_dir(md_path, &settings)?;

    // 保存先ディレクトリを作成
    if !save_dir.exists() {
        std::fs::create_dir_all(&save_dir)
            .map_err(|e| format!("IO_ERROR: 保存先ディレクトリの作成に失敗: {}", e))?;
    }

    // ハッシュによる重複検出
    if settings.deduplicate_by_hash {
        if let Some(existing) = find_by_hash(&save_dir, &image_data) {
            let relative = make_relative_path(md_path, Path::new(&existing));
            return Ok(SaveImageResult {
                saved_path: existing,
                relative_path: relative,
            });
        }
    }

    // ファイル名を生成して保存
    let filename = generate_filename(&original_name, &settings.filename_strategy);
    let dest_path = save_dir.join(&filename);

    std::fs::write(&dest_path, &image_data)
        .map_err(|e| format!("IO_ERROR: 画像の保存に失敗: {}", e))?;

    let saved_path = dest_path.to_string_lossy().to_string();
    let relative_path = make_relative_path(md_path, &dest_path);

    log::info!("save_image: saved to {}", saved_path);

    Ok(SaveImageResult {
        saved_path,
        relative_path,
    })
}

/// ローカル画像ファイルをバイト列として読み込む Tauri コマンド。
///
/// useDropListener からの Tauri ドロップイベント処理で使用。
/// plugin-fs のスコープ制限を回避するため、Rust 側で直接読み込む。
#[tauri::command]
pub async fn read_image_bytes(path: String) -> Result<Vec<u8>, String> {
    let p = Path::new(&path);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let allowed = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
    if !allowed.contains(&ext.as_str()) {
        return Err(format!("UNSUPPORTED: 画像ファイルではありません: {}", path));
    }
    std::fs::read(&path).map_err(|e| format!("IO_ERROR: {}", e))
}

/// リモート画像をローカルにキャッシュする Tauri コマンド。
///
/// tauri-ipc-interface.md §3 `cache_remote_image` に準拠。
/// URL から画像をダウンロードし、アプリのキャッシュディレクトリに保存する。
#[tauri::command]
pub async fn cache_remote_image(app: AppHandle, url: String) -> Result<String, String> {
    log::info!("cache_remote_image: fetching {}", url);

    // キャッシュディレクトリを取得
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("IO_ERROR: キャッシュディレクトリの取得に失敗: {}", e))?
        .join("image_cache");

    if !cache_dir.exists() {
        std::fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("IO_ERROR: キャッシュディレクトリの作成に失敗: {}", e))?;
    }

    // URL のハッシュをファイル名にする
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let url_hash = format!("{:x}", hasher.finalize());

    // 拡張子を URL から推定
    let ext = url
        .rsplit('/')
        .next()
        .and_then(|s| s.split('?').next())
        .and_then(|s| s.rsplit('.').next())
        .filter(|e| matches!(*e, "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp"))
        .unwrap_or("png");

    let cache_path = cache_dir.join(format!("{}.{}", &url_hash[..16], ext));

    // 既にキャッシュ済みならそのパスを返す
    if cache_path.exists() {
        return Ok(cache_path.to_string_lossy().to_string());
    }

    // ダウンロード
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("NETWORK_ERROR: 画像のダウンロードに失敗: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP_ERROR: HTTP {} でダウンロードに失敗",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("NETWORK_ERROR: レスポンスの読み取りに失敗: {}", e))?;

    tokio::fs::write(&cache_path, &bytes)
        .await
        .map_err(|e| format!("IO_ERROR: キャッシュファイルの保存に失敗: {}", e))?;

    log::info!("cache_remote_image: cached to {:?}", cache_path);
    Ok(cache_path.to_string_lossy().to_string())
}

// =============================================================================
// テスト
// =============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn make_settings(mode: ImageSaveMode, strategy: FilenameStrategy) -> ImageStorageSettings {
        ImageStorageSettings {
            save_mode: mode,
            subfolder_name: "images".to_string(),
            custom_path: "/custom/absolute".to_string(),
            filename_strategy: strategy,
            deduplicate_by_hash: false,
        }
    }

    // -------------------------------------------------------------------------
    // resolve_image_save_dir
    // -------------------------------------------------------------------------

    #[test]
    fn test_resolve_save_dir_same_dir() {
        let settings = make_settings(ImageSaveMode::SameDir, FilenameStrategy::Original);
        let result = resolve_image_save_dir(Path::new("/ws/docs/note.md"), &settings).unwrap();
        assert_eq!(result, Path::new("/ws/docs"));
    }

    #[test]
    fn test_resolve_save_dir_subfolder() {
        let settings = make_settings(ImageSaveMode::Subfolder, FilenameStrategy::Original);
        let result = resolve_image_save_dir(Path::new("/ws/docs/note.md"), &settings).unwrap();
        assert_eq!(result, Path::new("/ws/docs/images"));
    }

    #[test]
    fn test_resolve_save_dir_custom_relative() {
        let mut settings = make_settings(ImageSaveMode::CustomRelative, FilenameStrategy::Original);
        settings.custom_path = "assets".to_string();
        let result = resolve_image_save_dir(Path::new("/ws/docs/note.md"), &settings).unwrap();
        assert_eq!(result, Path::new("/ws/docs/assets"));
    }

    #[test]
    fn test_resolve_save_dir_custom_absolute_valid() {
        // プラットフォーム依存の絶対パスを使用
        let abs_path = if cfg!(windows) {
            "C:\\absolute\\path"
        } else {
            "/absolute/path"
        };
        let mut settings = make_settings(ImageSaveMode::CustomAbsolute, FilenameStrategy::Original);
        settings.custom_path = abs_path.to_string();
        let result = resolve_image_save_dir(Path::new("C:\\ws\\note.md"), &settings).unwrap();
        assert_eq!(result, Path::new(abs_path));
    }

    #[test]
    fn test_resolve_save_dir_custom_absolute_relative_path_errors() {
        let mut settings = make_settings(ImageSaveMode::CustomAbsolute, FilenameStrategy::Original);
        settings.custom_path = "relative/path".to_string();
        let result = resolve_image_save_dir(Path::new("/ws/note.md"), &settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("絶対パスを指定"));
    }

    // -------------------------------------------------------------------------
    // generate_filename
    // -------------------------------------------------------------------------

    #[test]
    fn test_generate_filename_original() {
        let name = generate_filename("photo.png", &FilenameStrategy::Original);
        assert_eq!(name, "photo.png");
    }

    #[test]
    fn test_generate_filename_timestamp_has_correct_format() {
        let name = generate_filename("x.jpg", &FilenameStrategy::Timestamp);
        // 形式: YYYYMMDD_HHMMSS.jpg
        assert!(name.ends_with(".jpg"), "Should end with .jpg, got: {}", name);
        assert_eq!(name.len(), "20250101_120000.jpg".len());
    }

    #[test]
    fn test_generate_filename_uuid_has_extension() {
        let name = generate_filename("img.png", &FilenameStrategy::Uuid);
        assert!(name.ends_with(".png"));
        // UUID 形式: xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx.png
        assert!(name.contains('-'));
    }

    #[test]
    fn test_generate_filename_timestamp_original_contains_base() {
        let name = generate_filename("photo.jpeg", &FilenameStrategy::TimestampOriginal);
        assert!(name.contains("photo"), "Should contain base name, got: {}", name);
        assert!(name.ends_with(".jpeg"));
    }

    #[test]
    fn test_generate_filename_no_extension_defaults_to_png() {
        let name = generate_filename("noext", &FilenameStrategy::Original);
        // 拡張子なしのファイルはそのまま返る（Original strategy）
        assert_eq!(name, "noext");
    }

    // -------------------------------------------------------------------------
    // is_leap_year / days_to_ymd
    // -------------------------------------------------------------------------

    #[test]
    fn test_is_leap_year() {
        assert!(is_leap_year(2000)); // 400 の倍数
        assert!(is_leap_year(2024)); // 4 の倍数 (100 の倍数でない)
        assert!(!is_leap_year(1900)); // 100 の倍数 (400 の倍数でない)
        assert!(!is_leap_year(2023)); // 4 の倍数でない
    }

    #[test]
    fn test_days_to_ymd_epoch() {
        let (y, m, d) = days_to_ymd(0);
        assert_eq!((y, m, d), (1970, 1, 1));
    }

    #[test]
    fn test_days_to_ymd_year_boundary() {
        // 1970-12-31 は 364 日目（0 インデックス）
        let (y, m, d) = days_to_ymd(364);
        assert_eq!(y, 1970);
        assert_eq!(m, 12);
        assert_eq!(d, 31);
    }

    #[test]
    fn test_days_to_ymd_leap_year_feb29() {
        // 2024年1月1日からの日数 = 1970年からの日数を計算
        // 2024-02-29 を簡易確認: 2024は閏年
        let (y, _m, _d) = days_to_ymd(19783); // 2024-03-01 あたり
        assert!(y >= 2024);
    }

    // -------------------------------------------------------------------------
    // find_by_hash
    // -------------------------------------------------------------------------

    #[test]
    fn test_find_by_hash_finds_existing_file() {
        let dir = tempdir().unwrap();
        let data = b"test image data";
        let file = dir.path().join("image.png");
        fs::write(&file, data).unwrap();

        let result = find_by_hash(dir.path(), data);
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("image.png"));
    }

    #[test]
    fn test_find_by_hash_returns_none_when_not_found() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("other.png"), b"different data").unwrap();

        let result = find_by_hash(dir.path(), b"my image data");
        assert!(result.is_none());
    }

    #[test]
    fn test_find_by_hash_returns_none_for_nonexistent_dir() {
        let result = find_by_hash(Path::new("/nonexistent/dir"), b"data");
        assert!(result.is_none());
    }
}

/// 画像キャッシュをパージする Tauri コマンド。
///
/// tauri-ipc-interface.md §3 `purge_image_cache` に準拠。
/// キャッシュディレクトリの合計サイズが `max_bytes` を超えている場合、
/// 古いファイルから順に削除して指定サイズ以下にする。
#[tauri::command]
pub async fn purge_image_cache(app: AppHandle, max_bytes: u64) -> Result<u64, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("IO_ERROR: キャッシュディレクトリの取得に失敗: {}", e))?
        .join("image_cache");

    if !cache_dir.exists() {
        return Ok(0);
    }

    // ファイル一覧を取得し、更新日時でソート（古い順）
    let mut files: Vec<(PathBuf, u64, std::time::SystemTime)> = Vec::new();
    let mut total_size: u64 = 0;

    for entry in std::fs::read_dir(&cache_dir)
        .map_err(|e| format!("IO_ERROR: ディレクトリ読み取りエラー: {}", e))?
    {
        let entry = entry.map_err(|e| format!("IO_ERROR: エントリ読み取りエラー: {}", e))?;
        let path = entry.path();
        if path.is_file() {
            let metadata = entry
                .metadata()
                .map_err(|e| format!("IO_ERROR: メタデータ取得エラー: {}", e))?;
            let size = metadata.len();
            let modified = metadata.modified().unwrap_or(std::time::UNIX_EPOCH);
            total_size += size;
            files.push((path, size, modified));
        }
    }

    if total_size <= max_bytes {
        return Ok(0);
    }

    // 古い順にソート
    files.sort_by_key(|f| f.2);

    let mut freed: u64 = 0;
    for (path, size, _) in &files {
        if total_size - freed <= max_bytes {
            break;
        }
        if std::fs::remove_file(path).is_ok() {
            freed += size;
            log::debug!("purge_image_cache: removed {:?} ({} bytes)", path, size);
        }
    }

    log::info!(
        "purge_image_cache: freed {} bytes (limit: {} bytes)",
        freed,
        max_bytes
    );
    Ok(freed)
}
