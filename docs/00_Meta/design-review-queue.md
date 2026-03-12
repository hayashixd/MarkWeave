# 設計書レビューキュー

> **目的**: 設計書を1ファイルずつ順番にレビューし、実装との乖離を記録する管理台帳。
> 「次のレビューを実施して」と依頼されたら、`AGENTS.md` の「🔍 設計書実装整合レビュープロトコル」に従い、このファイルで `pending` になっている最も番号の小さいエントリーをレビューする。

---

## レビュー対象一覧

| # | 設計書ファイル | ステータス | レビュー日 | レビューファイル |
|---|---|---|---|---|
| 1 | `docs/01_Architecture/system-design.md` | pending | — | — |
| 2 | `docs/01_Architecture/tauri-ipc-interface.md` | pending | — | — |
| 3 | `docs/01_Architecture/security-design.md` | pending | — | — |
| 4 | `docs/01_Architecture/performance-design.md` | pending | — | — |
| 5 | `docs/01_Architecture/plugin-api-design.md` | pending | — | — |
| 6 | `docs/02_Core_Editor/markdown-tiptap-conversion.md` | pending | — | — |
| 7 | `docs/02_Core_Editor/tiptap-roundtrip-test-strategy.md` | pending | — | — |
| 8 | `docs/02_Core_Editor/undo-redo-design.md` | pending | — | — |
| 9 | `docs/02_Core_Editor/markdown-extensions-design.md` | pending | — | — |
| 10 | `docs/02_Core_Editor/text-statistics-design.md` | pending | — | — |
| 11 | `docs/03_UI_UX/app-shell-design.md` | pending | — | — |
| 12 | `docs/03_UI_UX/menu-inventory.md` | pending | — | — |
| 13 | `docs/03_UI_UX/editor-ux-design.md` | pending | — | — |
| 14 | `docs/03_UI_UX/keyboard-shortcuts.md` | pending | — | — |
| 15 | `docs/03_UI_UX/theme-design.md` | pending | — | — |
| 16 | `docs/03_UI_UX/accessibility-design.md` | pending | — | — |
| 17 | `docs/03_UI_UX/split-editor-design.md` | pending | — | — |
| 18 | `docs/03_UI_UX/zen-mode-design.md` | pending | — | — |
| 19 | `docs/04_File_Workspace/file-workspace-design.md` | pending | — | — |
| 20 | `docs/04_File_Workspace/window-tab-session-design.md` | pending | — | — |
| 21 | `docs/05_Features/slash-commands-design.md` | pending | — | — |
| 22 | `docs/05_Features/wikilinks-backlinks-design.md` | pending | — | — |
| 23 | `docs/05_Features/git-integration-design.md` | pending | — | — |
| 24 | `docs/05_Features/search-design.md` | pending | — | — |
| 25 | `docs/05_Features/metadata-query-design.md` | pending | — | — |
| 26 | `docs/05_Features/AI/ai-design.md` | pending | — | — |
| 27 | `docs/05_Features/HTML/html-editing-design.md` | pending | — | — |
| 28 | `docs/05_Features/Image/image-design.md` | pending | — | — |
| 29 | `docs/06_Export_Interop/export-interop-design.md` | pending | — | — |
| 30 | `docs/06_Export_Interop/smart-paste-design.md` | pending | — | — |
| 31 | `docs/07_Platform_Settings/user-settings-design.md` | pending | — | — |
| 32 | `docs/07_Platform_Settings/i18n-design.md` | pending | — | — |
| 33 | `docs/07_Platform_Settings/cross-platform-design.md` | pending | — | — |
| 34 | `docs/07_Platform_Settings/mobile-advanced-design.md` | pending | — | — |
| 35 | `docs/07_Platform_Settings/distribution-design.md` | pending | — | — |
| 36 | `docs/07_Platform_Settings/community-design.md` | pending | — | — |
| 37 | `docs/08_Testing_Quality/testing-strategy-design.md` | pending | — | — |
| 38 | `docs/08_Testing_Quality/error-handling-design.md` | pending | — | — |

---

## ステータス凡例

| ステータス | 意味 |
|---|---|
| `pending` | 未レビュー |
| `in_progress` | 現在レビュー中 |
| `done` | レビュー完了 |

---

## レビュー完了一覧（過去レビュー）

*（初回レビュー時点では空。レビューが完了するたびに上表から移動せず、ステータスを `done` に更新する）*
