# テーマシステム設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [設計方針](#1-設計方針)
2. [CSS Custom Properties 変数体系](#2-css-custom-properties-変数体系)
3. [テーマの 3 層構造](#3-テーマの-3-層構造)
4. [ライト／ダークモード設計](#4-ライトダークモード設計)
5. [ユーザー定義テーマ](#5-ユーザー定義テーマ)
6. [テーマ切り替えの実装](#6-テーマ切り替えの実装)
7. [ファイル構成](#7-ファイル構成)
8. [実装フェーズ](#8-実装フェーズ)
9. [カスタムフォント管理設計](#9-カスタムフォント管理設計)

---

## 1. 設計方針

### 1.1 基本方針

- **CSS Custom Properties（変数）を唯一の設計軸とする**: テーマの切り替えは `<html>` 要素の `data-theme` 属性変更だけで完了し、コンポーネントへの個別変更は行わない
- **3 層分離**: 「エディタ UI」「エディタ内プレビュー」「HTML/PDF エクスポート出力」の 3 層は CSS スコープで分離するが、変数の命名体系を共有して一貫性を保つ
- **後から追加可能**: 新テーマの追加はCSS ファイルを 1 つ追加するだけで完結する設計とする
- **user-settings-design.md との統合**: テーマ設定（`theme`・`editorFontFamily` 等）は既存の `AppSettings` スキーマに収める

### 1.2 対応テーマ一覧

| テーマ ID | 表示名 | 説明 |
|----------|--------|------|
| `light` | ライト | 白背景・標準配色（デフォルト） |
| `dark` | ダーク | 黒背景・暗配色 |
| `system` | システム | OS のダーク/ライト設定に追従 |
| `github` | GitHub | GitHub Markdown 配色 |
| `solarized-light` | Solarized Light | Solarized 暖色系 |
| `solarized-dark` | Solarized Dark | Solarized 暗色系 |

Phase 1 では `light` / `dark` / `system` のみ実装。追加テーマは Phase 7 以降。

---

## 2. CSS Custom Properties 変数体系

### 2.1 命名規則

```
--{レイヤー}-{カテゴリ}-{プロパティ}[-{修飾子}]

レイヤー:
  (なし)       → グローバル（全レイヤー共有）
  editor-      → エディタ UI 層
  preview-     → プレビュー層
  export-      → エクスポート層（共有変数を解決した固定値）

カテゴリ:
  color-       → 色
  font-        → フォント
  spacing-     → 余白
  border-      → ボーダー
  shadow-      → 影

例:
  --color-bg              → グローバル背景色
  --editor-color-bg       → エディタ UI 背景色
  --preview-color-heading → プレビュー見出し色
```

### 2.2 グローバル変数（全レイヤー共通）

```css
/* src/themes/variables.css */

:root {
  /* ── ベースカラー ─────────────────── */
  --color-bg:           #ffffff;
  --color-bg-secondary: #f6f8fa;
  --color-bg-tertiary:  #eaeef2;

  --color-text:         #24292f;
  --color-text-muted:   #57606a;
  --color-text-subtle:  #8c959f;

  --color-border:       #d0d7de;
  --color-border-muted: #eaeef2;

  --color-accent:       #0969da;
  --color-accent-hover: #0550ae;

  --color-success:      #1a7f37;
  --color-warning:      #9a6700;
  --color-danger:       #cf222e;

  /* ── タイポグラフィ ──────────────── */
  /* プラットフォーム別フォントスタックは §2.5 参照 */
  --font-sans:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono:   "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --font-size-base: 16px;
  --line-height-base: 1.6;

  /* ── スペーシング ───────────────── */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* ── ボーダー ───────────────────── */
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 12px;

  /* ── トランジション ──────────────── */
  --transition-fast: 80ms ease;
  --transition-normal: 160ms ease;
}
```

### 2.5 プラットフォーム別フォントスタック

CJK 文字（日本語・中国語・韓国語）を含むコンテンツを正しく表示するため、
プラットフォームごとに適切なフォールバックフォントを定義する。
JavaScript で実行時に `platform()` を取得し、`:root` の CSS 変数を上書きする。

```typescript
// src/themes/platform-fonts.ts
import { platform } from '@tauri-apps/plugin-os';

const PLATFORM_FONT_STACKS: Record<string, { sans: string; mono: string }> = {
  // Windows: 游ゴシック（Win8.1+）→ メイリオ → システム sans-serif
  windows: {
    sans: '"Yu Gothic UI", "游ゴシック UI", "Meiryo UI", メイリオ, "Segoe UI", sans-serif',
    mono: '"Cascadia Code", "BIZ UDゴシック", Consolas, "Courier New", monospace',
  },
  // macOS: ヒラギノ角ゴ（macOS 10.11+）→ システム
  macos: {
    sans: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "ヒラギノ角ゴシック", sans-serif',
    mono: '"SF Mono", "Osaka-Mono", "Hiragino Kaku Gothic ProN", Menlo, monospace',
  },
  // Linux: Noto Sans CJK JP（Google Noto フォント推奨）→ IPAex ゴシック
  linux: {
    sans: '"Noto Sans CJK JP", "IPAexGothic", "IPA Pゴシック", "Droid Sans Japanese", sans-serif',
    mono: '"Noto Sans Mono CJK JP", "IPAGothic", "Courier New", monospace',
  },
  // Android/iOS: OS デフォルト（CJK は自動的に適切なフォントを選択）
  android: {
    sans: '"Noto Sans CJK JP", sans-serif',
    mono: '"Noto Sans Mono CJK JP", monospace',
  },
  ios: {
    sans: '-apple-system, "Hiragino Sans", sans-serif',
    mono: '"SF Mono", Menlo, monospace',
  },
};

export async function applyPlatformFonts(): Promise<void> {
  const os = await platform(); // 'windows' | 'macos' | 'linux' | 'android' | 'ios'
  const fonts = PLATFORM_FONT_STACKS[os] ?? PLATFORM_FONT_STACKS.linux;
  const root = document.documentElement;
  root.style.setProperty('--font-sans', fonts.sans);
  root.style.setProperty('--font-mono', fonts.mono);
}
```

**実装タイミング**: `applyPlatformFonts()` をアプリ起動時（`main.tsx` の初期化処理）で呼び出す。
ユーザーがカスタムテーマで `--font-sans` を上書きした場合はそちらが優先される（CSS カスケード）。

### 2.3 エディタ UI 層変数

```css
/* エディタ UI（タブバー・サイドバー・ツールバー）の変数 */

:root {
  /* ── タブバー ────────────────────── */
  --editor-tabbar-bg:         var(--color-bg-secondary);
  --editor-tabbar-border:     var(--color-border);
  --editor-tab-bg:            transparent;
  --editor-tab-bg-active:     var(--color-bg);
  --editor-tab-text:          var(--color-text-muted);
  --editor-tab-text-active:   var(--color-text);
  --editor-tab-text-dirty:    var(--color-warning);  /* ● 未保存マーカー */

  /* ── ツールバー ─────────────────── */
  --editor-toolbar-bg:        var(--color-bg-secondary);
  --editor-toolbar-border:    var(--color-border);
  --editor-toolbar-icon:      var(--color-text-muted);
  --editor-toolbar-icon-hover: var(--color-text);
  --editor-toolbar-btn-bg-active: var(--color-bg-tertiary);

  /* ── サイドバー ─────────────────── */
  --editor-sidebar-bg:        var(--color-bg-secondary);
  --editor-sidebar-border:    var(--color-border);
  --editor-sidebar-item-bg-hover:  var(--color-bg-tertiary);
  --editor-sidebar-item-bg-active: var(--color-accent);
  --editor-sidebar-item-text-active: #ffffff;

  /* ── ステータスバー ──────────────── */
  --editor-statusbar-bg:      var(--color-bg-secondary);
  --editor-statusbar-text:    var(--color-text-muted);
  --editor-statusbar-border:  var(--color-border);

  /* ── エディタ本体 ───────────────── */
  --editor-content-bg:        var(--color-bg);
  --editor-content-text:      var(--color-text);
  --editor-content-font:      var(--font-sans);
  --editor-content-font-size: var(--font-size-base);
  --editor-content-line-height: var(--line-height-base);
  --editor-cursor-color:      var(--color-accent);
  --editor-selection-bg:      rgba(9, 105, 218, 0.2);
  --editor-focus-outline:     2px solid var(--color-accent);
}
```

### 2.4 プレビュー層変数

```css
/* エディタ内のレンダリング表示（NodeView の rendered 状態）の変数 */

:root {
  /* ── 見出し ─────────────────────── */
  --preview-heading-color:     var(--color-text);
  --preview-heading-border:    var(--color-border);

  /* ── コードブロック ──────────────── */
  --preview-code-bg:           var(--color-bg-secondary);
  --preview-code-text:         var(--color-text);
  --preview-code-font:         var(--font-mono);
  --preview-inline-code-bg:    rgba(175, 184, 193, 0.2);

  /* ── 引用ブロック ────────────────── */
  --preview-blockquote-border: var(--color-border);
  --preview-blockquote-text:   var(--color-text-muted);

  /* ── テーブル ────────────────────── */
  --preview-table-border:      var(--color-border);
  --preview-table-header-bg:   var(--color-bg-secondary);
  --preview-table-row-alt-bg:  var(--color-bg-secondary);

  /* ── リンク ─────────────────────── */
  --preview-link-color:        var(--color-accent);
  --preview-link-hover:        var(--color-accent-hover);

  /* ── タスクリスト ───────────────── */
  --preview-task-checkbox-color: var(--color-accent);
}
```

---

## 3. テーマの 3 層構造

### 3.1 層の分離方針

```
┌────────────────────────────────────────────────────────┐
│  エディタ UI 層（.editor-ui）                           │
│  → --editor-* 変数のみ使用                              │
│  例: タブバー・ツールバー・サイドバー                     │
├────────────────────────────────────────────────────────┤
│  プレビュー層（.editor-preview）                         │
│  → --preview-* 変数のみ使用                             │
│  例: NodeView のレンダリング済み表示                      │
├────────────────────────────────────────────────────────┤
│  エクスポート層（.export-body / .markdown-body）         │
│  → CSS Custom Properties を juice で解決した固定値を使用 │
│  例: HTML エクスポート・PDF 出力                         │
└────────────────────────────────────────────────────────┘
```

### 3.2 CSS スコープの実装

```tsx
// src/components/Editor/Editor.tsx

// エディタ全体を .editor-ui でラップ
<div className="editor-ui" data-theme={theme}>
  <TabBar />
  <Toolbar />
  <div className="editor-layout">
    <Sidebar className="editor-sidebar" />
    {/* プレビュー表示は .editor-preview でラップ */}
    <div className="editor-content editor-preview">
      <TipTapEditor />
    </div>
  </div>
  <StatusBar />
</div>
```

---

## 4. ライト／ダークモード設計

### 4.1 モード切り替えの仕組み

`<html>` 要素の `data-theme` 属性を変更することでテーマを切り替える。CSS 側は属性セレクタで変数値を上書きする。

```css
/* src/themes/dark/variables.css */

[data-theme="dark"] {
  --color-bg:           #0d1117;
  --color-bg-secondary: #161b22;
  --color-bg-tertiary:  #21262d;

  --color-text:         #e6edf3;
  --color-text-muted:   #8d96a0;
  --color-text-subtle:  #6e7681;

  --color-border:       #30363d;
  --color-border-muted: #21262d;

  --color-accent:       #58a6ff;
  --color-accent-hover: #79c0ff;

  --color-success:      #3fb950;
  --color-warning:      #d29922;
  --color-danger:       #f85149;
}
```

### 4.2 システムテーマへの追従

```typescript
// src/themes/theme-manager.ts

import { appWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '../store/settingsStore';

export class ThemeManager {
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private unlistenTauri?: () => void;

  /**
   * テーマを初期化し、system モードの場合は OS 変更を監視する。
   */
  async initialize(): Promise<void> {
    const { theme } = useSettingsStore.getState().settings;
    await this.applyTheme(theme);

    if (theme === 'system') {
      this.startSystemThemeWatch();
    }
  }

  /**
   * テーマを適用する。
   * 'system' は OS の prefers-color-scheme で解決する。
   */
  async applyTheme(theme: AppTheme): Promise<void> {
    const resolved = theme === 'system'
      ? (this.mediaQuery.matches ? 'dark' : 'light')
      : theme;

    document.documentElement.setAttribute('data-theme', resolved);

    // Tauri のウィンドウタイトルバーを合わせる（macOS・Windows 11 のみ有効）
    await appWindow.setTheme(resolved === 'dark' ? 'dark' : 'light');
  }

  /**
   * system モード時: OS のダーク/ライト変更を監視する。
   */
  private startSystemThemeWatch(): void {
    const handler = () => this.applyTheme('system');
    this.mediaQuery.addEventListener('change', handler);
  }

  destroy(): void {
    this.unlistenTauri?.();
  }
}

export const themeManager = new ThemeManager();
```

### 4.3 コードブロックのシンタックスハイライトテーマ

エディタのテーマに合わせてハイライトテーマを自動切り替えする。

| エディタテーマ | ハイライトテーマ | CSS ファイル |
|-------------|---------------|------------|
| `light` / `github` / `solarized-light` | `github` | `highlight.js/styles/github.css` |
| `dark` / `solarized-dark` | `github-dark` | `highlight.js/styles/github-dark.css` |

```typescript
// src/themes/theme-manager.ts（続き）

private applyHighlightTheme(resolved: 'light' | 'dark'): void {
  const linkEl = document.getElementById('highlight-theme') as HTMLLinkElement;
  linkEl.href = resolved === 'dark'
    ? '/themes/highlight/github-dark.css'
    : '/themes/highlight/github.css';
}
```

---

## 5. ユーザー定義テーマ

### 5.1 カスタムテーマの仕組み

Phase 7 以降で対応。ユーザーは CSS Custom Properties の値のみを上書きした JSON ファイルを定義できる。

```jsonc
// ~/.config/md-editor/themes/my-theme.json
{
  "id": "my-theme",
  "name": "My Theme",
  "extends": "light",           // ベーステーマ（省略時は light）
  "variables": {
    "--color-bg": "#fdf6e3",
    "--color-text": "#657b83",
    "--color-accent": "#268bd2",
    "--font-sans": "\"Noto Sans JP\", sans-serif",
    "--font-size-base": "15px"
  }
}
```

### 5.2 カスタムテーマの読み込み

```typescript
// src/themes/theme-manager.ts（続き）

async loadCustomTheme(themePath: string): Promise<void> {
  const json = await readTextFile(themePath);
  const customTheme: CustomTheme = JSON.parse(json);

  // ベーステーマを data-theme で適用してから、変数を上書き
  document.documentElement.setAttribute('data-theme', customTheme.extends ?? 'light');

  const style = document.getElementById('custom-theme-vars') as HTMLStyleElement;
  style.textContent = `:root { ${
    Object.entries(customTheme.variables)
      .map(([k, v]) => `${k}: ${v};`)
      .join('\n')
  } }`;
}
```

### 5.3 カスタムテーマの管理 UI（Phase 7）

```
設定 → 外観 → テーマ
  ├─ ビルトインテーマ一覧
  │    ○ ライト（デフォルト）
  │    ○ ダーク
  │    ○ システム
  │    ○ GitHub
  │    ○ Solarized Light
  │    ○ Solarized Dark
  ├─ カスタムテーマ
  │    ＋ テーマを追加（ファイルを選択）
  │    [my-theme]  [編集]  [削除]
  └─ [テーマのプレビュー領域]
```

---

## 6. テーマ切り替えの実装

### 6.1 Zustand ストアとの統合

テーマ設定は `settingsStore` の `theme` フィールドで管理する（`user-settings-design.md` §3 参照）。テーマが変更されるたびに `ThemeManager.applyTheme()` を呼び出す。

```typescript
// src/store/settingsStore.ts（抜粋）

import { themeManager } from '../themes/theme-manager';

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSetting: async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    set(state => ({ settings: { ...state.settings, [key]: value } }));
    await persistSettings(get().settings);

    // テーマ変更時は即時反映
    if (key === 'theme') {
      await themeManager.applyTheme(value as AppTheme);
    }
  },
}));
```

### 6.2 パフォーマンス考慮

テーマ切り替えは `data-theme` 属性の変更のみで完了するため、React の再レンダリングは発生しない。CSS の再計算はブラウザが自動的に行う。

```
テーマ切り替えコスト:

[旧実装案: className の切り替え]
  → React 全コンポーネントの再レンダリング（コスト大）

[採用実装: data-theme 属性の変更のみ]
  → CSS Custom Properties の再計算のみ（コスト小）
  → React 再レンダリング: 0回
```

---

## 7. ファイル構成

```
src/themes/
├── variables.css            # グローバル変数（ライトテーマのデフォルト値）
├── theme-manager.ts         # テーマ切り替えロジック
│
├── dark/
│   └── variables.css        # ダークテーマの変数上書き
│
├── github/
│   ├── variables.css        # GitHub テーマ固有の変数
│   ├── preview.css          # エディタ内プレビュー用スタイル
│   └── export.css           # HTML/PDF エクスポート用スタイル
│
├── document/
│   ├── variables.css
│   ├── preview.css
│   └── export.css
│
├── solarized-light/
│   └── variables.css
│
├── solarized-dark/
│   └── variables.css
│
├── highlight/               # コードハイライト CSS
│   ├── github.css           # ライト系テーマ用
│   └── github-dark.css      # ダーク系テーマ用
│
└── default/
    ├── editor.css           # エディタ UI 共通スタイル（既存）
    ├── preview.css          # プレビュー共通スタイル（既存）
    └── html-export.css      # HTML エクスポート共通スタイル（既存）
```

---

## 8. 実装フェーズ

### Phase 1（MVP）— ライト/ダーク/システムのみ

- [ ] `variables.css` の CSS Custom Properties 体系を確立
- [ ] `dark/variables.css` でダークテーマ変数を上書き
- [ ] `ThemeManager` の実装（applyTheme・system 追従）
- [ ] `settingsStore` との統合（テーマ設定の即時反映）
- [ ] `<html data-theme>` によるテーマ切り替え実装
- [ ] コードハイライトのテーマ切り替え（github / github-dark）

### Phase 4（HTML エクスポートテーマ）

- [ ] GitHub テーマの `export.css` 実装
- [ ] ドキュメントテーマの `export.css` 実装
- [ ] `juice` によるCSS インライン化時の変数解決確認

### Phase 7（拡張テーマ）

- [ ] GitHub・Solarized 等の追加ビルトインテーマ実装
- [ ] カスタムテーマの JSON 定義フォーマット確定
- [ ] カスタムテーマの読み込み・適用ロジック
- [ ] テーマ管理 UI（設定ダイアログへの組み込み）
- [ ] §5.4〜§5.7 で設計した GUI カラーピッカー・フォントセレクタ・オーバーライドレイヤーの実装

---

## 5.4 テーマカスタマイザー GUI 概要

Phase 7 で実装するビジュアルテーマカスタマイザー。JSON ファイルを手書きせずに GUI で CSS 変数を変更し、カスタムテーマを作成・保存できる。

```
設定 → 外観 → テーマ → [カスタマイズ]

┌────────────────────────────────────────────────────────────────────┐
│  テーマカスタマイザー                         [リセット] [保存]    │
├──────────────────────┬─────────────────────────────────────────────┤
│  カラー              │  ■ 背景色              [#ffffff] [●]       │
│  フォント            │  ■ テキスト色          [#24292f] [●]       │
│  スペーシング    ◄── │  ■ アクセントカラー    [#0969da] [●]       │
│                      │  ■ ボーダー色          [#d0d7de] [●]       │
│                      │  ■ コードブロック背景   [#f6f8fa] [●]      │
│                      │                                             │
│                      │  ─── プレビュー ─────────────────────────  │
│                      │  # 見出し1                                  │
│                      │  本文テキスト。**太字** と _斜体_ を含む。  │
│                      │  `インラインコード`                         │
│                      │  > 引用ブロック                             │
└──────────────────────┴─────────────────────────────────────────────┘
```

### 5.5 カラーピッカーコンポーネント設計

```tsx
// src/components/ThemeCustomizer/ColorPickerField.tsx

interface ColorPickerFieldProps {
  label: string;
  cssVariable: string;           // 例: '--color-bg'
  value: string;                 // 現在の色値（例: '#ffffff'）
  onChange: (cssVar: string, color: string) => void;
}

export function ColorPickerField({ label, cssVariable, value, onChange }: ColorPickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  // ドラフト変更をリアルタイムでプレビューに反映
  React.useEffect(() => {
    if (isValidColor(draft)) {
      onChange(cssVariable, draft);
    }
  }, [draft]);

  return (
    <div className="color-picker-field">
      <label>{label}</label>
      <div className="color-controls">
        {/* カラースウォッチ（クリックでピッカー展開）*/}
        <button
          className="color-swatch"
          style={{ backgroundColor: value }}
          onClick={() => setOpen(v => !v)}
          aria-label={`${label}: ${value}`}
        />
        {/* hex テキスト入力 */}
        <input
          type="text"
          value={draft}
          maxLength={9}
          pattern="^#[0-9a-fA-F]{3,8}$"
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (!isValidColor(draft)) setDraft(value); }}
        />
        {/* ネイティブ input[type="color"]（ブラウザ標準ピッカー）*/}
        <input
          type="color"
          value={value.length === 7 ? value : '#000000'}
          onChange={e => { setDraft(e.target.value); onChange(cssVariable, e.target.value); }}
          className="native-color-input"
          aria-label="カラーピッカーを開く"
        />
      </div>
    </div>
  );
}

function isValidColor(s: string): boolean {
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(s);
}
```

### 5.6 フォントセレクタコンポーネント設計

```tsx
// src/components/ThemeCustomizer/FontSelectorField.tsx

/** システムフォントのよく使われる候補 */
const COMMON_FONTS = [
  { value: '', label: 'テーマデフォルト' },
  { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP' },
  { value: '"Hiragino Sans", sans-serif', label: 'ヒラギノ角ゴ（macOS）' },
  { value: '"Yu Gothic UI", sans-serif', label: '游ゴシック UI（Windows）' },
  { value: '"Meiryo UI", sans-serif', label: 'メイリオ UI（Windows）' },
  { value: 'Georgia, serif', label: 'Georgia（英語）' },
  { value: '"Courier New", monospace', label: 'Courier New（等幅）' },
];

interface FontSelectorFieldProps {
  label: string;
  cssVariable: string;
  value: string;
  onChange: (cssVar: string, font: string) => void;
}

export function FontSelectorField({ label, cssVariable, value, onChange }: FontSelectorFieldProps) {
  const [custom, setCustom] = React.useState('');
  const isCustom = !COMMON_FONTS.some(f => f.value === value);

  return (
    <div className="font-selector-field">
      <label>{label}</label>
      <select
        value={isCustom ? '__custom__' : value}
        onChange={e => {
          if (e.target.value !== '__custom__') onChange(cssVariable, e.target.value);
        }}
      >
        {COMMON_FONTS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
        <option value="__custom__">カスタム…</option>
      </select>
      {/* カスタム入力フィールド（プルダウンで「カスタム」選択時に表示）*/}
      {isCustom && (
        <input
          type="text"
          value={isCustom ? value : custom}
          placeholder='"Font Name", fallback-family'
          onChange={e => onChange(cssVariable, e.target.value)}
        />
      )}
      {/* フォントプレビュー */}
      <span className="font-preview" style={{ fontFamily: value || 'inherit' }}>
        The quick brown fox jumps over the lazy dog. 日本語テキストサンプル。
      </span>
    </div>
  );
}
```

### 5.7 CSS 変数オーバーライドレイヤー

カスタマイザーで変更した CSS 変数は `<style id="custom-theme-vars">` タグに書き込む。`:root` への直接代入は **しない**（テーマ切り替え時に上書きされてしまうため）。

```typescript
// src/themes/override-layer.ts

/**
 * CSS 変数オーバーライドレイヤー。
 * `:root` に直接書くのではなく、`:root` セレクタを含む <style> タグに
 * 書き込むことで、テーマ CSS（variables.css）より高いカスケード優先度を確保する。
 */
const OVERRIDE_STYLE_ID = 'custom-theme-vars';

/** 変数オーバーライドを DOM に適用する（デバウンス不要・即時反映）*/
export function applyOverrideVars(vars: Record<string, string>): void {
  let el = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = OVERRIDE_STYLE_ID;
    document.head.appendChild(el);
  }

  if (Object.keys(vars).length === 0) {
    el.textContent = '';
    return;
  }

  const declarations = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  el.textContent = `:root {\n${declarations}\n}`;
}

/** 現在の <style> タグから変数マップを読み取る（設定画面を開いた時の初期化用）*/
export function readCurrentOverrideVars(): Record<string, string> {
  const el = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!el?.textContent) return {};

  const result: Record<string, string> = {};
  for (const match of el.textContent.matchAll(/\s*(--[\w-]+):\s*([^;]+);/g)) {
    result[match[1].trim()] = match[2].trim();
  }
  return result;
}
```

### 5.8 Zustand 統合と永続化

```typescript
// src/store/themeCustomizerStore.ts

import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';
import { applyOverrideVars, readCurrentOverrideVars } from '../themes/override-layer';

interface ThemeCustomizerStore {
  /** 現在のオーバーライド変数マップ */
  overrideVars: Record<string, string>;
  /** カスタムテーマの表示名 */
  customThemeName: string;
  /** 変数を更新（即時 DOM 反映）*/
  setVar: (cssVar: string, value: string) => void;
  /** 変数を削除（ベーステーマの値に戻す）*/
  removeVar: (cssVar: string) => void;
  /** 全変数をリセット */
  resetAll: () => void;
  /** settings.json に保存 */
  saveCustomTheme: () => Promise<void>;
  /** settings.json から読み込み（起動時）*/
  loadCustomTheme: () => Promise<void>;
}

export const useThemeCustomizerStore = create<ThemeCustomizerStore>((set, get) => ({
  overrideVars: {},
  customThemeName: 'My Theme',

  setVar: (cssVar, value) => {
    const next = { ...get().overrideVars, [cssVar]: value };
    set({ overrideVars: next });
    applyOverrideVars(next);   // 即時 DOM 反映（保存ボタン不要）
  },

  removeVar: (cssVar) => {
    const next = { ...get().overrideVars };
    delete next[cssVar];
    set({ overrideVars: next });
    applyOverrideVars(next);
  },

  resetAll: () => {
    set({ overrideVars: {} });
    applyOverrideVars({});
  },

  saveCustomTheme: async () => {
    const store = await load('settings.json');
    await store.set('customTheme', {
      name: get().customThemeName,
      variables: get().overrideVars,
    });
    await store.save();
  },

  loadCustomTheme: async () => {
    const store = await load('settings.json');
    const saved = await store.get<{ name: string; variables: Record<string, string> }>('customTheme');
    if (saved?.variables) {
      set({ overrideVars: saved.variables, customThemeName: saved.name ?? 'My Theme' });
      applyOverrideVars(saved.variables);
    }
  },
}));
```

### 5.9 カスタマイザー全体コンポーネント

```tsx
// src/components/ThemeCustomizer/ThemeCustomizer.tsx

import { useThemeCustomizerStore } from '../../store/themeCustomizerStore';
import { ColorPickerField } from './ColorPickerField';
import { FontSelectorField } from './FontSelectorField';

/** カスタマイズ対象の変数グループ */
const COLOR_VARS = [
  { label: '背景色',             cssVar: '--color-bg' },
  { label: 'テキスト色',         cssVar: '--color-text' },
  { label: 'アクセントカラー',   cssVar: '--color-accent' },
  { label: 'ボーダー色',         cssVar: '--color-border' },
  { label: 'コードブロック背景', cssVar: '--preview-code-bg' },
  { label: '引用ボーダー',       cssVar: '--preview-blockquote-border' },
];
const FONT_VARS = [
  { label: '本文フォント',         cssVar: '--font-sans' },
  { label: 'コードフォント',       cssVar: '--font-mono' },
];

export function ThemeCustomizer() {
  const { overrideVars, setVar, resetAll, saveCustomTheme, customThemeName } =
    useThemeCustomizerStore();

  return (
    <div className="theme-customizer">
      <div className="customizer-header">
        <input
          className="theme-name-input"
          value={customThemeName}
          onChange={e => useThemeCustomizerStore.setState({ customThemeName: e.target.value })}
          placeholder="テーマ名"
        />
        <button onClick={resetAll}>リセット</button>
        <button className="save-btn" onClick={saveCustomTheme}>保存</button>
      </div>

      <section>
        <h3>カラー</h3>
        {COLOR_VARS.map(({ label, cssVar }) => (
          <ColorPickerField
            key={cssVar}
            label={label}
            cssVariable={cssVar}
            value={overrideVars[cssVar] ?? getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()}
            onChange={setVar}
          />
        ))}
      </section>

      <section>
        <h3>フォント</h3>
        {FONT_VARS.map(({ label, cssVar }) => (
          <FontSelectorField
            key={cssVar}
            label={label}
            cssVariable={cssVar}
            value={overrideVars[cssVar] ?? ''}
            onChange={setVar}
          />
        ))}
      </section>

      <section>
        <h3>プレビュー</h3>
        <div className="theme-preview editor-preview">
          <h1>見出し1</h1>
          <p>本文テキスト。<strong>太字</strong>と<em>斜体</em>を含む。</p>
          <code>インラインコード</code>
          <blockquote>引用ブロックのサンプルテキスト。</blockquote>
        </div>
      </section>
    </div>
  );
}

---

## 9. カスタムフォント管理設計

### 9.1 設計目標

Typora が支持される大きな理由のひとつは「文字の美しさ」である。本エディタでも以下を実現する。

| 目標 | 詳細 |
|------|------|
| ローカルフォント利用 | OS にインストール済みの任意のフォントをエディタ・プレビュー・PDF 出力に適用 |
| リガチャ制御 | プログラミングフォント（Fira Code など）の合字を有効/無効化 |
| フォントスタック管理 | 本文・コード・見出し・UI の 4 スロットを独立して設定 |
| エクスポート反映 | PDF・印刷出力にも同一フォント指定を適用（ブラウザ依存を回避） |

---

### 9.2 OS ローカルフォントの列挙

#### Tauri コマンド: `list_system_fonts`

```rust
// src-tauri/src/font.rs
use std::process::Command;

#[tauri::command]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        // fc-list または system_profiler を使用
        let output = Command::new("fc-list")
            .args([":", "family"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut fonts: Vec<String> = stdout
            .lines()
            .flat_map(|l| l.split(','))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        fonts.sort();
        fonts.dedup();
        Ok(fonts)
    }
    #[cfg(target_os = "windows")]
    {
        // HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts
        use winreg::{RegKey, enums::HKEY_LOCAL_MACHINE};
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let fonts_key = hklm
            .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts")
            .map_err(|e| e.to_string())?;
        let mut names: Vec<String> = fonts_key
            .enum_values()
            .filter_map(|r| r.ok())
            .map(|(name, _)| {
                // "Font Name (TrueType)" → "Font Name"
                name.trim_end_matches(" (TrueType)")
                    .trim_end_matches(" (OpenType)")
                    .to_string()
            })
            .collect();
        names.sort();
        names.dedup();
        Ok(names)
    }
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("fc-list")
            .args([":", "family"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut fonts: Vec<String> = stdout
            .lines()
            .flat_map(|l| l.split(','))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        fonts.sort();
        fonts.dedup();
        Ok(fonts)
    }
}
```

**注意**: `list_system_fonts` はアプリ起動時に 1 回だけ呼び出し、結果を React state にキャッシュする。フォント追加後は再起動が必要（動的更新は Phase 後続対応）。

---

### 9.3 フォント適用メカニズム

#### CSS Custom Properties による適用

```css
/* src/themes/base.css */
:root {
  --font-sans:  "Helvetica Neue", Arial, sans-serif;   /* 本文 */
  --font-mono:  "Courier New", monospace;               /* コード */
  --font-head:  var(--font-sans);                       /* 見出し（デフォルトは本文と同じ） */
  --font-ui:    system-ui, sans-serif;                  /* UI 要素 */
}

.editor-content { font-family: var(--font-sans); }
.editor-content code,
.editor-content pre  { font-family: var(--font-mono); }
.editor-content h1,
.editor-content h2,
.editor-content h3   { font-family: var(--font-head); }
```

#### ユーザー指定フォントの動的注入

フォントが OS にインストール済みの場合、`@font-face` は不要。CSS Custom Properties を上書きするだけで適用できる。

```ts
// src/themes/font-manager.ts
export function applyUserFonts(fonts: FontSettings): void {
  const { sans, mono, heading } = fonts;

  // <style id="user-font-override"> を置き換え
  let styleEl = document.getElementById('user-font-override') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'user-font-override';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    :root {
      ${sans    ? `--font-sans: "${sans}", sans-serif;`    : ''}
      ${mono    ? `--font-mono: "${mono}", monospace;`     : ''}
      ${heading ? `--font-head: "${heading}", sans-serif;` : ''}
    }
  `;
}
```

`AppSettings` の `fonts` フィールドが変更されるたびに `applyUserFonts()` を呼び出す。

---

### 9.4 フォント設定スキーマ

`user-settings-design.md §4.1` の `AppSettings` に以下を追加する。

```ts
// src/settings/schema.ts（追記）
export interface FontSettings {
  /** 本文フォント（空文字 = テーマ既定） */
  sans:    string;
  /** コード・等幅フォント */
  mono:    string;
  /** 見出しフォント（空文字 = sans と同一） */
  heading: string;
  /** リガチャ（合字）を有効化するか */
  ligatures: boolean;
}

// AppSettings に追加
export interface AppSettings {
  // ... 既存フィールド ...
  fonts: FontSettings;
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  sans:      '',
  mono:      '',
  heading:   '',
  ligatures: false,
};
```

---

### 9.5 リガチャ（合字）の制御

リガチャはコードブロックのプログラミングフォント（Fira Code、JetBrains Mono 等）で特に重要。

```css
/* リガチャ有効時 */
.editor-content code,
.editor-content pre {
  font-variant-ligatures: common-ligatures contextual discretionary-ligatures;
  font-feature-settings: "calt" 1, "liga" 1, "dlig" 1;
}

/* リガチャ無効時 */
.editor-content code,
.editor-content pre {
  font-variant-ligatures: none;
  font-feature-settings: "calt" 0, "liga" 0, "dlig" 0;
}
```

```ts
// src/themes/font-manager.ts（追記）
export function applyLigatures(enabled: boolean): void {
  document.documentElement.dataset.ligatures = enabled ? 'on' : 'off';
}
```

```css
/* src/themes/base.css に追記 */
[data-ligatures="on"] code,
[data-ligatures="on"] pre {
  font-variant-ligatures: common-ligatures contextual;
  font-feature-settings: "calt" 1, "liga" 1;
}
[data-ligatures="off"] code,
[data-ligatures="off"] pre {
  font-variant-ligatures: none;
  font-feature-settings: "calt" 0, "liga" 0;
}
```

---

### 9.6 PDF / 印刷出力へのフォント反映

PDF 出力は Tauri の `webview.print()` を使用する。ブラウザの印刷エンジンはシステムフォントを参照するため、**OS にインストール済みであれば追加設定なしで反映される**。

エクスポート用 CSS には `@media print` スコープで変数をリセットし、`--export-font-sans` 等の明示的な変数を使用する。

```css
/* src/themes/export.css */
@media print {
  :root {
    /* ユーザー設定の --font-sans をエクスポート層に引き継ぐ */
    --export-font-sans: var(--font-sans, "Helvetica Neue", Arial, sans-serif);
    --export-font-mono: var(--font-mono, "Courier New", monospace);
  }

  body { font-family: var(--export-font-sans); }
  code, pre { font-family: var(--export-font-mono); }
}
```

**Web フォント（Google Fonts 等）を PDF に使う場合**は、`@font-face` を埋め込んだ HTML を Tauri の `webview.load_html()` に渡し印刷する。オフライン環境でのフォールバックを必ず定義すること。

---

### 9.7 フォント選択 UI（`FontSelectorField` コンポーネント）

既存の `ThemeCustomizer` §8 の「フォント」セクションで使用する `FontSelectorField` の完全実装。

```tsx
// src/components/settings/FontSelectorField.tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  label:       string;
  cssVariable: string;
  value:       string;
  onChange:    (cssVar: string, fontName: string) => void;
}

export function FontSelectorField({ label, cssVariable, value, onChange }: Props) {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    invoke<string[]>('list_system_fonts').then(setSystemFonts);
  }, []);

  const filtered = systemFonts.filter(f =>
    f.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="font-selector-field">
      <label>{label}</label>
      <input
        type="text"
        placeholder="フォント名を入力 or 選択…"
        value={value}
        onChange={e => onChange(cssVariable, e.target.value)}
      />
      {filter.length > 0 && (
        <ul className="font-dropdown">
          {filtered.slice(0, 20).map(f => (
            <li
              key={f}
              style={{ fontFamily: f }}
              onClick={() => { onChange(cssVariable, f); setFilter(''); }}
            >
              {f}
            </li>
          ))}
        </ul>
      )}
      <input
        className="font-filter"
        placeholder="絞り込み…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
    </div>
  );
}
```

---

### 9.8 実装フェーズ

| フェーズ | 内容 |
|----------|------|
| **Phase 3** | `list_system_fonts` Tauri コマンド実装・`FontSelectorField` 実装・本文/コードフォント変更 |
| **Phase 5** | 見出しフォント独立設定・リガチャ切り替え・設定永続化 |
| **Phase 7** | PDF/印刷エクスポートへのフォント完全反映・Web フォント埋め込みオプション |
