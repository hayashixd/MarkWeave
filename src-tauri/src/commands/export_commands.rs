//! PDF エクスポート用 Tauri コマンド。
//!
//! export-interop-design.md §3.2 に準拠。
//! HTML コンテンツを一時ファイルに書き出し、WebView の print API で PDF を生成する。

use serde::Deserialize;
use std::path::Path;
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
