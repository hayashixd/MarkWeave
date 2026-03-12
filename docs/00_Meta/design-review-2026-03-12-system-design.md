# レビュー: docs/01_Architecture/system-design.md（2026-03-12）

## 概要

- 設計書セクション数: 8
- 確認済み実装: 16 項目
- 未実装（要注意）: 3 項目
- 保留（feature-list.md 管理済み）: 0 項目

---


## 4バージョン統合メモ

- 統合対象: v1（初回判定）、v2（01_Architecture 観点の再確認）、v3（UI/モード実装観点の再確認）、v4（最終クロスチェック）。
- 統合方針: 判定は「設計書記述」と「実装事実」のみで再評価し、重複項目は最も厳しい判定（✅ < ⚠️ < ❌）を採用。
- 本ドキュメントの §1〜§8 と総合サマリーは、上記4バージョンの重複・差分を統合した最終版。

### 統合時に正規化したポイント

1. モード設計の評価軸を Markdown エディタ実装に限定（HTML エディタの3モード実装は別要件として扱う）。
2. ~~`EditorModeExtension` / `useEditorMode` は「命名一致」ではなく「同等実装の存在」で確認し、同等実装が確認できないため ❌ を維持。~~ → **訂正（2026-03-12）**: 設計書 §2.2 の設計メモで TyporaFocusExtension への統合が設計判断として記録されており、❌ → ✅ に訂正。
3. `hast` SoT は `mdast` 中心実装との乖離として ⚠️ に統一。
4. `public/` サンドボックス構成は `plugin-runtime.html` の存在のみ確認できるため ⚠️ に統一。

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
- 内部ドキュメントモデルは hast 互換 AST を基準にする。
- Markdown エディタは `typora / wysiwyg / source / split` の4モードを持つ。
- NodeView では `EditorModeExtension + useEditorMode()` の共通購読パターンを用いる。
- 大規模ファイルは 3MB / 3,000ノード閾値で source に自動切替する。

#### 実装確認
| 要件 | 判定 | 根拠ファイル（パス:行番号） |
|---|---|---|
| 3MB・3,000ノード閾値で source へ切替する判定がある | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:95-97`, `src/components/editor/TipTapEditor.tsx:485-518` |
| AI最適化モジュール（normalize/annotate/analyze/buildReport）が存在する | ✅ 準拠 | `src/ai/optimizer/ai-optimizer.ts:7-15`, `src/ai/optimizer/ai-optimizer.ts:83-135`, `src/ai/optimizer/ai-optimizer.ts:189-220` |
| Markdownエディタのモードが2種（wysiwyg/source） | ✅ 準拠 | `src/components/editor/TipTapEditor.tsx:93`, `src/components/editor/TipTapEditor.tsx:119`, `src/components/editor/TipTapEditor.tsx:620-634`。設計書 §2.2（line 221-228）で2モード構成に確定済み |
| Typora式フォーカスデコレーションが wysiwyg モード内で実現 | ✅ 準拠 | `src/extensions/TyporaFocusExtension.ts:22-29`。設計書の設計メモ（line 228）で TyporaFocusExtension による統合を明記 |
| 内部 AST が hast 互換を基準として統一されている | ⚠️ 部分準拠 | `src/core/document/ast.ts:4-6`, `src/core/document/ast.ts:33-103`, `src/lib/markdown-to-tiptap.ts:4-5` |

#### 未実装・不一致の詳細
- ~~**Markdown 4モード**: 設計書は `typora / wysiwyg / source / split` を要求しているが、MarkdownEditor の `EditorMode` は `wysiwyg | source` の2値のみ。~~ → **訂正済み（2026-03-12）**: 設計書 §2.2（line 221-228）は2モード構成（wysiwyg / source）に確定済み。typora は wysiwyg 内の TyporaFocusExtension に統合、split は将来保留と明記されている。
- ~~**NodeView 共通モード購読**: 設計書の `EditorModeExtension` + `useEditorMode` パターンに相当する実装は確認できず、Typora 表示は別拡張（Decoration）で実装されている。~~ → **訂正済み（2026-03-12）**: 設計書の設計メモにより TyporaFocusExtension（ProseMirror Decoration ベース）での統合が設計判断として記録されており、現在の実装は設計書と整合している。
- **hast SoT**: ドキュメント型定義は mdast 準拠と明記されており、hast 互換 SoT の明示統一は確認できない。

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
| 設計記載の `ai_commands.rs` が commands に存在する | ❌ 未実装 | `src-tauri/src/commands/mod.rs:1-8`, `src-tauri/src/lib.rs:39-84` |
| `public` にサンドボックス実行用 HTML がある | ⚠️ 部分準拠 | `public/plugin-runtime.html:1-20` |

#### 未実装・不一致の詳細
- **ai_commands.rs**: 設計書の構成例に含まれるが、現状のコマンド登録には含まれていない。
- **public のサンドボックス構成**: plugin-runtime 用ファイルはあるが、設計書が例示する複数サンドボックス構成との一致は一部のみ確認。

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
| 設計書の Typora クリックハンドラ（`typora-click-handler.ts`）相当 | ❌ 未実装 | `src/extensions/TyporaFocusExtension.ts:1-10`, `src/extensions/TyporaFocusExtension.ts:237-271` |
| Undo/Redo の実装詳細（本設計書内定義に対する直接実装） | ⚠️ 部分準拠 | `src/components/editor/TipTapEditor.tsx:233-286` |

#### 未実装・不一致の詳細
- **Typora クリック位置→ブロックフォーカス変換**: 設計書の専用プラグイン実装例に対し、現状はフォーカスデコレーション拡張実装を確認（同等設計かの断定までは不可）。
- **Undo/Redo**: ProseMirror/Tiptap を利用する構成はあるが、本設計書の粒度要件に対する専用実装箇所はこのレビュー範囲では特定できなかった。

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
| `.html` ファイル関連付け設定（設計書では `.md / .html`） | ⚠️ 部分準拠 | `src-tauri/tauri.conf.json:46-57` |

#### 未実装・不一致の詳細
- **ファイル関連付け**: 現行設定は `md/markdown` のみ確認でき、`.html` 関連付けは確認できない。

---

## 総合サマリー

| 判定 | 件数 |
|---|---|
| ✅ 準拠 | 16 |
| ⚠️ 部分準拠 | 4 |
| ❌ 未実装 | 3 |
| 🔶 保留（管理済み） | 0 |

### 主要な未実装・不一致（❌ / ⚠️ のみ列挙）

1. ~~**Markdown エディタ4モード要件** — 現状は `wysiwyg/source` の2モード実装。~~ → **訂正済み（2026-03-12）**: 設計書 §2.2 で2モード構成に確定済み。
2. ~~**EditorModeExtension + useEditorMode パターン** — 設計書で規定された共通購読パターンを確認できない。~~ → **訂正済み（2026-03-12）**: 設計書の設計メモで TyporaFocusExtension 統合を明記。
3. **hast 互換 SoT の明示統一** — mdast 準拠定義が中心で、hast SoT の統一実装は確認できない。
4. **ai_commands.rs** — 設計書構成例にあるコマンドモジュールが commands 登録に存在しない。
5. **Typora クリックハンドラ実装差異** — 設計書例示の専用プラグイン実装を確認できない。
6. **`.html` ファイル関連付け** — tauri.conf では `.md/.markdown` のみ確認。
