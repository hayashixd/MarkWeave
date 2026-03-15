# レビュー: docs/01_Architecture/security-design.md（2026-03-12）

## 概要

- 設計書セクション数: 4
- 確認済み実装: 20 項目
- 未実装（要注意）: 0 項目
- 保留（feature-list.md 管理済み）: 0 項目

---

## セクション別レビュー結果

### §1 HTML プレビューのサニタイズ戦略

#### 設計要件（抜粋）
- HTML プレビューは DOMPurify でサニタイズしてから描画する。
- TipTap カスタムノード（KaTeX/MathML, Mermaid/SVG）向けにホワイトリストを拡張する。
- Mermaid SVG では `foreignObject` を禁止する。
- `<iframe sandbox>` 方式はオプションとして提供可能である。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| DOMPurify 共通設定の実装 | ✅ 準拠 | `src/utils/dompurify-config.ts:13-64` |
| KaTeX/MathML・Mermaid/SVG の許可タグ/属性拡張 | ✅ 準拠 | `src/utils/dompurify-config.ts:29-60` |
| Mermaid 用 `foreignObject` 禁止 | ✅ 準拠 | `src/utils/dompurify-config.ts:70-73` |
| HTML スプリットプレビューのサニタイズ経由描画 | ✅ 準拠 | `src/components/editor/HtmlSplitView.tsx:14` |
| `<iframe sandbox>` オプション提供 | ✅ 準拠 | `src/components/editor/HtmlSplitView.tsx:23-24`（`useSandbox` prop）, `src/components/editor/HtmlSplitView.tsx:213-221`（`<iframe sandbox="allow-same-origin">` 分岐） |
| `style` タグの扱い | ✅ 準拠 | `src/utils/dompurify-config.ts:61`（`FORBID_TAGS` に `style` を含む） |

#### 訂正メモ（2026-03-12）
- **`<iframe sandbox>` オプション**: 初回レビューで ❌ としたが、`HtmlSplitView.tsx` の `useSandbox` prop により DOMPurify 方式と iframe sandbox 方式の切替が実装済み。❌ → ✅ に訂正。
- **`style` タグ**: 初回レビューで「`ADD_TAGS` に `style` を追加している」と記載したが、現在の実装は `FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'button', 'iframe']` で `style` を禁止しており設計書と一致。⚠️ → ✅ に訂正。

---

### §2 script タグを含む HTML ブロックの分離戦略

#### 設計要件（抜粋）
- `rawHtmlBlock` NodeView で `<script>` を含む場合に警告バッジを表示する。
- プレビューはサニタイズ済み HTML を表示する。
- 保存時は `<script>` を含む生 HTML を保持する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `rawHtmlBlock` NodeView の存在 | ✅ 準拠 | `src/extensions/RawHtmlBlockExtension.tsx:23-57` |
| script 含有時バッジ表示 | ✅ 準拠 | `src/extensions/RawHtmlBlockExtension.tsx:73-82` |
| script 情報の保存（head の script src を保持） | ⚠️ 部分準拠 | `src/lib/html-to-tiptap.ts:141-146`, `src/lib/tiptap-to-html.ts:84-87` |

#### 未実装・不一致の詳細
- **保存時分離の対象差分**: 実装で保持しているのは `head` の `scriptLinks` であり、設計書が想定する「本文内 raw HTML ブロックの script 分離」とは対象が異なる。ただし本文内の raw HTML ブロックは `rawHtmlBlock` ノードとして原文保持されるため、script を含む HTML が保存時に失われることはない。実質的な安全性は担保されている。

---

### §3 Tauri ファイルシステムスコープの制限

#### 設計要件（抜粋）
- Capabilities は最小権限（スコープ付き allow）で定義する。
- ファイルアクセスはダイアログ経由で動的スコープ付与を前提にする。
- パストラバーサルを追加検証する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `dialog:allow-open` / `dialog:allow-save` の許可 | ✅ 準拠 | `src-tauri/capabilities/default.json:12-13` |
| fs 権限のスコープ制限（`allow: [{path: ...}]`） | ✅ 準拠 | `src-tauri/capabilities/default.json:16-31`（`fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-exists`, `fs:allow-mkdir` それぞれに `$APPDATA/**` / `$APP_CACHE_DIR/**` スコープ設定済み） |
| `$APPDATA` / `$APP_CACHE_DIR` への限定設定 | ✅ 準拠 | `src-tauri/capabilities/default.json:17-31` |
| TypeScript 側の `isPathWithinBase` 相当検証 | ✅ 準拠 | `src/utils/path-validator.ts:18-32`（`isPathWithinBase()` + `containsTraversalPattern()`） |
| Rust 側の入力検証（絶対パス・canonicalize） | ✅ 準拠 | `src-tauri/src/commands/fs_commands.rs:7-21`（`canonicalize_path()` でシンボリックリンク解決 + パス正規化） |

#### 訂正メモ（2026-03-12）
- **FS スコープ制限**: 初回レビューで ❌ としたが、`default.json` に `$APPDATA/**` / `$APP_CACHE_DIR/**` のスコープ付き allow ルールが設定済み。❌ → ✅ に訂正。
- **isPathWithinBase**: 初回レビューで ❌（`rg` ヒットなし）としたが、`src/utils/path-validator.ts` に `isPathWithinBase()` および `containsTraversalPattern()` が実装済み。❌ → ✅ に訂正。
- **Rust 側検証**: 初回レビューで ⚠️ としたが、`canonicalize_path()` でシンボリックリンク解決を含む完全なパス正規化が実装されており、設計書要件を満たす。⚠️ → ✅ に訂正。

---

### §4 その他のセキュリティ考慮事項

#### 設計要件（抜粋）
- CSP は `script-src 'self'` を維持し、`connect-src ipc: http://ipc.localhost` を基本とする。
- KaTeX は `trust: false` で運用する。
- Mermaid は主 WebView 直接実行ではなく、sandbox iframe 経由を基本とする。
- 外部リンクは OS ブラウザで開く。
- AI API 通信は Rust コマンド経由、アップデート署名検証/公開鍵設定、プラグイン権限モデルを整備する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `script-src 'self'` | ✅ 準拠 | `src-tauri/tauri.conf.json:25` |
| `connect-src` で外部接続を禁止（IPC 通信のみ許可） | ✅ 準拠 | `src-tauri/tauri.conf.json:25`、設計書を `connect-src ipc: http://ipc.localhost` に修正済み（2026-03-12） |
| KaTeX の `trust: false` | ✅ 準拠 | `src/extensions/MathExtension.tsx:50-54`, `src/extensions/MathExtension.tsx:186-190` |
| Mermaid の sandbox iframe 経由レンダリング | ✅ 準拠 | `src/utils/mermaid-sandbox-renderer.ts:29-70`（`<iframe sandbox="allow-scripts">` で隔離）, `src/extensions/MermaidExtension.tsx:14`（`renderMermaidInSandbox` を使用）, `src/utils/dompurify-config.ts:81-83`（SVG を DOMPurify でサニタイズ） |
| 外部リンクを `@tauri-apps/plugin-shell` で開く処理 | ✅ 準拠 | `src/hooks/useExternalLinkHandler.ts:10`（`import { open } from '@tauri-apps/plugin-shell'`）, `src/hooks/useExternalLinkHandler.ts:38-44`（http/https を OS ブラウザで開く）, `src/hooks/useExternalLinkHandler.ts:32-35`（`javascript:` URL をブロック） |
| AI API Rust 経由（`call_ai_api`） | ✅ 準拠 | `src-tauri/src/commands/ai_commands.rs:62-101`, `src/core/ai/ai-client.ts` |
| アップデータエンドポイント設定 | ✅ 準拠 | `src-tauri/tauri.conf.json:29-33` |
| アップデータ公開鍵設定 | ⚠️ 部分準拠 | `src-tauri/tauri.conf.json:30`（`pubkey` に TODO プレースホルダ — リリースビルド時に `tauri signer generate` で生成予定） |
| プラグイン sandbox + 権限モデル | ✅ 準拠 | `src/plugins/plugin-bridge.ts:85-90`, `src/plugins/plugin-api.ts:22-35` |

#### 訂正メモ（2026-03-12）
- **Mermaid sandbox iframe**: 初回レビューで ❌（主 WebView で直接 render）としたが、`mermaid-sandbox-renderer.ts` で `<iframe sandbox="allow-scripts">` を使用した隔離レンダリングが実装済み。`MermaidExtension.tsx` は `renderMermaidInSandbox()` を呼び出しており、設計書要件を満たす。❌ → ✅ に訂正。
- **外部リンク**: 初回レビューで ❌（`rg` ヒットなし）としたが、`useExternalLinkHandler.ts` で `@tauri-apps/plugin-shell` の `open()` を使用したリンクインターセプトが実装済み。`javascript:` URL のブロック、http/https の OS ブラウザ委譲、その他スキームの OS 委譲を実装。❌ → ✅ に訂正。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 20 |
| ⚠️ 部分準拠 | 2 |
| ❌ 未実装 | 0 |
| 🔶 保留（管理済み） | 0 |

### 残存する ⚠️ 項目

1. **script 保存時分離の対象差分** — `head` の `scriptLinks` 保持と本文 raw HTML ブロックの script 保持で対象が異なるが、実質的な安全性は担保。
2. **アップデータ公開鍵** — TODO プレースホルダ。リリースビルド時に生成予定。

### 解消済み項目（2026-03-12 訂正）

1. ~~**CSP `connect-src` 方針差分**~~ → 設計書を Tauri 2.0 IPC 要件に合わせて修正。
2. ~~**ファイルシステム最小権限化**~~ → capabilities にスコープ付き allow ルールが設定済み。
3. ~~**パストラバーサル多層防御**~~ → TS 側 `isPathWithinBase` + Rust 側 `canonicalize_path` で多層防御実装済み。
4. ~~**Mermaid sandbox 分離**~~ → `mermaid-sandbox-renderer.ts` で iframe sandbox 経由実装済み。
5. ~~**外部リンク安全遷移**~~ → `useExternalLinkHandler.ts` で `@tauri-apps/plugin-shell` 経由実装済み。
6. ~~**`<iframe sandbox>` オプション**~~ → `HtmlSplitView.tsx` の `useSandbox` prop で実装済み。
7. ~~**`style` タグ方針差分**~~ → `FORBID_TAGS` に `style` を含み設計書と一致。
