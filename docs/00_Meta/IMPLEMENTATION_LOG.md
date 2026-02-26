# 実装進捗ログ

> **目的:** セッション間の引き継ぎ情報を記録する。
> 各セッション終了時に「今回やったこと」と「次回やること」を必ず記入する。
>
> **正確な実装状態の SoT は `roadmap.md` の `[x]` チェック。本ファイルは補足説明用。**

---

## 現在のフェーズ

**Phase 1 MVP** — 実装中

---

## セッション履歴

### 2026-02-26 セッション #1（設計フェーズ）
**担当:** 設計専用セッション
**作業内容:**
- `docs/` 以下に全設計ドキュメントを作成（Phase 1〜8 全体設計）
- `roadmap.md` に全実装タスクをチェックボックス形式で記載
- `design-coverage.md` に設計網羅度を整理

**成果物:** docs/ 以下の全設計ドキュメント

---

### 2026-02-26 セッション #2（実装フェーズ開始）
**担当:** 実装フェーズ
**ブランチ:** `claude/implementation-workflow-process-3l7de`

**作業内容:**
- Phase 1 セットアップ完了（Vite+React+TS+Tauri 2.0 プロジェクト初期化）
- TipTap エディタ基盤実装（`src/components/editor/Editor.tsx`）
- Markdown ↔ TipTap 変換ライブラリ実装（`src/lib/markdown-to-tiptap.ts`, `tiptap-to-markdown.ts`）
- App Shell 実装（`src/components/layout/AppShell.tsx`）
- TabBar 実装（`src/components/tabs/TabBar.tsx`）
- Zustand ストア実装（`src/store/tabStore.ts`, `settingsStore.ts`）
- Rust ファイルI/Oコマンド（`src-tauri/src/commands/fs_commands.rs`）

**実装済み roadmap.md 項目:** Phase 1 セットアップ全7項目 / コア機能全5項目 / タブ管理5項目 / WYSIWYG基本要素8項目 / オートフォーマット4項目 / ショートカット4項目

**今回追加:**
- `CLAUDE.md` にセッション開始プロトコルを追加
- `roadmap.md` に実装済み `[x]` チェックを反映
- 本ログファイル作成

---

### 次回セッション向け: 残り Phase 1 タスク

次のセッションでは `roadmap.md` を読み、最初の `- [ ]` から順に実装してください。

**優先順位（Phase 1 残タスク）:**

| 優先 | タスク | 参照設計書 |
|------|--------|-----------|
| ★★★ | Playwright E2Eテスト環境セットアップ | testing-strategy-design.md §3 |
| ★★★ | タイトルバーへの未保存マーカー反映（Rustコマンド） | window-tab-session-design.md §3 |
| ★★★ | `onCloseRequested` ウィンドウクローズ未保存ガード | window-tab-session-design.md §5 |
| ★★★ | セッション保存・復元（plugin-store） | window-tab-session-design.md §2 |
| ★★★ | 取り消し線（@tiptap/extension-strike） | markdown-tiptap-conversion.md |
| ★★★ | タスクリスト（@tiptap/extension-task-list） | markdown-tiptap-conversion.md |
| ★★★ | コードブロック シンタックスハイライト（lowlight統合） | markdown-tiptap-conversion.md |
| ★★★ | ソースモード切替（Ctrl+/） | system-design.md |
| ★★ | Ctrl+K（リンク挿入ダイアログ） | keyboard-shortcuts.md |
| ★★ | Ctrl+1〜6（見出しレベルショートカット） | keyboard-shortcuts.md |
| ★★ | AppSettings 型定義 + settingsStore 完成 | user-settings-design.md |
| ★★ | プリファレンスダイアログ | user-settings-design.md |
| ★ | スマートペースト（turndown + DOMPurify） | smart-paste-design.md |
| ★ | エラーハンドリング（ErrorBoundary + toastStore） | error-handling-design.md |
| ★ | ファイル関連付け・シングルインスタンス制御 | window-tab-session-design.md §5 |

---

## Claude Code セッション開始手順（毎回）

```
1. このファイル(IMPLEMENTATION_LOG.md)を読む → 前回の続きを把握
2. roadmap.md を読む → 最初の - [ ] を探す
3. 対応する設計ドキュメントを読む
4. 実装する
5. roadmap.md の - [ ] を - [x] に変更
6. このログの「セッション履歴」に記録を追加
7. コミット: feat(phase-1): <タスク名>
```
