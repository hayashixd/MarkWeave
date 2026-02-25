# HTML 編集詳細設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [`<style>` タグ内 CSS 編集の範囲設計](#1-style-タグ内-css-編集の範囲設計)
2. [HTML 編集時の相対パス解決設計](#2-html-編集時の相対パス解決設計)
3. [HTML → MD 変換ロスの許容範囲定義](#3-html--md-変換ロスの許容範囲定義)
4. [JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計](#4-javascript--iframe-埋め込みコンテンツの-wysiwyg-表示設計)

---

## 1. `<style>` タグ内 CSS 編集の範囲設計

### 1.1 設計方針

**インライン CSS 編集は提供しない**（WYSIWYG エディタの責務を超えるため）。
`<style>` タグの扱いは以下の 2 段階で行う:

| フェーズ | 対応 |
|---------|------|
| Phase 5（HTML WYSIWYG 編集）| `<style>` ブロックをソースとして表示・編集のみ |
| Phase 7 以降 | CSS エディタペインの提供を検討 |

### 1.2 `<style>` ブロックの表示方法

WYSIWYG モードでは `<style>` タグは **CodeMirror 6（CSS モード）** でレンダリングする。
このブロックはユーザーが直接編集できる。

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

### 1.3 スタイルの live プレビュー

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

### 1.4 CSS の外部ファイル化

メタデータパネル（[html-editor-analysis.md](./html-editor-analysis.md) §4）から `<link rel="stylesheet">` の追加・削除が可能。
外部 CSS ファイルのパスは §2 の相対パス解決に従って解決する。

---

## 2. HTML 編集時の相対パス解決設計

### 2.1 解決が必要なパスの種類

HTML 編集時に相対パスで参照されるリソース:

| タグ・属性 | 例 |
|----------|----|
| `<img src="./images/photo.png">` | 画像 |
| `<link href="./style.css">` | CSS |
| `<script src="./app.js">` | JavaScript |
| `<a href="./other.html">` | 別 HTML ファイル |
| `<video src="./video.mp4">` | 動画 |

### 2.2 WebView でのパス解決問題

Tauri の WebView はファイルシステムパスへの直接アクセスを制限している。
`file://` URL 形式または Tauri の asset protocol を使用する必要がある。

```
問題: <img src="./images/photo.png"> は WebView では解決されない

解決策: Tauri の convertFileSrc() でアセット URL に変換
  → <img src="https://asset.localhost/path/to/images/photo.png">
```

### 2.3 パス解決の実装

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

### 2.4 保存時のパス正規化

HTML ファイルを保存する際は、アセット URL を元の相対パスに戻す。
エディタ内部表現と保存ファイルのパス形式を分離して管理する。

```typescript
// 保存フロー
// 内部表現（asset.localhost URL）
//   → tiptapToHtml()
//   → assetUrlToRelativePath() で相対パスに変換
//   → .html ファイルに書き込み
```

### 2.5 ワークスペース外パスの扱い

`plugin-fs` のスコープ制限（[security-design.md](./security-design.md) §4）により、
ワークスペース外のファイルを参照する相対パスは表示できない。
その場合は「⚠ このファイルはセキュリティの制約により表示できません」をプレビューに表示する。

---

## 3. HTML → MD 変換ロスの許容範囲定義

### 3.1 変換方針

HTML → MD 変換（turndown を使用）は **情報ロスが避けられない**。
ユーザーが変換を選択する際に事前に確認できるよう、ロスの種類を明示する。

### 3.2 変換サポートレベル

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

### 3.3 変換前の警告ダイアログ

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
│  [キャンセル]  [別名で保存してから変換]  [変換する] │
└──────────────────────────────────────────────────────┘
```

### 3.4 変換結果のプレビュー

「変換する」前に変換後の Markdown をプレビューできるオプションを提供する（Phase 7）。

---

## 4. JavaScript / iframe 埋め込みコンテンツの WYSIWYG 表示設計

### 4.1 セキュリティ方針

`<script>` タグおよび `<iframe>` は **WYSIWYG プレビューで実行しない**。
これは XSS 攻撃および悪意ある埋め込みコンテンツの実行を防ぐための必須要件。

詳細セキュリティ設計は [security-design.md](./security-design.md) §5「スクリプトタグ分離」を参照。

### 4.2 表示方法

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

### 4.3 セキュアなプレビュー（オプション）

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

### 4.4 エクスポート時の扱い

HTML エクスポート時は元の `<script>` / `<iframe>` タグをそのまま出力する（エクスポート先では実行される可能性がある旨をドキュメントに注記）。

---

## 関連ドキュメント

- [html-editor-analysis.md](./html-editor-analysis.md) — HTML 編集の基本 UX（3モード設計）
- [security-design.md](./security-design.md) — XSS 対策・スクリプトタグ分離
- [export-design.md](./export-design.md) — HTML エクスポートパイプライン
- [smart-paste-design.md](./smart-paste-design.md) — HTML ペースト時の変換設計
