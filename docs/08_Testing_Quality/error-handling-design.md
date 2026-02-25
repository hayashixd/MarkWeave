# エラーハンドリング・診断ログ設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Tauri 2.0
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [設計方針](#1-設計方針)
2. [エラーの分類](#2-エラーの分類)
3. [診断ログ設計（tauri-plugin-log）](#3-診断ログ設計tauri-plugin-log)
4. [React Error Boundary 設計](#4-react-error-boundary-設計)
5. [Tauri コマンドエラーの翻訳](#5-tauri-コマンドエラーの翻訳)
6. [ユーザー向け通知 UI 設計](#6-ユーザー向け通知-ui-設計)
7. [パース失敗時の回復設計](#7-パース失敗時の回復設計)
8. [エラーケース別の対応方針一覧](#8-エラーケース別の対応方針一覧)
9. [実装フェーズ](#9-実装フェーズ)

---

## 1. 設計方針

### 1.1 基本原則

| 原則 | 詳細 |
|------|------|
| **技術的なエラー文字列を見せない** | Rust のエラーメッセージや OS エラーコードをユーザーに直接表示しない。翻訳してわかりやすい言葉で伝える |
| **ログは常に記録する** | ユーザー通知の有無にかかわらず、内部エラーはすべてログファイルに記録する |
| **アプリを落とさない** | エラーが一部のコンポーネントで発生しても、他の機能（他のタブ等）に影響させない |
| **データを守る** | エラーが発生しても、ユーザーが書いたコンテンツを失わないことを最優先とする |

### 1.2 エラーハンドリングの全体像

```
Rust（Tauri バックエンド）
  └─ Result<T, String> で IPC → フロントエンドへ伝搬
                                    │
                                    ▼
React フロントエンド
  ├─ Error Boundary     ← コンポーネントのレンダリングエラーをキャッチ
  ├─ try/catch         ← 非同期処理（ファイルI/O等）のエラーをキャッチ
  └─ エラー翻訳層       ← Rust エラー文字列 → ユーザー向けメッセージ
                                    │
                                    ▼
                          トースト / モーダル / ログ
```

---

## 2. エラーの分類

### 2.1 重大度による分類

| 重大度 | 定義 | 対応 |
|--------|------|------|
| **Fatal** | アプリが継続不能（DB 破損等）| モーダルダイアログ → 強制終了 |
| **Error** | 操作が失敗したが他機能は正常（保存失敗等）| トースト通知（エラー色）|
| **Warning** | 望ましくない状態だが継続可能（変換ロス等）| トースト通知（警告色）|
| **Info** | 情報通知（アップデートあり等）| トースト通知（情報色）|
| **Debug** | 開発者向け情報 | ログのみ（UI 表示なし）|

### 2.2 発生場所による分類

| 発生場所 | 例 |
|---------|-----|
| ファイル I/O | 読み取り権限なし、ディスク容量不足、ファイル削除済み |
| Markdown パース | 解析できない構文（まれに発生）|
| Markdown シリアライズ | AST → テキスト変換失敗 |
| HTML サニタイズ | DOMPurify の予期しない動作 |
| 外部リンク | リンク先ファイルが存在しない |
| 自動アップデート | ネットワーク接続なし、署名検証失敗 |
| React レンダリング | コンポーネントの予期しないエラー |
| Tauri コマンド | Rust 側でのエラー |

---

## 3. 診断ログ設計（tauri-plugin-log）

### 3.1 ログの保存場所

`tauri-plugin-log` を使用する。保存先は OS 標準のログディレクトリ。

| OS | ログファイルのパス例 |
|----|-------------------|
| Windows | `%LOCALAPPDATA%\com.example.mdeditor\logs\app.log` |
| macOS | `~/Library/Logs/com.example.mdeditor/app.log` |
| Linux | `~/.local/share/com.example.mdeditor/logs/app.log` |

### 3.2 ログのローテーション設定

```rust
// src-tauri/src/lib.rs
use tauri_plugin_log::{Builder as LogBuilder, RotationStrategy, Target, TargetKind};

fn setup_logger(app: &tauri::App) {
    app.handle()
        .plugin(
            LogBuilder::new()
                .targets([
                    Target::new(TargetKind::Stdout),  // 開発時: 標準出力
                    Target::new(TargetKind::LogDir { file_name: Some("app".to_string()) }),
                ])
                .rotation_strategy(RotationStrategy::KeepAll)
                .max_file_size(5_000_000)  // 5MB でローテーション
                .level(log::LevelFilter::Info)
                .level_for("app", log::LevelFilter::Debug)  // アプリ自身は Debug まで記録
                .build(),
        )
        .expect("Failed to initialize logger");
}
```

### 3.3 フロントエンドからのログ出力

`@tauri-apps/plugin-log` でフロントエンドからもログ出力できる。

```typescript
// src/utils/logger.ts
import { info, warn, error, debug } from '@tauri-apps/plugin-log';

/** ラッパー: 本番では console.log を出力せず、ログファイルにのみ記録 */
export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    debug(`${msg} ${JSON.stringify(args)}`);
  },
  info: (msg: string, ...args: unknown[]) => {
    info(`${msg} ${JSON.stringify(args)}`);
    if (import.meta.env.DEV) console.info(msg, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    warn(`${msg} ${JSON.stringify(args)}`);
    if (import.meta.env.DEV) console.warn(msg, ...args);
  },
  error: (msg: string, error?: unknown) => {
    const errorStr = error instanceof Error ? error.stack ?? error.message : String(error);
    error(`${msg}\n${errorStr}`);
    if (import.meta.env.DEV) console.error(msg, error);
  },
};
```

### 3.4 ログ収集の方針（個人開発）

個人開発のため、クラッシュレポートの自動送信は行わない。
問題が発生したときにユーザー（自分）がログファイルを確認する形とする。

メニュー → ヘルプ → **ログファイルを開く** でログの保存場所を Finder/エクスプローラで開く。

---

## 4. React Error Boundary 設計

### 4.1 Error Boundary の配置

React のレンダリングエラーをキャッチするため、Error Boundary を以下の 2 箇所に配置する。

```
App (AppErrorBoundary)
  ├─ Sidebar
  ├─ TabBar
  └─ EditorArea (EditorErrorBoundary)
        ├─ Editor [Tab 1]
        ├─ Editor [Tab 2]
        └─ ...
```

| バウンダリ | 役割 |
|-----------|------|
| `AppErrorBoundary` | アプリ全体のクラッシュをキャッチ。致命的エラー画面を表示 |
| `EditorErrorBoundary` | エディタコンポーネントのクラッシュをキャッチ。他のタブは正常動作を維持 |

### 4.2 AppErrorBoundary の実装

```typescript
// src/components/ErrorBoundary/AppErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMessage: string; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('AppErrorBoundary caught error', { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error-screen">
          <h1>予期しないエラーが発生しました</h1>
          <p>申し訳ありません。エディタが予期しないエラーで停止しました。</p>
          <p>ログファイルを確認して問題を報告してください。</p>
          <button onClick={() => location.reload()}>再起動</button>
          <button onClick={openLogDirectory}>ログファイルを開く</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 4.3 EditorErrorBoundary の実装

エディタが 1 つクラッシュしても他のタブは動作し続ける。

```typescript
// src/components/ErrorBoundary/EditorErrorBoundary.tsx

export class EditorErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('EditorErrorBoundary caught error', { error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="editor-error">
          <p>このタブの表示中にエラーが発生しました。</p>
          <p>ファイルの内容は保持されています。</p>
          <button onClick={() => this.setState({ hasError: false })}>
            再試行
          </button>
          <button onClick={this.props.onSaveRaw}>
            テキストとして保存
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 5. Tauri コマンドエラーの翻訳

Rust 側のエラー文字列をそのままユーザーに見せない。フロントエンドで翻訳する。

### 5.1 Rust 側のエラー定義

```rust
// src-tauri/src/error.rs
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "detail")]
pub enum AppError {
    FileNotFound { path: String },
    PermissionDenied { path: String },
    DiskFull,
    FileLocked { path: String },
    InvalidPath { path: String },
    Unknown { message: String },
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        // ログ用: 技術的な詳細を含む
        match self {
            AppError::FileNotFound { path } => write!(f, "FileNotFound: {}", path),
            AppError::PermissionDenied { path } => write!(f, "PermissionDenied: {}", path),
            AppError::DiskFull => write!(f, "DiskFull"),
            AppError::FileLocked { path } => write!(f, "FileLocked: {}", path),
            AppError::InvalidPath { path } => write!(f, "InvalidPath: {}", path),
            AppError::Unknown { message } => write!(f, "Unknown: {}", message),
        }
    }
}
```

### 5.2 フロントエンドでの翻訳

```typescript
// src/utils/error-translator.ts

interface AppError {
  kind: 'FileNotFound' | 'PermissionDenied' | 'DiskFull' | 'FileLocked' | 'InvalidPath' | 'Unknown';
  detail?: { path?: string; message?: string };
}

/** Tauri コマンドのエラーをユーザー向けメッセージに変換する */
export function translateError(error: unknown): string {
  // Tauri の構造化エラー（AppError）
  if (isAppError(error)) {
    switch (error.kind) {
      case 'FileNotFound':
        return `ファイルが見つかりません: ${error.detail?.path ?? ''}`;
      case 'PermissionDenied':
        return `ファイルへのアクセス権がありません: ${error.detail?.path ?? ''}`;
      case 'DiskFull':
        return 'ディスクの空き容量が不足しています。不要なファイルを削除してください。';
      case 'FileLocked':
        return `ファイルが別のアプリで開かれています: ${error.detail?.path ?? ''}`;
      case 'InvalidPath':
        return `無効なファイルパスです: ${error.detail?.path ?? ''}`;
      default:
        return '予期しないエラーが発生しました。ログファイルを確認してください。';
    }
  }

  // 通常の Error オブジェクト
  if (error instanceof Error) {
    logger.error('Untranslated error', error);
    return '予期しないエラーが発生しました。';
  }

  return String(error);
}
```

---

## 6. ユーザー向け通知 UI 設計

### 6.1 トースト通知（一時的なメッセージ）

画面右下に最大 3 件まで積み上げて表示する。

```
┌─────────────────────────────────────────────┐
│ ✓  保存しました                   [✕]      │  ← Info (緑)
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ⚠  HTML → Markdown 変換で一部の書式が失われ  │  ← Warning (黄)
│    ました                         [詳細] [✕]│
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ ✕  ファイルへのアクセス権がありません  [✕]  │  ← Error (赤)
└─────────────────────────────────────────────┘
```

| 種別 | 自動消去 | 備考 |
|------|---------|------|
| Info | 3秒後 | 「保存しました」等 |
| Warning | 8秒後（手動消去も可）| 変換ロス等 |
| Error | 消去しない（手動のみ）| ユーザーが読むまで残す |

### 6.2 モーダルダイアログ（重要な確認・致命的エラー）

ユーザーの判断が必要な場合はモーダルを使用する（トーストは判断を求めない）。

```
┌─────────────────────────────────────────────────────┐
│  ファイルが外部で変更されました                       │
│                                                     │
│  「README.md」は別のアプリケーションで変更されました。│
│  エディタの内容で上書きしますか？                    │
│                                                     │
│              [変更を破棄してリロード]  [そのまま継続] │
└─────────────────────────────────────────────────────┘
```

### 6.3 トーストの状態管理

```typescript
// src/store/toastStore.ts
import { create } from 'zustand';

export type ToastSeverity = 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  severity: ToastSeverity;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: Toast[];
  show: (severity: ToastSeverity, message: string, action?: Toast['action']) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (severity, message, action) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, severity, message, action }] }));

    // 自動消去
    const delay = severity === 'info' ? 3000 : severity === 'warning' ? 8000 : 0;
    if (delay > 0) setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), delay);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));

/** 使用例 */
// useToastStore.getState().show('error', translateError(err));
```

---

## 7. パース失敗時の回復設計

### 7.1 Markdown パース失敗時

Markdown ファイルが解析できない場合、クラッシュさせずにソースモードで開く。

```typescript
// src/core/editor.ts

async function openFile(path: string): Promise<void> {
  const content = await readTextFile(path);

  try {
    const ast = parseMarkdown(content);
    editor.setContent(astToTipTap(ast));
    setMode('wysiwyg');
  } catch (parseError) {
    // パース失敗 → ソースモードにフォールバック
    logger.warn('Markdown parse failed, falling back to source mode', { path, parseError });
    editor.setSourceContent(content);
    setMode('source');

    useToastStore.getState().show(
      'warning',
      'このファイルは一部の構文を解析できないため、ソースモードで開きました。',
    );
  }
}
```

### 7.2 シリアライズ失敗時（保存時）

保存時に AST → Markdown の変換が失敗した場合、元のコンテンツを保護する。

```typescript
async function saveFile(path: string): Promise<void> {
  let content: string;

  try {
    content = serializeToMarkdown(editor.getAST());
  } catch (serializeError) {
    logger.error('Markdown serialization failed', { path, serializeError });
    useToastStore.getState().show(
      'error',
      '保存中にエラーが発生しました。ファイルは変更されていません。',
    );
    return;  // 保存を中止（元ファイルを破壊しない）
  }

  await writeTextFile(path, content);
}
```

---

## 8. エラーケース別の対応方針一覧

| エラーケース | 重大度 | ユーザー通知 | ログ | 回復動作 |
|------------|--------|-----------|------|---------|
| ファイルが見つからない | Error | トースト | ✅ | タブを閉じる選択肢を提示 |
| ファイルの読み取り権限なし | Error | トースト | ✅ | なし |
| ディスク容量不足 | Error | トースト | ✅ | なし |
| Markdown パース失敗 | Warning | トースト | ✅ | ソースモードで開く |
| Markdown シリアライズ失敗 | Error | トースト | ✅ | 保存中止（元ファイル保護）|
| 外部でファイル変更 | Warning | モーダル | ✅ | リロード or 無視を選択 |
| 外部でファイル削除 | Warning | トースト | ✅ | タブ保持 or 閉じるを選択 |
| 自動アップデートチェック失敗 | Info | なし | ✅ | 次回起動時に再試行 |
| ネットワーク接続なし（更新）| Warning | トースト | ✅ | 手動更新で再試行 |
| React レンダリングエラー（エディタ）| Error | エラー UI（タブ内）| ✅ | 再試行ボタン |
| React レンダリングエラー（アプリ）| Fatal | エラー画面 | ✅ | 再起動ボタン |
| Tauri コマンド Unknown エラー | Error | トースト | ✅ | なし |

---

## 9. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| `tauri-plugin-log` 設定、`logger` ユーティリティ、`AppErrorBoundary`・`EditorErrorBoundary`、`toastStore`、ファイル I/O エラー翻訳 |
| Phase 1（後半）| パース失敗時のソースモードフォールバック、シリアライズ失敗時の保存中止 |
| Phase 3 | 外部ファイル変更通知のモーダル実装 |
| Phase 5（配布後）| メニュー → ヘルプ → ログファイルを開く の実装 |

---

## 関連ドキュメント

- [distribution-design.md](./distribution-design.md) — アップデートエラー処理
- [workspace-design.md](./workspace-design.md) — 外部ファイル変更検知
- [window-tab-session-design.md](./window-tab-session-design.md) §10 — クラッシュリカバリ
- [security-design.md](./security-design.md) — DOMPurify エラー処理
