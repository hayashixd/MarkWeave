# レビュー: docs/01_Architecture/security-design.md（2026-03-12）

## 概要

- 設計書セクション数: 4
- 確認済み実装: 15 項目
- 未実装（要注意）: 2 項目
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
| DOMPurify 共通設定の実装 | ✅ 準拠 | `src/utils/dompurify-config.ts:13-66` |
| KaTeX/MathML・Mermaid/SVG の許可タグ/属性拡張 | ✅ 準拠 | `src/utils/dompurify-config.ts:29-61` |
| Mermaid 用 `foreignObject` 禁止 | ✅ 準拠 | `src/utils/dompurify-config.ts:72-75` |
| HTML スプリットプレビューのサニタイズ経由描画 | ✅ 準拠 | `src/components/editor/HtmlSplitView.tsx:110-118` |
| `<iframe sandbox>` オプション提供 | ❌ 未実装 | `src/components/editor/HtmlSplitView.tsx:145-215`（`iframe` 分岐なし） |
| `style` タグの扱い（設計例は禁止、実装は許可） | ⚠️ 部分準拠 | `src/utils/dompurify-config.ts:40`, `src/utils/dompurify-config.ts:63` |

#### 未実装・不一致の詳細
- **`<iframe sandbox>` オプション**: 設計書では DOMPurify 方式に加え `iframe sandbox` 方式を選択可能とするが、現状の HTML スプリットビューは `div.innerHTML` の単一方式のみ。
- **`style` タグ方針の差分**: 設計例では `FORBID_TAGS` に `style` を含む一方、実装では `ADD_TAGS` に `style` を追加している。

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
- **保存時分離の対象差分**: 実装で保持しているのは `head` の `scriptLinks` であり、設計書が想定する「本文内 raw HTML ブロックの script 分離」とは一致しない。

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
| fs 権限のスコープ制限（`allow: [{path: ...}]`） | ❌ 未実装 | `src-tauri/capabilities/default.json:16-20`（`fs:default` と広域許可のみ） |
| `$APPDATA` / `$APP_CACHE_DIR` への限定設定 | ❌ 未実装 | `src-tauri/capabilities/default.json:1-40`（該当 allow ルールなし） |
| TypeScript 側の `isPathWithinBase` 相当検証 | ❌ 未実装 | `rg -n "isPathWithinBase|path-validator" src`（ヒットなし） |
| Rust 側の入力検証（絶対パス・存在確認） | ⚠️ 部分準拠 | `src-tauri/src/commands/fs_commands.rs:14-28`, `src-tauri/src/commands/fs_commands.rs:57-63` |

#### 未実装・不一致の詳細
- **Capabilities の最小権限化**: 設計書のスコープ付き許可（`$APPDATA/**` など）が設定されていない。
- **パストラバーサル多層防御**: 設計書記載の TS 側ガード実装が確認できない。
- **検証粒度**: Rust 側は絶対パス/存在チェックはあるが、設計例にある canonicalize を使ったスコープ確認までは確認できない。

---

### §4 その他のセキュリティ考慮事項

#### 設計要件（抜粋）
- CSP は `script-src 'self'` を維持し、`connect-src 'none'` を基本とする。
- KaTeX は `trust: false` で運用する。
- Mermaid は主 WebView 直接実行ではなく、sandbox iframe 経由を基本とする。
- 外部リンクは OS ブラウザで開く。
- AI API 通信は Rust コマンド経由、アップデート署名検証/公開鍵設定、プラグイン権限モデルを整備する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `script-src 'self'` | ✅ 準拠 | `src-tauri/tauri.conf.json:25` |
| `connect-src 'none'` | ❌ 未実装 | `src-tauri/tauri.conf.json:25`（`ipc:` / `http://ipc.localhost` を許可） |
| KaTeX の `trust: false` | ✅ 準拠 | `src/extensions/MathExtension.tsx:50-54`, `src/extensions/MathExtension.tsx:186-190` |
| Mermaid の sandbox iframe 経由レンダリング | ❌ 未実装 | `src/extensions/MermaidExtension.tsx:20-25`, `src/extensions/MermaidExtension.tsx:205-209`（主 WebView で直接 render） |
| 外部リンクを `@tauri-apps/plugin-shell` で開く処理 | ❌ 未実装 | `rg -n "@tauri-apps/plugin-shell|open\(href|editor.on\('click'" src`（ヒットなし） |
| AI API Rust 経由（`call_ai_api`） | ✅ 準拠 | `src-tauri/src/commands/ai_commands.rs:68-99`, `src/core/ai/ai-client.ts` |
| アップデータエンドポイント設定 | ✅ 準拠 | `src-tauri/tauri.conf.json:29-33` |
| アップデータ公開鍵設定 | ⚠️ 部分準拠 | `src-tauri/tauri.conf.json:30`（`pubkey` が空） |
| プラグイン sandbox + 権限モデル | ✅ 準拠 | `src/plugins/plugin-bridge.ts:85-90`, `src/plugins/plugin-api.ts:22-35` |

#### 未実装・不一致の詳細
- **CSP `connect-src`**: 設計の `none` と実装値が異なる。
- **Mermaid 実行分離**: 設計は sandbox iframe 経由だが、実装は主 WebView で `mermaid.render()` を直接実行。
- **外部リンクの安全な遷移**: 設計書記載のリンクインターセプト実装が確認できない。
- **アップデート鍵管理**: updater 設定はあるが公開鍵が未設定。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 11 |
| ⚠️ 部分準拠 | 4 |
| ❌ 未実装 | 6 |
| 🔶 保留（管理済み） | 0 |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. **ファイルシステム最小権限化** — capabilities にスコープ付き `allow` ルールが確認できない。
2. **CSP `connect-src` 方針差分** — 設計の `none` と実装設定が不一致。
3. **Mermaid sandbox 分離未適用** — 設計想定の iframe 分離ではなく主 WebView 実行。
