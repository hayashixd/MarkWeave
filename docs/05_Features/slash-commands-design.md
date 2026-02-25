# スラッシュコマンド設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [UX フロー](#2-ux-フロー)
3. [コマンド一覧](#3-コマンド一覧)
4. [UI 設計](#4-ui-設計)
5. [実装方針](#5-実装方針)
6. [キーボード操作](#6-キーボード操作)
7. [AI テンプレートとの連携](#7-ai-テンプレートとの連携)
8. [設定項目](#8-設定項目)

---

## 1. 概要と目的

### 1.1 概要

エディタ上で行頭または段落の空白部分に `/` を入力すると、挿入可能な要素の一覧をポップアップメニューで表示する機能。見出し・テーブル・画像・AIテンプレートなど、ツールバーへマウスを移動することなくキーボード操作のみで各種ブロック要素を挿入できる。

### 1.2 目的・設計思想

- Notion や Linear などで標準化されたキーボードファーストのUXパターンを採用
- マウスに頼らず全操作をキーボードで完結させることで **執筆フローの中断を最小化**
- ツールバーが非表示の状態（フォーカスモード・Zen モード）でもすべての要素挿入を可能にする
- AI テンプレートとの統合で「ドキュメントの足場作り」を高速化

---

## 2. UX フロー

### 2.1 基本フロー

```
1. ユーザーが段落の先頭（または空の段落）で / を入力
2. スラッシュコマンドポップアップが表示される
3. 候補リストが表示され、キー入力でフィルタリング
4. ↑↓ キーで候補を選択し Enter で挿入
5. Esc または / 削除でポップアップを閉じる
```

### 2.2 詳細トリガー条件

| トリガー | 動作 |
|---------|------|
| 行頭での `/` 入力 | 即座にコマンドパレット表示 |
| 空段落での `/` 入力 | 即座にコマンドパレット表示 |
| テキスト途中での `/` 入力 | コマンドパレットを表示しない（通常文字として入力）|
| `/` の後に文字を追加 | リアルタイムフィルタリング |
| `/` 全削除 | コマンドパレットを閉じる |

### 2.3 挿入動作

- コマンド選択時、入力した `/[クエリ]` は削除され、選択した要素に置換される
- テーブルなど構造を持つ要素は **最小限の初期データ付き** で挿入される
- 挿入後はカーソルが適切な位置（見出しなら見出しテキスト先頭等）に移動する

---

## 3. コマンド一覧

### 3.1 テキスト・見出し

| コマンド | キーワード | 説明 |
|---------|----------|------|
| 見出し H1 | `h1`, `heading1`, `見出し1` | H1 見出しを挿入 |
| 見出し H2 | `h2`, `heading2`, `見出し2` | H2 見出しを挿入 |
| 見出し H3 | `h3`, `heading3`, `見出し3` | H3 見出しを挿入 |
| 見出し H4 | `h4`, `heading4`, `見出し4` | H4 見出しを挿入 |
| 箇条書きリスト | `ul`, `list`, `bullet`, `リスト` | 順序なしリストを挿入 |
| 番号付きリスト | `ol`, `ordered`, `番号` | 順序付きリストを挿入 |
| タスクリスト | `todo`, `task`, `checkbox`, `タスク` | チェックボックス付きリストを挿入 |
| 引用ブロック | `quote`, `blockquote`, `引用` | 引用ブロックを挿入 |
| 区切り線 | `hr`, `divider`, `line`, `区切り` | 水平線を挿入 |

### 3.2 コード・数式・図表

| コマンド | キーワード | 説明 |
|---------|----------|------|
| コードブロック | `code`, `コード` | 言語選択付きコードブロックを挿入 |
| インラインコード | `inline-code` | インラインコードを挿入 |
| 数式（ブロック） | `math`, `formula`, `数式` | KaTeX ブロック数式を挿入 |
| インライン数式 | `inline-math` | インライン数式を挿入 |
| Mermaid 図 | `mermaid`, `diagram`, `図` | Mermaid 図表ブロックを挿入 |
| PlantUML 図 | `plantuml`, `uml` | PlantUML ブロックを挿入 |

### 3.3 テーブル

| コマンド | キーワード | 説明 |
|---------|----------|------|
| テーブル（2×2） | `table`, `テーブル`, `表` | 2列×2行のテーブルを挿入 |
| テーブル（カスタム） | `table 3x4` | 列数×行数を指定してテーブルを挿入 |

### 3.4 メディア

| コマンド | キーワード | 説明 |
|---------|----------|------|
| 画像を挿入 | `image`, `img`, `画像` | ファイル選択ダイアログで画像を挿入 |
| 画像 URL | `image-url` | URL 指定で画像を挿入 |
| リンク | `link`, `url`, `リンク` | リンクを挿入（URL 入力プロンプト付き） |

### 3.5 Markdown 拡張

| コマンド | キーワード | 説明 |
|---------|----------|------|
| 脚注 | `footnote`, `脚注` | 脚注リファレンスを挿入 |
| カスタムコンテナ（情報） | `info`, `callout-info` | `:::info` ブロックを挿入 |
| カスタムコンテナ（警告） | `warning`, `callout-warning`, `警告` | `:::warning` ブロックを挿入 |
| カスタムコンテナ（注意） | `danger`, `callout-danger`, `注意` | `:::danger` ブロックを挿入 |
| 目次 | `toc`, `目次` | `[toc]` プレースホルダーを挿入 |

### 3.6 AI テンプレート

| コマンド | キーワード | 説明 |
|---------|----------|------|
| ブログ構成案 | `blog`, `ブログ` | ブログ記事のAIテンプレートを挿入 |
| コード解説 | `code-explain`, `コード解説` | コード解説テンプレートを挿入 |
| 会議メモ | `meeting`, `会議`, `議事録` | 会議メモテンプレートを挿入 |
| 要約テンプレート | `summary`, `要約` | 要約用プロンプトテンプレートを挿入 |
| すべてのテンプレート... | `template`, `テンプレート` | AI テンプレートパネルを開く |

---

## 4. UI 設計

### 4.1 ポップアップレイアウト

```
/ で表示されるコマンドパレット:

┌──────────────────────────────────────────────┐
│ 🔍 /見出し                                   │  ← 入力欄（入力と連動）
├──────────────────────────────────────────────┤
│ テキスト・見出し                              │  ← カテゴリラベル
│ ▶ 🔠 見出し H1    大きな見出し              │  ← 選択中
│   🔡 見出し H2    中くらいの見出し           │
│   🔡 見出し H3    小さな見出し               │
├──────────────────────────────────────────────┤
│ コード・数式                                  │
│   💻 コードブロック  シンタックスハイライト付き │
│   🧮 数式（ブロック）  KaTeX 記法            │
└──────────────────────────────────────────────┘
  ↑↓ で移動  Enter で挿入  Esc で閉じる
```

### 4.2 サイズ・位置

- **幅**: 320px（最小）〜 400px（最大）
- **最大高さ**: 320px（超過時はスクロール）
- **表示位置**: カーソル直下（エディタビューポートの端に達する場合は上方向に反転）
- **z-index**: 他のオーバーレイ要素より前面（値: 1000）

### 4.3 各候補のアイテム構成

```
┌─────────────────────────────────────────────────────┐
│ [アイコン]  [コマンド名]         [説明テキスト]    │
│             [サブテキスト: キーワード例]            │
└─────────────────────────────────────────────────────┘
```

- **アイコン**: カテゴリ別の絵文字またはSVGアイコン
- **コマンド名**: 日本語表示（設定によって英語表示切り替え可）
- **説明テキスト**: 右側にグレーテキストで機能の簡潔な説明
- **ホバー・選択状態**: 背景色のハイライトで強調

### 4.4 フィルタリング挙動

- `/` の後に文字を入力するとリアルタイムでフィルタリング
- フィルタリングアルゴリズム: **fuse.js** のファジーマッチ
- マッチした文字部分をボールドで強調表示
- 結果が 0 件の場合: 「`/xxx` に一致する要素が見つかりません」と表示

---

## 5. 実装方針

### 5.1 TipTap 拡張として実装

```typescript
// src/renderer/wysiwyg/extensions/slash-commands.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { ReactRenderer } from '@tiptap/react';
import { SlashCommandsMenu } from '../../components/SlashCommandsMenu';

export interface SlashCommandItem {
  id: string;
  label: string;         // 日本語表示名
  keywords: string[];    // 検索キーワード（英語・日本語両方）
  icon: string;          // 絵文字 or SVGアイコン名
  category: SlashCommandCategory;
  description: string;
  action: (editor: Editor) => void;
}

export type SlashCommandCategory =
  | 'text'
  | 'code'
  | 'table'
  | 'media'
  | 'markdown-extension'
  | 'ai-template';

export const SlashCommandsExtension = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('slashCommands'),
        view(editorView) {
          return new SlashCommandsView(editorView);
        },
      }),
    ];
  },
});
```

### 5.2 トリガー検出ロジック

```typescript
// src/renderer/wysiwyg/extensions/slash-commands-trigger.ts

function shouldShowSlashMenu(state: EditorState): boolean {
  const { selection, doc } = state;
  if (!selection.empty) return false;

  const { $from } = selection;
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

  // 行頭の / または空段落の / のみトリガー
  return textBefore === '/' || textBefore.match(/^\s*\/$/) !== null;
}

function getQueryFromState(state: EditorState): string | null {
  const { $from } = state.selection;
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  const match = textBefore.match(/\/(\w*)$/);
  return match ? match[1] : null;
}
```

### 5.3 コマンド定義とアクション

```typescript
// src/renderer/wysiwyg/extensions/slash-command-definitions.ts

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'heading-1',
    label: '見出し H1',
    keywords: ['h1', 'heading1', '見出し1', 'heading'],
    icon: '🔠',
    category: 'text',
    description: '大きな見出し',
    action: (editor) => {
      editor.chain().focus()
        .deleteRange({ from: editor.state.selection.$from.pos - getSlashQueryLength(editor), to: editor.state.selection.$from.pos })
        .setHeading({ level: 1 })
        .run();
    },
  },
  {
    id: 'table',
    label: 'テーブル',
    keywords: ['table', 'テーブル', '表', 'grid'],
    icon: '📊',
    category: 'table',
    description: '2×2 のテーブルを挿入',
    action: (editor) => {
      editor.chain().focus()
        .deleteRange(/* スラッシュ削除 */)
        .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
        .run();
    },
  },
  // ... 他のコマンド
];
```

### 5.4 メニュー React コンポーネント

```typescript
// src/components/SlashCommandsMenu/index.tsx
import { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';

interface SlashCommandsMenuProps {
  query: string;
  position: { x: number; y: number };
  onSelect: (command: SlashCommandItem) => void;
  onClose: () => void;
}

export function SlashCommandsMenu({ query, position, onSelect, onClose }: SlashCommandsMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommandItem[]>(SLASH_COMMANDS);

  // fuse.js でファジーフィルタリング
  const fuse = useMemo(() => new Fuse(SLASH_COMMANDS, {
    keys: ['label', 'keywords', 'description'],
    threshold: 0.4,
  }), []);

  useEffect(() => {
    if (query) {
      setFilteredCommands(fuse.search(query).map(r => r.item));
    } else {
      setFilteredCommands(SLASH_COMMANDS);
    }
    setSelectedIndex(0);
  }, [query, fuse]);

  // キーボードイベントはエディタのキーハンドラーから転送される
  // ...

  return (
    <div
      className="slash-commands-menu"
      style={{ left: position.x, top: position.y }}
      role="listbox"
      aria-label="要素を挿入"
    >
      {/* カテゴリグループ別にコマンドをレンダリング */}
    </div>
  );
}
```

---

## 6. キーボード操作

| キー | 動作 |
|-----|------|
| `↑` | 前の候補に移動 |
| `↓` | 次の候補に移動 |
| `Enter` | 選択中のコマンドを実行 |
| `Tab` | 選択中のコマンドを実行（Enter と同様） |
| `Esc` | コマンドパレットを閉じ、入力した `/` を削除 |
| `Backspace`（`/` まで削除） | コマンドパレットを閉じる |
| 任意の文字入力 | クエリに追加してフィルタリング |

---

## 7. AI テンプレートとの連携

[ai-features.md](./ai-features.md) で設計された AI テンプレートシステムとの統合:

```
/ブログ [Enter] → ブログ構成案のテンプレートをカーソル位置に挿入
/テンプレート [Enter] → AI テンプレートパネル（サイドバー）を開く
```

- スラッシュコマンドからの AI テンプレート挿入は、テンプレートパネルの「カーソル挿入」と同等の動作
- プレースホルダー（`{{タイトル}}`等）が含まれる場合、挿入直後にプレースホルダー入力ダイアログを表示

---

## 8. 設定項目

[user-settings-design.md](./user-settings-design.md) に追加する設定:

```typescript
interface EditorSettings {
  // ... 既存設定
  slashCommands: {
    enabled: boolean;           // スラッシュコマンド機能の有効/無効（デフォルト: true）
    showAiTemplates: boolean;   // AI テンプレートをスラッシュコマンドに表示（デフォルト: true）
    triggerOnlyAtLineStart: boolean; // 行頭のみでトリガー（デフォルト: true）
  };
}
```

---

## 関連ドキュメント

- [editor-ux-design.md](./editor-ux-design.md) — エディタ全体の UX 設計
- [ai-features.md](./ai-features.md) — AI テンプレートシステム設計
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — キーボードショートカット設計
- [markdown-extensions-design.md](./markdown-extensions-design.md) — カスタムコンテナ等の拡張記法設計
- [accessibility-design.md](./accessibility-design.md) — アクセシビリティ設計（ARIA ロール・キーボード操作）
