# 機能一覧（実装トレーサビリティ）

> 目的: 「設計書に定義された機能」が実装計画（`roadmap.md`）だけでなく、**実装有無の進捗**まで追跡できる状態を保証する。
> 更新日: 2026-02-28

## 使い方

- 各設計書の主要機能を 1 行で列挙する。
- `roadmap.md` に直接タスクがある機能は「ロードマップ紐づけ」に Phase を記載する。
- `実装ステータス` は毎回再判定し、推測ではなく現行コードと `roadmap.md` の完了状況を根拠に更新する。

## 実装ステータス凡例

| 記号 | 意味 |
|---|---|
| ✅ | 実装済み（該当機能の主要要件が現行実装で確認できる） |
| 🔶 | 一部実装（MVP/一部機能のみ実装、または後続 Phase が未完） |
| ❌ | 未実装（現行実装で確認できない） |

## 設計書 ↔ 機能一覧 ↔ 実装進捗対応表

| 設計書 | 主要機能（要約） | ロードマップ紐づけ | 実装ステータス |
|---|---|---|---|
| `01_Architecture/system-design.md` | 全体アーキテクチャ、編集モード、責務分離 | Phase 1〜8（全体） | 🔶 |
| `01_Architecture/tauri-ipc-interface.md` | Tauri IPC コマンド契約（SoT） | 全 Phase（横断） | 🔶 |
| `01_Architecture/security-design.md` | XSS/CSP/fs-scope/更新署名の安全設計 | Phase 1（CSP）、技術的負債（HTML編集セキュリティ審査） | 🔶 |
| `01_Architecture/performance-design.md` | 仮想スクロール、インクリメンタル処理、計測 | 技術的負債（仮想スクロール、インクリメンタル、計測） | 🔶 |
| `01_Architecture/plugin-api-design.md` | プラグイン API とサンドボックス | Phase 7（プラグインAPI） | ❌ |
| `02_Core_Editor/markdown-tiptap-conversion.md` | Markdown ↔ TipTap 変換仕様 | Phase 1（パーサ/シリアライザ） | ✅ |
| `02_Core_Editor/tiptap-roundtrip-test-strategy.md` | 変換ラウンドトリップ品質担保 | 品質管理（継続テスト） | 🔶 |
| `02_Core_Editor/undo-redo-design.md` | Undo/Redo 粒度と履歴分離 | Phase 1（Undo/Redo）、制約項目 | 🔶 |
| `02_Core_Editor/markdown-extensions-design.md` | 脚注・カスタムコンテナ等の拡張記法 | Phase 7（スラッシュコマンド配下の拡張） | ❌ |
| `02_Core_Editor/text-statistics-design.md` | 文字数/単語数/読了時間統計 | Phase 3（文書統計ダイアログ） | ❌ |
| `03_UI_UX/app-shell-design.md` | シェル UI、メニュー、ステータスバー | Phase 1/3/7（UI 拡張） | 🔶 |
| `03_UI_UX/editor-ux-design.md` | エディタ操作 UX（ジャンプ・補完・整形等） | Phase 3（Markdownエディタ基本機能強化） | ❌ |
| `03_UI_UX/keyboard-shortcuts.md` | ショートカット体系 | Phase 1/3/7 | 🔶 |
| `03_UI_UX/theme-design.md` | テーマシステム・見た目カスタマイズ | Phase 7（テーマシステム） | ❌ |
| `03_UI_UX/zen-mode-design.md` | Zen/集中モード強化 | Phase 7（Zen モード強化） | ❌ |
| `03_UI_UX/split-editor-design.md` | ペイン分割編集 | Phase 7（ペイン分割エディタ） | ❌ |
| `03_UI_UX/accessibility-design.md` | a11y 対応方針 | 技術的負債（a11y 対応） | ❌ |
| `04_File_Workspace/file-workspace-design.md` | ファイル/フォルダ/ワークスペース管理 | Phase 1/3/7 | 🔶 |
| `04_File_Workspace/window-tab-session-design.md` | タブ、セッション、クラッシュリカバリ | Phase 1（タブ・セッション）、技術的負債（クラッシュリカバリ） | 🔶 |
| `05_Features/search-design.md` | 検索・置換機能 | Phase 3（Ctrl+F / Ctrl+H） | ❌ |
| `05_Features/slash-commands-design.md` | スラッシュコマンド挿入 | Phase 7（スラッシュコマンド） | ❌ |
| `05_Features/wikilinks-backlinks-design.md` | WikiLink/Backlink/グラフ表示 | Phase 7.5（PKM 機能） | ❌ |
| `05_Features/git-integration-design.md` | Git 状態表示・履歴・競合支援 | Phase 7.5（PKM/ワークスペース拡張として管理） | ❌ |
| `05_Features/metadata-query-design.md` | メタデータ索引とクエリ | Phase 7.5（メタデータクエリエンジン） | ❌ |
| `05_Features/HTML/html-editing-design.md` | HTML WYSIWYG/ソース/スプリット編集 | Phase 5/6 | ❌ |
| `05_Features/Image/image-design.md` | 画像挿入・管理・最適化 | Phase 3（D&D/貼り付け画像）、Phase 4（埋め込み） | ❌ |
| `05_Features/AI/ai-design.md` | AIコピー・テンプレート | Phase 7.5（AI 機能） | ❌ |
| `06_Export_Interop/export-interop-design.md` | HTML/PDF/Pandoc エクスポート | Phase 4/7 | ❌ |
| `06_Export_Interop/smart-paste-design.md` | スマートペースト変換 | Phase 1/3（スマートペースト拡張） | 🔶 |
| `07_Platform_Settings/user-settings-design.md` | 設定管理・マイグレーション | Phase 1（ユーザー設定） | ✅ |
| `07_Platform_Settings/i18n-design.md` | 多言語化 | 技術的負債（i18n） | 🔶 |
| `07_Platform_Settings/cross-platform-design.md` | OS 差分対応方針 | Phase 7（Windowsジャンプリスト等）、継続対応 | 🔶 |
| `07_Platform_Settings/mobile-advanced-design.md` | モバイル高度機能（SAF/iCloud） | 将来フェーズ（機能一覧で管理） | ❌ |
| `07_Platform_Settings/distribution-design.md` | 配布・自動更新 | 配布・アップデート章 | ❌ |
| `07_Platform_Settings/community-design.md` | コミュニティ・テレメトリー・フィードバック | 将来フェーズ（機能一覧で管理） | ❌ |
| `08_Testing_Quality/testing-strategy-design.md` | テスト戦略・品質ゲート | 全 Phase（品質管理） | 🔶 |
| `08_Testing_Quality/error-handling-design.md` | ログ・通知・例外設計 | Phase 1（エラーハンドリング） | ✅ |

## 未紐づけ機能の扱い

以下は「設計書には存在するがロードマップに独立項目がない」ため、本ファイルで明示管理する。

- `mobile-advanced-design.md`（モバイル高度機能）
- `community-design.md`（コミュニティ/テレメトリー/フィードバック）
- `testing-strategy-design.md`（品質戦略の運用項目）
- `tiptap-roundtrip-test-strategy.md`（変換品質の継続検証）

必要に応じて、ロードマップに専用フェーズ/章を追加して昇格させる。
