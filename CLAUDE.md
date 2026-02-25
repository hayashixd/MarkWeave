# CLAUDE.md — AI エージェント向け作業ガイド

このファイルは Claude Code (AI エージェント) がこのリポジトリで作業する際のルールを定義する。

---

## プロジェクト概要

Tauri 2.0 + React + TipTap による Typora ライク WYSIWYG Markdown/HTML エディタ。

- **フロントエンド**: React + TypeScript + TipTap (ProseMirror)
- **バックエンド**: Rust (Tauri 2.0)
- **設計ドキュメント**: `docs/` 以下の Markdown ファイル

---

## 設計ドキュメントのルール

### 1. 作業前に必ず確認する

設計ドキュメントを追加・変更する前に以下を参照すること。

| 確認先 | 目的 |
|--------|------|
| `docs/00_Meta/design-index.md` | どのファイルに何を書くかの索引 |
| `docs/00_Meta/design-coverage.md` | 設計済みトピックの網羅状況（✅/🔶/❌） |
| `docs/00_Meta/roadmap.md` | フェーズ計画・設計ドキュメント一覧 |

### 2. ディレクトリ配置ルール

```
docs/
├── 00_Meta/           → プロジェクト管理・索引のみ。設計内容は書かない
├── 01_Architecture/   → 複数機能にまたがる横断的な設計
├── 02_Core_Editor/    → TipTap/ProseMirror の AST・変換・テキスト処理
├── 03_UI_UX/          → React コンポーネント・操作性・テーマ・a11y
├── 04_File_Workspace/ → ファイル I/O・ワークスペース・セッション
├── 05_Features/       → 機能ドメイン別（サブディレクトリで分類）
│   ├── AI/            → AI コピー・テンプレート
│   ├── HTML/          → HTML WYSIWYG 編集
│   └── Image/         → 画像管理・操作・アノテーション
├── 06_Export_Interop/ → エクスポート・Pandoc・スマートペースト
├── 07_Platform_Settings/ → OS 対応・ユーザー設定・配布
└── 08_Testing_Quality/   → テスト戦略・エラーハンドリング
```

**判断の優先順位**:
1. `design-index.md` のクイックガイドに該当トピックがあればそのファイルに追記する
2. 「複数機能にまたがるか」→ YES なら `01_Architecture/`
3. 「エディタの AST/変換処理か」→ YES なら `02_Core_Editor/`
4. 「ユーザーが直接見て操作する UI か」→ YES なら `03_UI_UX/`
5. 迷ったら既存の最も関連するファイルに追記する

### 3. 既存ファイルへの追記 vs 新規ファイル作成

**原則: 既存ファイルへの追記を優先する。**

新規ファイルを作成してよいのは、以下の **すべて** を満たす場合のみ:

- 独立したドメイン（既存ファイルの主題と明確に分離できる）
- 十分なボリューム（5 セクション以上 or 200 行以上の見込み）
- 追記すると既存ファイルの主題が曖昧になる

### 4. ファイル命名規則

```
<機能名>-design.md      # 設計ドキュメント（原則）
<機能名>-strategy.md    # 戦略・方針ドキュメント
<機能名>-analysis.md    # 分析ドキュメント（参照専用）
```

- 小文字ケバブケース（`image-design.md`、`ai-design.md`）
- 単語は英語（日本語ファイル名は使わない）

### 5. ドキュメントのヘッダー形式

```markdown
# <タイトル>（日本語）

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: YYYY-MM-DD
```

### 6. 新規ファイル作成後の必須更新

新しい設計ドキュメントを作成したら、**必ず** 以下の 3 ファイルも更新する:

1. **`docs/00_Meta/design-index.md`** — 該当ディレクトリのテーブルに行を追加
2. **`docs/00_Meta/design-coverage.md`** — 新トピックの行を追加（状態: ✅）
3. **`docs/00_Meta/roadmap.md`** — 「設計ドキュメント一覧」テーブルに行を追加

### 7. 既存ファイルを削除・統合する場合

- 削除前に内容を統合先に移行する
- `design-index.md`・`design-coverage.md`・`roadmap.md` の参照を更新する
- `git rm` で削除し、統合先ファイルを `git add` する

---

## Git ブランチ・コミットのルール

- 作業ブランチ: `claude/<目的>-<セッションID>` 形式
- コミットメッセージ: `docs:` または `feat:` / `fix:` プレフィックス
- push は `git push -u origin <branch-name>`

---

## src/ のディレクトリ構成

```
src/
├── ai/           AI コピー・テンプレートシステム
├── components/   React UI コンポーネント
├── core/         TipTap/ProseMirror コア（AST・変換）
├── file/         ファイル I/O・ワークスペース
├── plugins/      TipTap プラグイン拡張
├── renderer/     プレビュー・レンダリング
└── themes/       テーマ CSS
```

`src/` の各ディレクトリは `docs/` の対応ディレクトリと関連する:

| src/ | docs/ |
|------|-------|
| `core/` | `02_Core_Editor/` |
| `ai/` | `05_Features/AI/` |
| `file/` | `04_File_Workspace/` |
| `plugins/` | `01_Architecture/plugin-api-design.md` |
| `renderer/` | `06_Export_Interop/` |
| `themes/` | `03_UI_UX/theme-design.md` |
| `components/` | `03_UI_UX/` |
