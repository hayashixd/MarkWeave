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
  KaTeX は `'unsafe-eval'` 不要のビルドを使用し、Mermaid は CSP 対応モードを確認する（具体的な対応は下記 §4.5 参照）。
- `connect-src 'none'` により、WebView から直接外部 API を叩くことを禁止する。
  AI API 等の外部通信は必ず Rust（Tauri コマンド）側を経由させる（具体的な実装は §4.6 参照）。

### 4.1.1 KaTeX の CSP 対応（`unsafe-eval` 不使用）

KaTeX の `renderToString()` は **HTML 文字列を返すのみで `eval` / `new Function()` を使用しない**。
バージョン 0.12 以降は `'unsafe-eval'` なしで動作することが確認されている。

```typescript
// src/renderer/wysiwyg/extensions/math-inline.ts

import katex from 'katex';
// katex/dist/katex.min.css も import すること（style-src 'self' で提供）

/**
 * KaTeX で数式を HTML 文字列に変換する。
 * renderToString() は eval を使わないため unsafe-eval 不要。
 */
export function renderMathToHtml(expression: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,   // 構文エラーでも表示を維持する
      output: 'html',        // 'mathml' も可（アクセシビリティ重視なら 'htmlAndMathml'）
      trust: false,          // \url{} 等の潜在的な XSS を無効化
    });
  } catch {
    return `<span class="math-error">${expression}</span>`;
  }
}
```

**CSP 設定との整合性**:

| KaTeX の機能 | `unsafe-eval` の必要性 |
|---|---|
| `renderToString()` | **不要** ✅ |
| `render()`（DOM に直接書く） | 不要 ✅（innerHTML 経由で OK） |
| Auto-render extension（`renderMathInElement`） | 不要 ✅（正規表現ベース） |
| `\htmlId`, `\htmlClass` などのカスタムマクロ | `trust: true` を設定した場合のみ XSS リスク |

> **採用バージョン**: katex >= 0.16 を推奨。`trust: false`（デフォルト）を維持すること。

### 4.1.2 Mermaid の CSP 対応（`unsafe-eval` 不使用）

Mermaid は内部で `new Function()` を使用するバージョンが存在するため、
**主 WebView での直接実行は行わない**。代わりに**サンドボックス iframe 内で実行**する。

```
主 WebView (CSP: script-src 'self')
  ↓ postMessage でダイアグラム定義を送信
iframe (sandbox="allow-scripts", src="mermaid-sandbox.html")
  ↓ Mermaid でレンダリング → SVG 生成
  ↓ postMessage で SVG 文字列を返す
主 WebView で DOMPurify.sanitize(svg) → 表示
```

```typescript
// src/renderer/wysiwyg/extensions/mermaid-extension.ts

/**
 * Mermaid ダイアグラムを iframe 経由でレンダリングする。
 * 主 WebView の CSP を汚染しないためサンドボックス iframe を使用する。
 */
export async function renderMermaid(definition: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts'); // allow-same-origin は付与しない
    iframe.src = '/mermaid-sandbox.html';            // Tauri asset server で提供
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const timeout = setTimeout(() => {
      iframe.remove();
      reject(new Error('Mermaid レンダリングタイムアウト'));
    }, 10_000);

    window.addEventListener('message', function handler(event) {
      if (event.source !== iframe.contentWindow) return;
      if (event.data.type !== 'mermaid-result') return;

      clearTimeout(timeout);
      iframe.remove();
      window.removeEventListener('message', handler);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        // DOMPurify でサニタイズしてから表示
        const safeSvg = DOMPurify.sanitize(event.data.svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        resolve(safeSvg);
      }
    });

    // iframe のロード完了後にメッセージを送信
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({ type: 'render', definition }, '*');
    };
  });
}
```

```html
<!-- public/mermaid-sandbox.html (Tauri asset server で提供) -->
<!DOCTYPE html>
<html>
<head>
  <!-- この iframe 内では unsafe-eval を許可する（主 WebView には影響しない） -->
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'unsafe-inline'">
  <script src="/mermaid.min.js"></script>
</head>
<body>
  <div id="graph"></div>
  <script>
    mermaid.initialize({ startOnLoad: false, securityLevel: 'antiscript' });
    window.addEventListener('message', async (event) => {
      try {
        const { svg } = await mermaid.render('graph', event.data.definition);
        window.parent.postMessage({ type: 'mermaid-result', svg }, '*');
      } catch (error) {
        window.parent.postMessage({ type: 'mermaid-result', error: error.message }, '*');
      }
    });
  </script>
</body>
</html>
```

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
| CSP の `unsafe-eval` 排除 | KaTeX は renderToString のみ使用、Mermaid は sandbox iframe | **推奨** |
| iframe sandbox によるプレビュー隔離 | オプション設定として提供 | **推奨** |
| AI API などの外部通信を Rust 経由に制限 | `connect-src 'none'` + Tauri コマンド経由（§4.6 参照） | **Phase 3 実装** |

---

### 4.5 外部 URL 画像キャッシュのセキュリティ

`$APP_CACHE_DIR` にキャッシュする外部 URL 画像は、以下のリスクを持つ。

- **SSRF（Server-Side Request Forgery）的リスク**: 悪意のある Markdown に `![](http://internal-server/secret)` が埋め込まれると、Rust が内部サーバーにリクエストを送る可能性がある
- **キャッシュポイズニング**: URL は同じでも内容が改ざんされているケース（ETag/Last-Modified で検証する）

```rust
// src-tauri/src/commands/image_cache.rs

const ALLOWED_SCHEMES: &[&str] = &["https"]; // http は不可（HTTPS のみ）
const MAX_CACHE_SIZE_BYTES: u64 = 100 * 1024 * 1024; // 100MB

/// 外部 URL の画像を取得してキャッシュする。
/// SSRF 対策として、プライベート IP アドレスへのリクエストを禁止する。
#[tauri::command]
pub async fn fetch_external_image(url: String) -> Result<String, String> {
    // 1. URL スキームの検証（HTTPS のみ）
    let parsed = url::Url::parse(&url).map_err(|e| format!("URL parse error: {e}"))?;
    if !ALLOWED_SCHEMES.contains(&parsed.scheme()) {
        return Err("HTTPS URL のみサポートしています".to_string());
    }

    // 2. プライベート IP アドレスへのリクエストを禁止（SSRF 対策）
    let host = parsed.host_str().ok_or("ホスト名が取得できません")?;
    if is_private_host(host) {
        return Err("プライベートネットワークへのアクセスは禁止されています".to_string());
    }

    // 3. キャッシュキー = URL の SHA-256 ハッシュ
    let cache_key = sha256_hex(&url);
    // ... キャッシュ読み取り・書き込み
    Ok(cache_key)
}

fn is_private_host(host: &str) -> bool {
    // localhost, 127.x.x.x, 10.x.x.x, 192.168.x.x, 172.16-31.x.x を禁止
    matches!(host, "localhost" | "::1")
        || host.starts_with("127.")
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || {
            // 172.16.0.0/12
            let parts: Vec<u8> = host.split('.').filter_map(|s| s.parse().ok()).collect();
            parts.len() == 4 && parts[0] == 172 && (16..=31).contains(&parts[1])
        }
}
```

---

### 4.6 AI API 外部通信の Rust 経由設計

CSP の `connect-src 'none'` により WebView から外部 API への直接通信を禁止し、
すべての AI API 通信を Tauri コマンド（Rust）経由とする。

#### 設計原則

| 禁止 | 許可 |
|------|------|
| `fetch('https://api.anthropic.com/...')` を WebView 内で呼ぶ | `invoke('call_ai_api', {...})` で Rust に委譲 |
| WebView で API key を localStorage に保存 | API key は `plugin-stronghold`（暗号化ストレージ）で Rust 側に保持 |
| WebView で受け取ったレスポンスを直接 innerHTML に | DOMPurify でサニタイズしてから表示 |

#### Rust コマンド実装

```rust
// src-tauri/src/commands/ai.rs

use reqwest::Client;
use serde::{Deserialize, Serialize};

/// サポートするモデルのホワイトリスト。
/// 新モデルの追加はここを編集する（フロントエンドから任意のモデルを指定させない）。
const ALLOWED_MODELS: &[(&str, &str)] = &[
    ("anthropic", "claude-sonnet-4-5"),
    ("anthropic", "claude-haiku-4-5-20251001"),
    ("openai",    "gpt-4o"),
    ("openai",    "gpt-4o-mini"),
];

#[derive(Deserialize)]
pub struct AiRequest {
    pub provider: String, // "anthropic" | "openai"
    pub model: String,
    pub prompt: String,
    pub max_tokens: u32,
}

#[derive(Serialize)]
pub struct AiResponse {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[tauri::command]
pub async fn call_ai_api(
    state: tauri::State<'_, crate::AppState>,
    request: AiRequest,
) -> Result<AiResponse, String> {
    // 1. モデルのホワイトリスト検証
    let is_allowed = ALLOWED_MODELS.iter().any(|(p, m)| {
        p == &request.provider && m == &request.model
    });
    if !is_allowed {
        return Err(format!(
            "サポートしていないプロバイダ/モデル: {}/{}", request.provider, request.model
        ));
    }

    // 2. プロンプト長の上限（100KB = 約25,000トークン相当）
    if request.prompt.len() > 102_400 {
        return Err("プロンプトが長すぎます（最大 100KB）".to_string());
    }

    // 3. max_tokens の上限（モデル上限を超えないよう制限）
    if request.max_tokens > 8192 {
        return Err("max_tokens が上限を超えています（最大 8192）".to_string());
    }

    // 4. API key の取得（Rust 側の設定ストアから取得、フロントから渡させない）
    let api_key = state.get_api_key(&request.provider)
        .ok_or_else(|| format!("{} の API key が設定されていません", request.provider))?;

    // 5. プロバイダ別のリクエスト実行
    match request.provider.as_str() {
        "anthropic" => call_anthropic(&api_key, &request.model, &request.prompt, request.max_tokens).await,
        "openai"    => call_openai(&api_key, &request.model, &request.prompt, request.max_tokens).await,
        _           => Err("未対応プロバイダ".to_string()),
    }
}

async fn call_anthropic(
    api_key: &str,
    model: &str,
    prompt: &str,
    max_tokens: u32,
) -> Result<AiResponse, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("API 通信エラー: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API エラー {status}: {msg}"));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let content = json["content"][0]["text"].as_str().unwrap_or("").to_string();
    let input_tokens = json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

    Ok(AiResponse { content, input_tokens, output_tokens })
}
```

#### フロントエンド側の呼び出し

```typescript
// src/core/ai/ai-client.ts

import { invoke } from '@tauri-apps/api/core';

export interface AiRequest {
  provider: 'anthropic' | 'openai';
  model: string;
  prompt: string;
  maxTokens: number;
}

export interface AiResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * AI API を Rust 経由で呼び出す。
 * WebView から直接 API を叩くことは CSP により禁止されている。
 */
export async function callAiApi(request: AiRequest): Promise<AiResponse> {
  return invoke<AiResponse>('call_ai_api', {
    request: {
      provider: request.provider,
      model: request.model,
      prompt: request.prompt,
      max_tokens: request.maxTokens,
    },
  });
}
```

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体設計
- [image-storage-design.md](./image-storage-design.md) — 画像管理設計（asset:// プロトコル含む）

---

*このドキュメントは実装フェーズで随時更新する。新たな脅威が発見された場合はセクション 4 に追記すること。*
