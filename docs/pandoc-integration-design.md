# Pandoc 連携設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [Word（.docx）エクスポート設計](#1-worddocxエクスポート設計)
2. [LaTeX / ePub エクスポート設計](#2-latex--epub-エクスポート設計)
3. [Pandoc パス設定・外部ツール連携](#3-pandoc-パス設定外部ツール連携)
4. [Pandoc バージョン互換性](#4-pandoc-バージョン互換性)

---

## 1. Word（.docx）エクスポート設計

### 1.1 エクスポートフロー

```
メニュー → エクスポート → Word (.docx)
  │
  ▼
[オプションダイアログ]
  テンプレート: [reference.docx を選択...]  または  デフォルト
  □ 目次を自動生成
  □ シンタックスハイライトを含める
  │
  [エクスポート]
  │
  ▼
Tauri コマンド経由で Pandoc を呼び出し:
  pandoc input.md -o output.docx [--reference-doc=ref.docx] [--toc]
  │
  ▼
保存先ダイアログ → .docx 保存
```

### 1.2 reference.docx テンプレート

Word のスタイル（見出し・本文・コードブロックなど）を reference.docx で制御する。

| テンプレート | 説明 |
|------------|------|
| デフォルト（Pandoc 組み込み） | Pandoc 標準の Word スタイル |
| カスタム reference.docx | ユーザーが指定した .docx ファイルのスタイルを使用 |

```typescript
// src/export/docx-exporter.ts
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

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
use std::process::Command;
use std::io::Write;
use tempfile::NamedTempFile;

#[tauri::command]
pub async fn export_with_pandoc(
    content: String,
    output_path: String,
    format: String,
    reference_doc: Option<String>,
    toc: bool,
    highlight: bool,
) -> Result<(), String> {
    // 一時ファイルに Markdown を書き出し
    let mut tmp = NamedTempFile::new().map_err(|e| e.to_string())?;
    tmp.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    let tmp_path = tmp.path().to_string_lossy().to_string();

    let pandoc_path = get_pandoc_path()?; // §3 参照

    let mut args = vec![
        tmp_path.clone(),
        "-o".to_string(),
        output_path.clone(),
        "--from=markdown".to_string(),
        format!("--to={}", format),
    ];
    if toc { args.push("--toc".to_string()); }
    if let Some(ref_doc) = reference_doc {
        args.push(format!("--reference-doc={}", ref_doc));
    }
    if highlight {
        args.push("--highlight-style=pygments".to_string());
    }

    let status = Command::new(&pandoc_path)
        .args(&args)
        .status()
        .map_err(|e| format!("Pandoc 実行エラー: {}", e))?;

    if !status.success() {
        return Err(format!("Pandoc がエラーで終了しました (code: {:?})", status.code()));
    }
    Ok(())
}
```

### 1.3 数式・図表の扱い

| コンテンツ | .docx 変換 |
|-----------|-----------|
| KaTeX 数式 (`$...$`) | Pandoc が OMath (Word 数式) に変換 |
| Mermaid 図 | SVG/PNG に事前レンダリングして埋め込み（§1.4 参照） |
| コードブロック | Courier New フォント + バックグラウンド色 |
| 脚注 | Word の脚注機能に変換 |

### 1.4 Mermaid 図の事前レンダリング

Pandoc は Mermaid を直接処理できないため、エクスポート前に PNG に変換する。

```typescript
// エクスポートパイプライン
// 1. Markdown 内の Mermaid コードブロックを検出
// 2. Mermaid CLI (mmdc) または WebView でレンダリングして PNG を生成
// 3. コードブロックを ![diagram](tmp/mermaid-N.png) に置換
// 4. Pandoc でエクスポート
// 5. 一時 PNG ファイルを削除
```

---

## 2. LaTeX / ePub エクスポート設計

### 2.1 LaTeX エクスポート

```typescript
// LaTeX エクスポートオプション
interface LatexExportOptions {
  engine: 'pdflatex' | 'xelatex' | 'lualatex';  // PDF 生成エンジン
  template: string | null;    // カスタム .tex テンプレート
  toc: boolean;
  numberSections: boolean;
  geometry: string;           // "margin=2cm" など
}
```

**出力フォーマット:**

| オプション | 説明 |
|-----------|------|
| `.tex` のみ | LaTeX ソースを出力（PDF 生成なし） |
| `.pdf`（PDF 直接生成） | xelatex 等で PDF に変換（要 TeX 環境） |

```
pandoc input.md -o output.tex --from=markdown --to=latex [--template=custom.tex]
pandoc input.md -o output.pdf --pdf-engine=xelatex
```

**日本語対応:**
- `xelatex` + `xeCJK` パッケージ推奨
- テンプレート例:
  ```latex
  \usepackage{xeCJK}
  \setCJKmainfont{Noto Serif CJK JP}
  ```

### 2.2 ePub エクスポート

```
pandoc input.md -o output.epub --epub-cover-image=cover.jpg --toc
```

```typescript
interface EpubExportOptions {
  coverImage: string | null;  // カバー画像パス
  css: string | null;         // カスタム CSS
  toc: boolean;
  chapterLevel: number;       // 章の見出しレベル（デフォルト: 1）
  metadata: {
    title: string;
    author: string;
    language: string;         // 'ja', 'en' など
  };
}
```

### 2.3 エクスポート UI 統合

```
┌──────────────────────────────────────┐
│  エクスポート形式を選択               │
├──────────────────────────────────────┤
│  ● Word (.docx)                      │
│  ○ PDF (HTML 経由)                   │
│  ○ LaTeX (.tex)                      │
│  ○ ePub (.epub)                      │
│  ○ HTML                              │
├──────────────────────────────────────┤
│  [設定...]           [エクスポート]  │
└──────────────────────────────────────┘
```

---

## 3. Pandoc パス設定・外部ツール連携

### 3.1 Pandoc の検出

```rust
// src-tauri/src/commands/export.rs
fn get_pandoc_path() -> Result<String, String> {
    // 1. ユーザー設定の pandocPath を確認
    if let Some(path) = get_user_setting("pandocPath") {
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    // 2. PATH から pandoc を検索
    #[cfg(target_os = "windows")]
    let candidates = vec![
        "pandoc.exe",
        r"C:\Program Files\Pandoc\pandoc.exe",
    ];
    #[cfg(not(target_os = "windows"))]
    let candidates = vec![
        "pandoc",
        "/usr/local/bin/pandoc",
        "/opt/homebrew/bin/pandoc",
    ];

    for candidate in &candidates {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return Ok(candidate.to_string());
        }
    }

    Err("Pandoc が見つかりません。設定からパスを指定してください。".to_string())
}
```

### 3.2 設定 UI

設定画面 → 「外部ツール」セクション:

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

**バージョン確認:**
```typescript
// 設定画面の「現在のバージョン」表示
async function checkPandocVersion(path: string): Promise<string | null> {
  try {
    const result = await invoke<string>('run_command', {
      program: path,
      args: ['--version'],
    });
    const match = result.match(/pandoc (\S+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
```

### 3.3 Pandoc 未インストール時のエラーハンドリング

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
│  インストール後、設定 → 外部ツールからパスを           │
│  設定してください。                                   │
│                                                      │
│  [設定を開く]  [閉じる]                              │
└──────────────────────────────────────────────────────┘
```

---

## 4. Pandoc バージョン互換性

### 4.1 最低動作バージョン

| Pandoc バージョン | サポート状況 |
|-----------------|-------------|
| 3.0 以上 | ✅ 完全サポート |
| 2.19.x | ✅ 基本機能のみ（一部オプション非対応） |
| 2.x 未満 | ❌ 非サポート |

### 4.2 バージョン別機能差異

| 機能 | Pandoc 2.x | Pandoc 3.x |
|------|-----------|-----------|
| `--from=markdown+...` 拡張 | ✅ | ✅ |
| `--embed-resources` | ❌ (`--self-contained`) | ✅ |
| Markdown 脚注 | ✅ | ✅ |
| GitHub Flavored Markdown | ✅ | ✅ |

---

## 関連ドキュメント

- [export-design.md](./export-design.md) — HTML/PDF エクスポートパイプライン
- [user-settings-design.md](./user-settings-design.md) — 外部ツール設定の保存
- [markdown-extensions-design.md](./markdown-extensions-design.md) — 脚注・数式など変換対象の拡張記法
