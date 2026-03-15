# クロスプラットフォーム設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [プラットフォームロードマップと優先度](#1-プラットフォームロードマップと優先度)
2. [WebView 差異の吸収設計](#2-webview-差異の吸収設計)
3. [キーボードショートカットの抽象化](#3-キーボードショートカットの抽象化)
4. [ファイルシステム API の差異吸収](#4-ファイルシステム-api-の差異吸収)
5. [モバイル UI 設計方針](#5-モバイル-ui-設計方針)
6. [プラットフォーム固有機能の設計](#6-プラットフォーム固有機能の設計)
7. [Tauri 2.0 ビルド設定](#7-tauri-20-ビルド設定)
8. [クロスプラットフォームテスト戦略](#8-クロスプラットフォームテスト戦略)

---

## 1. プラットフォームロードマップと優先度

| フェーズ | プラットフォーム | 状態 |
|---------|----------------|------|
| Phase 1〜4 | **Windows 10/11** | 主開発ターゲット |
| Phase 7 以降 | **macOS** (Ventura 以降) | デスクトップ拡張 |
| Phase 7 以降 | **Linux** (Ubuntu 22.04+) | デスクトップ拡張 |
| Phase 8 以降 | **Android** (API 30 以降) | モバイル第一弾 |
| Phase 8 以降 | **iOS** (iOS 16 以降) | モバイル第二弾 |

> **フェーズ番号について**: 本表のフェーズは `roadmap.md` の Phase 1〜8 の体系に準拠している。
> - Phase 7: 高度な機能（プラグイン API・PDF エクスポート等）。この段階で macOS/Linux 対応を実施する。
> - Phase 8: AI 連携機能。この段階でコア機能が安定した後にモバイル対応を開始する。
> - モバイル（Android/iOS）は Phase 8 以降の将来フェーズとして計画する（`decision-log.md §1` 参照）。

**設計原則**: Phase 1 から「後でモバイル対応に困らない」構造を意識する。
具体的には「デスクトップ専用 API の直接呼び出しを避け、抽象化レイヤーを通じて呼ぶ」。

---

## 2. WebView 差異の吸収設計

### 2.1 各プラットフォームの WebView エンジン

| プラットフォーム | WebView エンジン | ベース | 備考 |
|----------------|----------------|------|------|
| Windows 10/11 | WebView2 | Chromium (Edge) | OS に標準搭載 |
| macOS | WKWebView | WebKit (Safari) | OS に標準搭載 |
| Linux | WebKitGTK | WebKit | バージョン差異あり |
| Android | Chrome WebView | Chromium | OS 更新で自動更新 |
| iOS | WKWebView | WebKit (Safari) | OS に標準搭載 |

### 2.2 CSS 互換性マトリクス

| CSS 機能 | WebView2 | WKWebView | WebKitGTK | Chrome WebView |
|---------|----------|-----------|-----------|----------------|
| CSS Grid | ◎ | ◎ | ◎ (GTK4以降) | ◎ |
| CSS Custom Properties | ◎ | ◎ | ◎ | ◎ |
| CSS Scroll Snap | ◎ | ◎ | △ | ◎ |
| Backdrop Filter | ◎ | ◎ | △ | ◎ |
| Container Queries | ◎ | ◎ (Safari 16+) | △ | ◎ |
| :has() セレクタ | ◎ | ◎ (Safari 15.4+) | △ | ◎ |
| font-variant-numeric | ◎ | ◎ | ◎ | ◎ |

**対策**:
- CSS の使用前に [Can I Use](https://caniuse.com) で全ターゲット WebView の対応を確認する
- WebKit 固有のバグ（特に WKWebView の contentEditable 周辺）は `@supports` や UA 判定で回避する
- Windows Phase 1 では WebKit 対応は後回しにしてよい。Phase 7 以降（macOS/Linux 対応開始時）で一括対処する

### 2.3 JavaScript API 互換性

| API | WebView2 | WKWebView | 備考 |
|-----|----------|-----------|------|
| `navigator.clipboard.writeText()` | ◎ | ◎ | Tauri の HTTPS origin で動作 |
| `navigator.clipboard.read()` | ◎ | △ | WKWebView では権限要求が異なる |
| `ResizeObserver` | ◎ | ◎ | — |
| `IntersectionObserver` | ◎ | ◎ | 仮想スクロールで使用 |
| `OffscreenCanvas` | ◎ | ◎ (Safari 16.4+) | HEIF 変換で使用 |
| CSS Houdini / Paint API | △ | ✗ | 使用禁止 |
| Web Workers | ◎ | ◎ | Markdown パース高速化で使用検討 |
| `window.showOpenFilePicker()` | ✗ | ✗ | **使用禁止**: Tauri の plugin-dialog を使う |

### 2.4 ContentEditable の挙動差異と対策

TipTap/ProseMirror は ContentEditable ベースのため、WebKit 系（macOS/iOS）で特有の挙動が発生する。

| 問題 | 発生プラットフォーム | 対策 |
|------|------------------|------|
| 日本語 IME の composition イベント処理 | macOS/iOS WKWebView | TipTap の `handleDOMEvents` で `compositionstart/end` を適切に処理 |
| スマートクォートの自動変換 | macOS WKWebView | CSS `text-transform: none` + `autocorrect="off"` 属性 |
| タッチでのカーソル位置ずれ | iOS WKWebView | `selection.getRangeAt(0)` の代わりに ProseMirror の `posAtCoords` を使う |
| スクロールバーのオーバーレイ | macOS | `-webkit-scrollbar` スタイルで統一 |
| フォーカス時のスクロールジャンプ | iOS WKWebView | `scrollIntoView` のタイミングを `requestAnimationFrame` でずらす |

---

## 3. キーボードショートカットの抽象化

### 3.1 修飾キーの抽象化

TipTap では `Mod` というプレフィックスが `Windows: Ctrl`、`macOS: Cmd` に自動マップされる。
このプロジェクトでもアプリレイヤー全体で `Mod` 抽象を統一して使う。

```typescript
// src/utils/platform.ts

import { platform } from '@tauri-apps/plugin-os';

export type ModKey = 'Ctrl' | 'Meta';  // Meta = Cmd

let _modKey: ModKey | null = null;

export async function getModKey(): Promise<ModKey> {
  if (_modKey) return _modKey;
  const p = await platform();
  _modKey = p === 'macos' ? 'Meta' : 'Ctrl';
  return _modKey;
}

/** キーボードイベントで修飾キーが押されているか判定 */
export function isModPressed(event: KeyboardEvent): boolean {
  // Tauri の WebView では metaKey (Cmd) / ctrlKey (Ctrl) が正しく報告される
  return navigator.platform.toLowerCase().includes('mac')
    ? event.metaKey
    : event.ctrlKey;
}

/** ショートカット文字列を生成（UI表示用） */
export function shortcutLabel(key: string): string {
  const mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
  return `${mod}+${key}`;
}
```

### 3.2 プラットフォーム別のショートカット差異マトリクス

| 機能 | Windows / Linux | macOS | 注意点 |
|------|----------------|-------|--------|
| 太字 | `Ctrl+B` | `Cmd+B` | TipTap `Mod-b` で統一 |
| 保存 | `Ctrl+S` | `Cmd+S` | TipTap `Mod-s` |
| 取り消し線 | `Alt+Shift+5` | `Ctrl+Shift+5` | **差異あり**。macOS では `Cmd+Shift+5` はスクリーンショット |
| 検索・置換 | `Ctrl+H` | `Cmd+Shift+H` | macOS の `Cmd+H` はウィンドウを隠す |
| ハイライト | `Ctrl+Shift+H` | `Cmd+Option+H` | macOS の `Cmd+Shift+H` と被るため変更 |
| フルスクリーン | `F11` | `Ctrl+Cmd+F` | OS 依存 |
| ウィンドウを隠す | — | `Cmd+H` | macOS 固有。アプリは横取りしない |
| ウィンドウを最小化 | `Win+Down` / `Alt+Space` | `Cmd+M` | アプリ側では使用しない |

### 3.3 プラットフォーム分岐の実装パターン

```typescript
// src/utils/platform-shortcuts.ts
// ショートカット設定はここで一元管理し、他の場所には散在させない

import { isModPressed } from './platform';

export const PLATFORM_SHORTCUTS = {
  STRIKETHROUGH: navigator.platform.toLowerCase().includes('mac')
    ? { ctrl: true, alt: false, shift: true, key: '5' }  // Ctrl+Shift+5 on mac
    : { ctrl: false, alt: true,  shift: true, key: '5' }, // Alt+Shift+5 on Windows

  SEARCH_REPLACE: navigator.platform.toLowerCase().includes('mac')
    ? { mod: true, shift: true, key: 'H' }  // Cmd+Shift+H
    : { mod: true, shift: false, key: 'H'}, // Ctrl+H
} as const;
```

---

## 4. ファイルシステム API の差異吸収

### 4.1 プラットフォーム別のファイルシステム制約

| プラットフォーム | アクセス方式 | 制約 |
|----------------|------------|------|
| Windows | Win32 API (plugin-fs) | 制限なし（ユーザー権限の範囲で自由） |
| macOS | POSIX (plugin-fs) | TCC（透過的権限制御）でデスクトップ等にアクセス時に許可ダイアログ |
| Linux | POSIX (plugin-fs) | 制限なし |
| Android | Scoped Storage (SAF) | アプリ専用ストレージのみ自由。共有ストレージは SAF 経由 |
| iOS | Sandbox | Documents フォルダのみ。他は Document Picker 経由 |

### 4.2 ファイルアクセス抽象化レイヤー

プラットフォーム差異を吸収するファイルアクセス抽象レイヤーを設ける。

```typescript
// src/file/file-access.ts

import { platform } from '@tauri-apps/plugin-os';
import {
  readTextFile, writeTextFile, exists, rename,
} from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';

/**
 * ファイルを開く（プラットフォーム非依存インターフェース）。
 * - デスクトップ: ネイティブファイルダイアログ
 * - Android/iOS: OS 標準のファイルピッカー（plugin-dialog が自動的に使用）
 */
export async function openFileDialog(): Promise<{ path: string; content: string } | null> {
  const selected = await open({
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'HTML', extensions: ['html', 'htm'] },
    ],
    multiple: false,
  });

  if (!selected || Array.isArray(selected)) return null;

  try {
    const content = await readTextFile(selected);
    return { path: selected, content };
  } catch (err) {
    // Android/iOS でパーミッションエラーが発生した場合のフォールバック
    console.error('File read error:', err);
    return null;
  }
}

/**
 * 新しいファイルパスに保存する（Save As）。
 * Android/iOS では「エクスポート」操作に相当する。
 */
export async function saveFileDialog(
  defaultPath?: string,
  content?: string
): Promise<string | null> {
  const path = await save({
    defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  if (!path) return null;
  if (content !== undefined) await writeTextFile(path, content);
  return path;
}

/**
 * 与えられたパスに直接書き込む（Auto-save 用）。
 * Android では SAF の制約により、ダイアログで開いたファイルのみ書き込み可能。
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}
```

### 4.3 Android の Scoped Storage 対応方針

Android では `plugin-dialog` の `open()` が SAF を通じてファイル URI を返す。
Tauri 2.0 の `plugin-fs` は SAF のラッパーを提供するため、コードレベルでの大きな分岐は不要。

**ただし以下の制約に注意**:

1. **ファイルパスが `content://` URI になる**: `dirname()` 等のパス操作が機能しない場合がある
2. **画像の保存先**: 同一ディレクトリへの書き込みが保証されない。`$APP_DATA_DIR` 配下に保存する
3. **ファイルウォッチャー**: Android の `content://` URI に対してウォッチャーが機能しない可能性

#### 4.3.1 モバイルでのエンコーディング検出の制約

`file-operations-design.md §2` では UTF-8 / Shift-JIS 等のエンコーディング自動判定を規定しているが、
モバイルプラットフォームでは以下の制約がある。

| プラットフォーム | 制約 | 対応方針 |
|--------------|------|---------|
| Android (SAF) | `content://` URI で取得したバイト列の文字コード自動判定は PC と同様に機能する見込み。ただし Shift-JIS ファイルの共有は Android でほぼ発生しないため低優先度 | ベストエフォート（誤検出時はユーザーが手動でエンコーディング指定） |
| iOS (Sandbox) | Documents フォルダ経由のファイルは通常 UTF-8。Shift-JIS ファイルを扱うユーザーはほぼデスクトップ利用が前提 | PC 向けと同じ chardet ロジックを適用。誤判定時の手動指定 UI は Phase 8 以降で追加 |

**実装指針**: モバイルで Shift-JIS ファイルを扱う可能性があっても、
`@tauri-apps/plugin-fs` が返すバイト列に対して既存の文字コード判定（`chardet`）をそのまま適用する。
文字化けが発生した場合にユーザーが手動でエンコーディングを指定できる UI（`file-operations-design.md §2.3`）を
デスクトップ・モバイル共通で提供することで対応する。

```typescript
// src/file/file-access.ts（Android 対応追加）

export async function resolveDirectory(filePath: string): Promise<string> {
  const p = await platform();

  if (p === 'android') {
    // Android の content:// URI ではパス操作が使えない
    // → アプリ内部ストレージの作業ディレクトリを返す
    const { appDataDir } = await import('@tauri-apps/api/path');
    return await appDataDir();
  }

  // デスクトップ / iOS: 通常のディレクトリ解決
  const { dirname } = await import('@tauri-apps/api/path');
  return await dirname(filePath);
}
```

---

## 5. モバイル UI 設計方針

### 5.1 レイアウトの考え方

モバイルでは画面サイズとタッチ操作が前提。**Phase 1 から「モバイルで破綻しない」レイアウト**を意識する。

| コンポーネント | デスクトップ | モバイル |
|-------------|------------|---------|
| タブバー | 常に表示 | スワイプで切り替え or ドロワー |
| サイドバー | 常に表示可能 | ボトムシートまたはドロワー |
| ツールバー | 上部固定 | 上部 + フローティングアクション |
| ステータスバー | 下部固定 | 非表示（スペース節約） |
| 仮想キーボード | — | エディタ領域を上に押し上げる |

### 5.2 仮想キーボードとの共存

iOS/Android では仮想キーボードが表示されるとビューポートが縮小する。
これによりエディタが仮想キーボードの後ろに隠れる問題が発生しやすい。

```typescript
// src/hooks/useKeyboardHeight.ts（モバイル用）

import { useEffect, useState } from 'react';

/**
 * 仮想キーボードの高さを検出して、エディタ下端のパディングを動的に調整する。
 * Visual Viewport API を使用（iOS 15.4+, Android Chrome でサポート）。
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const viewportHeight = window.visualViewport?.height ?? windowHeight;
      setKeyboardHeight(Math.max(0, windowHeight - viewportHeight));
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  return keyboardHeight;
}
```

```tsx
// エディタコンポーネントでの利用
export function Editor() {
  const keyboardHeight = useKeyboardHeight();

  return (
    <div
      className="editor-container"
      style={{ paddingBottom: keyboardHeight }}
    >
      {/* TipTap エディタ */}
    </div>
  );
}
```

### 5.3 タッチ操作の対応

| 操作 | デスクトップ代替 | モバイル実装 |
|------|----------------|------------|
| 画像 D&D | D&D で挿入 | 「写真を挿入」ボタン + `input[type=file]` |
| 右クリックメニュー | 右クリック | 長押し (TouchEvent → contextmenu) |
| ホバー表示のツールチップ | hover | タップで表示（タップ外で非表示） |
| テキスト選択 | マウスドラッグ | タッチドラッグ（OS標準） |
| スクロール | マウスホイール | 指スワイプ（OS標準） |

### 5.4 モバイル専用ツールバー

モバイル向けツールバーは **1行のコンパクトなフォーマットバー** と **仮想キーボード上のアクセサリービュー** の2段構成にする。

```
モバイルツールバー（エディタ上部）:
  ┌──────────────────────────────────────┐
  │  [B] [I] [~] [H1▼] [🔗] [📷] [⋯] │
  └──────────────────────────────────────┘

キーボードアクセサリービュー（キーボード直上、iOS のみ）:
  ┌──────────────────────────────────────┐
  │  [↹ TAB] [> QUOTE] [` CODE] [完了] │
  └──────────────────────────────────────┘
```

キーボードアクセサリービューは iOS の `inputAccessoryView` に相当するが、
WKWebView ではネイティブとの統合が難しいため、
CSS で `position: sticky; bottom: 0` + `transform: translateY(-keyboardHeight)` で実現する。

---

## 6. プラットフォーム固有機能の設計

### 6.1 Windows 固有機能

| 機能 | 実装 | フェーズ |
|------|------|---------|
| ジャンプリスト（タスクバー右クリック） | `SHAddToRecentDocs` Rust コマンド | Phase 3 |
| ファイル関連付け（`.md` ダブルクリック） | `tauri.conf.json` の `fileAssociations` | Phase 1 |
| DWM タイトルバーのカスタム色 | `tauri-plugin-window-state` | Phase 4 |
| Windows 通知センター通知 | `tauri-plugin-notification` | Phase 4 |
| WebView2 の最小バージョン要件 | Windows 10 1903 以降（WebView2 対応） | Phase 1 |

### 6.2 macOS 固有機能（Phase 7 以降）

| 機能 | 実装 | 備考 |
|------|------|------|
| ネイティブメニューバー統合 | Tauri の `Menu` API | ファイル/編集/表示 メニュー |
| Spotlight インデックス | `NSUserActivity` | 検索可能にする |
| iCloud Drive 保存 | iOS と共有（Documents フォルダ） | iOS との連携 |
| Touch Bar サポート | 工数が高いため保留 | — |
| macOS のダークモード | CSS `prefers-color-scheme` | 自動対応 |

### 6.3 iOS 固有機能（Phase 8 以降）

| 機能 | 実装 | 備考 |
|------|------|------|
| iCloud Drive 連携 | `UIFileSharingEnabled: true` | Files アプリからアクセス可能 |
| Files アプリ連携 | `LSSupportsOpeningDocumentsInPlace` | Documents の共有 |
| スワイプバックジェスチャー | Tauri の戻るナビゲーション設定 | タブ切り替えに流用 |
| iOS ショートカット連携 | 将来対応 | — |

### 6.4 Android 固有機能（Phase 8 以降）

| 機能 | 実装 | 備考 |
|------|------|------|
| Files アプリ連携 | SAF（Storage Access Framework） | plugin-dialog が対応 |
| ウィジェット | 将来対応 | — |
| バックキーのハンドリング | Tauri の `hardwareBackButton` イベント | タブを閉じるまたはアプリを終了 |
| Android Auto | 対象外 | — |

---

## 7. Tauri 2.0 ビルド設定

### 7.1 プラットフォーム別の `tauri.conf.json` 設定ポイント

```json
// tauri.conf.json（共通部分）
{
  "identifier": "com.example.markdown-editor",
  "bundle": {
    "fileAssociations": [
      {
        "ext": ["md", "markdown"],
        "name": "Markdown File",
        "description": "Markdown document",
        "role": "Editor",
        "mimeType": "text/markdown"
      }
    ]
  }
}
```

```toml
# src-tauri/Cargo.toml（プラットフォーム別依存）

[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = ["Win32_UI_Shell"] }

[target.'cfg(target_os = "android")'.dependencies]
# Android 固有の依存があれば追加

[target.'cfg(target_os = "ios")'.dependencies]
# iOS 固有の依存があれば追加
```

### 7.2 Capabilities（パーミッション）のプラットフォーム分岐

```json
// src-tauri/capabilities/desktop.json（Windows/macOS/Linux 共通）
{
  "identifier": "desktop",
  "platforms": ["windows", "macos", "linux"],
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-watch",
    "fs:allow-mkdir",
    "fs:allow-read-dir"
  ]
}
```

```json
// src-tauri/capabilities/mobile.json（Android/iOS 共通）
{
  "identifier": "mobile",
  "platforms": ["android", "ios"],
  "windows": ["main"],
  "permissions": [
    "fs:allow-app-read",    // アプリ専用ストレージのみ読み取り
    "fs:allow-app-write",   // アプリ専用ストレージのみ書き込み
    "dialog:allow-open",    // SAF 経由のファイル選択
    "dialog:allow-save"
  ]
}
```

### 7.3 Android ビルド手順（参考）

```bash
# Android SDK の設定（一度だけ）
rustup target add aarch64-linux-android armv7-linux-androideabi

# Android ビルド（開発）
pnpm tauri android dev

# Android リリースビルド
pnpm tauri android build --split-per-abi
```

---

## 8. クロスプラットフォームテスト戦略

### 8.1 テスト分類

| テスト種別 | ツール | 対象プラットフォーム |
|---------|-------|-----------------|
| ユニットテスト | Vitest | プラットフォーム非依存（変換ロジック等） |
| コンポーネントテスト | Vitest + Testing Library | Chrome（CI環境） |
| E2Eテスト（デスクトップ） | Playwright + Tauri Driver | Windows（CI）、macOS（手動）|
| E2Eテスト（モバイル） | Appium or BrowserStack | Android/iOS（手動、Phase 8 以降）|

### 8.2 プラットフォーム差異の優先テスト項目

Phase 1 の時点から、後でモバイル対応が困難にならないよう以下を意識して実装・テストする。

| テスト項目 | Windows | macOS | Android | iOS |
|----------|---------|-------|---------|-----|
| ファイル開く・保存 | ✅ E2E | Phase 7+ | Phase 8+ | Phase 8+ |
| 日本語 IME 入力 | ✅ E2E | Phase 7+ | Phase 8+ | Phase 8+ |
| キーボードショートカット | ✅ E2E | Phase 7+ | — | — |
| タッチ操作（基本） | — | — | Phase 8+ | Phase 8+ |
| ファイル関連付け | ✅ 手動 | Phase 7+ | Phase 8+ | Phase 8+ |
| セッション復元 | ✅ E2E | Phase 7+ | Phase 8+ | Phase 8+ |
| 仮想キーボード共存 | — | — | Phase 8+ | Phase 8+ |

### 8.3 継続的インテグレーション（CI）設定

```yaml
# .github/workflows/build.yml（参考）
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pnpm tauri build

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm vitest run

  test-e2e-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm tauri build  # Tauri Driver 用にビルドが必要
      - run: pnpm playwright test
```

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体設計
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — キーボードショートカット詳細
- [image-storage-design.md](./image-storage-design.md) — 画像管理（モバイル対応含む）
- [security-design.md](./security-design.md) — セキュリティ設計

---

*このドキュメントは Phase 7 以降（macOS/Linux 展開）および Phase 8 以降（モバイル展開）に向けて随時更新する。*
