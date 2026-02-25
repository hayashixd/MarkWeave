# キーボードショートカット設計書

> 対象: Tauri + TipTap ベースの Typora ライク Markdown エディタ
> Windows（Phase 1）、macOS/Android/iOS（Phase 2）

---

## 1. 推奨ショートカット一覧

### 凡例

- `Mod` = Windows では `Ctrl`、macOS では `Cmd`
- `⚠️` = 競合注意（セクション 2 参照）
- `🆕` = Typora にない独自拡張

---

### 1-1. テキスト装飾（インライン）

| 操作 | Windows | macOS (Phase 2) | Typora 互換 | 備考 |
|------|---------|-----------------|-------------|------|
| **太字** | `Ctrl+B` | `Cmd+B` | ✅ | TipTap デフォルト |
| *斜体* | `Ctrl+I` | `Cmd+I` | ✅ | TipTap デフォルト |
| ~~取り消し線~~ | `Alt+Shift+5` | `Ctrl+Shift+5` | ✅ | Typora 互換 |
| `インラインコード` | `Ctrl+Shift+`` ` `` | `Cmd+Shift+`` ` `` | ✅ | |
| リンク挿入 | `Ctrl+K` | `Cmd+K` | ✅ | |
| ==ハイライト== | `Ctrl+Shift+H` | `Cmd+Option+H` | ❌🆕 | macOS では `Cmd+Shift+H` が検索・置換と競合するため `Cmd+Option+H` を使用 |
| 下線 | `Ctrl+U` | `Cmd+U` | ❌🆕 | Markdown 非標準だが有用 |
| 上付き文字 | `Ctrl+Shift+.` | `Cmd+Shift+.` | ❌🆕 | |
| 下付き文字 | `Ctrl+Shift+,` | `Cmd+Shift+,` | ❌🆕 | |
| 書式クリア | `Ctrl+\` | `Cmd+\` | ✅ | |

---

### 1-2. ブロック操作

| 操作 | Windows | macOS (Phase 2) | Typora 互換 | 備考 |
|------|---------|-----------------|-------------|------|
| 段落（Normal） | `Ctrl+0` | `Cmd+0` | ✅ | |
| 見出し H1 | `Ctrl+1` | `Cmd+1` | ✅ | |
| 見出し H2 | `Ctrl+2` | `Cmd+2` | ✅ | |
| 見出し H3 | `Ctrl+3` | `Cmd+3` | ✅ | |
| 見出し H4 | `Ctrl+4` | `Cmd+4` | ✅ | |
| 見出し H5 | `Ctrl+5` | `Cmd+5` | ✅ | |
| 見出し H6 | `Ctrl+6` | `Cmd+6` | ✅ | |
| 引用ブロック | `Ctrl+Shift+Q` | `Cmd+Shift+Q` | ✅ | |
| コードブロック | `Ctrl+Shift+K` | `Cmd+Shift+K` | ✅ | ⚠️ CodeMirror と競合（後述） |
| 順序付きリスト | `Ctrl+Shift+[` | `Cmd+Shift+[` | ✅ | |
| 順序なしリスト | `Ctrl+Shift+]` | `Cmd+Shift+]` | ✅ | |
| タスクリスト | `Ctrl+Shift+L` | `Cmd+Shift+L` | ❌🆕 | |
| テーブル挿入 | `Ctrl+T` | `Cmd+T` | ✅ | ⚠️ ブラウザ「新規タブ」だが Tauri では問題なし |
| 水平線 | `Ctrl+Shift+-` | `Cmd+Shift+-` | ❌🆕 | 入力ルール `---` の補完として |
| インデント増加 | `Tab` | `Tab` | ✅ | リスト内のみ |
| インデント減少 | `Shift+Tab` | `Shift+Tab` | ✅ | リスト内のみ |
| ブロック上に移動 | `Alt+Up` | `Option+Up` | ❌🆕 | リスト/見出しの並び替え |
| ブロック下に移動 | `Alt+Down` | `Option+Down` | ❌🆕 | |

---

### 1-3. テーブル操作

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| 次のセルへ | `Tab` | `Tab` | テーブル内のみ有効 |
| 前のセルへ | `Shift+Tab` | `Shift+Tab` | テーブル内のみ有効 |
| 末尾セルで新行追加 | `Tab` | `Tab` | 最後のセルにカーソル時 |
| 行を下に追加 | `Ctrl+Enter` | `Cmd+Enter` | テーブル内のみ有効 |
| 行を上に追加 | `Ctrl+Shift+Enter` | `Cmd+Shift+Enter` | テーブル内のみ有効 |
| 行を削除 | `Ctrl+Shift+Backspace` | `Cmd+Shift+Backspace` | テーブル内のみ有効 |
| 列を右に追加 | `Alt+Shift+Enter` | `Option+Shift+Enter` | 🆕 |
| 列を削除 | `Alt+Shift+Backspace` | `Option+Shift+Backspace` | 🆕 |
| 行を上へ移動 | `Alt+Up` | `Option+Up` | テーブル内文脈で上書き |
| 行を下へ移動 | `Alt+Down` | `Option+Down` | テーブル内文脈で上書き |

---

### 1-4. ファイル操作

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| 新規ファイル | `Ctrl+N` | `Cmd+N` | Tauri 管理、ブラウザ干渉なし |
| ファイルを開く | `Ctrl+O` | `Cmd+O` | |
| 上書き保存 | `Ctrl+S` | `Cmd+S` | |
| 名前を付けて保存 | `Ctrl+Shift+S` | `Cmd+Shift+S` | |
| HTML エクスポート | `Ctrl+Shift+E` | `Cmd+Shift+E` | |
| クイックオープン | `Ctrl+P` | `Cmd+P` | ⚠️ OS 印刷と競合。`preventDefault` 必須 |
| 閉じる | `Ctrl+W` | `Cmd+W` | Tauri でウィンドウ close イベント |
| Undo | `Ctrl+Z` | `Cmd+Z` | |
| Redo | `Ctrl+Shift+Z` | `Cmd+Shift+Z` | `Ctrl+Y` も許容 |

---

### 1-5. 表示モード切り替え

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| ソース ↔ WYSIWYG トグル | `Ctrl+/` | `Cmd+/` | Typora 互換 ⚠️ CodeMirror と競合 |
| Typora 式モード | `Ctrl+Alt+1` | `Cmd+Option+1` | 🆕 |
| 常に WYSIWYG モード | `Ctrl+Alt+2` | `Cmd+Option+2` | 🆕 |
| 常にソースモード | `Ctrl+Alt+3` | `Cmd+Option+3` | 🆕 |
| サイドバイサイド | `Ctrl+Alt+4` | `Cmd+Option+4` | 🆕 |
| フォーカスモード | `F8` | `F8` | Typora 互換 |
| タイプライターモード | `F9` | `F9` | Typora 互換 |
| フルスクリーン | `F11` | `Ctrl+Cmd+F` | OS 依存 |

---

### 1-6. ナビゲーション・検索

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| 検索 | `Ctrl+F` | `Cmd+F` | ⚠️ WebView 組み込み検索を preventDefault |
| 検索・置換 | `Ctrl+H` | `Cmd+Shift+H` | ⚠️ macOS で `Cmd+H` は「隠す」なので変更 |
| アウトラインパネル | `Ctrl+Shift+O` | `Cmd+Shift+O` | 🆕 |
| 前の見出しへ | `Ctrl+[` | `Cmd+[` | 🆕 |
| 次の見出しへ | `Ctrl+]` | `Cmd+]` | 🆕 |
| ドキュメント先頭へ | `Ctrl+Home` | `Cmd+Up` | |
| ドキュメント末尾へ | `Ctrl+End` | `Cmd+Down` | |

---

### 1-7. 行ブックマーク

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| ブックマークのトグル | `Ctrl+F2` | `Cmd+F2` | カーソル行をブックマーク追加/削除。ガタークリックでも同操作 🆕 |
| 次のブックマークへ | `F2` | `F2` | 末尾に達したら先頭に戻る 🆕 |
| 前のブックマークへ | `Shift+F2` | `Shift+F2` | 先頭に達したら末尾に戻る 🆕 |

---

### 1-8. ソースモード限定（CodeMirror 6）

以下のショートカットはソースモードでのみ有効。WYSIWYG モードでは無視される。

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| 矩形選択（マウス） | `Alt+ドラッグ` | `Option+ドラッグ` | `@codemirror/rectangular-selection` 使用 🆕 |
| 矩形選択（キーボード） | `Alt+Shift+↑↓←→` | `Option+Shift+↑↓←→` | キーボードで矩形範囲を拡張 🆕 |
| マルチカーソル追加 | `Ctrl+Alt+↑` / `Ctrl+Alt+↓` | `Cmd+Option+↑` / `Cmd+Option+↓` | カーソルを上/下行に複製 🆕 |

---

### 1-9. テキスト補完

| 操作 | Windows | macOS (Phase 2) | 備考 |
|------|---------|-----------------|------|
| 単語補完を表示 | `Ctrl+Space` | `Cmd+Space` | ⚠️ macOS では Spotlight と競合。`Cmd+Option+Space` に変更検討 🆕 |
| 補完を確定 | `Tab` / `Enter` | `Tab` / `Enter` | 補完ポップアップ表示時のみ |
| 補完を閉じる | `Esc` | `Esc` | |

---

## 2. 競合ショートカットの整理と解決策

### 2-1. TipTap（ProseMirror）デフォルトとの競合

| キー | TipTap デフォルト挙動 | 本プロジェクトの意図 | 対処 |
|------|----------------------|---------------------|------|
| `Tab` | ListItem のインデント | テーブル移動 / リストインデント / コードインデント | `editor.isActive()` で文脈判定し上書き（後述） |
| `Mod-Shift-Z` | Redo（StarterKit） | Redo | そのまま利用 |
| `Enter` | 段落分割 | リスト項目作成 / テーブル行追加 | StarterKit の挙動を維持しつつ、テーブル内を上書き |
| `Backspace` | 前文字削除 | リスト解除 / 見出し → 段落 | StarterKit に任せ、必要なら追加 Extension で補完 |

**解決策**: StarterKit の `keyboardShortcuts` を無効化せず、**より高い priority の Extension を追加**して文脈依存の挙動を前置する。

```typescript
// 文脈依存 Tab の実装例
const ContextualTab = Extension.create({
  name: 'contextualTab',
  priority: 1000, // StarterKit より高く設定

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
          return editor.commands.goToNextCell()
        }
        if (editor.isActive('listItem')) {
          return editor.commands.sinkListItem('listItem')
        }
        if (editor.isActive('codeBlock')) {
          // ソースモードに移譲（後述）
          return false
        }
        return false // それ以外はデフォルトに任せる
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
          return editor.commands.goToPreviousCell()
        }
        if (editor.isActive('listItem')) {
          return editor.commands.liftListItem('listItem')
        }
        return false
      },
    }
  },
})
```

---

### 2-2. CodeMirror 6 デフォルトとの競合

CodeMirror 6 はソースモード（`EditorView`）で以下を独自に処理する：

| キー | CodeMirror デフォルト | 競合するアプリ機能 | 解決策 |
|------|-----------------------|-------------------|--------|
| `Ctrl+/` | 行コメントのトグル（`@codemirror/commands`） | ソース ↔ WYSIWYG 切り替え | **CM の `keymap` から削除**し、アプリレイヤーで処理 |
| `Ctrl+Shift+K` | 行削除（VSCode 互換キーマップ） | コードブロック挿入（WYSIWYG のみ） | ソースモードでは競合なし（WYSIWYG でのみ定義）。CM の `vscodeKeymap` を使う場合は除外 |
| `Ctrl+F` | 検索パネル（`@codemirror/search`） | アプリ共通の検索 UI | **CM に検索パネルを使わず**、アプリ側の検索バーに統一 |
| `Ctrl+H` | 置換パネル（`@codemirror/search`） | アプリ共通の検索・置換 UI | 同上 |
| `Ctrl+D` | 次の出現箇所を選択 | 未定義（WYSIWYG） | ソースモードでは CM のまま維持 |
| `Alt+Up/Down` | 行を上下に移動 | ブロック移動（WYSIWYG） | ソースモードでは CM のまま維持 |

**CodeMirror からキーを除外する実装例**：

```typescript
import { keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'

// Ctrl+/ と検索キーを除いたキーマップ
const filteredKeymap = keymap.of([
  // searchKeymap を丸ごと除外（アプリ側で管理）
  ...defaultKeymap.filter(
    (binding) =>
      binding.key !== 'Ctrl-/' &&
      binding.mac !== 'Cmd-/'
  ),
  ...historyKeymap,
  // searchKeymap はここに追加しない
])

// Ctrl+/ はアプリレイヤーで処理（Tauri のイベント or React のハンドラ）
```

---

### 2-3. OS・WebView レベルの競合

| キー | OS/WebView の挙動 | 対処 |
|------|------------------|------|
| `Ctrl+P` | 印刷ダイアログ（OS） | Tauri の `prevent_default_on_key` or フロントエンドで `e.preventDefault()` |
| `Ctrl+F` | WebView 組み込み検索 | Tauri v2: `WebviewWindow::set_browser_accelerator_keys(false)` |
| `Ctrl+R` / `F5` | WebView リロード | Tauri の設定で無効化（リリースビルド）。開発時は許容 |
| `Ctrl+W` | タブ/ウィンドウを閉じる | Tauri ウィンドウの `on_close_requested` で保存確認ダイアログを表示 |
| `Alt+F4` | ウィンドウを閉じる（Windows） | 同上 |
| `Cmd+H` | ウィンドウを隠す（macOS） | ハイライト (`Ctrl+Shift+H`) との直接競合なし。macOS では代替キーを検討 |
| `Cmd+M` | ウィンドウを最小化（macOS） | アプリ側で特定用途に使わなければ問題なし |

**Tauri v2 での WebView ショートカット無効化設定例**：

```rust
// src-tauri/src/main.rs
use tauri::WebviewWindowBuilder;

WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::App("index.html".into()))
    .browser_extensions_enabled(false) // 拡張機能の干渉を防ぐ
    .build()?;
```

```typescript
// フロントエンドで特定キーを横取り
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault()
    openQuickOpen()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    openSearchPanel()
  }
}, { capture: true }) // capture: true で最上位から処理
```

### 2-4. IME 変換中のショートカット制御

日本語・中国語・韓国語 IME の変換中（composition 中）に、`Backspace`・`Enter`・`Space`・`Ctrl+B` 等の
エディタショートカットが意図せず発火することがある。これを防ぐため、すべてのショートカットハンドラに
`isComposing` チェックを組み込む。

**基本方針**: `KeyboardEvent.isComposing === true` の場合はショートカットを発火しない。
ただし TipTap/ProseMirror は内部的に `compositionstart/compositionend` を処理するため、
カスタムキーバインドを追加する際のみ明示的なガードが必要。

```typescript
// TipTap のカスタムキーバインド例（src/editor/keybindings.ts）
import { Extension } from '@tiptap/core';

export const CustomKeybindings = Extension.create({
  addKeyboardShortcuts() {
    return {
      // Ctrl+B: 太字（TipTap デフォルトは isComposing を考慮しているが、
      // カスタム拡張では明示的に確認する）
      'Ctrl-b': ({ editor }) => {
        // ProseMirror の keydown ハンドラは compositionevent 中は呼ばれないため
        // 基本的にガード不要。ただし独自の document.addEventListener では必要。
        return editor.commands.toggleBold();
      },
    };
  },
});

// document レベルの独自イベントリスナーには必ずガードを入れる
document.addEventListener('keydown', (e) => {
  if (e.isComposing) return; // ← IME 変換中はすべてのショートカットをスキップ

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    openSearchPanel();
  }
  // ... 他のショートカット
}, { capture: true });
```

**注意点**:
- `Backspace` と `Enter` は IME 変換中も特定の操作（変換候補の選択・キャンセル）に使われるため、
  ProseMirror/TipTap の内部ハンドラに委ねる（独自実装しない）
- `Space` は変換中は変換確定に使われるため、カスタムの `Space` ショートカットには
  `e.isComposing` ガードを必ず設ける
- `isComposing` の検知は `text-statistics-design.md §4` の自動保存スキップ（IME 入力中の保存遅延）
  と同じ仕組みで実装できる

---

## 3. モード別の挙動差異と実装上の対処

### 3-1. 挙動差異マトリクス

| キー | Typora 式 / 常に WYSIWYG | ソースモード (CM6) | サイドバイサイド |
|------|--------------------------|-------------------|----------------|
| `Tab` | リストインデント / テーブルセル移動 | コードインデント（スペース/タブ） | ソース側 CM の挙動 |
| `Shift+Tab` | リストデインデント / テーブル逆移動 | コードデインデント | 同上 |
| `Enter` | 段落分割 / リスト項目作成 | 改行挿入 | 同上 |
| `Ctrl+/` | ソースモードへ切り替え | WYSIWYG モードへ切り替え | 使用しない / F キーで代替 |
| `Ctrl+D` | 未割り当て（選択肢: 重複行） | 次の出現選択（CM デフォルト） | ソース側 CM の挙動 |
| `` Ctrl+` `` | インラインコード挿入 | CM のコードフォールディング等 | — |
| `Backspace` | 段落先頭でブロック解除 | 文字削除 | — |
| `Alt+Up/Down` | ブロック移動 | 行移動（CM デフォルト） | ソース側 CM の挙動 |
| `Home` / `End` | 行頭/行末（ProseMirror） | 行頭/行末（仮想行対応・CM） | — |

---

### 3-2. モード切り替えの実装アーキテクチャ

```
┌─────────────────────────────────────────┐
│           ShortcutManager               │
│  ┌────────────┐    ┌──────────────────┐ │
│  │ TipTap     │    │ CodeMirror 6     │ │
│  │ Extensions │    │ Keymap           │ │
│  └────────────┘    └──────────────────┘ │
│         ↑                  ↑            │
│         │    モード判定     │            │
│  ┌──────┴──────────────────┴────────┐   │
│  │       GlobalKeyHandler           │   │
│  │  (document keydown, capture:true)│   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**グローバルキーハンドラ**がモードを判定し、適切なエンジンにルーティングする：

```typescript
type EditorMode = 'typora' | 'wysiwyg' | 'source' | 'split'

class ShortcutManager {
  private mode: EditorMode = 'typora'

  handleGlobalKeydown(e: KeyboardEvent): void {
    // モード切り替えキーは常に最優先
    if (this.isModeToggle(e)) {
      e.preventDefault()
      this.handleModeToggle(e)
      return
    }

    // ソースモード中は CodeMirror に任せる（基本的に干渉しない）
    if (this.mode === 'source') {
      // Ctrl+/ だけは横取り
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        this.switchToWysiwyg()
      }
      return
    }

    // WYSIWYG 系モードは TipTap の Extension に委譲
    // （document イベントはここでは何もしない）
  }

  private isModeToggle(e: KeyboardEvent): boolean {
    return (e.ctrlKey || e.metaKey) && e.altKey && ['1','2','3','4'].includes(e.key)
  }
}
```

---

### 3-3. 重要キーの詳細挙動

#### `Backspace` — ブロック先頭での挙動

```typescript
// WYSIWYG: 段落先頭の Backspace でブロックタイプを降格
const SmartBackspace = Extension.create({
  name: 'smartBackspace',
  priority: 900,

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $anchor, empty } = editor.state.selection
        if (!empty || $anchor.parentOffset !== 0) return false

        // 見出し → 段落
        if (editor.isActive('heading')) {
          return editor.commands.setParagraph()
        }
        // リスト項目 → リスト解除（TipTap StarterKit に任せる）
        return false
      },
    }
  },
})
```

#### `Tab` — 包括的な文脈判定

```typescript
// （前掲の ContextualTab を拡張）
Tab: ({ editor }) => {
  // 優先度: テーブル > リスト > コードブロック > 段落
  if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
    return editor.commands.goToNextCell()
  }
  if (editor.isActive('listItem')) {
    return editor.commands.sinkListItem('listItem')
  }
  // codeBlock 内では何もしない（TipTap のデフォルトは Tab 挿入しない）
  if (editor.isActive('codeBlock')) {
    return false // ブラウザのデフォルトフォーカス移動も防ぎたいなら true を返す
  }
  return false
},
```

#### `Ctrl+/` — モードトグル vs CM コメント

```
WYSIWYG モード時:
  Ctrl+/ → ソースモードへ遷移（GlobalKeyHandler が処理）

ソースモード時:
  Ctrl+/ → WYSIWYG モードへ遷移（GlobalKeyHandler が横取り、CM には渡さない）
  ※ CM のコメントトグルは発火しない
```

---

## 4. TipTap カスタムショートカット実装ベストプラクティス

### 4-1. Extension 設計の基本

```typescript
import { Extension } from '@tiptap/core'

/**
 * ルール:
 * 1. Mod = Ctrl (Win/Linux) / Cmd (macOS)  →  クロスプラットフォーム対応
 * 2. return true  = イベントを消費（他の handler に渡さない）
 * 3. return false = このキーは処理しない（次の handler へ）
 * 4. priority が高い Extension が先に処理される（デフォルト: 100）
 */
const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',
  priority: 200, // StarterKit(100) より高く、contextualTab(1000) より低く

  addKeyboardShortcuts() {
    return {
      // ---- インライン装飾 ----
      'Mod-Shift-s': () =>
        this.editor.chain().focus().toggleStrike().run(),

      'Mod-Shift-`': () =>
        this.editor.chain().focus().toggleCode().run(),

      'Mod-Shift-h': () =>
        this.editor.chain().focus().toggleHighlight().run(),

      'Mod-\\': () =>
        this.editor.chain().focus().unsetAllMarks().run(),

      // ---- ブロック: 見出し ----
      'Mod-0': () =>
        this.editor.chain().focus().setParagraph().run(),

      'Mod-1': () =>
        this.editor.chain().focus().toggleHeading({ level: 1 }).run(),

      'Mod-2': () =>
        this.editor.chain().focus().toggleHeading({ level: 2 }).run(),

      'Mod-3': () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),

      'Mod-4': () =>
        this.editor.chain().focus().toggleHeading({ level: 4 }).run(),

      'Mod-5': () =>
        this.editor.chain().focus().toggleHeading({ level: 5 }).run(),

      'Mod-6': () =>
        this.editor.chain().focus().toggleHeading({ level: 6 }).run(),

      // ---- ブロック: その他 ----
      'Mod-Shift-q': () =>
        this.editor.chain().focus().toggleBlockquote().run(),

      'Mod-Shift-k': () =>
        this.editor.chain().focus().toggleCodeBlock().run(),

      'Mod-Shift-[': () =>
        this.editor.chain().focus().toggleOrderedList().run(),

      'Mod-Shift-]': () =>
        this.editor.chain().focus().toggleBulletList().run(),

      // ---- テーブル ----
      'Mod-Enter': ({ editor }) => {
        if (editor.isActive('table')) {
          return editor.chain().focus().addRowAfter().run()
        }
        return false // テーブル外では通常の改行に委ねる
      },

      'Mod-Shift-Enter': ({ editor }) => {
        if (editor.isActive('table')) {
          return editor.chain().focus().addRowBefore().run()
        }
        return false
      },
    }
  },
})
```

---

### 4-2. 競合解決パターン集

#### パターン A: 既存ショートカットを完全上書き

```typescript
// StarterKit の Mod-b をまず無効化してから再定義
const OverrideBold = Extension.create({
  name: 'overrideBold',
  priority: 1000, // StarterKit より必ず高く

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => {
        // カスタム処理
        console.log('custom bold')
        return this.editor.chain().focus().toggleBold().run()
      },
    }
  },
})
```

#### パターン B: 文脈によって処理を分岐

```typescript
'Alt-Up': ({ editor }) => {
  // テーブル内: 行を上に移動
  if (editor.isActive('table')) {
    return editor.chain().focus().moveRowUp().run()
  }
  // リスト内: リスト項目を上に移動（将来実装）
  if (editor.isActive('listItem')) {
    // カスタムコマンドを呼ぶ
    return editor.commands.moveListItemUp()
  }
  return false
},
```

#### パターン C: カスタムコマンドの定義と組み合わせ

```typescript
// commands に独自コマンドを追加
const TableCommands = Extension.create({
  name: 'tableCommands',

  addCommands() {
    return {
      moveRowUp:
        () =>
        ({ commands }) => {
          return commands.chain()
            .deleteRow()      // 現在行を削除
            // ... 実際は ProseMirror の Transaction で実装
            .run()
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Alt-Up': ({ editor }) => {
        if (editor.isActive('table')) {
          return editor.commands.moveRowUp()
        }
        return false
      },
    }
  },
})
```

---

### 4-3. ショートカット設定の外部化（ユーザーカスタマイズ対応）

将来的にユーザーがキーを変更できるようにするため、ハードコードを避ける：

```typescript
// types/shortcuts.ts
export interface ShortcutConfig {
  bold: string           // 'Mod-b'
  italic: string         // 'Mod-i'
  heading1: string       // 'Mod-1'
  // ...
}

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  bold: 'Mod-b',
  italic: 'Mod-i',
  heading1: 'Mod-1',
  // ...
}

// Extension でコンフィグを受け取る
const MarkdownShortcuts = Extension.create<{ shortcuts: ShortcutConfig }>({
  name: 'markdownShortcuts',

  addOptions() {
    return { shortcuts: DEFAULT_SHORTCUTS }
  },

  addKeyboardShortcuts() {
    const s = this.options.shortcuts
    return {
      [s.bold]: () => this.editor.chain().focus().toggleBold().run(),
      [s.heading1]: () =>
        this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
    }
  },
})

// 使用時
editor = new Editor({
  extensions: [
    MarkdownShortcuts.configure({
      shortcuts: userPreferences.shortcuts ?? DEFAULT_SHORTCUTS,
    }),
  ],
})
```

---

### 4-4. デバッグとテスト

```typescript
// 開発時: どの Extension がキーを処理したか確認する
const ShortcutDebugger = Extension.create({
  name: 'shortcutDebugger',
  priority: 9999, // 最高優先度で監視のみ

  addKeyboardShortcuts() {
    return {
      // すべてのキーを傍受してログ出力し、false を返して処理は通常通り続ける
      // ※ ProseMirror では "catch-all" は不可能なので、問題のあるキーを個別に追加
    }
  },
})

// Vitest でショートカットをテスト
import { Editor } from '@tiptap/core'
import { test, expect } from 'vitest'

test('Ctrl+1 で H1 に変換される', () => {
  const editor = new Editor({ extensions: [/* ... */] })
  editor.commands.setContent('<p>Hello</p>')
  editor.commands.setTextSelection(3)

  // キーイベントをシミュレート
  editor.view.dispatchEvent(
    new KeyboardEvent('keydown', { key: '1', ctrlKey: true })
  )

  expect(editor.isActive('heading', { level: 1 })).toBe(true)
})
```

---

## 5. まとめ：実装優先度

| フェーズ | 実装内容 | 対応キー |
|---------|---------|---------|
| **Phase 1 (MVP)** | 基本インライン装飾 + 見出し | `Ctrl+B/I/U`, `Ctrl+1〜6`, `Ctrl+S/Z` |
| **Phase 1** | ソースモード切替 | `Ctrl+/`（GlobalKeyHandler で実装） |
| **Phase 2** | テーブル操作 | `Tab`, `Ctrl+Enter`, `Ctrl+Shift+Backspace` |
| **Phase 2** | ブロック操作全般 | `Ctrl+Shift+Q/K/[/]` |
| **Phase 3** | ナビゲーション | `Ctrl+F/H/P`, アウトライン |
| **Phase 3** | 表示モード | `Ctrl+Alt+1〜4` |
| **将来** | ユーザー設定可能なキーバインド | `ShortcutConfig` の外部化 |

---

## 6. ショートカットカスタマイズ UX 設計

### 6.1 設定 UI

```
設定 → キーボードショートカット

┌─────────────────────────────────────────────────────────────────┐
│  キーボードショートカット              [デフォルトに戻す] [検索] │
├──────────────────────┬────────────────┬─────────────────────────┤
│  コマンド             │ ショートカット  │                         │
├──────────────────────┼────────────────┼─────────────────────────┤
│  テキスト装飾                                                   │
│  太字                 │ Ctrl+B         │ [変更]                  │
│  斜体                 │ Ctrl+I         │ [変更]                  │
│  取り消し線           │ Alt+Shift+5    │ [変更]                  │
│  ハイライト           │ Ctrl+Shift+H   │ [変更]                  │
├──────────────────────┼────────────────┼─────────────────────────┤
│  ブロック操作                                                   │
│  見出し H1            │ Ctrl+1         │ [変更]                  │
│  コードブロック       │ Ctrl+Shift+K   │ [変更]                  │
└──────────────────────┴────────────────┴─────────────────────────┘
```

### 6.2 ショートカット変更ダイアログ

```
┌────────────────────────────────────────┐
│  「太字」のショートカットを変更         │
├────────────────────────────────────────┤
│                                        │
│  新しいキーを押してください:            │
│  ┌──────────────────────────────────┐  │
│  │  Ctrl+B                          │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ⚠ Ctrl+B は他のコマンドで使用中はありません │
│                                        │
│  [キャンセル]  [クリア]  [保存]        │
└────────────────────────────────────────┘
```

**競合検出:**
```typescript
function detectConflict(
  newKey: string,
  commandId: string,
  allShortcuts: ShortcutConfig
): string | null {
  for (const [id, key] of Object.entries(allShortcuts)) {
    if (id !== commandId && key === newKey) {
      return id; // 競合するコマンド ID を返す
    }
  }
  return null;
}
```

競合がある場合:
```
⚠ Ctrl+B は「太字（上書き前）」に割り当てられています。
  上書きしますか？
```

### 6.3 ショートカット設定の永続化

```typescript
// src/settings/shortcuts-store.ts
import { Store } from '@tauri-apps/plugin-store';

const store = new Store('settings.json');

export async function loadShortcuts(): Promise<Partial<ShortcutConfig>> {
  return await store.get<Partial<ShortcutConfig>>('keyboardShortcuts') ?? {};
}

export async function saveShortcut(
  commandId: keyof ShortcutConfig,
  key: string | null  // null でリセット（デフォルトを使用）
): Promise<void> {
  const current = await loadShortcuts();
  if (key === null) {
    delete current[commandId];
  } else {
    current[commandId] = key;
  }
  await store.set('keyboardShortcuts', current);
  await store.save();
}

export async function resetAllShortcuts(): Promise<void> {
  await store.delete('keyboardShortcuts');
  await store.save();
}
```

### 6.4 カスタムショートカットの TipTap への適用

```typescript
// src/editor/setup.ts
import { DEFAULT_SHORTCUTS, ShortcutConfig } from '../types/shortcuts';
import { loadShortcuts } from '../settings/shortcuts-store';

async function buildShortcutConfig(): Promise<ShortcutConfig> {
  const userOverrides = await loadShortcuts();
  return { ...DEFAULT_SHORTCUTS, ...userOverrides };
}

// アプリ起動時 & 設定変更時に呼び出す
export async function initEditor() {
  const shortcuts = await buildShortcutConfig();

  const editor = new Editor({
    extensions: [
      StarterKit,
      MarkdownShortcuts.configure({ shortcuts }),
      ContextualTab,
    ],
  });

  return editor;
}
```

### 6.5 ショートカット設定のエクスポート・インポート

Phase 7 以降で検討:

```typescript
// JSON ファイルとしてエクスポート
export async function exportShortcuts(): Promise<void> {
  const shortcuts = await loadShortcuts();
  const json = JSON.stringify(shortcuts, null, 2);
  const path = await save({ filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (path) await writeTextFile(path, json);
}

// JSON ファイルからインポート
export async function importShortcuts(): Promise<void> {
  const path = await open({ filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (!path || Array.isArray(path)) return;
  const json = await readTextFile(path as string);
  const shortcuts = JSON.parse(json) as Partial<ShortcutConfig>;
  // バリデーション後に保存
  await store.set('keyboardShortcuts', shortcuts);
  await store.save();
}
```
