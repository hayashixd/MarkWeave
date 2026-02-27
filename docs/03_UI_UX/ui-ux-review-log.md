# UI/UX レビュー実施ログ（2026-02-27）

## レビュー対象
- 設計書
  - `docs/03_UI_UX/accessibility-design.md`
  - `docs/03_UI_UX/app-shell-design.md`
- 実装
  - `src/components/tabs/TabBar.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/components/sidebar/Sidebar.tsx`
  - `src/components/editor/TipTapEditor.tsx`

## 主な改善観点と対応

### 1. タブバーのキーボード操作
- 課題: タブが `div` ベースで、キーボードでの移動・操作が限定的。
- 対応:
  - `tablist` / `tab` ロール構造を明確化。
  - roving tabindex と矢印キー操作を追加し、キーボードでのタブ移動を改善。
  - `ArrowLeft/Right`、`Home/End`、`Delete/Backspace` の操作を追加。

### 2. ARIA セマンティクスの不足
- 課題: サイドバー開閉ボタン・ツールバー・ステータス領域の ARIA 属性が不足。
- 対応:
  - サイドバーに `aside` + `aria-label` を追加。
  - 開閉ボタンに `aria-label` / `aria-expanded` / `aria-controls` を追加。
  - エディタツールバーに `role="toolbar"` と `aria-label` を追加。
  - ツールバーボタンに `aria-label` / `aria-pressed` を追加。

### 3. アプリ全体のランドマーク不足
- 課題: メイン編集領域・アプリコンテナのランドマークが曖昧。
- 対応:
  - ルートコンテナへ `role="application"` を追加。
  - 編集領域を `main` として明示。
  - ステータスバーを `role="status"` + `aria-live="polite"` に変更。

## 補足
- 上記対応は、`accessibility-design.md` で定義された WCAG / ARIA 方針に沿って実施。
