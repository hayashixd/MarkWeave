# テーマシステム設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

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
