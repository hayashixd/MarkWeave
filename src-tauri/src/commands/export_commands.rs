//! PDF・Pandoc エクスポート用 Tauri コマンド。
//!
//! export-interop-design.md §3.2, §7, §8, §9 に準拠。
//! HTML コンテンツを一時ファイルに書き出し、WebView の print API で PDF を生成する。
//! また Pandoc を使った Word / LaTeX / ePub エクスポートも提供する。

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Manager};

/// PDF エクスポートオプション。
/// export-interop-design.md §3.2 PdfOptions に対応。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfOptions {
    /// 用紙サイズ: "A4" | "Letter" | "A3"
    pub paper_size: String,
    /// 印刷方向: "portrait" | "landscape"
    pub orientation: String,
    /// 余白（mm 単位）
    pub margin_top: f64,
    pub margin_bottom: f64,
    pub margin_left: f64,
    pub margin_right: f64,
    /// ヘッダー/フッターを印刷するか
    pub print_header_footer: bool,
}

/// HTML コンテンツを PDF ファイルとして出力する Tauri コマンド。
///
/// フロントエンドから `invoke('print_to_pdf', { htmlContent, outputPath, options })` で呼び出す。
///
/// 実装方式:
/// 1. HTML コンテンツを一時ファイルに書き出す
/// 2. 非表示の WebviewWindow を作成して HTML をロードする
/// 3. WebView の print_to_pdf API で PDF バイト列を取得する
/// 4. PDF ファイルを出力先パスに書き出す
/// 5. 一時ファイルと非表示ウィンドウを削除する
#[tauri::command]
pub async fn print_to_pdf(
    app: AppHandle,
    html_content: String,
    output_path: String,
    options: PdfOptions,
) -> Result<u64, String> {
    log::info!(
        "print_to_pdf: output={}, paper={}, orientation={}",
        output_path,
        options.paper_size,
        options.orientation
    );

    // 出力先パスのバリデーション
    let out = Path::new(&output_path);
    if !out.is_absolute() {
        return Err("出力パスは絶対パスである必要があります".to_string());
    }

    // 親ディレクトリの存在確認
    if let Some(parent) = out.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("出力先ディレクトリの作成に失敗: {}", e))?;
        }
    }

    // 一時ファイルに HTML を書き出し
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("一時ディレクトリの取得に失敗: {}", e))?;

    let temp_html_path = temp_dir.join("pdf_export_temp.html");
    tokio::fs::write(&temp_html_path, &html_content)
        .await
        .map_err(|e| format!("一時 HTML ファイルの書き込みに失敗: {}", e))?;

    // 一時ファイルの URL を構築
    let file_url = format!(
        "file://{}",
        temp_html_path.to_string_lossy().replace('\\', "/")
    );

    // 非表示の WebviewWindow を作成して PDF を生成
    let pdf_bytes = {
        let window_label = format!("pdf_export_{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis());

        let webview_window = tauri::WebviewWindowBuilder::new(
            &app,
            &window_label,
            tauri::WebviewUrl::External(file_url.parse().map_err(|e| format!("URL パースエラー: {}", e))?),
        )
        .visible(false)
        .build()
        .map_err(|e| format!("WebviewWindow の作成に失敗: {}", e))?;

        // ページのロード完了を少し待つ
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

        // 用紙サイズをインチに変換（WebView2 の print_to_pdf はインチを使用）
        let (width_inch, height_inch) = paper_size_to_inches(&options.paper_size);
        let (width_inch, height_inch) = if options.orientation == "landscape" {
            (height_inch, width_inch)
        } else {
            (width_inch, height_inch)
        };

        // 余白を mm → インチに変換
        let margin_top = options.margin_top / 25.4;
        let margin_bottom = options.margin_bottom / 25.4;
        let margin_left = options.margin_left / 25.4;
        let margin_right = options.margin_right / 25.4;

        // print API を呼び出して PDF バイト列を取得
        let pdf_result = webview_window.print_to_pdf(
            tauri::webview::PageSize {
                width: width_inch,
                height: height_inch,
            },
            tauri::webview::PrintMargin {
                top: margin_top,
                right: margin_right,
                bottom: margin_bottom,
                left: margin_left,
            },
        ).await;

        // 非表示ウィンドウを閉じる
        let _ = webview_window.close();

        pdf_result.map_err(|e| format!("PDF の生成に失敗: {}", e))?
    };

    // PDF ファイルを出力先に書き出し
    let pdf_size = pdf_bytes.len() as u64;
    tokio::fs::write(&output_path, &pdf_bytes)
        .await
        .map_err(|e| format!("PDF ファイルの書き込みに失敗: {}", e))?;

    // 一時ファイルを削除
    let _ = tokio::fs::remove_file(&temp_html_path).await;

    log::info!(
        "print_to_pdf: success ({} bytes) → {}",
        pdf_size,
        output_path
    );

    Ok(pdf_size)
}

/// 用紙サイズ文字列をインチ単位の (幅, 高さ) に変換する。
fn paper_size_to_inches(paper_size: &str) -> (f64, f64) {
    match paper_size {
        "A3" => (11.69, 16.54),
        "A4" => (8.27, 11.69),
        "Letter" => (8.5, 11.0),
        "Legal" => (8.5, 14.0),
        _ => (8.27, 11.69), // デフォルト: A4
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pandoc 関連コマンド（export-interop-design.md §7, §8, §9 に準拠）
// ─────────────────────────────────────────────────────────────────────────────

/// Pandoc インストール確認の結果。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocCheckResult {
    /// Pandoc が利用可能かどうか
    pub available: bool,
    /// 検出されたバージョン文字列（例: "3.1.11"）
    pub version: Option<String>,
    /// Pandoc の実行パス
    pub path: Option<String>,
}

/// Pandoc のパスを解決する。
///
/// 優先順位:
/// 1. ユーザー指定パス（pandoc_path 引数）
/// 2. システムの PATH から `pandoc` / `pandoc.exe` を検索
/// 3. OS 別の既知インストールパスを試行
fn resolve_pandoc_path(pandoc_path: Option<&str>) -> Option<String> {
    // 1. ユーザー指定パス
    if let Some(path) = pandoc_path {
        if !path.is_empty() && Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    // 2 & 3. 候補リストを試行
    #[cfg(target_os = "windows")]
    let candidates: Vec<&str> = vec![
        "pandoc.exe",
        r"C:\Program Files\Pandoc\pandoc.exe",
        r"C:\Users\Default\AppData\Local\Pandoc\pandoc.exe",
    ];
    #[cfg(not(target_os = "windows"))]
    let candidates: Vec<&str> = vec![
        "pandoc",
        "/usr/local/bin/pandoc",
        "/opt/homebrew/bin/pandoc",
        "/usr/bin/pandoc",
    ];

    for candidate in &candidates {
        if Command::new(candidate)
            .arg("--version")
            .output()
            .is_ok()
        {
            return Some(candidate.to_string());
        }
    }

    None
}

/// Pandoc のバージョン文字列を取得する。
fn get_pandoc_version(pandoc_path: &str) -> Option<String> {
    let output = Command::new(pandoc_path)
        .arg("--version")
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    // "pandoc 3.1.11" または "pandoc.exe 3.1.11" の形式からバージョン部分を抽出
    let first_line = stdout.lines().next()?;
    let version = first_line
        .split_whitespace()
        .nth(1)
        .map(|v| v.to_string());
    version
}

/// Pandoc のインストール状態を確認する Tauri コマンド。
///
/// フロントエンドから `invoke('check_pandoc', { pandocPath? })` で呼び出す。
/// export-interop-design.md §9.1 に準拠。
#[tauri::command]
pub fn check_pandoc(pandoc_path: Option<String>) -> PandocCheckResult {
    let path_ref = pandoc_path.as_deref();
    match resolve_pandoc_path(path_ref) {
        Some(resolved_path) => {
            let version = get_pandoc_version(&resolved_path);
            log::info!("check_pandoc: found at '{}' version={:?}", resolved_path, version);
            PandocCheckResult {
                available: true,
                version,
                path: Some(resolved_path),
            }
        }
        None => {
            log::info!("check_pandoc: Pandoc not found");
            PandocCheckResult {
                available: false,
                version: None,
                path: None,
            }
        }
    }
}

/// Pandoc エクスポートオプション。
/// export-interop-design.md §7.2, §8.1, §8.2 に対応。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocExportOptions {
    /// 出力フォーマット: "docx" | "latex" | "epub"
    pub format: String,
    /// 出力ファイルパス
    pub output_path: String,
    /// ユーザー指定の Pandoc パス（省略時は自動検出）
    pub pandoc_path: Option<String>,
    /// 目次を生成するか
    pub toc: bool,
    /// Word 用 reference.docx パス（省略時はPandocデフォルト）
    pub reference_doc: Option<String>,
    /// コードのシンタックスハイライトを含めるか（docx 用）
    pub highlight: bool,
    /// LaTeX エンジン（LaTeX エクスポート用）: "pdflatex" | "xelatex" | "lualatex"
    pub latex_engine: Option<String>,
    /// ePub 表紙画像パス
    pub cover_image: Option<String>,
    /// ドキュメントタイトル（ePub メタデータ）
    pub title: Option<String>,
    /// 著者名（ePub メタデータ）
    pub author: Option<String>,
    /// 言語コード（ePub メタデータ）: "ja", "en" など
    pub language: Option<String>,
}

/// Pandoc を使って Markdown ドキュメントを変換してエクスポートする Tauri コマンド。
///
/// フロントエンドから `invoke('export_with_pandoc', { content, options })` で呼び出す。
/// export-interop-design.md §7.2, §8.1, §8.2 に準拠。
#[tauri::command]
pub async fn export_with_pandoc(
    content: String,
    options: PandocExportOptions,
) -> Result<(), String> {
    log::info!(
        "export_with_pandoc: format={}, output={}",
        options.format,
        options.output_path
    );

    // Pandoc パスを解決
    let pandoc_path = resolve_pandoc_path(options.pandoc_path.as_deref())
        .ok_or_else(|| {
            "Pandoc が見つかりません。設定から Pandoc のパスを指定してください。".to_string()
        })?;

    // 出力先ディレクトリを作成
    let out = Path::new(&options.output_path);
    if let Some(parent) = out.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("出力先ディレクトリの作成に失敗: {}", e))?;
        }
    }

    // Markdown を一時ファイルに書き出す
    let temp_dir = std::env::temp_dir();
    let temp_input = temp_dir.join("pandoc_input_temp.md");
    std::fs::write(&temp_input, content.as_bytes())
        .map_err(|e| format!("一時ファイルの作成に失敗: {}", e))?;

    let temp_input_path = temp_input.to_string_lossy().to_string();

    // Pandoc 引数を構築
    let mut args: Vec<String> = vec![
        temp_input_path.clone(),
        "-o".to_string(),
        options.output_path.clone(),
        "--from=markdown+gfm_auto_identifiers+footnotes".to_string(),
        format!("--to={}", options.format),
    ];

    if options.toc {
        args.push("--toc".to_string());
    }

    // フォーマット別オプション
    match options.format.as_str() {
        "docx" => {
            if let Some(ref_doc) = &options.reference_doc {
                if !ref_doc.is_empty() {
                    args.push(format!("--reference-doc={}", ref_doc));
                }
            }
            if options.highlight {
                args.push("--highlight-style=pygments".to_string());
            }
        }
        "latex" => {
            if let Some(engine) = &options.latex_engine {
                if !engine.is_empty() {
                    args.push(format!("--pdf-engine={}", engine));
                }
            }
        }
        "epub" | "epub3" => {
            if let Some(cover) = &options.cover_image {
                if !cover.is_empty() {
                    args.push(format!("--epub-cover-image={}", cover));
                }
            }
            if let Some(title) = &options.title {
                if !title.is_empty() {
                    args.push(format!("--metadata=title:{}", title));
                }
            }
            if let Some(author) = &options.author {
                if !author.is_empty() {
                    args.push(format!("--metadata=author:{}", author));
                }
            }
            if let Some(lang) = &options.language {
                if !lang.is_empty() {
                    args.push(format!("--metadata=lang:{}", lang));
                }
            }
        }
        _ => {}
    }

    log::debug!("export_with_pandoc: {:?} {:?}", pandoc_path, args);

    // Pandoc を実行
    let output = Command::new(&pandoc_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Pandoc の起動に失敗: {}", e))?;

    // 一時ファイルを削除
    let _ = std::fs::remove_file(&temp_input);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Pandoc がエラーで終了しました (code: {:?})\n{}",
            output.status.code(),
            stderr.trim()
        ));
    }

    log::info!("export_with_pandoc: success → {}", options.output_path);
    Ok(())
}
