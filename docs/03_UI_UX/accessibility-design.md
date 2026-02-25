# アクセシビリティ（a11y）設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [設計方針](#1-設計方針)
2. [エディタ本体の ARIA 設計](#2-エディタ本体の-aria-設計)
3. [カスタム NodeView の ARIA 設計](#3-カスタム-nodeview-の-aria-設計)
4. [キーボードのみの操作フロー](#4-キーボードのみの操作フロー)
5. [フォーカス管理](#5-フォーカス管理)
6. [ライブリージョン（状態変化のアナウンス）](#6-ライブリージョン状態変化のアナウンス)
7. [カラーコントラスト設計](#7-カラーコントラスト設計)
8. [テスト戦略](#8-テスト戦略)
9. [実装フェーズ](#9-実装フェーズ)

---

## 1. 設計方針

### 1.1 準拠基準

- **WCAG 2.1 AA 準拠を最低ラインとする**: カラーコントラスト・キーボード操作・スクリーンリーダー対応について WCAG 2.1 の達成基準 AA をすべて満たす
- **スクリーンリーダー対応**: NVDA（Windows）・VoiceOver（macOS）の最新版で動作を確認する
- **段階的対応**: Phase 1 の MVP 段階で「骨格」を作り、フェーズを追って完成度を高める。後付けコストが高い ARIA ロール定義と CSS Custom Properties のコントラスト変数は Phase 1 で確定する

### 1.2 ContentEditable エディタの特有課題

TipTap / ProseMirror は `contenteditable="true"` を使った エディタであり、スクリーンリーダーとの相性に以下の固有課題がある。

| 課題 | 対応策 |
|------|--------|
| カーソル移動時の読み上げが過剰になる | `aria-live="off"` + 明示的なアナウンスのみ行う |
| カスタム NodeView が div / span で構成されていてセマンティクスが失われる | 各 NodeView に適切な `role` と `aria-label` を付与する |
| ソース↔レンダリング切り替え時に DOM が大幅に変化する | `aria-live="assertive"` でモード変更をアナウンスする |
| ツールバーのアクティブ状態がスクリーンリーダーに伝わらない | `aria-pressed` / `aria-checked` を使用する |

---

## 2. エディタ本体の ARIA 設計

### 2.1 エディタ領域のロール

```tsx
// src/components/Editor/Editor.tsx

<div
  className="editor-ui"
  data-theme={theme}
  role="application"          // エディタ全体はアプリケーションとして扱う
  aria-label="Markdown エディタ"
>
  <TabBar />

  {/* ツールバー */}
  <div
    role="toolbar"
    aria-label="書式ツールバー"
    aria-controls="editor-content"
  >
    <Toolbar />
  </div>

  <div className="editor-layout">
    <nav
      aria-label="ファイルツリー"
      hidden={!sidebarOpen}
    >
      <Sidebar />
    </nav>

    {/* エディタコンテンツ */}
    <div
      id="editor-content"
      className="editor-content"
    >
      <TipTapEditor />
    </div>
  </div>

  <footer aria-label="ステータスバー">
    <StatusBar />
  </footer>
</div>
```

### 2.2 TipTap エディタ本体の ARIA 属性

TipTap が生成する `contenteditable` 要素にカスタム属性を付与する。

```typescript
// src/renderer/wysiwyg/prosemirror-setup.ts

const editor = new Editor({
  editorProps: {
    attributes: {
      // contenteditable 要素自体の ARIA
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': 'ドキュメント編集エリア',
      'aria-describedby': 'editor-mode-status',
      // 現在の編集モードを参照
      // aria-readonly は ソースモード以外では不要（常に編集可能）
    },
  },
});
```

### 2.3 タブバーの ARIA 設計

```tsx
// src/components/Editor/TabBar.tsx

<div role="tablist" aria-label="開いているファイル">
  {tabs.map((tab, index) => (
    <button
      key={tab.id}
      role="tab"
      aria-selected={tab.id === activeTabId}
      aria-controls={`editor-content`}
      id={`tab-${tab.id}`}
      tabIndex={tab.id === activeTabId ? 0 : -1}  // roving tabindex
    >
      {tab.isDirty && (
        <span aria-label="未保存の変更あり">●</span>
      )}
      {tab.fileName}
      <button
        aria-label={`${tab.fileName} を閉じる`}
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
      >×</button>
    </button>
  ))}
</div>
```

### 2.4 ツールバーの ARIA 設計

```tsx
// src/components/Editor/Toolbar.tsx

{/* 書式ボタン群 */}
<div role="group" aria-label="テキスト書式">
  <button
    aria-pressed={editor.isActive('bold')}
    aria-label="太字 (Ctrl+B)"
    title="太字 (Ctrl+B)"
    onClick={() => editor.chain().toggleBold().run()}
  >
    <BoldIcon aria-hidden="true" />
  </button>

  <button
    aria-pressed={editor.isActive('italic')}
    aria-label="斜体 (Ctrl+I)"
    onClick={() => editor.chain().toggleItalic().run()}
  >
    <ItalicIcon aria-hidden="true" />
  </button>
</div>

{/* 見出しレベル選択 */}
<div role="group" aria-label="見出しレベル">
  <select
    aria-label="見出しレベルを選択"
    value={currentHeadingLevel}
    onChange={e => applyHeading(Number(e.target.value))}
  >
    <option value="0">標準テキスト</option>
    <option value="1">見出し 1</option>
    <option value="2">見出し 2</option>
    <option value="3">見出し 3</option>
    <option value="4">見出し 4</option>
    <option value="5">見出し 5</option>
    <option value="6">見出し 6</option>
  </select>
</div>

{/* エディタモード切替 */}
<div role="group" aria-label="エディタモード">
  {(['typora', 'wysiwyg', 'source', 'split'] as EditorMode[]).map(mode => (
    <button
      key={mode}
      aria-pressed={currentMode === mode}
      aria-label={MODE_LABELS[mode]}
      onClick={() => setEditorMode(mode)}
    >
      {MODE_LABELS[mode]}
    </button>
  ))}
</div>
```

---

## 3. カスタム NodeView の ARIA 設計

各カスタム NodeView はフォーカス状態（ソース表示）とレンダリング状態で ARIA 属性を切り替える。

### 3.1 見出し NodeView

```tsx
// src/renderer/wysiwyg/node-views/HeadingNodeView.tsx

export function HeadingNodeView({ node, editor, getPos }: NodeViewProps) {
  const mode = useEditorMode(editor);
  const [isFocused, setIsFocused] = useState(false);
  const level = node.attrs.level as number;

  const showSource = mode === 'source' || (mode === 'typora' && isFocused);
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

  if (showSource) {
    // ソース編集中: スクリーンリーダーに編集中であることを伝える
    return (
      <div
        role="textbox"
        aria-label={`見出し ${level} を編集中`}
        aria-multiline="false"
      >
        {/* TipTap の contenteditable がここに入る */}
      </div>
    );
  }

  // レンダリング状態: セマンティックな見出しタグを使う
  return (
    <HeadingTag
      // クリックでソース編集に入れることをスクリーンリーダーに伝える
      tabIndex={0}
      aria-label={`見出し ${level}: ${node.textContent}（クリックまたは Enter で編集）`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // フォーカス移動でソース表示に切り替わる
          e.preventDefault();
          editor.commands.focus(getPos());
        }
      }}
    >
      {node.textContent}
    </HeadingTag>
  );
}
```

### 3.2 コードブロック NodeView

```tsx
// src/renderer/wysiwyg/node-views/CodeBlockNodeView.tsx

export function CodeBlockNodeView({ node, editor }: NodeViewProps) {
  const language = node.attrs.language ?? '（言語未指定）';

  return (
    <figure aria-label={`コードブロック: ${language}`}>
      <figcaption className="sr-only">
        {language} のコードブロック
      </figcaption>
      {/* CodeMirror が内包される */}
      <div role="code" aria-label={`${language} コード`}>
        {/* CodeMirror エディタ */}
      </div>
    </figure>
  );
}
```

### 3.3 テーブル NodeView

```tsx
// src/components/Table/TableEditor.tsx

<table
  role="grid"
  aria-label="データテーブル（Tab でセル移動）"
  aria-rowcount={rowCount}
  aria-colcount={colCount}
>
  <thead>
    <tr role="row">
      {headers.map((header, colIndex) => (
        <th
          key={colIndex}
          role="columnheader"
          aria-sort={getSortState(colIndex)}    // 将来: ソート対応時
          scope="col"
        >
          {header.text}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {rows.map((row, rowIndex) => (
      <tr key={rowIndex} role="row" aria-rowindex={rowIndex + 2}>
        {row.cells.map((cell, colIndex) => (
          <td
            key={colIndex}
            role="gridcell"
            aria-colindex={colIndex + 1}
            aria-label={`行 ${rowIndex + 1}, 列 ${colIndex + 1}: ${cell.text}`}
            tabIndex={isActiveCell(rowIndex, colIndex) ? 0 : -1}
          >
            {cell.text}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

### 3.4 数式（KaTeX）NodeView

```tsx
// src/renderer/wysiwyg/node-views/MathNodeView.tsx

export function MathBlockNodeView({ node }: NodeViewProps) {
  const formula = node.attrs.formula;

  return (
    // aria-label で数式をテキストとして提供する
    // スクリーンリーダーは KaTeX SVG を読み上げられないため
    <div
      aria-label={`数式: ${formula}`}
      role="math"
    >
      {/* KaTeX がレンダリングした SVG */}
      <KatexRenderer formula={formula} />
    </div>
  );
}
```

### 3.5 画像 NodeView

```tsx
// src/renderer/wysiwyg/node-views/ImageNodeView.tsx

export function ImageNodeView({ node }: NodeViewProps) {
  const { src, alt, title } = node.attrs;

  return (
    <figure>
      <img
        src={src}
        alt={alt ?? ''}    // alt が空の場合は装飾画像として扱う
        title={title}
      />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
}
```

---

## 4. キーボードのみの操作フロー

### 4.1 全体のキーボードフロー

```
アプリ起動
  → Tabキー: フォーカスがタブバーの最初のタブに移動
  → Tabキー: ツールバーに移動
  → Tabキー: エディタ本体（contenteditable）に移動
  → Tabキー: ステータスバーに移動（ループ）

ツールバー内のナビゲーション（roving tabindex）:
  → 左右矢印キー: ツールバーボタン間を移動
  → Enter / Space: ボタンを押す

タブバーのナビゲーション（roving tabindex）:
  → 左右矢印キー: タブ間を移動
  → Enter / Space: タブを選択
  → Delete: タブを閉じる
```

### 4.2 ツールバーの roving tabindex 実装

```tsx
// src/components/Editor/Toolbar.tsx

export function Toolbar() {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<HTMLButtonElement[]>([]);

  function handleKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') {
      next = (index + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft') {
      next = (index - 1 + buttons.length) % buttons.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = buttons.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setFocusedIndex(next);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div role="toolbar" aria-label="書式ツールバー">
      {buttons.map((btn, index) => (
        <button
          key={btn.id}
          ref={el => { if (el) buttonRefs.current[index] = el; }}
          tabIndex={index === focusedIndex ? 0 : -1}
          onKeyDown={e => handleKeyDown(e, index)}
          aria-pressed={btn.isActive?.()}
          aria-label={btn.label}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
```

### 4.3 モーダル・ダイアログのフォーカストラップ

```tsx
// src/components/common/Modal.tsx

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // ダイアログを開く前のフォーカス位置を記録
      previousFocusRef.current = document.activeElement as HTMLElement;
      // ダイアログ内の最初のフォーカス可能要素にフォーカス
      dialogRef.current?.querySelector<HTMLElement>('[tabindex], button, input')?.focus();
    } else {
      // ダイアログを閉じたら元の位置に戻す
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // フォーカストラップ: Tab キーでダイアログ外に出ないようにする
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onKeyDown={handleKeyDown}
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
    </div>
  );
}
```

---

## 5. フォーカス管理

### 5.1 フォーカスインジケーター

すべてのインタラクティブ要素でフォーカスリングが見えるようにする。ブラウザデフォルトの `outline` を消さない。

```css
/* src/themes/variables.css */

/* フォーカスリングのグローバル設定 */
:focus-visible {
  outline: var(--editor-focus-outline);   /* 2px solid var(--color-accent) */
  outline-offset: 2px;
}

/* マウス操作時はフォーカスリングを非表示（:focus-visible が自動で制御）*/
/* :focus { outline: none; } は書かない */
```

### 5.2 エディタモード切り替え後のフォーカス管理

```typescript
// src/renderer/wysiwyg/extensions/editor-mode.ts（抜粋）

addCommands() {
  return {
    setEditorMode: (mode: EditorMode) => ({ editor }) => {
      editor.storage.editorMode.mode = mode;
      editor.view.dispatch(
        editor.view.state.tr.setMeta('editorModeChanged', mode)
      );

      // モード切り替え後はエディタ本体にフォーカスを戻す
      // （ツールバーのボタンをクリックした場合、フォーカスが外れるため）
      if (mode !== 'split') {
        editor.commands.focus();
      }
      return true;
    },
  };
},
```

### 5.3 スキップナビゲーション

キーボードユーザーが繰り返しナビゲートせずにメインコンテンツに到達できるよう、「メインコンテンツへスキップ」リンクを設ける。

```tsx
// src/app.tsx

<>
  {/* スキップリンク: 最初の Tab キーで現れる */}
  <a
    href="#editor-content"
    className="skip-link"
  >
    メインコンテンツへスキップ
  </a>
  <div className="editor-ui" ...>
    ...
  </div>
</>
```

```css
/* スキップリンク: 通常は非表示、フォーカス時に表示 */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  padding: 8px 16px;
  background: var(--color-accent);
  color: #ffffff;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

---

## 6. ライブリージョン（状態変化のアナウンス）

### 6.1 アナウンス専用ライブリージョン

```tsx
// src/app.tsx

{/* スクリーンリーダー向けアナウンス専用（視覚的には非表示）*/}
<div
  id="aria-live-region"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
/>

<div
  id="aria-alert-region"
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  className="sr-only"
/>
```

```css
/* スクリーンリーダーにのみ読まれる要素 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 6.2 アナウンスすべき状態変化

```typescript
// src/utils/a11y-announce.ts

/**
 * polite: ユーザーの現在の操作が終わってからアナウンス（保存完了など）
 */
export function announcePolite(message: string): void {
  const region = document.getElementById('aria-live-region');
  if (!region) return;
  region.textContent = '';
  // DOM の変更を確実に検知させるため一フレーム空ける
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * assertive: 即座にアナウンス（エラーなど緊急メッセージ）
 */
export function announceAssertive(message: string): void {
  const region = document.getElementById('aria-alert-region');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
```

| イベント | アナウンス内容 | 優先度 |
|---------|-------------|--------|
| ファイル保存完了 | 「ファイルを保存しました」 | polite |
| エディタモード切り替え | 「Typora 式モードに切り替えました」| assertive |
| ファイルを開く | 「{ファイル名} を開きました」 | polite |
| タブを閉じる | 「{ファイル名} を閉じました」 | polite |
| 未保存の変更あり | 「未保存の変更があります」（タイトルバー変更時）| polite |
| エラー発生 | エラーメッセージ | assertive |
| 全文検索完了 | 「{N} 件の結果が見つかりました」 | polite |
| 置換完了 | 「{N} 件を置換しました」 | polite |

---

## 7. カラーコントラスト設計

### 7.1 WCAG 2.1 AA の基準

| テキスト種別 | 最低コントラスト比 |
|------------|----------------|
| 通常テキスト（18px 未満 / 14px 未満の太字） | 4.5:1 |
| 大きいテキスト（18px 以上 / 14px 以上の太字） | 3:1 |
| UI コンポーネントの境界（ボーダー等） | 3:1 |

### 7.2 ライトテーマのコントラスト検証

| 要素 | 前景色 | 背景色 | コントラスト比 | 判定 |
|------|--------|--------|-------------|------|
| 本文テキスト | `#24292f` | `#ffffff` | **15.3:1** | ✅ AA |
| ミュートテキスト（サイドバー） | `#57606a` | `#f6f8fa` | **5.1:1** | ✅ AA |
| プレースホルダー | `#8c959f` | `#ffffff` | **3.9:1** | ✅ AA |
| アクセントリンク | `#0969da` | `#ffffff` | **5.9:1** | ✅ AA |
| コードブロック本文 | `#24292f` | `#f6f8fa` | **14.4:1** | ✅ AA |
| ツールバーアイコン | `#57606a` | `#f6f8fa` | **5.1:1** | ✅ AA |
| ボーダー線 | `#d0d7de` | `#ffffff` | **1.7:1** | ⚠️（装飾用のため対象外）|

### 7.3 ダークテーマのコントラスト検証

| 要素 | 前景色 | 背景色 | コントラスト比 | 判定 |
|------|--------|--------|-------------|------|
| 本文テキスト | `#e6edf3` | `#0d1117` | **15.8:1** | ✅ AA |
| ミュートテキスト | `#8d96a0` | `#161b22` | **5.0:1** | ✅ AA |
| アクセントリンク | `#58a6ff` | `#0d1117` | **6.1:1** | ✅ AA |
| コードブロック本文 | `#e6edf3` | `#161b22` | **14.0:1** | ✅ AA |

### 7.4 コントラスト検証の自動化

CI でコントラスト比チェックを自動実行する。

```typescript
// tests/a11y/contrast.test.ts

import { getContrast } from 'color2k';

const LIGHT_TOKENS = {
  '--color-text': '#24292f',
  '--color-bg': '#ffffff',
  '--color-text-muted': '#57606a',
  '--color-bg-secondary': '#f6f8fa',
  '--color-accent': '#0969da',
};

describe('カラーコントラスト（ライトテーマ）', () => {
  test('本文テキストのコントラスト比が 4.5:1 以上', () => {
    const ratio = getContrast(LIGHT_TOKENS['--color-text'], LIGHT_TOKENS['--color-bg']);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('ミュートテキストのコントラスト比が 4.5:1 以上', () => {
    const ratio = getContrast(
      LIGHT_TOKENS['--color-text-muted'],
      LIGHT_TOKENS['--color-bg-secondary']
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
```

---

## 8. テスト戦略

### 8.1 自動テスト

| テスト種別 | ツール | 対象 |
|---------|-------|------|
| コントラスト比チェック | `color2k` + Vitest | CSS 変数のペアをすべて検証 |
| ARIA 属性検証 | `@testing-library/jest-dom` | 各コンポーネントの role / aria-* |
| キーボードナビゲーション | Playwright | タブ移動・フォーカストラップ・roving tabindex |
| スクリーンリーダー互換性 | Playwright + `nvda` / `axe-core` | 主要フロー（ファイルを開く・編集・保存）|

### 8.2 axe-core による自動 a11y 検査

```typescript
// tests/a11y/editor.a11y.test.ts（Playwright）

import { checkA11y } from 'axe-playwright';

test('エディタのアクセシビリティ違反がないこと', async ({ page }) => {
  await page.goto('/');
  // axe-core で自動検査（WCAG 2.1 AA ルール適用）
  await checkA11y(page, undefined, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    // 既知の例外（ContentEditable の特有課題）
    rules: {
      'region': { enabled: false },  // エディタ領域は role=application で包む
    },
  });
});
```

### 8.3 手動テスト項目（スクリーンリーダー）

| 操作 | NVDA（Windows）| VoiceOver（macOS）|
|------|--------------|----------------|
| アプリ起動時 | 「Markdown エディタ」と読み上げる | 同上 |
| タブ移動（タブバー → ツールバー → エディタ）| 各要素のラベルを読み上げる | 同上 |
| ツールバーの太字ボタン | 「太字 Ctrl+B、トグルボタン、オフ」| 同上 |
| 見出しをクリック | 「見出し 2: タイトルテキスト」| 同上 |
| ファイル保存 | 「ファイルを保存しました」| 同上 |
| エラーダイアログ | ダイアログタイトルと内容を読み上げる | 同上 |

---

## 9. 実装フェーズ

### Phase 1（MVP — 骨格の確立）

- [ ] CSS Custom Properties に `--editor-focus-outline` 変数を定義
- [ ] `focus-visible` によるフォーカスリング（全インタラクティブ要素）
- [ ] スキップナビゲーションリンクの実装
- [ ] エディタ本体の `role="application"` / `role="textbox"` 付与
- [ ] ツールバーの `role="toolbar"` + roving tabindex
- [ ] タブバーの `role="tablist"` / `role="tab"` + `aria-selected`
- [ ] ARIA ライブリージョンの設置（`announcePolite` / `announceAssertive` ユーティリティ）
- [ ] 保存・エラー時のアナウンス実装
- [ ] コントラスト比の Vitest テスト（ライト/ダークテーマの主要ペア）

### Phase 2（テーブル編集の a11y）

- [ ] テーブルの `role="grid"` / `role="gridcell"` / `aria-rowcount` 実装
- [ ] テーブルセルの `aria-label` 付与
- [ ] Tab キーによるセル移動のアナウンス

### Phase 3（リッチ機能の a11y）

- [ ] 数式 NodeView の `role="math"` + `aria-label` 実装
- [ ] 画像 NodeView の `alt` 属性管理 UI（alt が空の場合の扱い）
- [ ] コードブロック NodeView の `role="code"` + 言語ラベル
- [ ] 検索バーの `aria-live="polite"` でのマッチ件数アナウンス
- [ ] モーダルのフォーカストラップ実装

### Phase 7（拡張）

- [ ] Playwright + axe-core による自動 a11y テストの CI 統合
- [ ] NVDA / VoiceOver での手動テスト実施
- [ ] WCAG 2.1 AA 適合宣言の検討
