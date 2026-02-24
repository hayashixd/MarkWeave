# エクスポート設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [設計方針](#1-設計方針)
2. [HTML エクスポート設計](#2-html-エクスポート設計)
3. [PDF エクスポート設計](#3-pdf-エクスポート設計)
4. [エクスポートオプション UI](#4-エクスポートオプション-ui)
5. [エクスポートテーマ CSS 設計](#5-エクスポートテーマ-css-設計)
6. [変換パイプライン詳細](#6-変換パイプライン詳細)
7. [実装フェーズ](#7-実装フェーズ)

---

## 1. 設計方針

### 1.1 基本方針

- **スタンドアローン出力**: HTML エクスポートは外部 CDN に依存しない完全自己完結ファイルを生成する（CSS インライン化・フォント埋め込み）
- **テーマ統一**: エクスポートテーマはエディタのプレビューテーマと同一 CSS 変数体系を共有する（[theme-design.md](./theme-design.md) 参照）
- **ロスレス変換**: Markdown の全要素（数式・Mermaid・コードハイライト）をエクスポート先でも忠実に再現する
- **PDF は HTML 経由**: PDF は HTML レンダリングを WebView で印刷させることで生成し、専用レンダラは持たない

### 1.2 エクスポート形式一覧

| 形式 | 対応フェーズ | 生成方法 |
|------|------------|---------|
| HTML（スタンドアローン） | Phase 4 | remark-rehype + juice |
| PDF | Phase 7 | Tauri WebView 印刷 API |
| Markdown（別名保存） | Phase 6 | TipTap → remark-stringify |

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
juice() によるCSS インライン化
  │
  ▼
Tauri plugin-fs で .html ファイル書き出し
```

### 2.2 HTML テンプレート構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}}</title>
  <!-- テーマ CSS（juice でインライン化前のソース） -->
  <style>{{THEME_CSS}}</style>
  <!-- コードハイライト CSS -->
  <style>{{HIGHLIGHT_CSS}}</style>
  <!-- KaTeX CSS（数式使用時のみ） -->
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

`juice` によるインライン化でスタンドアローン性を確保する。ただし全プロパティをインライン化するとファイルサイズが肥大するため、以下のルールに従う。

| CSS の種類 | インライン化 | 理由 |
|-----------|------------|------|
| 本文・見出しスタイル | ✅ する | メールクライアント・PDF でも有効 |
| コードハイライト（`.hljs-*`） | ✅ する | 外部 CSS への依存を排除 |
| KaTeX スタイル | ✅ する（数式使用時のみ） | 同上 |
| `:hover` / `:focus` 疑似クラス | ❌ しない（juice が自動スキップ） | インライン化不可 |
| CSS カスタムプロパティ（変数） | ✅ 変数を解決してからインライン化 | WebView 外では変数が機能しない |

```typescript
// src/file/export/html-exporter.ts

import juice from 'juice';

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
  // Step 1: Markdown → hast 変換
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHighlight)
    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(options.includeToc ? rehypeToc : () => {})
    .use(rehypeStringify);

  const contentHtml = String(await processor.process(markdown));

  // Step 2: テーマ CSS 読み込み
  const themeCss = await loadThemeCss(options.theme);
  const highlightCss = await loadHighlightCss();

  // Step 3: HTML テンプレートへ注入
  const title = extractTitle(markdown) ?? 'Exported Document';
  const html = buildHtmlTemplate({ title, contentHtml, themeCss, highlightCss, options });

  // Step 4: CSS インライン化（オプション）
  const finalHtml = options.inlineCss ? juice(html) : html;

  // Step 5: ファイル書き出し
  await writeTextFile(outputPath, finalHtml);
}
```

### 2.4 Mermaid 図表のエクスポート対応

Mermaid は JavaScript ランタイムが必要なため、静的 HTML への埋め込みには SVG 事前レンダリングが必要。

```
エクスポート時の Mermaid 処理フロー:

[Mermaid コードブロック検出]
  │
  ├─ オプション A: SVG 事前レンダリング（デフォルト）
  │    → Tauri の headless WebView でレンダリング
  │    → SVG を HTML に直接埋め込み
  │    → JavaScript 不要のスタンドアローン HTML が生成される
  │
  └─ オプション B: mermaid.js を埋め込み
       → mermaid.min.js をバンドルして HTML に埋め込み
       → ブラウザが表示時にレンダリング
       → ファイルサイズ増加（約 2MB）
```

**採用方針**: オプション A（SVG 事前レンダリング）をデフォルトとし、オプション B はエクスポートダイアログで選択可能とする。

---

## 3. PDF エクスポート設計

### 3.1 生成方法

Tauri の WebView（Windows: WebView2、macOS: WKWebView）の印刷 API を使用して PDF を生成する。専用の PDF ライブラリは使わない。

```
PDF 生成フロー:

[PDF エクスポート要求]
  │
  ▼
[HTML エクスポートと同じ変換パイプライン]
  │  ※ juice によるCSS インライン化あり
  ▼
[Tauri: 印刷用 HTML を一時ファイルに書き出し]
  │
  ▼
[Tauri コマンド: print_to_pdf]
  │  WebView2 / WKWebView の print API 呼び出し
  ▼
[PDF ファイル生成]
  │
  ▼
[一時ファイル削除]
```

### 3.2 Tauri バックエンドの印刷コマンド

```rust
// src-tauri/src/commands/export.rs

use tauri::{AppHandle, WebviewWindow};

#[tauri::command]
pub async fn print_to_pdf(
    app: AppHandle,
    html_content: String,
    output_path: String,
    options: PdfOptions,
) -> Result<(), String> {
    // 一時 HTML ファイルに書き出し
    let temp_path = app.path().temp_dir()
        .map_err(|e| e.to_string())?
        .join("export_temp.html");
    std::fs::write(&temp_path, &html_content)
        .map_err(|e| e.to_string())?;

    // WebView で印刷（WebView2 の場合: PrintToPdf API）
    // WKWebView の場合: createPDF(configuration:completionHandler:)
    // ※ Tauri の将来バージョンで公式サポートされるまでは
    //    tauri-plugin-print を検討
    print_webview_to_pdf(&temp_path, &output_path, &options)
        .map_err(|e| e.to_string())?;

    // 一時ファイル削除
    let _ = std::fs::remove_file(&temp_path);
    Ok(())
}

#[derive(serde::Deserialize)]
pub struct PdfOptions {
    /// 用紙サイズ: "A4" | "Letter" | "A3"
    pub paper_size: String,
    /// 向き: "portrait" | "landscape"
    pub orientation: String,
    /// 余白（mm）
    pub margin_top: f64,
    pub margin_bottom: f64,
    pub margin_left: f64,
    pub margin_right: f64,
    /// ヘッダー・フッター表示
    pub print_header_footer: bool,
}
```

### 3.3 印刷用 CSS（`@media print`）

HTML エクスポートの CSS に `@media print` ブロックを追加し、PDF 出力品質を制御する。

```css
/* src/themes/default/print.css */

@media print {
  /* ページ余白 */
  @page {
    size: A4 portrait;
    margin: 20mm 25mm;
  }

  /* ナビゲーション・サイドバーを非表示 */
  .toc,
  nav {
    display: none;
  }

  /* 改ページ制御 */
  h1, h2, h3 {
    page-break-after: avoid;
  }

  pre, blockquote, table {
    page-break-inside: avoid;
  }

  /* コードブロックの折り返し */
  pre {
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* リンクに URL を付記 */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #666;
  }

  /* 内部リンクには URL を付記しない */
  a[href^="#"]::after {
    content: "";
  }
}
```

### 3.4 PDF エクスポートの制限事項

| 制限 | 詳細 |
|------|------|
| Mermaid 図表 | SVG 事前レンダリング必須（JavaScript 実行なし） |
| インタラクティブ要素 | PDF にはリンク以外のインタラクションなし |
| フォント埋め込み | OS フォントは PDF に自動埋め込みされる（WebView2 依存） |
| ファイルサイズ | 大きな画像・図表が多い場合は数十 MB になる可能性あり |

---

## 4. エクスポートオプション UI

### 4.1 エクスポートダイアログ

ファイルメニュー → エクスポート → HTML / PDF を選択するとダイアログを表示する。

```
┌─────────────────────────────────────────────────────────┐
│  HTML にエクスポート                              [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
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
│  ☐ mermaid.js を埋め込む（ファイルサイズ増加）            │
│                                                         │
│  保存先: /Users/user/Documents/my-note.html  [変更...]   │
│                                                         │
│  [プレビュー]                      [キャンセル] [エクスポート] │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│  PDF にエクスポート                               [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  テーマ       [GitHub スタイル     ▼]                    │
│  用紙サイズ   [A4               ▼]                      │
│  向き         ○ 縦  ● 横                               │
│                                                         │
│  余白（mm）   上: [20]  下: [20]  左: [25]  右: [25]    │
│                                                         │
│  ☐ ヘッダー・フッターを表示（ページ番号・タイトル）       │
│  ☑ 目次（TOC）を含める                                  │
│                                                         │
│  保存先: /Users/user/Documents/my-note.pdf   [変更...]   │
│                                                         │
│                              [キャンセル] [エクスポート] │
└─────────────────────────────────────────────────────────┘
```

### 4.2 メニュー構造

```
ファイル
  └─ エクスポート
       ├─ HTML にエクスポート...  （Ctrl+Shift+E）
       └─ PDF にエクスポート...
```

### 4.3 エクスポート設定の永続化

エクスポートオプションは前回の設定を記憶する。`user-settings-design.md` の設定スキーマに追加する。

```typescript
// AppSettings への追加項目
interface ExportSettings {
  // HTML エクスポートのデフォルト設定
  htmlExport: {
    theme: 'github' | 'document' | 'presentation';
    includeToc: boolean;
    inlineCss: boolean;
    renderMath: boolean;
    mermaidMode: 'svg' | 'bundle';
  };
  // PDF エクスポートのデフォルト設定
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

エクスポートテーマは `src/themes/` 配下に配置し、エディタのプレビュー CSS と変数体系を共有する（詳細は [theme-design.md](./theme-design.md) §3 参照）。

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
│   ├── export.css          # HTML/PDF エクスポート用
│   └── preview.css         # エディタ内プレビュー用
├── document/
│   ├── export.css
│   └── preview.css
└── presentation/
    ├── export.css
    └── preview.css         # 将来対応
```

### 5.3 GitHub テーマ CSS の構造

```css
/* src/themes/github/export.css */

/* ── レイアウト ─────────────────────── */
.markdown-body {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #24292f;
  background-color: #ffffff;
}

/* ── 見出し ──────────────────────────── */
.markdown-body h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }

/* ── コードブロック ──────────────────── */
.markdown-body pre {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow: auto;
}

.markdown-body code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 85%;
}

/* ── テーブル ────────────────────────── */
.markdown-body table {
  border-collapse: collapse;
  width: 100%;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid #d0d7de;
  padding: 6px 13px;
}

.markdown-body tr:nth-child(2n) {
  background-color: #f6f8fa;
}

/* ── 引用ブロック ────────────────────── */
.markdown-body blockquote {
  border-left: 4px solid #d0d7de;
  margin: 0;
  padding: 0 1em;
  color: #57606a;
}

/* ── TOC ─────────────────────────────── */
.toc {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 16px 24px;
  margin-bottom: 32px;
}

.toc ol { margin: 0; padding-left: 1.5em; }
.toc li { margin: 4px 0; }
```

---

## 6. 変換パイプライン詳細

### 6.1 数式（KaTeX）のエクスポート

KaTeX CSS はスタンドアローン出力のためにバンドルに含める。フォントは Base64 エンコードで埋め込むかウェブフォントを使用するか選択する。

```typescript
// KaTeX CSS とフォントの埋め込み方針
const KATEX_CSS_INLINE = true;       // CSS をインライン化
const KATEX_FONT_EMBED = 'woff2';    // フォントは woff2 で Base64 埋め込み
```

### 6.2 コードハイライトのエクスポート

`rehype-highlight` は `highlight.js` ベース。テーマごとに対応するハイライトテーマ CSS を埋め込む。

| エクスポートテーマ | ハイライトテーマ |
|----------------|---------------|
| `github` | `github` |
| `document` | `github-dark` |
| `presentation` | `monokai-sublime` |

### 6.3 画像パスの解決

エクスポート時に Markdown 内の相対パス画像を Base64 埋め込みするかコピーするか選択する。

```
画像パス解決フロー:

[画像パス: ./images/screenshot.png]
  │
  ├─ オプション A: Base64 埋め込み（デフォルト）
  │    → fs.readFile() で読み込み
  │    → data:image/png;base64,... に変換
  │    → <img src="data:..."> としてインライン化
  │    → 完全自己完結ファイルが生成される
  │
  └─ オプション B: ファイルをコピー
       → エクスポート先フォルダに ./images/ を作成してコピー
       → 相対パスはそのまま維持
       → 複数ファイルが生成される（HTML + images/）
```

---

## 7. 実装フェーズ

### Phase 4（HTML エクスポート）

- [ ] `unified` パイプライン構築（remark-rehype・rehype-highlight・rehype-katex）
- [ ] `rehypeSlug` + `rehypeToc` による TOC 生成
- [ ] HTML テンプレートエンジン実装（`buildHtmlTemplate()`）
- [ ] `juice` による CSS インライン化
- [ ] 画像の Base64 埋め込み処理
- [ ] Mermaid SVG 事前レンダリング（headless WebView）
- [ ] エクスポートダイアログ UI（テーマ選択・オプション）
- [ ] GitHub テーマ CSS 実装（`src/themes/github/export.css`）
- [ ] ドキュメントテーマ CSS 実装（`src/themes/document/export.css`）
- [ ] メニュー: ファイル → エクスポート → HTML にエクスポート

### Phase 7（PDF エクスポート）

- [ ] `@media print` CSS 実装
- [ ] Tauri コマンド `print_to_pdf` 実装（Rust）
- [ ] PDF エクスポートダイアログ UI
- [ ] メニュー: ファイル → エクスポート → PDF にエクスポート
- [ ] ページヘッダー・フッターのテンプレート設計
