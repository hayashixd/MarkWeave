# セキュリティ設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [HTML プレビューのサニタイズ戦略](#1-html-プレビューのサニタイズ戦略)
2. [script タグを含む HTML ブロックの分離戦略](#2-script-タグを含む-html-ブロックの分離戦略)
3. [Tauri ファイルシステムスコープの制限](#3-tauri-ファイルシステムスコープの制限)
4. [その他のセキュリティ考慮事項](#4-その他のセキュリティ考慮事項)

---

## 1. HTML プレビューのサニタイズ戦略

### 1.1 脅威モデル

エディタは **ローカルファイルを開くアプリ**であるため、外部からのコンテンツ注入は通常発生しない。
ただし、以下のケースでは XSS・情報漏洩リスクが存在する：

| 脅威 | 経路 | リスクレベル |
|------|------|------------|
| 悪意ある .md/.html ファイルを開く | ソーシャルエンジニアリング | **中**（ローカル限定） |
| クリップボードからの HTML ペースト | 外部コンテンツ | **中** |
| Markdown 内の生 HTML ブロック | ローカルファイル | **低〜中** |
| 外部URLからの画像 CSS（CSS インジェクション） | ネットワーク | **低** |

Tauri の WebView はレンダラープロセスを Chromium のサンドボックス内で実行するため、
従来のブラウザ XSS より攻撃面は狭い。しかし Tauri コマンド（`invoke()`）経由で
ファイルシステムへアクセスできるため、スクリプト実行は防ぐ必要がある。

### 1.2 プレビューエリアのサニタイズ方針

**採用方針: DOMPurify によるサニタイズ（一次防衛） + `<iframe sandbox>` による隔離（二次防衛）**

#### 一次防衛: DOMPurify

HTML プレビューを innerHTML で DOM に挿入する前に DOMPurify でサニタイズする。

```typescript
// src/renderer/html/live-preview.ts

import DOMPurify from 'dompurify';

/**
 * HTML文字列をサニタイズしてプレビュー用DOMに安全に挿入する。
 * <script> タグ・インラインイベントハンドラ（onerror= 等）を除去する。
 */
export function renderSanitizedHtml(
  container: HTMLElement,
  rawHtml: string
): void {
  const clean = DOMPurify.sanitize(rawHtml, {
    // 許可するタグ（HTMLエディタの表現に必要な要素を列挙）
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'del', 'code', 'pre',
      'ul', 'ol', 'li',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img',
      'div', 'span', 'section', 'article', 'header', 'footer',
      'details', 'summary',
      'figure', 'figcaption',
      'sup', 'sub',
      'mark',
    ],
    // 許可する属性
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id',
      'width', 'height', 'align', 'colspan', 'rowspan',
      'data-*',         // カスタムデータ属性
      'target',         // <a target="_blank">
      'rel',            // <a rel="noopener">
      'type',           // <ol type="1">
      'start',          // <ol start="5">
      'checked',        // <input type="checkbox">
      'disabled',       // チェックボックスの表示用
    ],
    // <script> タグは絶対に除去
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    // イベントハンドラ属性（onerror=, onclick= 等）は除去
    FORBID_ATTR: [],    // ALLOW_DATA_ATTR と FORBID_TAGS で制御
    // javascript: URL を除去
    FORCE_BODY: true,
    // DOMPurify はデフォルトで javascript: と data: URL を除去する
  });

  container.innerHTML = clean;
}
```

#### 二次防衛: `<iframe sandbox>` によるスクリプト隔離

サイドバイサイドモードの右ペイン（HTML プレビュー）では、より強力な隔離として
`sandbox` 属性付き `<iframe>` 内でレンダリングすることも選択可能にする。

```tsx
// src/renderer/html/SplitPreview.tsx

interface SplitPreviewProps {
  htmlContent: string;
  useSandbox: boolean;  // ユーザー設定で選択可能
}

export function SplitPreview({ htmlContent, useSandbox }: SplitPreviewProps) {
  const sanitized = useMemo(() => DOMPurify.sanitize(htmlContent, DOMPURIFY_CONFIG), [htmlContent]);

  if (useSandbox) {
    // <iframe sandbox> 方式: JavaScript を完全に実行不可にする
    // allow-same-origin のみ許可（DOM 読み取りに必要、allow-scripts は付けない）
    return (
      <iframe
        sandbox="allow-same-origin"
        srcDoc={sanitized}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="HTML Preview"
      />
    );
  }

  // DOMPurify のみ方式: JavaScript を除去して直接 innerHTML
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

**2方式の比較**:

| 観点 | DOMPurify のみ | iframe sandbox |
|------|--------------|----------------|
| CSS の適用 | ◎ エディタのスタイルが適用される | ✗ 外部 CSS は別途必要 |
| スクリプト遮断 | ◯ サニタイズで除去 | ◎ ブラウザレベルで実行不可 |
| パフォーマンス | ◎ 高速 | △ iframe の生成コスト |
| スクロール同期 | ◎ 直接 DOM 操作可能 | △ postMessage 経由が必要 |

**採用決定**: **デフォルトは DOMPurify のみ**で実装し、`<iframe sandbox>` はオプション設定として提供する。
Markdown エディタとしての主要ユースケースでは DOMPurify で十分なセキュリティレベルが保てる。

---

## 2. script タグを含む HTML ブロックの分離戦略

### 2.1 基本方針

`<script>` タグを含む HTML ブロックについては、**プレビューとストレージを明確に分離する**。

```
保存（ファイルへの書き込み）:
  → <script> タグを含む生HTMLをそのまま保存（改変しない）
  → HTMLエディタとしての機能を維持

プレビュー（TipTap NodeView での表示）:
  → <script> タグを除去したサニタイズ済みHTMLでレンダリング
  → UIで「スクリプトは実行されていません」バッジを表示

Split プレビュー右ペイン:
  → DOMPurify でサニタイズしてレンダリング
```

### 2.2 rawHtmlBlock NodeView での表示

```tsx
// src/renderer/wysiwyg/extensions/raw-html-block.ts

export function RawHtmlBlockNodeView({ node }: NodeViewProps) {
  const rawHtml = node.attrs.html as string;

  // スクリプトが含まれているか判定
  const hasScript = /<script[\s\S]*?>/i.test(rawHtml);

  // プレビュー用: サニタイズ済みHTML
  const sanitized = useMemo(
    () => DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG),
    [rawHtml]
  );

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="raw-html-block"
    >
      {hasScript && (
        <div className="raw-html-script-badge" title="スクリプトはプレビューで実行されません">
          ⚠ script（保存時は維持）
        </div>
      )}
      {/* サニタイズ済みHTMLを表示 */}
      <div dangerouslySetInnerHTML={{ __html: sanitized }} />
    </NodeViewWrapper>
  );
}
```

### 2.3 保存時の動作

TipTap → mdast → Markdown シリアライズ時、`rawHtmlBlock` の `attrs.html` はそのまま出力する。
`<script>` タグは**保存ファイルには含まれる**（改変しない）。

```typescript
// tiptap-to-mdast.ts
case 'rawHtmlBlock':
  return {
    type: 'html',
    value: node.attrs.html,  // <script> タグも含めてそのまま保存
  };
```

**ユーザーへの説明（UIトースト/ヘルプテキスト）**:
> `<script>` タグを含む HTML ブロックはプレビューでは実行されませんが、ファイル保存時にはそのまま保持されます。

---

## 3. Tauri ファイルシステムスコープの制限

### 3.1 基本方針

**最小権限の原則**: アプリが必要とするファイルシステムへのアクセスを最小限に制限する。

| アクセス先 | 許可方法 | 理由 |
|-----------|---------|------|
| ユーザーが明示的に開いたファイルのディレクトリ | ダイアログ経由でスコープ付与 | ファイル本体と画像の読み書きに必要 |
| `$APPDATA`（設定ファイル） | Capabilities で固定許可 | セッション・設定の永続化 |
| `$APP_CACHE_DIR`（画像キャッシュ） | Capabilities で固定許可 | 外部URL画像のキャッシュ |
| それ以外のパス | **ダイアログ経由を必須化** | 任意パスへの読み書きを防ぐ |

### 3.2 `tauri.conf.json` / Capabilities 設定

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "デフォルト権限：最小権限の原則に基づいて定義",
  "windows": ["main"],
  "permissions": [
    // コアAPI（window, clipboard, shell は制限付き）
    "core:default",

    // ファイルシステム
    // ★ allow-read-file / allow-write-file は「スコープ」で制限する
    // ★ allow-read-dir（ツリー表示用）もスコープ制限
    { "identifier": "fs:allow-read-file", "allow": [{ "path": "$APPDATA/**" }, { "path": "$APP_CACHE_DIR/**" }] },
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$APPDATA/**" }, { "path": "$APP_CACHE_DIR/**" }] },
    { "identifier": "fs:allow-mkdir", "allow": [{ "path": "$APP_CACHE_DIR/**" }] },

    // ファイルダイアログ（ユーザー操作でスコープを動的に付与）
    "dialog:allow-open",
    "dialog:allow-save",

    // ファイル監視（開いているファイルのみ監視）
    "fs:allow-watch",

    // アセットプロトコル（ローカル画像表示）
    "core:asset:allow-fetch-asset",

    // セッション永続化
    "store:default"
  ]
}
```

### 3.3 ダイアログ経由でのスコープ動的付与

ユーザーがファイルを開いた瞬間に、そのファイルが属するディレクトリへのアクセス権を動的に付与する。
これにより、ユーザーが意図しないディレクトリへのアクセスを防ぐ。

```typescript
// src/file/file-manager.ts

import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { addPluginListener } from '@tauri-apps/api/core';

/**
 * ファイルを開く。ダイアログ経由でのみファイルアクセス権を付与。
 * 任意パスを直接指定してのオープンは禁止（引数に受け取らない）。
 */
export async function openFileViaDialog(): Promise<{ path: string; content: string } | null> {
  const selected = await open({
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
    ],
    // ダイアログで選択されたパスに対して自動的にスコープが付与される
  });

  if (!selected || Array.isArray(selected)) return null;

  const content = await readTextFile(selected);
  return { path: selected, content };
}

/**
 * 最近使ったファイルを再オープンする場合。
 * ★ Tauri のスコープ機構で事前に許可されていないと readTextFile は失敗する。
 * → ユーザーに確認ダイアログを表示してから開く。
 */
export async function reopenRecentFile(filePath: string): Promise<string | null> {
  try {
    return await readTextFile(filePath);
  } catch {
    // スコープ外の場合はユーザーにダイアログで再許可を求める
    const confirmed = await confirm(
      `"${filePath}" へのアクセス権を再許可しますか？`,
      { title: 'ファイルアクセスの確認' }
    );
    if (!confirmed) return null;

    // ユーザーにファイルピッカーで同じファイルを選ばせる
    const result = await openFileViaDialog();
    return result?.content ?? null;
  }
}
```

### 3.4 パストラバーサル対策

Tauri の `plugin-fs` はスコープ外のパスへのアクセスをブロックするが、
TypeScript 側でも `..` を含むパスを検証して多層防御とする。

```typescript
// src/utils/path-validator.ts

import { resolve, normalize } from '@tauri-apps/api/path';

/**
 * 指定されたパスが許可されたベースディレクトリ内に収まっているか検証する。
 * パストラバーサル（../../etc/passwd 等）を防ぐ。
 */
export async function isPathWithinBase(
  targetPath: string,
  baseDir: string
): Promise<boolean> {
  const normalizedTarget = await resolve(targetPath);
  const normalizedBase = await resolve(baseDir);
  return normalizedTarget.startsWith(normalizedBase);
}
```

---

## 4. その他のセキュリティ考慮事項

### 4.1 CSP（Content Security Policy）設定

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "csp": [
        "default-src 'self'",
        "img-src 'self' asset: https://asset.localhost blob: data:",
        "style-src 'self' 'unsafe-inline'",
        // ★ script-src に 'unsafe-eval' を含めない（KaTeX / Mermaid の代替手段を使う）
        "script-src 'self'",
        "connect-src 'none'"   // 外部APIへの直接接続を禁止
      ].join("; ")
    }
  }
}
```

**注意点**:
- `'unsafe-eval'` は KaTeX / Mermaid が動的コード生成を行う場合に必要になることがある。
  KaTeX は `'unsafe-eval'` 不要のビルドを使用し、Mermaid は CSP 対応モードを確認する。
- `connect-src 'none'` により、WebView から直接外部 API を叩くことを禁止する。
  AI API 等の外部通信は必ず Rust（Tauri コマンド）側を経由させる。

### 4.2 Tauri コマンドの入力検証

フロントエンドから `invoke()` で呼び出す Rust コマンドは、引数を必ず検証する。

```rust
// src-tauri/src/commands/file_ops.rs

#[tauri::command]
pub async fn read_file_content(
    app: tauri::AppHandle,
    path: String,
) -> Result<String, String> {
    // 1. パスの正規化（シンボリックリンク解決含む）
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("パス解決エラー: {e}"))?;

    // 2. Tauri のスコープ検証（plugin-fs が自動でチェックするが念のため）
    // plugin-fs の read_file を通じて呼ぶ限り、スコープ外は自動でエラーになる

    // 3. ファイル読み込み
    std::fs::read_to_string(canonical)
        .map_err(|e| format!("読み込みエラー: {e}"))
}
```

### 4.3 外部リンクの安全な開き方

`<a href="...">` をクリックした際、デフォルトの Tauri WebView では WebView 内でページ遷移してしまう。
外部リンクは必ず OS のデフォルトブラウザで開く。

```typescript
// src/renderer/wysiwyg/plugins/link-handler.ts

import { open } from '@tauri-apps/plugin-shell';

// TipTap のリンクのクリックをインターセプト
editor.on('click', ({ event }) => {
  const target = event.target as HTMLElement;
  const anchor = target.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (!href) return;

  event.preventDefault();

  if (href.startsWith('http://') || href.startsWith('https://')) {
    // 外部URLはOSのデフォルトブラウザで開く
    open(href);
  } else if (href.startsWith('#')) {
    // アンカーリンクはエディタ内スクロール
    scrollToAnchor(href.slice(1));
  }
  // javascript: URL は何もしない（DOMPurify が除去するが念のため）
});
```

### 4.4 セキュリティ要件サマリー

| 要件 | 実装 | 優先度 |
|------|------|--------|
| HTML プレビューのスクリプト実行防止 | DOMPurify | **必須** |
| ファイルシステムアクセスの最小化 | Tauri Capabilities スコープ制限 | **必須** |
| `<script>` 保存 vs プレビュー分離 | NodeView でバッジ表示・保存は維持 | **必須** |
| 外部リンクをブラウザで開く | `@tauri-apps/plugin-shell` の `open()` | **必須** |
| パストラバーサル防止 | TypeScript 側検証 + Tauri スコープ | **必須** |
| CSP の `unsafe-eval` 排除 | KaTeX/Mermaid CSP 対応版を使用 | **推奨** |
| iframe sandbox によるプレビュー隔離 | オプション設定として提供 | **推奨** |
| AI API などの外部通信を Rust 経由に制限 | `connect-src 'none'` + Tauri コマンド | **将来対応** |

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体設計
- [image-storage-design.md](./image-storage-design.md) — 画像管理設計（asset:// プロトコル含む）

---

*このドキュメントは実装フェーズで随時更新する。新たな脅威が発見された場合はセクション 4 に追記すること。*
