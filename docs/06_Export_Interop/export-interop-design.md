# エクスポート・相互変換設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.1
> 更新日: 2026-02-25

---

## 目次

1. [設計方針](#1-設計方針)
2. [HTML エクスポート設計](#2-html-エクスポート設計)
3. [PDF エクスポート設計](#3-pdf-エクスポート設計)
4. [エクスポートオプション UI](#4-エクスポートオプション-ui)
5. [エクスポートテーマ CSS 設計](#5-エクスポートテーマ-css-設計)
6. [変換パイプライン詳細](#6-変換パイプライン詳細)
7. [Word（.docx）エクスポート設計](#7-worddocxエクスポート設計)
8. [LaTeX / ePub エクスポート設計](#8-latex--epub-エクスポート設計)
9. [Pandoc パス設定・外部ツール連携](#9-pandoc-パス設定外部ツール連携)
10. [Pandoc バージョン互換性](#10-pandoc-バージョン互換性)
11. [実装フェーズ](#11-実装フェーズ)

---

## 1. 設計方針

### 1.1 基本方針

- **スタンドアローン出力**: HTML エクスポートは外部 CDN に依存しない完全自己完結ファイルを生成する（CSS インライン化・フォント埋め込み）
- **テーマ統一**: エクスポートテーマはエディタのプレビューテーマと同一 CSS 変数体系を共有する（[theme-design.md](../03_UI_UX/theme-design.md) 参照）
- **ロスレス変換**: Markdown の全要素（数式・Mermaid・コードハイライト）をエクスポート先でも忠実に再現する
- **PDF は HTML 経由**: PDF は HTML レンダリングを WebView で印刷させることで生成し、専用レンダラは持たない

### 1.2 エクスポート形式一覧

| 形式 | 対応フェーズ | 生成方法 |
|------|------------|---------|
| HTML（スタンドアローン） | Phase 4 | remark-rehype + juice |
| PDF | Phase 7 | Tauri WebView 印刷 API |
| Markdown（別名保存） | Phase 6 | TipTap → remark-stringify |
| Word（.docx） | Phase 7 | Pandoc 連携 |
| LaTeX / ePub | Phase 7 | Pandoc 連携 |

---

## 2. HTML エクスポート設計

### 2.1 変換パイプライン

```
TipTap ドキュメント
  │  getMarkdown()
  ▼
Markdown 文字列
  │  remark().use(remarkGfm).use(remarkMath).parse()
  ▼
mdast（Markdown AST）
  │  remarkRehype({ allowDangerousHtml: false })
  ▼
hast（HTML AST）
  │  rehypeHighlight()        ← コードブロックのシンタックスハイライト
  │  rehypeKatex()            ← 数式レンダリング
  │  rehypeSlug()             ← 見出しに id 付与（TOC リンク用）
  │  rehypeToc({ ordered })   ← TOC 自動生成（オプション）
  ▼
HTML 文字列（rehypeStringify）
  │
  ▼
HTML テンプレートへ注入
  │  DOMPurify.sanitize()     ← XSS サニタイズ（保険）
  ▼
【★ローカル画像 Base64 埋め込み（Rust バックエンド）】
  │  HTML 内の <img src="./..."> を検出
  │  Tauri invoke('embed_local_images') でファイルを読み込み
  │  data:image/png;base64,... に変換してインプレース置換
  ▼
juice() によるCSS インライン化
  │
  ▼
Tauri plugin-fs で .html ファイル書き出し
```

> **重要**: ローカル画像の Base64 埋め込みは CSS インライン化（juice）の **前** に行う。
> juice は HTML の `<img>` タグを処理しないため、順序を入れ替えても問題はないが、
> 「全リソースが自己完結した状態」でファイルを書き出すことが設計原則である。

### 2.2 HTML テンプレート構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <style>{{THEME_CSS}}</style>
  <style>{{HIGHLIGHT_CSS}}</style>
  {{#if HAS_MATH}}<style>{{KATEX_CSS}}</style>{{/if}}
</head>
<body class="export-body">
  {{#if TOC}}<nav class="toc">{{TOC_HTML}}</nav>{{/if}}
  <main class="markdown-body">
    {{CONTENT_HTML}}
  </main>
</body>
</html>
```

### 2.3 CSS インライン化戦略

| CSS の種類 | インライン化 | 理由 |
|-----------|------------|------|
| 本文・見出しスタイル | ✅ する | メールクライアント・PDF でも有効 |
| コードハイライト（`.hljs-*`） | ✅ する | 外部 CSS への依存を排除 |
| KaTeX スタイル | ✅ する（数式使用時のみ） | 同上 |
| `:hover` / `:focus` 疑似クラス | ❌ しない（juice が自動スキップ） | インライン化不可 |
| CSS カスタムプロパティ（変数） | ✅ 変数を解決してからインライン化 | WebView 外では変数が機能しない |

```typescript
// src/file/export/html-exporter.ts
interface HtmlExportOptions {
  theme: 'github' | 'document' | 'presentation';
  includeToc: boolean;
  inlineCss: boolean;
}

export async function exportToHtml(
  markdown: string,
  outputPath: string,
  options: HtmlExportOptions
): Promise<void> {
  const processor = unified()
    .use(remarkParse).use(remarkGfm).use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHighlight).use(rehypeKatex).use(rehypeSlug)
    .use(options.includeToc ? rehypeToc : () => {})
    .use(rehypeStringify);

  const contentHtml = String(await processor.process(markdown));
  const themeCss = await loadThemeCss(options.theme);
  const highlightCss = await loadHighlightCss();
  const title = extractTitle(markdown) ?? 'Exported Document';
  const html = buildHtmlTemplate({ title, contentHtml, themeCss, highlightCss, options });
  const finalHtml = options.inlineCss ? juice(html) : html;
  await writeTextFile(outputPath, finalHtml);
}
```

### 2.4 Mermaid 図表のエクスポート対応

```
エクスポート時の Mermaid 処理フロー:

[Mermaid コードブロック検出]
  │
  ├─ オプション A: SVG 事前レンダリング（デフォルト）
  │    → Tauri の headless WebView でレンダリング
  │    → SVG を HTML に直接埋め込み
  │
  └─ オプション B: mermaid.js を埋め込み
       → mermaid.min.js をバンドルして HTML に埋め込み
       → ファイルサイズ増加（約 2MB）
```

---

## 3. PDF エクスポート設計

### 3.1 生成方法

Tauri の WebView の印刷 API を使用して PDF を生成する。

```
PDF 生成フロー:

[PDF エクスポート要求]
  │
  ▼
[HTML エクスポートと同じ変換パイプライン]
  │
  ▼
[Tauri: 印刷用 HTML を一時ファイルに書き出し]
  │
  ▼
[Tauri コマンド: print_to_pdf]
  │  WebView2 / WKWebView の print API 呼び出し
  ▼
[PDF ファイル生成] → [一時ファイル削除]
```

### 3.2 Tauri バックエンドの印刷コマンド

```rust
// src-tauri/src/commands/export.rs
#[tauri::command]
pub async fn print_to_pdf(
    app: AppHandle,
    html_content: String,
    output_path: String,
    options: PdfOptions,
) -> Result<(), String> {
    let temp_path = app.path().temp_dir()
        .map_err(|e| e.to_string())?.join("export_temp.html");
    std::fs::write(&temp_path, &html_content).map_err(|e| e.to_string())?;
    print_webview_to_pdf(&temp_path, &output_path, &options).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&temp_path);
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct PdfOptions {
    pub paper_size: String,      // "A4" | "Letter" | "A3"
    pub orientation: String,     // "portrait" | "landscape"
    pub margin_top: f64,
    pub margin_bottom: f64,
    pub margin_left: f64,
    pub margin_right: f64,
    pub print_header_footer: bool,
}
```

### 3.3 印刷用 CSS（`@media print`）

```css
@media print {
  @page { size: A4 portrait; margin: 20mm 25mm; }

  .toc, nav { display: none; }

  h1, h2, h3 { page-break-after: avoid; }
  pre, blockquote, table { page-break-inside: avoid; }

  pre { white-space: pre-wrap; word-break: break-all; }

  a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #666; }
  a[href^="#"]::after { content: ""; }
}
```

### 3.4 PDF エクスポートの制限事項

| 制限 | 詳細 |
|------|------|
| Mermaid 図表 | SVG 事前レンダリング必須 |
| インタラクティブ要素 | PDF にはリンク以外のインタラクションなし |
| フォント埋め込み | OS フォントは PDF に自動埋め込みされる（WebView2 依存） |

---

## 4. エクスポートオプション UI

### 4.1 エクスポートダイアログ

```
┌─────────────────────────────────────────────────────────┐
│  HTML にエクスポート                              [×] │
├─────────────────────────────────────────────────────────┤
│  テーマ                                                  │
│  ○ GitHub スタイル（デフォルト）                          │
│  ○ ドキュメントスタイル（書籍風）                         │
│  ○ プレゼンテーションスタイル                             │
│                                                         │
│  オプション                                              │
│  ☑ 目次（TOC）を自動生成                                 │
│  ☑ CSS をインライン化（スタンドアローン）                  │
│  ☑ 数式をレンダリング（KaTeX）                            │
│  ☑ Mermaid 図表を SVG に変換                             │
│                                                         │
│  保存先: /Users/user/Documents/my-note.html  [変更...]   │
│                      [キャンセル] [エクスポート]          │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│  エクスポート形式を選択                                   │
├─────────────────────────────────────────────────────────┤
│  ● Word (.docx)                                         │
│  ○ PDF (HTML 経由)                                      │
│  ○ LaTeX (.tex)                                         │
│  ○ ePub (.epub)                                         │
│  ○ HTML                                                 │
├─────────────────────────────────────────────────────────┤
│  [設定...]                          [エクスポート]       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 メニュー構造

```
ファイル
  └─ エクスポート
       ├─ HTML にエクスポート...  （Ctrl+Shift+E）
       ├─ PDF にエクスポート...
       ├─ Word (.docx) にエクスポート...
       ├─ LaTeX にエクスポート...
       └─ ePub にエクスポート...
```

### 4.3 エクスポート設定の永続化

```typescript
interface ExportSettings {
  htmlExport: {
    theme: 'github' | 'document' | 'presentation';
    includeToc: boolean;
    inlineCss: boolean;
    renderMath: boolean;
    mermaidMode: 'svg' | 'bundle';
  };
  pdfExport: {
    theme: 'github' | 'document' | 'presentation';
    paperSize: 'A4' | 'Letter' | 'A3';
    orientation: 'portrait' | 'landscape';
    marginMm: { top: number; bottom: number; left: number; right: number };
    printHeaderFooter: boolean;
    includeToc: boolean;
  };
}
```

---

## 5. エクスポートテーマ CSS 設計

### 5.1 テーマ一覧

| テーマ ID | 説明 | 用途 |
|----------|------|------|
| `github` | GitHub Markdown スタイル | 技術文書・README |
| `document` | 書籍風タイポグラフィ | 長文ドキュメント・報告書 |
| `presentation` | スライド風大フォント | プレゼン用途（将来対応）|

### 5.2 テーマファイル構成

```
src/themes/
├── github/
│   ├── export.css
│   └── preview.css
├── document/
│   ├── export.css
│   └── preview.css
└── presentation/
    ├── export.css
    └── preview.css
```

### 5.3 コードハイライトテーマの対応

| エクスポートテーマ | ハイライトテーマ |
|----------------|---------------|
| `github` | `github` |
| `document` | `github-dark` |
| `presentation` | `monokai-sublime` |

---

## 6. 変換パイプライン詳細

### 6.1 数式（KaTeX）のエクスポート

```typescript
const KATEX_CSS_INLINE = true;       // CSS をインライン化
const KATEX_FONT_EMBED = 'woff2';    // フォントは woff2 で Base64 埋め込み
```

### 6.2 画像パスの解決

```
[画像パス: ./images/screenshot.png]
  │
  ├─ オプション A: Base64 埋め込み（デフォルト、スタンドアローン出力）
  │    → data:image/png;base64,... に変換
  │    → 完全自己完結ファイルが生成される
  │    → ファイルを他者に送付しても画像が壊れない ✅
  │
  └─ オプション B: ファイルをコピー
       → エクスポート先フォルダに ./images/ を作成してコピー
       → 複数ファイルが生成される（HTML + images/）
```

#### Base64 埋め込みの実装（Rust バックエンド）

スタンドアローン HTML エクスポート時、HTML 内のすべてのローカル画像パスを
Rust バックエンドで読み込み、Data URI に変換してインプレース置換する。

```rust
// src-tauri/src/export/embed_images.rs

use base64::{engine::general_purpose::STANDARD, Engine as _};
use regex::Regex;
use std::path::Path;

/// HTML 文字列内のローカル画像 src を Base64 Data URI に置換する。
/// 外部 URL（http:// / https://）および data: スキームはスキップする。
pub fn embed_local_images(
    html: &str,
    source_file_dir: &Path,  // 元の .md ファイルが存在するディレクトリ
) -> Result<String, String> {
    // <img src="..." /> のパターンを検出
    let re = Regex::new(r#"<img([^>]*)\ssrc="([^"]+)"([^>]*)>"#)
        .map_err(|e| e.to_string())?;

    let mut result = html.to_string();

    // マッチをすべて収集してから置換（イテレーション中の変更を避けるため）
    let matches: Vec<_> = re
        .captures_iter(html)
        .map(|cap| {
            let full_match = cap[0].to_string();
            let before_src = cap[1].to_string();
            let src = cap[2].to_string();
            let after_src = cap[3].to_string();
            (full_match, before_src, src, after_src)
        })
        .collect();

    for (full_match, before_src, src, after_src) in matches {
        // 外部 URL および data: スキームはスキップ
        if src.starts_with("http://")
            || src.starts_with("https://")
            || src.starts_with("data:")
        {
            continue;
        }

        // 相対パスを絶対パスに解決
        let image_path = source_file_dir.join(&src);
        let image_path = match image_path.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                // ファイルが見つからない場合はスキップ（src そのまま）
                log::warn!("画像ファイルが見つかりません: {:?}", image_path);
                continue;
            }
        };

        // ファイルを読み込んで Base64 エンコード
        let bytes = match std::fs::read(&image_path) {
            Ok(b) => b,
            Err(e) => {
                log::warn!("画像の読み込みに失敗: {:?} - {}", image_path, e);
                continue;
            }
        };

        // MIME タイプを拡張子から判定
        let mime = mime_from_extension(
            image_path.extension().and_then(|e| e.to_str()).unwrap_or("")
        );

        let data_uri = format!(
            "data:{};base64,{}",
            mime,
            STANDARD.encode(&bytes)
        );

        // インプレース置換
        let new_tag = format!(r#"<img{}src="{}"{} >"#, before_src, data_uri, after_src);
        result = result.replacen(&full_match, &new_tag, 1);
    }

    Ok(result)
}

fn mime_from_extension(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png"  => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif"  => "image/gif",
        "webp" => "image/webp",
        "svg"  => "image/svg+xml",
        "bmp"  => "image/bmp",
        "ico"  => "image/x-icon",
        _      => "application/octet-stream",
    }
}
```

```rust
// src-tauri/src/export/commands.rs（Tauri コマンド）

#[tauri::command]
pub async fn export_html_standalone(
    source_file_path: String,
    html_content: String,
    output_path: String,
) -> Result<(), String> {
    let source_dir = Path::new(&source_file_path)
        .parent()
        .ok_or("ソースファイルのディレクトリが取得できません")?;

    // ① ローカル画像を Base64 に埋め込む
    let html_with_images = embed_local_images(&html_content, source_dir)?;

    // ② juice（CSS インライン化）は TypeScript 側で実施済みの想定
    //    ここではファイル書き出しのみ
    tokio::fs::write(&output_path, html_with_images)
        .await
        .map_err(|e| e.to_string())
}
```

#### TypeScript 側エクスポーター（呼び出し側）

```typescript
// src/export/html-exporter.ts

import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import juice from 'juice'
import DOMPurify from 'dompurify'

export async function exportStandaloneHtml(
  editor: Editor,
  currentFilePath: string,
  options: HtmlExportOptions,
): Promise<void> {
  const outputPath = await save({
    filters: [{ name: 'HTML File', extensions: ['html'] }],
    defaultPath: currentFilePath.replace(/\.md$/, '.html'),
  })
  if (!outputPath) return

  // ① Markdown → HTML（remark/rehype パイプライン）
  const markdown = editor.storage.markdown.getMarkdown()
  const rawHtml = await markdownToHtml(markdown, options)

  // ② XSS サニタイズ
  const sanitizedHtml = DOMPurify.sanitize(rawHtml)

  // ③ HTML テンプレートへ注入
  const fullHtml = buildHtmlTemplate(sanitizedHtml, options)

  // ④ CSS インライン化（juice）
  const inlinedHtml = juice(fullHtml, {
    extraCss: await loadThemeCss(options.theme),
    removeStyleTags: true,
  })

  // ⑤ ローカル画像 Base64 埋め込み + ファイル書き出し（Rust バックエンド）
  await invoke('export_html_standalone', {
    sourceFilePath: currentFilePath,
    htmlContent: inlinedHtml,
    outputPath,
  })
}
```

---

## 7. Word（.docx）エクスポート設計

### 7.1 エクスポートフロー

```
メニュー → エクスポート → Word (.docx)
  │
  ▼
[オプションダイアログ]
  テンプレート: [reference.docx を選択...]  または  デフォルト
  □ 目次を自動生成
  □ シンタックスハイライトを含める
  │
  ▼
Tauri コマンド経由で Pandoc を呼び出し:
  pandoc input.md -o output.docx [--reference-doc=ref.docx] [--toc]
  │
  ▼
保存先ダイアログ → .docx 保存
```

### 7.2 reference.docx テンプレート

| テンプレート | 説明 |
|------------|------|
| デフォルト（Pandoc 組み込み） | Pandoc 標準の Word スタイル |
| カスタム reference.docx | ユーザーが指定した .docx ファイルのスタイルを使用 |

```typescript
// src/export/docx-exporter.ts
export async function exportToDocx(
  markdownContent: string,
  options: DocxExportOptions,
): Promise<void> {
  const outputPath = await save({
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (!outputPath) return;

  await invoke('export_with_pandoc', {
    content: markdownContent,
    outputPath,
    format: 'docx',
    referenceDoc: options.referenceDoc ?? null,
    toc: options.includeToc,
    highlight: options.includeHighlight,
  });
}
```

```rust
// src-tauri/src/commands/export.rs
#[tauri::command]
pub async fn export_with_pandoc(
    content: String,
    output_path: String,
    format: String,
    reference_doc: Option<String>,
    toc: bool,
    highlight: bool,
) -> Result<(), String> {
    let mut tmp = NamedTempFile::new().map_err(|e| e.to_string())?;
    tmp.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    let tmp_path = tmp.path().to_string_lossy().to_string();
    let pandoc_path = get_pandoc_path()?;

    let mut args = vec![
        tmp_path.clone(), "-o".to_string(), output_path.clone(),
        "--from=markdown".to_string(), format!("--to={}", format),
    ];
    if toc { args.push("--toc".to_string()); }
    if let Some(ref_doc) = reference_doc {
        args.push(format!("--reference-doc={}", ref_doc));
    }
    if highlight { args.push("--highlight-style=pygments".to_string()); }

    let status = Command::new(&pandoc_path).args(&args).status()
        .map_err(|e| format!("Pandoc 実行エラー: {}", e))?;

    if !status.success() {
        return Err(format!("Pandoc がエラーで終了しました (code: {:?})", status.code()));
    }
    Ok(())
}
```

### 7.3 数式・図表の扱い

| コンテンツ | .docx 変換 |
|-----------|-----------|
| KaTeX 数式 (`$...$`) | Pandoc が OMath (Word 数式) に変換 |
| Mermaid 図 | PNG に事前レンダリングして埋め込み |
| コードブロック | Courier New フォント + バックグラウンド色 |
| 脚注 | Word の脚注機能に変換 |

---

## 8. LaTeX / ePub エクスポート設計

### 8.1 LaTeX エクスポート

```typescript
interface LatexExportOptions {
  engine: 'pdflatex' | 'xelatex' | 'lualatex';
  template: string | null;
  toc: boolean;
  numberSections: boolean;
  geometry: string;  // "margin=2cm" など
}
```

**出力フォーマット:**

| オプション | 説明 |
|-----------|------|
| `.tex` のみ | LaTeX ソースを出力（PDF 生成なし） |
| `.pdf`（PDF 直接生成） | xelatex 等で PDF に変換（要 TeX 環境） |

**日本語対応**: `xelatex` + `xeCJK` パッケージ推奨

```latex
\usepackage{xeCJK}
\setCJKmainfont{Noto Serif CJK JP}
```

### 8.2 ePub エクスポート

```typescript
interface EpubExportOptions {
  coverImage: string | null;
  css: string | null;
  toc: boolean;
  chapterLevel: number;  // デフォルト: 1
  metadata: {
    title: string;
    author: string;
    language: string;  // 'ja', 'en' など
  };
}
```

---

## 9. Pandoc パス設定・外部ツール連携

### 9.1 Pandoc の検出

```rust
fn get_pandoc_path() -> Result<String, String> {
    if let Some(path) = get_user_setting("pandocPath") {
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    #[cfg(target_os = "windows")]
    let candidates = vec!["pandoc.exe", r"C:\Program Files\Pandoc\pandoc.exe"];
    #[cfg(not(target_os = "windows"))]
    let candidates = vec!["pandoc", "/usr/local/bin/pandoc", "/opt/homebrew/bin/pandoc"];

    for candidate in &candidates {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return Ok(candidate.to_string());
        }
    }

    Err("Pandoc が見つかりません。設定からパスを指定してください。".to_string())
}
```

### 9.2 設定 UI

```
┌──────────────────────────────────────────────────────┐
│  外部ツール設定                                       │
├──────────────────────────────────────────────────────┤
│  Pandoc パス:                                         │
│  [ /usr/local/bin/pandoc              ] [参照...]    │
│  現在のバージョン: 3.1.11 ✅                          │
│                                                      │
│  LaTeX エンジン (PDF 生成時):                         │
│  [ xelatex ▼ ]                                       │
│  現在のバージョン: XeTeX 3.14159265 ✅                │
└──────────────────────────────────────────────────────┘
```

```typescript
async function checkPandocVersion(path: string): Promise<string | null> {
  try {
    const result = await invoke<string>('run_command', { program: path, args: ['--version'] });
    const match = result.match(/pandoc (\S+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
```

### 9.3 Pandoc 未インストール時のエラーハンドリング

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Pandoc が見つかりません                           │
├──────────────────────────────────────────────────────┤
│  Word / LaTeX / ePub エクスポートには Pandoc が        │
│  必要です。                                           │
│                                                      │
│  Pandoc のインストール方法:                           │
│  • macOS: brew install pandoc                        │
│  • Windows: https://pandoc.org/installing.html       │
│  • Linux: apt install pandoc                         │
│                                                      │
│  [設定を開く]  [閉じる]                              │
└──────────────────────────────────────────────────────┘
```

---

## 10. Pandoc バージョン互換性

### 10.1 最低動作バージョン

| Pandoc バージョン | サポート状況 |
|-----------------|-------------|
| 3.0 以上 | ✅ 完全サポート |
| 2.19.x | ✅ 基本機能のみ（一部オプション非対応） |
| 2.x 未満 | ❌ 非サポート |

### 10.2 バージョン別機能差異

| 機能 | Pandoc 2.x | Pandoc 3.x |
|------|-----------|-----------|
| `--from=markdown+...` 拡張 | ✅ | ✅ |
| `--embed-resources` | ❌ (`--self-contained`) | ✅ |
| Markdown 脚注 | ✅ | ✅ |
| GitHub Flavored Markdown | ✅ | ✅ |

---

## 11. 実装フェーズ

### Phase 4（HTML エクスポート）

- [ ] `unified` パイプライン構築（remark-rehype・rehype-highlight・rehype-katex）
- [ ] `rehypeSlug` + `rehypeToc` による TOC 生成
- [ ] HTML テンプレートエンジン実装（`buildHtmlTemplate()`）
- [ ] `juice` による CSS インライン化
- [ ] 画像の Base64 埋め込み処理
- [ ] Mermaid SVG 事前レンダリング（headless WebView）
- [ ] エクスポートダイアログ UI（テーマ選択・オプション）
- [ ] GitHub テーマ CSS 実装
- [ ] ドキュメントテーマ CSS 実装

### Phase 7（PDF + Pandoc エクスポート）

- [ ] `@media print` CSS 実装
- [ ] Tauri コマンド `print_to_pdf` 実装（Rust）
- [ ] PDF エクスポートダイアログ UI
- [ ] Pandoc インストール確認（起動時 / エクスポート実行時）
- [ ] Pandoc 未インストール時のエラー UX
- [ ] Word（.docx）エクスポート
- [ ] LaTeX / ePub エクスポート

---

## 関連ドキュメント

- [theme-design.md](../03_UI_UX/theme-design.md) — エクスポートテーマ CSS と変数体系
- [user-settings-design.md](../07_Platform_Settings/user-settings-design.md) — エクスポート設定の保存
- [markdown-extensions-design.md](../02_Core_Editor/markdown-extensions-design.md) — 脚注・数式など変換対象の拡張記法
- [security-design.md](../01_Architecture/security-design.md) — DOMPurify XSS サニタイズ
