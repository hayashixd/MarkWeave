# ユーザー設定（プリファレンス）設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [設計方針](#1-設計方針)
2. [設定カテゴリと項目一覧](#2-設定カテゴリと項目一覧)
3. [設定スキーマ（TypeScript型定義）](#3-設定スキーマtypescript型定義)
4. [永続化設計（plugin-store）](#4-永続化設計plugin-store)
5. [設定 UI 設計](#5-設定-ui-設計)
6. [デフォルト値](#6-デフォルト値)
7. [設定マイグレーション設計](#7-設定マイグレーション設計)
8. [実装フェーズ](#8-実装フェーズ)
9. [プラグイン設定との連携](#9-プラグイン設定との連携)

---

## 1. 設計方針

### 1.1 基本方針

- **単一の真実源（Single Source of Truth）**: 設定は `@tauri-apps/plugin-store` に JSON で永続化し、React 側は Zustand の `settingsStore` を経由してのみ参照する
- **即時反映**: テーマ・フォントなどの外観設定は保存ボタンなしにリアルタイムで反映する。ファイル関連の設定は次のファイル操作から適用する
- **後方互換**: 設定ファイルにバージョン番号を付与し、アプリ更新後も古い設定を安全にマイグレーションする

### 1.2 設定へのアクセス手段

| 手段 | 対象 |
|------|------|
| `Ctrl+,` （`Cmd+,`）| プリファレンスダイアログを開く |
| メニュー → 編集 → 設定 | 同上 |
| 右クリックコンテキストメニュー → 関連設定（画像など）| 特定カテゴリを直接開く |

---

## 2. 設定カテゴリと項目一覧

### 2.1 外観（Appearance）

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | カラーテーマ。`system` はOS設定に追従 |
| `editorFontFamily` | `string` | `''` | エディタのフォント（空文字 = テーマデフォルト）|
| `editorFontSize` | `number` | `16` | エディタのフォントサイズ（px）|
| `editorLineHeight` | `number` | `1.7` | エディタの行間 |
| `uiFontSize` | `number` | `14` | タブバー・サイドバー等 UI のフォントサイズ |
| `codeBlockFontFamily` | `string` | `''` | コードブロックのフォント（空文字 = OS モノスペース）|
| `codeBlockFontSize` | `number` | `14` | コードブロックのフォントサイズ |
| `paragraphSpacing` | `number` | `10` | 段落間の余白（px）|

### 2.2 エディタ動作（Editor）

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `autoFormat` | `boolean` | `true` | `# ` → 見出し等のオートフォーマット |
| `smartQuotes` | `boolean` | `false` | スマートクォーテーション（`"` → `""`）|
| `sourceTabSize` | `number` | `2` | ソースモードのタブ幅 |
| `smartPasteMode` | `'auto' \| 'ask' \| 'never'` | `'auto'` | スマートペーストの動作（詳細: [smart-paste-design.md](./smart-paste-design.md)）|
| `showLineNumbers` | `boolean` | `false` | ソースモードで行番号を表示 |
| `wordWrap` | `boolean` | `true` | ソースモードでの折り返し |
| `highlightCurrentLine` | `boolean` | `true` | ソースモードで現在行をハイライト |

### 2.3 Markdown 拡張（Markdown）

拡張構文は個別に有効/無効を切り替えられる。無効化した要素はエディタ上でリテラル文字列として表示される。

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `enableMath` | `boolean` | `true` | KaTeX 数式（`$...$`、`$$...$$`）|
| `enableMermaid` | `boolean` | `true` | Mermaid 図表 |
| `enableHighlight` | `boolean` | `true` | `==ハイライト==` |
| `enableSuperscript` | `boolean` | `true` | `^上付き^` |
| `enableSubscript` | `boolean` | `true` | `~下付き~` |
| `enableTaskList` | `boolean` | `true` | `- [ ]` タスクリスト |
| `enableFrontMatter` | `boolean` | `true` | YAML Front Matter |
| `enableGfmStrikethrough` | `boolean` | `true` | `~~取り消し線~~`（GFM）|

### 2.4 ファイル（File）

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `autoSaveDelay` | `number` | `2000` | 自動保存のデバウンス間隔（ms）。0 で無効 |
| `createBackup` | `boolean` | `false` | 上書き保存前にバックアップを作成（`.bak` ファイル）|
| `defaultSaveDir` | `string` | `''` | デフォルトの保存ダイアログ初期ディレクトリ（空 = ドキュメントフォルダ）|
| `imageSettings` | `ImageStorageSettings` | デフォルト参照 | 画像保存設定（詳細: [image-storage-design.md](./image-storage-design.md)）|
| `restoreSession` | `boolean` | `true` | 起動時に前回のタブを復元 |

### 2.5 AI コピー（AI Copy）

| 設定キー | 型 | デフォルト | 説明 |
|---------|-----|-----------|------|
| `aiCopy.normalizeHeadings` | `boolean` | `true` | 見出し階層の修正 |
| `aiCopy.annotateCodeBlocks` | `boolean` | `true` | コードブロックへの言語タグ付与 |
| `aiCopy.normalizeListMarkers` | `boolean` | `true` | リスト記号の統一 |
| `aiCopy.trimWhitespace` | `boolean` | `true` | 過剰空白行の削除 |
| `aiCopy.annotateLinks` | `boolean` | `false` | リンクのURL注記 |
| `aiCopy.normalizeCodeFences` | `boolean` | `true` | コードフェンスの統一 |
| `aiCopy.analyzePromptStructure` | `boolean` | `false` | RTICCO 構造解析 |

---

## 3. 設定スキーマ（TypeScript型定義）

```typescript
// src/settings/types.ts

import type { ImageStorageSettings } from '../file/imageStorage';

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  uiFontSize: number;
  codeBlockFontFamily: string;
  codeBlockFontSize: number;
  paragraphSpacing: number;
}

export interface EditorSettings {
  autoFormat: boolean;
  smartQuotes: boolean;
  sourceTabSize: number;
  smartPasteMode: 'auto' | 'ask' | 'never';
  showLineNumbers: boolean;
  wordWrap: boolean;
  highlightCurrentLine: boolean;
}

export interface MarkdownSettings {
  enableMath: boolean;
  enableMermaid: boolean;
  enableHighlight: boolean;
  enableSuperscript: boolean;
  enableSubscript: boolean;
  enableTaskList: boolean;
  enableFrontMatter: boolean;
  enableGfmStrikethrough: boolean;
}

export interface FileSettings {
  autoSaveDelay: number;
  createBackup: boolean;
  defaultSaveDir: string;
  imageSettings: ImageStorageSettings;
  restoreSession: boolean;
}

export interface AiCopySettings {
  normalizeHeadings: boolean;
  annotateCodeBlocks: boolean;
  normalizeListMarkers: boolean;
  trimWhitespace: boolean;
  annotateLinks: boolean;
  normalizeCodeFences: boolean;
  analyzePromptStructure: boolean;
}

/** アプリ設定の全体型 */
export interface AppSettings {
  /** 設定ファイルのバージョン。マイグレーションに使用 */
  version: number;
  appearance: AppearanceSettings;
  editor: EditorSettings;
  markdown: MarkdownSettings;
  file: FileSettings;
  aiCopy: AiCopySettings;
}
```

---

## 4. 永続化設計（plugin-store）

### 4.1 保存場所

`@tauri-apps/plugin-store` を使用する。保存先は OS 標準のアプリデータディレクトリ。

| OS | パス例 |
|----|--------|
| Windows | `%APPDATA%\com.example.mdeditor\settings.json` |
| macOS | `~/Library/Application Support/com.example.mdeditor/settings.json` |
| Linux | `~/.local/share/com.example.mdeditor/settings.json` |

### 4.2 Zustand ストアとの接続

```typescript
// src/settings/settingsStore.ts
import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';
import type { AppSettings } from './types';
import { DEFAULT_SETTINGS, migrateSettings } from './defaults';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: DeepPartial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    const store = await load('settings.json');
    const raw = await store.get<AppSettings>('settings');
    const settings = raw ? migrateSettings(raw) : DEFAULT_SETTINGS;
    set({ settings, loaded: true });
  },

  updateSettings: async (partial) => {
    const next = deepMerge(get().settings, partial);
    set({ settings: next });
    const store = await load('settings.json');
    await store.set('settings', next);
    await store.save();
  },
}));
```

### 4.3 起動時の読み込みタイミング

```typescript
// src/app.tsx
useEffect(() => {
  // 設定をロードしてから Editor をマウントする
  useSettingsStore.getState().loadSettings();
}, []);
```

---

## 5. 設定 UI 設計

### 5.1 プリファレンスダイアログ構成

```
┌─────────────────────────────────────────────────────────┐
│  設定                                           [✕ 閉じる]│
├────────────────┬────────────────────────────────────────┤
│  外観          │                                        │
│  エディタ  ◄── │  カラーテーマ                          │
│  Markdown 拡張 │  ○ ライト  ○ ダーク  ● システムに追従  │
│  ファイル      │                                        │
│  AI コピー     │  エディタフォント                      │
│                │  [                    ▼] サイズ: [16 ]  │
│                │  プレビュー: The quick brown fox       │
│                │                                        │
│                │  行間: [─────●──────]  1.7             │
│                │  段落間余白: [────●───]  10px           │
└────────────────┴────────────────────────────────────────┘
```

- 左ペイン: カテゴリ一覧（縦ナビゲーション）
- 右ペイン: 選択カテゴリの設定項目
- 閉じるボタンのみ（OK/キャンセルなし）。設定は即時反映・即時保存

### 5.2 Markdown 拡張カテゴリの表示例

```
Markdown 拡張
─────────────────────────────────────────────────
[✓] 数式（KaTeX）        $e=mc^2$  $$\sum_{i=0}^n$$
[✓] Mermaid 図表          graph TD; A --> B
[✓] ハイライト            ==重要==
[✓] 上付き / 下付き文字   x^2^  H~2~O
[✓] タスクリスト          - [ ] 未完了
[✓] YAML Front Matter     --- title: ... ---
[✓] 取り消し線（GFM）    ~~削除~~
[ ] スマートクォーテーション
─────────────────────────────────────────────────
※ 無効にした要素はリテラル文字列として表示されます
```

---

## 6. デフォルト値

```typescript
// src/settings/defaults.ts
import type { AppSettings } from './types';
import { DEFAULT_IMAGE_SETTINGS } from '../file/imageStorage';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  appearance: {
    theme: 'system',
    editorFontFamily: '',
    editorFontSize: 16,
    editorLineHeight: 1.7,
    uiFontSize: 14,
    codeBlockFontFamily: '',
    codeBlockFontSize: 14,
    paragraphSpacing: 10,
  },
  editor: {
    autoFormat: true,
    smartQuotes: false,
    sourceTabSize: 2,
    smartPasteMode: 'auto',
    showLineNumbers: false,
    wordWrap: true,
    highlightCurrentLine: true,
  },
  markdown: {
    enableMath: true,
    enableMermaid: true,
    enableHighlight: true,
    enableSuperscript: true,
    enableSubscript: true,
    enableTaskList: true,
    enableFrontMatter: true,
    enableGfmStrikethrough: true,
  },
  file: {
    autoSaveDelay: 2000,
    createBackup: false,
    defaultSaveDir: '',
    imageSettings: DEFAULT_IMAGE_SETTINGS,
    restoreSession: true,
  },
  aiCopy: {
    normalizeHeadings: true,
    annotateCodeBlocks: true,
    normalizeListMarkers: true,
    trimWhitespace: true,
    annotateLinks: false,
    normalizeCodeFences: true,
    analyzePromptStructure: false,
  },
};
```

---

## 7. 設定マイグレーション設計

アプリのバージョンアップで設定スキーマが変わった場合、古い設定ファイルを読んだときにデータ欠損やクラッシュが起きないようにマイグレーション関数で対応する。

```typescript
// src/settings/defaults.ts

/** 古い設定オブジェクトを最新バージョンに変換する */
export function migrateSettings(raw: unknown): AppSettings {
  // スキーマが全く壊れている場合はデフォルトを返す
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }

  const partial = raw as Partial<AppSettings>;
  const version = partial.version ?? 0;

  // v0 → v1: aiCopy セクションが存在しない旧バージョン対応
  if (version < 1) {
    return {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, ...partial.appearance },
      editor:     { ...DEFAULT_SETTINGS.editor,     ...partial.editor },
      markdown:   { ...DEFAULT_SETTINGS.markdown,   ...partial.markdown },
      file:       { ...DEFAULT_SETTINGS.file,       ...partial.file },
      aiCopy:     DEFAULT_SETTINGS.aiCopy,  // v0 には存在しないためデフォルトを使用
      version: 1,
    };
  }

  // 最新バージョン: 不足キーをデフォルトで補完
  return deepMerge(DEFAULT_SETTINGS, partial) as AppSettings;
}
```

### マイグレーションの運用ルール

| ルール | 理由 |
|--------|------|
| 設定を追加するとき: `DEFAULT_SETTINGS` にデフォルト値を追加し、旧バージョン用の補完を `migrateSettings` に記述 | キー欠損を防ぐ |
| 設定を削除するとき: ストアから読んだ後、余分なキーは無視して保存しなおす | 設定ファイルが肥大化しない |
| 設定の型が変わるとき: `version` を必ずインクリメントし、型変換ロジックを追加 | 型不一致クラッシュを防ぐ |

---

## 8. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| `AppSettings` 型定義、`DEFAULT_SETTINGS`、`settingsStore`、`loadSettings` / `updateSettings`、プリファレンスダイアログ（外観・エディタのみ）|
| Phase 3 | Markdown 拡張の設定 UI 追加 |
| Phase 4 | ファイル設定 UI 追加（自動保存・バックアップ）|
| Phase 8 | AI コピー設定 UI 追加 |
| 将来 | ショートカットカスタマイズ UI（[keyboard-shortcuts.md](./keyboard-shortcuts.md) §4-3 参照）|

---

---

## 9. プラグイン設定との連携

### 9.1 設計方針

プラグイン設定（各プラグインの独自設定値）は `AppSettings` とは**別ストア**（`pluginSettingsStore`）で管理する。ただし、保存先の `settings.json` は同一ファイルの `plugins.settings` セクションを使用する。

| 管理単位 | ストア | スキーマの所在 |
|---------|--------|--------------|
| アプリ共通設定 | `useSettingsStore` | `AppSettings` 型定義（§3） |
| プラグイン個別設定 | `usePluginSettingsStore` | 各 `manifest.json` の `settings` 宣言 |
| プラグイン有効/無効・インストール一覧 | `usePluginSettingsStore` | `PluginInstallRecord[]` |

### 9.2 settings.json 全体スキーマ

```typescript
// settings.json のルートオブジェクト全体像

interface SettingsFile {
  /** AppSettings（§3 で定義）*/
  settings: AppSettings;

  /** プラグイン管理データ */
  plugins: {
    /** インストール済みプラグイン一覧 */
    installed: PluginInstallRecord[];

    /** プラグイン個別設定値（key: pluginId, value: 設定値マップ）*/
    settings: Record<string, Record<string, unknown>>;
  };
}

export interface PluginInstallRecord {
  id: string;
  name: string;
  version: string;
  /** プラグインファイルの絶対パス */
  path: string;
  /** 有効/無効フラグ */
  enabled: boolean;
  /** インストール日時（ISO 8601）*/
  installedAt: string;
  /** 付与済み権限（権限確認ダイアログで承認済みのもの）*/
  grantedPermissions: string[];
}
```

### 9.3 設定 UI タブへのプラグイン統合

プリファレンスダイアログに「プラグイン」タブを追加し、§9.3（`plugin-api-design.md`）で設計したプラグイン管理 UI を組み込む。

```
設定ダイアログ:

┌──────────────┬─────────────────────────────────────────────────┐
│  外観         │                                                 │
│  エディタ     │  ← 既存タブ                                    │
│  Markdown    │                                                 │
│  ファイル     │                                                 │
│  AI コピー   │                                                 │
│  ─────────── │                                                 │
│  プラグイン ← │  ← Phase 7 で追加                              │
└──────────────┴─────────────────────────────────────────────────┘
```

### 9.4 プラグイン設定へのアクセス（EditorPluginAPI 経由）

プラグインは `api.settings.get(key)` で自身の設定値を取得できる。型安全にするため、宣言した `default` の型が自動的に適用される。

```typescript
// プラグイン側のコード例
export const myPlugin: EditorPlugin = {
  manifest: {
    id: 'com.example.my-plugin',
    // ...
    settings: [
      { key: 'highlightColor', type: 'color', label: '色', default: '#ffeb3b' },
    ],
  },

  activate(api: EditorPluginAPI) {
    // 設定値の取得
    const color = api.settings.get<string>('highlightColor');

    // 設定変更の購読
    const unsubscribe = api.settings.onChange('highlightColor', (newColor) => {
      updateHighlightColor(newColor as string);
    });

    // deactivate 時に購読解除
    return () => unsubscribe();
  },
};
```

### 9.5 マイグレーション上の考慮

プラグイン設定は `AppSettings.version` とは独立してバージョン管理する。プラグインのバージョンアップ時に旧設定値が型不一致になる場合は、`PluginManager.activatePlugin` 内でデフォルト値で補完する。

```typescript
// src/plugins/PluginManager.ts（マイグレーション処理）
function resolvePluginSettings(
  manifest: PluginManifest,
  stored: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const decl of manifest.settings ?? []) {
    const val = stored[decl.key];
    // 型チェック: 合わなければデフォルト値を使用
    resolved[decl.key] = isCompatible(val, decl.type) ? val : decl.default;
  }
  return resolved;
}

function isCompatible(value: unknown, type: string): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'number') return typeof value === 'number' && !isNaN(value);
  return typeof value === 'string';
}
```

---

## 関連ドキュメント

- [image-storage-design.md](./image-storage-design.md) — 画像保存設定の詳細
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — ショートカットカスタマイズ設計
- [window-tab-session-design.md](./window-tab-session-design.md) — セッション復元設定
- [smart-paste-design.md](./smart-paste-design.md) — スマートペースト設定
- [ai-features.md](./ai-features.md) — AI コピー機能の詳細
- [plugin-api-design.md](../01_Architecture/plugin-api-design.md) §9 — プラグイン設定 GUI・動的フォーム生成・セーフモード設計
