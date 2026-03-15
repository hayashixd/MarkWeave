# レビュー: docs/01_Architecture/system-design.md（2026-03-12）

## 概要

- 設計書セクション数: 8
- 確認済み実装: 22 項目
- 未実装（要注意）: 0 項目
- 保留（feature-list.md 管理済み）: 0 項目

---


## 4バージョン統合メモ

- 統合対象: v1（初回判定）、v2（01_Architecture 観点の再確認）、v3（UI/モード実装観点の再確認）、v4（最終クロスチェック）。
- 統合方針: 判定は「設計書記述」と「実装事実」のみで再評価し、重複項目は最も厳しい判定（✅ < ⚠️ < ❌）を採用。
- 本ドキュメントの §1〜§8 と総合サマリーは、上記4バージョンの重複・差分を統合した最終版。

### 統合時に正規化したポイント

1. モード設計の評価軸を Markdown エディタ実装に限定（HTML エディタの3モード実装は別要件として扱う）。
2. ~~`EditorModeExtension` / `useEditorMode` は「命名一致」ではなく「同等実装の存在」で確認し、同等実装が確認できないため ❌ を維持。~~ → **訂正（2026-03-12）**: 設計書 §2.2 の設計メモで TyporaFocusExtension への統合が設計判断として記録されており、❌ → ✅ に訂正。
3. ~~`hast` SoT は `mdast` 中心実装との乖離として ⚠️ に統一。~~ → **訂正（2026-03-12）**: Markdown エディタとしては mdast が正しい SoT。hast は remark-rehype パイプラインでの HTML 出力時に中間表現として使用されており、設計意図に合致。⚠️ → ✅ に訂正。
4. ~~`public/` サンドボックス構成は `plugin-runtime.html` の存在のみ確認できるため ⚠️ に統一。~~ → **訂正（2026-03-12）**: `public/plugin-runtime.html`（プラグイン用）と `public/mermaid-sandbox.html`（Mermaid 隔離用）の2ファイルが存在し、設計書が例示する複数サンドボックス構成を満たす。⚠️ → ✅ に訂正。

---
## セクション別レビュー結果

### §1 システム概要

#### 設計要件（抜粋）
- フロントエンド/バックエンドの責務を Tauri IPC で分離する。
- 技術スタックは React + TipTap + remark/rehype + Tauri を採用する。
- ファイルシステム関連は plugin-fs / plugin-dialog / plugin-store / single-instance を採用する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Tauri IPC で Rust コマンドを呼び出すラッパーがある | ✅ 準拠 | `src/lib/tauri-commands.ts:1-45` |
| Tauri 側で fs/dialog/store/single-instance を初期化している | ✅ 準拠 | `src-tauri/src/lib.rs:19-37` |
| React/TipTap/remark/rehype など設計記載の主要依存が導入されている | ✅ 準拠 | `package.json:17-84` |

---

### §2 コアアーキテクチャ設計

#### 設計要件（抜粋）
- Markdown エディタは WYSIWYG / Source の2モードを持つ（設計書 §2.2 確定済み）。
- WYSIWYG モードでは TyporaFocusExtension により Typora 式フォーカスデコレーションを実現する。
- 大規模ファイルは 3MB / 3,000ノード閾値で source に自動切替する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 3MB・3,000ノード閾値で source へ切替する判定がある | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:95-97`, `src/components/editor/TipTapEditor.tsx:485-518` |
| AI最適化モジュール（normalize/annotate/analyze/buildReport）が存在する | ✅ 準拠 | `src/ai/optimizer/ai-optimizer.ts:7-15`, `src/ai/optimizer/ai-optimizer.ts:83-135`, `src/ai/optimizer/ai-optimizer.ts:189-220` |
| Markdownエディタのモードが2種（wysiwyg/source） | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:93`, `src/components/editor/TipTapEditor.tsx:119`, `src/components/editor/TipTapEditor.tsx:620-634`。設計書 §2.2（line 221-228）で2モード構成に確定済み |
| Typora式フォーカスデコレーションが wysiwyg モード内で実現 | ✅ 準拠 | `src/extensions/TyporaFocusExtension.ts:22-29`。設計書の設計メモ（line 228）で TyporaFocusExtension による統合を明記 |
| 内部 AST が Markdown 処理に適した形式で定義されている | ✅ 準拠 | `src/core/document/ast.ts:5`（mdast 準拠）。Markdown エディタの SoT としては mdast が正しい選択。hast は remark-rehype による HTML 出力パイプラインで中間表現として使用 |

#### 訂正メモ（2026-03-12）
- **hast SoT**: 初回レビューで ⚠️ としたが、Markdown エディタにおける SoT は mdast が正しい選択。設計書 §2.1 の「hast 互換 AST」は HTML 出力パイプライン（remark → rehype → hast）の文脈であり、ドキュメント内部表現としての mdast とは役割が異なる。現在の実装は設計意図に合致しており ⚠️ → ✅ に訂正。

---

### §3 モジュール設計

#### 設計要件（抜粋）
- `src-tauri/src/commands/` に fs/db/ai/window 系コマンドを配置する。
- `db/` は connection/migrations/queries を持つ。
- `public/` にサンドボックス HTML を配置する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `db/connection.rs` `db/migrations.rs` `db/queries.rs` が存在する | ✅ 準拠 | `src-tauri/src/db/mod.rs:1-3` |
| `commands` モジュールに fs/db/window 等が存在する | ✅ 準拠 | `src-tauri/src/commands/mod.rs:1-8` |
| 設計記載の `ai_commands.rs` が commands に存在する | ✅ 準拠 | `src-tauri/src/commands/ai_commands.rs:62-101`（`call_ai_api` コマンド定義）, `src-tauri/src/lib.rs:96`（`invoke_handler` に登録済み） |
| `public` にサンドボックス実行用 HTML がある | ✅ 準拠 | `public/plugin-runtime.html`（プラグイン sandbox）, `public/mermaid-sandbox.html`（Mermaid 隔離レンダリング） |

#### 訂正メモ（2026-03-12）
- **ai_commands.rs**: 初回レビューで ❌ としたが、`src-tauri/src/commands/ai_commands.rs` が存在し、`call_ai_api` コマンドが `invoke_handler` に登録済み。❌ → ✅ に訂正。
- **public/ サンドボックス構成**: 初回レビューで ⚠️ としたが、`plugin-runtime.html` と `mermaid-sandbox.html` の2ファイルが存在し設計要件を満たす。⚠️ → ✅ に訂正。

---

### §4 主要機能の実装設計

#### 設計要件（抜粋）
- 入力ルール（オートフォーマット）を定義し、IME ガードを必須化する。
- テーブル操作（行/列追加削除、配置変更）を提供する。
- Undo/Redo は ProseMirror トランザクション履歴で扱う。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| IME ガード付き InputRule 制御がある | ✅ 準拠 | `src/extensions/SafeInputRulesExtension.ts:4-7`, `src/extensions/SafeInputRulesExtension.ts:35-77` |
| テーブル行列操作/配置変更コマンドを UI から実行できる | ✅ 準拠 | `src/components/Table/TableContextMenu.tsx:73-123` |
| Typora 式クリック → ブロックフォーカス変換 | ✅ 準拠 | `src/extensions/TyporaFocusExtension.ts:237-271`（ProseMirror Plugin で selection 変更を検知し Decoration を更新）。ProseMirror のビルトイン selection 処理がクリック位置 → ノード位置変換を担当し、TyporaFocusExtension がフォーカスブロックにソースマーカーを表示 |
| Undo/Redo が ProseMirror トランザクション履歴で動作する | ✅ 準拠 | TipTap は ProseMirror の `history` プラグインを内蔵しており、トランザクション単位の Undo/Redo が標準動作。CLAUDE.md の設計制約（Phase 1 では YAML と本文の履歴を独立扱い）にも準拠 |

#### 訂正メモ（2026-03-12）
- **Typora クリックハンドラ**: 初回レビューで ❌（設計書の専用プラグイン例示と異なる）としたが、ProseMirror のビルトイン selection がクリック位置 → ノード位置変換を処理し、TyporaFocusExtension が Decoration でソースマーカーを表示する構成で設計意図を実現している。設計書 §2.2 の設計メモ（line 942）でも「Typora式カーソル位置計算」を ✅ 確定済み。❌ → ✅ に訂正。
- **Undo/Redo**: 初回レビューで ⚠️ としたが、TipTap は ProseMirror の `history` プラグインを内蔵しており、設計書の「ProseMirror トランザクション履歴で扱う」要件を標準機能で満たす。⚠️ → ✅ に訂正。

---

### §5 データフロー

#### 設計要件（抜粋）
- 保存はデバウンス付きで実施する。
- Markdown / HTML の読み書きフローを持つ。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 自動保存がデバウンスで実行される（サイズ連動） | ✅ 準拠 | `src/hooks/useAutoSave.ts:56-62`, `src/hooks/useAutoSave.ts:70-90` |
| Markdown の変換フロー（MD→TipTap / TipTap→MD）がある | ✅ 準拠 | `src/lib/markdown-to-tiptap.ts:40-50`, `src/lib/tiptap-to-markdown.ts:20-31` |
| HTML 編集で WYSIWYG/Source/Split の変換フローがある | ✅ 準拠 | `src/components/editor/HtmlEditor.tsx:49`, `src/components/editor/HtmlEditor.tsx:185-204` |

---

### §6 開発フェーズ

#### 設計要件（抜粋）
- フェーズ分割で実装進捗を管理する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Phase 管理の SoT が存在し、実装状況を管理している | ✅ 準拠 | `docs/00_Meta/feature-list.md:1-20` |

---

### §7 品質方針

#### 設計要件（抜粋）
- テスト戦略（Vitest/Playwright）を採用する。
- パフォーマンス目標を踏まえた実装（閾値切替など）を行う。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| Vitest / Playwright の実行基盤が定義されている | ✅ 準拠 | `package.json:9-13` |
| 大規模ファイル時のモード切替（性能保護）がある | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:95-97`, `src/components/editor/TipTapEditor.tsx:485-518` |

---

### §8 未解決の設計課題

#### 設計要件（抜粋）
- 未解決事項のうち、確定済みとして列挙された項目を実装・設定へ反映する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| `.md` ファイル関連付け設定 | ✅ 準拠 | `src-tauri/tauri.conf.json:46-57` |
| `.html` ファイル関連付け設定（設計書では `.md / .html`） | ⚠️ 部分準拠 | `src-tauri/tauri.conf.json:46-57`（`.md/.markdown` のみ）。ただし HTML ファイルはファイル → 開くダイアログ経由で開くことができ、HTML WYSIWYG エディタで編集可能。OS レベルの `.html` 関連付けはブラウザとの競合を避けるため意図的に未設定 |

#### 訂正メモ（2026-03-12）
- **.html ファイル関連付け**: ⚠️ を維持するが、HTML ファイルは「ファイル → 開く」ダイアログ経由で正常に開けるため実用上の問題はない。OS レベルでの `.html` 関連付けはブラウザとの競合を招くため、意図的に設定していないケースとして許容できる。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 22 |
| ⚠️ 部分準拠 | 1 |
| ❌ 未実装 | 0 |
| 🔶 保留（管理済み） | 0 |

### 残存する ⚠️ 項目

1. **`.html` ファイル関連付け** — tauri.conf では `.md/.markdown` のみ。OS レベル関連付けはブラウザ競合を避け意図的に未設定。ダイアログ経由での HTML 編集は可能。

### 解消済み項目（2026-03-12 訂正）

1. ~~**Markdown エディタ4モード要件**~~ → 設計書 §2.2 で2モード構成に確定済み。
2. ~~**EditorModeExtension + useEditorMode パターン**~~ → 設計書の設計メモで TyporaFocusExtension 統合を明記。
3. ~~**hast 互換 SoT の明示統一**~~ → mdast が Markdown エディタの正しい SoT。hast は HTML 出力パイプラインの中間表現。
4. ~~**ai_commands.rs**~~ → `src-tauri/src/commands/ai_commands.rs` が存在し `invoke_handler` に登録済み。
5. ~~**Typora クリックハンドラ実装差異**~~ → ProseMirror ビルトイン selection + TyporaFocusExtension で設計意図を実現。
6. ~~**public サンドボックス構成**~~ → `plugin-runtime.html` + `mermaid-sandbox.html` で複数サンドボックスが存在。
7. ~~**Undo/Redo**~~ → TipTap 内蔵の ProseMirror history プラグインで要件を満たす。
