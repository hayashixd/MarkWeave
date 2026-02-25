# HTML 編集設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25
> 統合元: html-editor-analysis.md, html-editing-advanced-design.md

---

## 目次

1. [追加機能の概要](#1-追加機能の概要)
2. [Markdown → HTML エクスポート](#2-markdown--html-エクスポート)
3. [HTML WYSIWYG 編集の基本方針](#3-html-wysiwyg-編集の基本方針)
4. [対応 HTML 要素](#4-対応-html-要素)
5. [双方向変換の設計](#5-双方向変換の設計)
6. [統合ドキュメントモデル](#6-統合ドキュメントモデル)
7. [技術選定](#7-技術選定)
8. [`<style>` タグ内 CSS 編集の範囲設計](#8-style-タグ内-css-編集の範囲設計)
9. [HTML 編集時の相対パス解決設計](#9-html-編集時の相対パス解決設計)
10. [HTML → MD 変換ロスの許容範囲定義](#10-html--md-変換ロスの許容範囲定義)
11. [JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計](#11-javascript--iframe-埋め込みコンテンツの-wysiwyg-表示設計)
12. [未解決の課題](#12-未解決の課題)

---

## 1. 追加機能の概要

本プロジェクトに HTML ファイルの編集・変換機能を追加する。大きく以下の 2 つの機能軸からなる。

| 機能 | 説明 |
|------|------|
| **MD → HTML 変換・エクスポート** | 編集中の Markdown ファイルを HTML ファイルとして出力する |
| **HTML WYSIWYG 編集** | HTML ファイルを Markdown と同様の直感的な操作で編集する |

---

## 2. Markdown → HTML エクスポート

### 2.1 変換パイプライン

```
Markdown テキスト
  │
  ▼
[remark パーサ] → mdast（Markdown AST）
  │
  ▼
[remark-rehype] → hast（HTML AST）
  │
  ├─ [rehype-highlight]   シンタックスハイライト
  ├─ [rehype-katex]       数式レンダリング
  ├─ [rehype-mermaid]     図表レンダリング
  └─ [rehype-stringify]
        │
        ▼
  HTML テキスト
  │
  ▼
[HTML テンプレートへ注入]
  │
  ▼
スタンドアロン .html ファイル
```

### 2.2 エクスポートオプション

| オプション | デフォルト | 説明 |
|-----------|---------|------|
| テーマ | `github` | GitHub スタイル / ドキュメントスタイル等 |
| CSS インライン化 | `true` | 外部ファイル不要のスタンドアロン HTML |
| シンタックスハイライト | `true` | コードブロックの色付け |
| 数式レンダリング | `true` | KaTeX を埋め込み |
| 目次自動生成 | `false` | 見出しから TOC を生成 |
| ファイル名 | 元ファイル名 + `.html` | 出力ファイル名 |

### 2.3 HTML テンプレート構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>{{theme-css}}</style>          <!-- テーマ CSS（インライン） -->
  <style>{{katex-css}}</style>          <!-- KaTeX CSS（オプション） -->
</head>
<body>
  <article class="markdown-body">
    {{content}}                         <!-- 変換済み HTML コンテンツ -->
  </article>
  <script>{{mermaid-init}}</script>     <!-- Mermaid 初期化（オプション） -->
</body>
</html>
```

---

## 3. HTML WYSIWYG 編集の基本方針

HTML ファイルを Markdown と同様に「直感的に」編集するための考え方。

**ポイント**: HTML と Markdown は根本的に異なる。Markdown は「テキストに意味を付ける」シンプルな記法だが、HTML は「ページ構造とスタイルを完全に制御する」マークアップ言語である。このギャップを埋めるため、本エディタでは **コンテンツ中心の編集モデル** を採用する。

```
┌─────────────────────────────────────────────────────────┐
│              HTML ファイルの編集対象                       │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  <head>                                        │     │
│  │    title, meta, CSS リンク（メタデータパネル）  │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │  <body>                                        │     │
│  │    ▶ WYSIWYG 編集の主対象                       │     │
│  │      - 見出し・段落・リスト・テーブル           │     │
│  │      - インラインスタイル（太字・色・サイズ）   │     │
│  │      - 画像・リンク・埋め込み                  │     │
│  │      - div ブロックのレイアウト                 │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 3.1 編集モード（3 種類）

Markdown エディタと同様に 3 つのモードを提供する。

```
┌──────────────────────────────────────┐
│           編集モード                  │
├──────────────────────────────────────┤
│ 1. WYSIWYG モード（デフォルト）       │
│    - レンダリング結果を見ながら編集   │
│    - ツールバーで書式設定             │
│    - ドラッグ&ドロップで要素移動      │
├──────────────────────────────────────┤
│ 2. ソースコード モード                │
│    - 生 HTML を直接編集              │
│      （シンタックスハイライト + 補完付き）│
├──────────────────────────────────────┤
│ 3. スプリット モード                  │
│    - 左: ソースコード / 右: プレビュー│
│    - 同期スクロール                   │
└──────────────────────────────────────┘
```

---

## 4. 対応 HTML 要素

### 4.1 対応 HTML ブロック要素

| HTML 要素 | WYSIWYG 表示 | 対応 Markdown 要素 |
|---------|-----------|----------------|
| `<h1>`〜`<h6>` | 見出し | `# `〜`###### ` |
| `<p>` | 段落 | 段落 |
| `<ul>`, `<ol>`, `<li>` | リスト | `- `, `1. ` |
| `<blockquote>` | 引用 | `> ` |
| `<pre><code>` | コードブロック | ` ``` ` |
| `<table>` | テーブル | `\| \| \|` |
| `<hr>` | 水平線 | `---` |
| `<div>` | セクション区切り | （MD 非対応） |
| `<section>`, `<article>` | セマンティックブロック | （MD 非対応） |
| `<figure>`, `<figcaption>` | 図版 | （MD 非対応） |

### 4.2 対応 HTML インライン要素

| HTML 要素 | WYSIWYG 表示 | 対応 Markdown 要素 |
|---------|-----------|----------------|
| `<strong>`, `<b>` | **太字** | `**text**` |
| `<em>`, `<i>` | *斜体* | `*text*` |
| `<s>`, `<del>` | ~~取り消し~~ | `~~text~~` |
| `<code>` | `インラインコード` | `` `code` `` |
| `<a href>` | リンク | `[text](url)` |
| `<img>` | 画像 | `![alt](src)` |
| `<mark>` | ハイライト | （MD 非対応） |
| `<span style>` | カスタムスタイル | （MD 非対応） |
| `<sup>`, `<sub>` | 上付き・下付き | （MD 非対応） |

### 4.3 HTML 固有の WYSIWYG 操作

Markdown にはない、HTML 編集で追加される UI 操作。

#### カラーピッカー
- 文字色（`color`）の変更
- 背景色（`background-color`）の変更

#### フォントスタイル
- フォントサイズの変更（`font-size`）
- フォントファミリーの選択（`font-family`）

#### ブロックレイアウト
- div ブロックの追加・削除
- `float`, `text-align`, `margin`, `padding` の基本制御
- Flexbox / Grid の簡易設定（将来）

#### メタデータパネル
- `<title>` 編集
- `<meta description>` 編集
- CSS ファイルの追加・削除
- `<link>`, `<script>` タグの管理

---

## 5. 双方向変換の設計

### 5.1 MD → HTML（ロスレス方向）

Markdown で表現できるすべての要素は HTML で表現可能。変換は基本的にロスレス。

```
Markdown        →   HTML
────────────────────────────────────
# 見出し        →   <h1>見出し</h1>
**太字**        →   <strong>太字</strong>
[リンク](url)   →   <a href="url">リンク</a>
- リスト        →   <ul><li>リスト</li></ul>
> 引用          →   <blockquote><p>引用</p></blockquote>
```

### 5.2 HTML → MD（ロッシー方向）

HTML は Markdown より表現力が高いため、変換時に情報が失われる場合がある。`turndown` ライブラリ（+ カスタムルール）を使用して対応。

```
HTML                        →   Markdown        変換品質
──────────────────────────────────────────────────────────
<h1>見出し</h1>             →   # 見出し         ✅ 完全
<strong>太字</strong>        →   **太字**          ✅ 完全
<table>...</table>          →   | ... |           ✅ 完全（シンプルなテーブルのみ）
<mark>ハイライト</mark>     →   ハイライト        ⚠️ 属性ロス
<span style="color:red">    →   red text          ⚠️ スタイルロス
<div class="container">     →   （段落として扱い） ⚠️ 構造ロス
<svg>...</svg>              →   （削除）           ❌ 変換不可
```

**変換時の警告表示**: 情報ロスが発生する場合はエディタ上で警告バナーを表示する。

### 5.3 変換モードの UI 統合

```
メニュー: ファイル
  ├─ 開く（.md / .html 両対応）
  ├─ 保存
  ├─ 別名で保存
  │   ├─ Markdown として保存 (.md)
  │   └─ HTML として保存 (.html)
  └─ エクスポート
      ├─ HTML にエクスポート（スタイル付き）
      ├─ PDF にエクスポート
      └─ Markdown に変換して開く（HTML→MD）
```

---

## 6. 統合ドキュメントモデル

### 6.1 内部 AST（hast 互換）

Markdown・HTML どちらのファイルも、内部では同一の AST で表現する。

```
┌─────────┐   parse    ┌──────────────┐   serialize  ┌─────────┐
│  .md    │ ─────────► │              │ ────────────► │  .md    │
└─────────┘            │  内部 AST    │               └─────────┘
                        │  (hast 互換) │
┌─────────┐   parse    │              │   serialize  ┌─────────┐
│  .html  │ ─────────► │              │ ────────────► │  .html  │
└─────────┘            └──────────────┘               └─────────┘
```

内部 AST は Markdown/HTML 両方の概念を包含できるよう **hast（Hypertext Abstract Syntax Tree）** ベースで設計する。

### 6.2 エディタモードの自動切替

| ファイル拡張子 | デフォルト編集モード |
|-------------|----------------|
| `.md`, `.markdown` | Markdown WYSIWYG モード |
| `.html`, `.htm` | HTML WYSIWYG モード |
| その他 | ソースコードモード |

---

## 7. 技術選定

### 7.1 変換ライブラリ

| 用途 | ライブラリ | 備考 |
|------|---------|------|
| MD → HTML AST | `remark-rehype` | unified エコシステム内 |
| HTML AST → HTML 文字列 | `rehype-stringify` | unified エコシステム内 |
| HTML → MD | `turndown` | カスタムルール追加で品質向上 |
| HTML AST 操作 | `hast-util-*` | unified エコシステム内 |
| HTML パース | `rehype-parse` | unified エコシステム内 |
| CSS インライン化 | `juice` | メール/スタンドアロン HTML 向け |

### 7.2 HTML エディタエンジン

ProseMirror をベースに、HTML 編集用のスキーマを追加定義する。

```typescript
// Markdown スキーマ（既存）
const markdownSchema = buildMarkdownSchema();

// HTML スキーマ（新規）
const htmlSchema = buildHtmlSchema({
  allowInlineStyles: true,
  allowCustomClasses: true,
  allowDivBlocks: true,
  allowSemanticElements: true,
});
```

### 7.3 HTML 専用ツールバー

Markdown ツールバーに加え、HTML 編集時は以下のコントロールを追加する。

```
[B] [I] [U] [S] | [H1〜H6] | [色▼] [背景▼] | [フォントサイズ▼] |
[リスト] [引用] [コード] | [テーブル] [画像] [リンク] |
[div 追加] [align▼] | [ソース表示] [プレビュー] [スプリット]
```

---

## 8. `<style>` タグ内 CSS 編集の範囲設計

### 8.1 設計方針

**インライン CSS 編集は提供しない**（WYSIWYG エディタの責務を超えるため）。`<style>` タグの扱いは以下の 2 段階で行う:

| フェーズ | 対応 |
|---------|------|
| Phase 5（HTML WYSIWYG 編集）| `<style>` ブロックをソースとして表示・編集のみ |
| Phase 7 以降 | CSS エディタペインの提供を検討 |

### 8.2 `<style>` ブロックの表示方法

WYSIWYG モードでは `<style>` タグは **CodeMirror 6（CSS モード）** でレンダリングする。このブロックはユーザーが直接編集できる。

```
WYSIWYG 表示:
┌────────────────────────────────────────────┐
│ <style>                     [CSS]          │
│   .markdown-body { color: #333; }          │
│   h1 { font-size: 2em; }                  │
│ </style>                                  │
└────────────────────────────────────────────┘
```

- ブロックは `rawHtmlBlock` ではなく専用の `styleBlock` カスタムノードとして実装
- シンタックスハイライト: CSS
- フォールドで折りたたみ可能

### 8.3 スタイルの live プレビュー

HTML 編集モードのスプリット表示（右ペインプレビュー）では、`<style>` タグの内容を動的に適用したプレビューを表示する。

```
左ペイン（ソース編集）     右ペイン（プレビュー）
┌────────────────────┐   ┌────────────────────┐
│ <style>            │   │ スタイル適用済みの  │
│   h1 { color: red; }│ → │ HTML プレビュー    │
│ </style>           │   │                    │
│ <h1>Test</h1>      │   │ [Test ← 赤色]      │
└────────────────────┘   └────────────────────┘
```

### 8.4 CSS の外部ファイル化

メタデータパネル（§4.3）から `<link rel="stylesheet">` の追加・削除が可能。外部 CSS ファイルのパスは §9 の相対パス解決に従って解決する。

---

## 9. HTML 編集時の相対パス解決設計

### 9.1 解決が必要なパスの種類

HTML 編集時に相対パスで参照されるリソース:

| タグ・属性 | 例 |
|----------|----|
| `<img src="./images/photo.png">` | 画像 |
| `<link href="./style.css">` | CSS |
| `<script src="./app.js">` | JavaScript |
| `<a href="./other.html">` | 別 HTML ファイル |
| `<video src="./video.mp4">` | 動画 |

### 9.2 WebView でのパス解決問題

Tauri の WebView はファイルシステムパスへの直接アクセスを制限している。`file://` URL 形式または Tauri の asset protocol を使用する必要がある。

```
問題: <img src="./images/photo.png"> は WebView では解決されない

解決策: Tauri の convertFileSrc() でアセット URL に変換
  → <img src="https://asset.localhost/path/to/images/photo.png">
```

### 9.3 パス解決の実装

```typescript
// src/file/html-path-resolver.ts
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { resolve, dirname } from '@tauri-apps/api/path';

/**
 * HTML 文字列内の相対パスを Tauri アセット URL に変換する
 * （WYSIWYG プレビューおよびスプリットビューで使用）
 */
export async function resolveHtmlPaths(
  html: string,
  htmlFilePath: string,
): Promise<string> {
  const baseDir = await dirname(htmlFilePath);

  // img src, link href, script src を変換
  return html.replace(
    /(src|href)="(?!https?:\/\/|data:|#)([^"]+)"/g,
    async (_, attr, relPath) => {
      const absPath = await resolve(baseDir, relPath);
      const assetUrl = convertFileSrc(absPath);
      return `${attr}="${assetUrl}"`;
    },
  );
}
```

### 9.4 保存時のパス正規化

HTML ファイルを保存する際は、アセット URL を元の相対パスに戻す。エディタ内部表現と保存ファイルのパス形式を分離して管理する。

```typescript
// 保存フロー
// 内部表現（asset.localhost URL）
//   → tiptapToHtml()
//   → assetUrlToRelativePath() で相対パスに変換
//   → .html ファイルに書き込み
```

### 9.5 ワークスペース外パスの扱い

`plugin-fs` のスコープ制限（[security-design.md](../01_Architecture/security-design.md) §4）により、ワークスペース外のファイルを参照する相対パスは表示できない。その場合は「⚠ このファイルはセキュリティの制約により表示できません」をプレビューに表示する。

---

## 10. HTML → MD 変換ロスの許容範囲定義

### 10.1 変換方針

HTML → MD 変換（turndown を使用）は **情報ロスが避けられない**。ユーザーが変換を選択する際に事前に確認できるよう、ロスの種類を明示する。

### 10.2 変換サポートレベル

| HTML 要素 / 機能 | 変換結果 | 備考 |
|----------------|---------|------|
| `<h1>`〜`<h6>` | `#` 見出し | ✅ 完全対応 |
| `<p>` | 段落 | ✅ 完全対応 |
| `<strong>`, `<b>` | `**bold**` | ✅ |
| `<em>`, `<i>` | `*italic*` | ✅ |
| `<a href>` | `[text](url)` | ✅ |
| `<img>` | `![alt](src)` | ✅（title は破棄） |
| `<ul>`, `<ol>` | リスト | ✅ |
| `<blockquote>` | `>` 引用 | ✅ |
| `<pre><code>` | コードブロック | ✅ |
| `<table>` | Markdown テーブル | ✅（セル結合は破棄） |
| `<hr>` | `---` | ✅ |
| **以下はロスあり** | | |
| インラインスタイル（`style="color:red"`）| **消失** | Markdown に対応なし |
| `<div>`, `<span>` | 内容を展開（タグ消失）| クラス・属性が消失 |
| `<table>` セル結合（colspan/rowspan）| セル構造が崩れる | Markdown の限界 |
| `<figure>`, `<figcaption>` | `![caption](src)` に変換 | figcaption → alt |
| `<details>`, `<summary>` | テキスト化（構造消失）| Markdown に対応なし |
| `<video>`, `<audio>` | リンクに変換 | `[video](src)` |
| `<iframe>` | **消失**（セキュリティ上の理由）| — |
| `<script>`, `<style>` | **消失** | — |
| `<mark>` | `==text==`（enableHighlight が必要）| 拡張記法 |
| `<sup>`, `<sub>` | `^text^` / `~text~`（設定依存）| 拡張記法 |
| カスタム HTML 属性 | **消失** | — |

### 10.3 変換前の警告ダイアログ

```
┌──────────────────────────────────────────────────────┐
│  HTML を Markdown に変換                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  このファイルには以下の要素が含まれています。         │
│  変換時に失われる可能性があります:                   │
│                                                      │
│  ⚠ インラインスタイル     (23 箇所)                  │
│  ⚠ テーブルのセル結合     (2 箇所)                   │
│  ⚠ カスタム div ブロック  (5 箇所)                   │
│                                                      │
│  変換後は元の HTML に戻すことはできません。           │
│  変換前に HTML ファイルを別名で保存することを         │
│  推奨します。                                        │
│                                                      │
│  [キャンセル]  [別名で保存してから変換]  [変換する]  │
└──────────────────────────────────────────────────────┘
```

### 10.4 変換結果のプレビュー

「変換する」前に変換後の Markdown をプレビューできるオプションを提供する（Phase 7）。

---

## 11. JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計

### 11.1 セキュリティ方針

`<script>` タグおよび `<iframe>` は **WYSIWYG プレビューで実行しない**。これは XSS 攻撃および悪意ある埋め込みコンテンツの実行を防ぐための必須要件。

詳細セキュリティ設計は [security-design.md](../01_Architecture/security-design.md) §5「スクリプトタグ分離」を参照。

### 11.2 表示方法

**`<script>` タグ**:

```
WYSIWYG 表示:
┌────────────────────────────────────┐
│ 🔒 <script>        [ソースを表示]  │
│    JavaScript コード（実行されません）│
└────────────────────────────────────┘
```

- CodeMirror 6（JavaScript モード）でシンタックスハイライト表示
- 「実行されません」の注記を明示
- `rawHtmlBlock` カスタムノードで保持（保存時には元の `<script>` として出力）

**`<iframe>` タグ**:

```
WYSIWYG 表示:
┌────────────────────────────────────┐
│ 🖼 iframe: youtube.com             │
│                                    │
│    [埋め込みコンテンツ]             │
│    セキュリティの制限により          │
│    プレビューできません             │
│                                    │
│    src: https://www.youtube.com/... │
└────────────────────────────────────┘
```

### 11.3 セキュアなプレビュー（オプション）

ユーザーが明示的に許可した場合のみ、`<iframe>` をサンドボックス化して表示する。

```html
<!-- WYSIWYG 内での iframe 表示（サンドボックス） -->
<iframe
  src="https://www.youtube.com/..."
  sandbox="allow-scripts allow-same-origin"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
```

- 初回表示時: 「このコンテンツを表示しますか？（URL: ...）」確認ダイアログ
- 許可リスト: `allow-list.json` に保存し、次回から確認不要
- `sandbox` 属性で `allow-forms`・`allow-top-navigation` は禁止

### 11.4 エクスポート時の扱い

HTML エクスポート時は元の `<script>` / `<iframe>` タグをそのまま出力する（エクスポート先では実行される可能性がある旨をドキュメントに注記）。

---

## 12. 未解決の課題

1. **CSS 編集の範囲**: インラインスタイルのみ対応するか、`<style>` タグ内の CSS も編集するか（Phase 7 以降で CSS エディタペインを検討）
2. **JavaScript の扱い**: `<script>` タグ内の JS をどこまで編集 UI で扱うか（セキュリティ面も考慮）
3. **HTML テンプレート**: Jinja2, EJS 等のテンプレート構文が含まれる HTML の扱い
4. **大規模 HTML**: 数千行の HTML ファイルのパフォーマンス（仮想化の必要性）

---

## 関連ドキュメント

- [file-workspace-design.md](../04_File_Workspace/file-workspace-design.md) — ファイル操作・ドロップによる HTML ファイルオープン
- [export-interop-design.md](../06_Export_Interop/export-interop-design.md) — HTML エクスポートパイプライン・Pandoc 連携
- [security-design.md](../01_Architecture/security-design.md) — XSS 対策・スクリプトタグ分離
- [smart-paste-design.md](../06_Export_Interop/smart-paste-design.md) — HTML ペースト時の変換設計
