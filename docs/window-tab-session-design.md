# ウィンドウ・タブ・セッション管理 設計ドキュメント

> プロジェクト: Markdown / HTML Editor
> バージョン: 1.0
> 更新日: 2026-02-23

---

## 目次

1. [タブ vs 複数ウィンドウ設計方針](#1-タブ-vs-複数ウィンドウ設計方針)
2. [セッション復元](#2-セッション復元)
3. [未保存変更の管理](#3-未保存変更の管理)
4. [最近使ったファイル履歴](#4-最近使ったファイル履歴)
5. [ファイル関連付けとシングルインスタンス制御](#5-ファイル関連付けとシングルインスタンス制御)
6. [全体アーキテクチャ](#6-全体アーキテクチャ)
7. [状態管理設計（Zustand）](#7-状態管理設計zustand)
8. [実装フェーズ](#8-実装フェーズ)

---

## 1. タブ vs 複数ウィンドウ設計方針

### 1.1 メモリ・パフォーマンスの実態（Windows / WebView2）

Tauri 2.0 on Windows は WebView2（Chromiumベース）を使用する。重要な特性：

- **ブラウザプロセスは共有**: 同一 UserDataFolder を使う場合、複数 `WebviewWindow` でも
  `msedgewebview2.exe` の Browser プロセスは1つで共有される
- **Renderer プロセスは独立**: ウィンドウごとに Renderer プロセスが分離するため、
  1ウィンドウ追加あたり **30〜80MB** のメモリ消費が増加する
- **Rust バックエンドは共有**: ファイルI/Oや設定管理など Rust のロジックはウィンドウ間で共有

### 1.2 選択肢の比較

| 観点 | A) アプリ内タブ | B) 複数 WebviewWindow | C) 両方 |
|------|---------------|----------------------|---------|
| **メモリ** | 最小（WebView単一） | ウィンドウ数×30〜80MB | Bと同等 |
| **状態管理** | React内で完結しシンプル | ウィンドウ間IPC必須で複雑 | 最複雑 |
| **モバイル対応** | そのまま動作 | WebviewWindowはデスクトップ専用 | 要分岐 |
| **実装コスト** | 低 | 中〜高 | 高 |
| **並列表示** | 要追加実装（Split View） | OS標準でスナップ配置可 | 自然 |
| **未保存管理** | React状態で一元管理 | ウィンドウ毎に個別制御 | 複雑 |

### 1.3 採用方針: **アプリ内タブをベース + 将来的なウィンドウ切り出し**

**Phase 1〜4**: タブ UI のみ実装（シンプル・低コスト）
**Phase 5以降**: タブをウィンドウに切り出す機能を追加（VS Code スタイル）

Android / iOS 対応予定があるため、タブ UI を基盤とするのが合理的。
WebviewWindow の追加はデスクトップ専用機能として後から追加する。

---

## 2. セッション復元

### 2.1 使用プラグイン

`@tauri-apps/plugin-store` を使ってセッション状態をJSONファイルに永続化する。

### 2.2 保存するセッション情報

```typescript
// src/store/session.ts

export interface FileSession {
  path: string;           // 絶対パス
  scrollPosition: number; // スクロール位置（px）
  cursorOffset: number;   // カーソル位置（文字オフセット）
}

export interface SessionState {
  openFiles: FileSession[];     // 開いているファイルの一覧（タブ順）
  activeFilePath: string | null; // アクティブタブのファイルパス
  editorMode: 'typora' | 'wysiwyg' | 'source' | 'split'; // エディタモード
  sidebarVisible: boolean;      // サイドバーの表示状態
  sidebarWidth: number;         // サイドバー幅（px）
}
```

### 2.3 保存・復元の実装

```typescript
// src/store/session.ts
import { load } from '@tauri-apps/plugin-store';

const STORE_FILE = 'session.json';

// セッションの保存（ウィンドウクローズ前・ファイル操作後に呼ぶ）
export async function saveSession(state: SessionState): Promise<void> {
  const store = await load(STORE_FILE, { autoSave: false });
  await store.set('openFiles', state.openFiles);
  await store.set('activeFilePath', state.activeFilePath);
  await store.set('editorMode', state.editorMode);
  await store.set('sidebarVisible', state.sidebarVisible);
  await store.set('sidebarWidth', state.sidebarWidth);
  await store.save(); // 明示的に保存（autoSave: false でクラッシュ耐性向上）
}

// セッションの復元（アプリ起動時）
export async function loadSession(): Promise<SessionState | null> {
  const store = await load(STORE_FILE, { autoSave: false });
  const openFiles = await store.get<FileSession[]>('openFiles');
  if (!openFiles || openFiles.length === 0) return null;

  // ファイルが実際に存在するか確認してから復元（削除・移動されたファイルを除外）
  const { exists } = await import('@tauri-apps/plugin-fs');
  const validFiles = (
    await Promise.all(openFiles.map(async (f) => (await exists(f.path)) ? f : null))
  ).filter(Boolean) as FileSession[];

  return {
    openFiles: validFiles,
    activeFilePath: await store.get<string | null>('activeFilePath') ?? null,
    editorMode: await store.get<SessionState['editorMode']>('editorMode') ?? 'typora',
    sidebarVisible: await store.get<boolean>('sidebarVisible') ?? true,
    sidebarWidth: await store.get<number>('sidebarWidth') ?? 240,
  };
}
```

### 2.4 アプリ起動時の復元フロー

```typescript
// src/app.tsx
useEffect(() => {
  (async () => {
    // コマンドライン引数でファイルが指定されていれば優先
    const args = await getMatches(); // @tauri-apps/plugin-cli or process.argv 相当
    if (args.filePath) {
      dispatch(openFile(args.filePath));
      return;
    }

    // セッション復元
    const session = await loadSession();
    if (session && session.openFiles.length > 0) {
      dispatch(restoreSession(session));
    }
  })();
}, []);
```

---

## 3. 未保存変更の管理

### 3.1 タブの状態管理

```typescript
// src/store/tabStore.ts（Zustand）

interface TabState {
  path: string;
  content: string;      // 現在のエディタ内容
  savedContent: string; // 最後にディスクに書き込んだ内容
  isDirty: boolean;     // content !== savedContent
}
```

タブタイトルには未保存マーカーを表示する（VS Code / Typora スタイル）：

```tsx
// src/components/TabBar/TabTitle.tsx
const TabTitle = ({ tab }: { tab: TabState }) => (
  <span className={tab.isDirty ? 'tab-dirty' : ''}>
    {tab.isDirty ? '● ' : ''}
    {basename(tab.path)}
  </span>
);
```

### 3.2 ウィンドウクローズ時のガード

Tauri 2.0 の `onCloseRequested` を使い、デフォルトのクローズを一時キャンセルして確認を取る。

```typescript
// src/hooks/useCloseGuard.ts
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ask } from '@tauri-apps/plugin-dialog';

export function useCloseGuard(dirtyFiles: string[]) {
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();

    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      if (dirtyFiles.length === 0) return; // 未保存なし → そのまま閉じる

      event.preventDefault(); // デフォルトのクローズをキャンセル

      const fileList = dirtyFiles.map((f) => `・${basename(f)}`).join('\n');
      const confirmed = await ask(
        `以下のファイルに未保存の変更があります:\n${fileList}\n\n保存せずに閉じますか？`,
        {
          title: '未保存の変更',
          kind: 'warning',
          okLabel: '閉じる',
          cancelLabel: 'キャンセル',
        }
      );

      if (confirmed) {
        await saveSession(getCurrentSession()); // セッション保存
        appWindow.destroy(); // onCloseRequested を再トリガーしないよう destroy を使う
      }
    });

    return () => { unlistenPromise.then((f) => f()); };
  }, [dirtyFiles]);
}
```

### 3.3 タイトルバーへの未保存マーカー反映

```rust
// src-tauri/src/commands/window.rs
#[tauri::command]
pub fn set_title_dirty(window: tauri::Window, dirty: bool, filename: String) {
    let title = if dirty {
        format!("● {} - MarkdownEditor", filename)
    } else {
        format!("{} - MarkdownEditor", filename)
    };
    let _ = window.set_title(&title);
}
```

### 3.4 タブを閉じるときの確認

ウィンドウ全体を閉じる場合と異なり、タブ単体を閉じる際は React 側でダイアログを表示する：

```typescript
// src/store/tabActions.ts
export async function closeTab(tabId: string): Promise<void> {
  const tab = getTabById(tabId);
  if (!tab) return;

  if (tab.isDirty) {
    const confirmed = await ask(
      `"${basename(tab.path)}" に未保存の変更があります。\n保存せずに閉じますか？`,
      { title: '未保存の変更', kind: 'warning', okLabel: '閉じる', cancelLabel: 'キャンセル' }
    );
    if (!confirmed) return;
  }

  dispatch(removeTab(tabId));
}
```

---

## 4. 最近使ったファイル履歴

### 4.1 Tauri ネイティブメニューへの動的追加

```typescript
// src/menu/recentFilesMenu.ts
import { Menu, Submenu, MenuItem } from '@tauri-apps/api/menu';
import { load } from '@tauri-apps/plugin-store';
import { basename } from '@tauri-apps/api/path';

const RECENT_MAX = 10;
const STORE_FILE = 'settings.json';

// 最近使ったファイルの読み書き
export async function addToRecentFiles(filePath: string): Promise<void> {
  const store = await load(STORE_FILE, { autoSave: false });
  const recent = (await store.get<string[]>('recentFiles')) ?? [];

  const updated = [filePath, ...recent.filter((p) => p !== filePath)].slice(0, RECENT_MAX);
  await store.set('recentFiles', updated);
  await store.save();

  await rebuildMenu(updated);
}

export async function getRecentFiles(): Promise<string[]> {
  const store = await load(STORE_FILE, { autoSave: false });
  return (await store.get<string[]>('recentFiles')) ?? [];
}

// メニューを再構築（ファイルを開くたびに呼ぶ）
export async function rebuildMenu(
  recentFiles: string[],
  onOpen: (path: string) => void
): Promise<void> {
  const items = await Promise.all(
    recentFiles.map((path, i) =>
      MenuItem.new({
        id: `recent-file-${i}`,
        text: await basename(path),
        action: () => onOpen(path),
      })
    )
  );

  const clearItem = await MenuItem.new({
    id: 'recent-clear',
    text: '履歴を消去',
    action: async () => {
      const store = await load(STORE_FILE, { autoSave: false });
      await store.set('recentFiles', []);
      await store.save();
      await rebuildMenu([], onOpen);
    },
  });

  // TODO: Menu API でサブメニューを差し替える
  // Tauri 2.0 では Menu.default() で現在のメニューを取得し、
  // submenu を入れ替えて再適用する
  const _submenu = await Submenu.new({
    text: '最近使ったファイル',
    items: items.length > 0 ? [...items, clearItem] : [clearItem],
  });
}
```

### 4.2 Windows ジャンプリスト・「最近使ったファイル」への登録

`SHAddToRecentDocs` を呼ぶことで、Windows のジャンプリストと「最近使ったファイル」
（スタートメニュー・タスクバー）に自動登録される。

```toml
# src-tauri/Cargo.toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = ["Win32_UI_Shell"] }
```

```rust
// src-tauri/src/commands/recent_files.rs
#[tauri::command]
pub fn add_to_recent_documents(path: String) {
    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Win32::UI::Shell::SHAddToRecentDocs;
        // SHARD_PATHW = 3: パス文字列として渡す。
        // Windows が自動的にジャンプリストと「最近使ったファイル」の両方に登録する。
        let hpath = HSTRING::from(&path);
        unsafe {
            SHAddToRecentDocs(0x0000_0003, hpath.as_ptr() as _);
        }
    }
    // macOS / Linux は何もしない（将来対応）
}
```

呼び出しタイミング：ファイルを開くたびにフロントエンドから `invoke` する。

```typescript
// src/file/fileManager.ts
import { invoke } from '@tauri-apps/api/core';

export async function openFile(path: string): Promise<string> {
  const content = await readTextFile(path); // plugin-fs
  await invoke('add_to_recent_documents', { path });
  await addToRecentFiles(path); // Tauriメニューにも追加
  return content;
}
```

---

## 5. ファイル関連付けとシングルインスタンス制御

### 5.1 ファイル関連付けの設定（tauri.conf.json）

```json
{
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

インストーラビルド時に `.md` / `.markdown` の関連付けが自動設定される。
（開発中は手動でレジストリ登録が必要な場合がある）

### 5.2 シングルインスタンス制御（tauri-plugin-single-instance）

2つ目以降の起動試行をブロックし、既存インスタンスにファイルパスを送る。

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-single-instance = "2"
```

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_single_instance::init(|app, argv, _cwd| {
                // 2つ目の起動試行時に呼ばれる
                // argv = ["app_path", "/path/to/file.md", ...]
                if let Some(path) = argv.get(1) {
                    // フロントエンドにファイルオープンを通知
                    let _ = app.emit("open-file-request", path);
                }
                // 既存ウィンドウをフォアグラウンドに表示
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
            })
        )
        .setup(|app| {
            // 初回起動時のファイルパスを処理
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = args.get(1) {
                let _ = app.emit("open-file-request", path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap();
}
```

### 5.3 フロントエンドでのイベント受信

```typescript
// src/hooks/useFileOpenListener.ts
import { listen } from '@tauri-apps/api/event';

export function useFileOpenListener(openFile: (path: string) => void) {
  useEffect(() => {
    const unlistenPromise = listen<string>('open-file-request', (event) => {
      openFile(event.payload); // 新しいタブで開く
    });
    return () => { unlistenPromise.then((f) => f()); };
  }, [openFile]);
}
```

### 5.4 既存ウィンドウに新しいタブで開く vs 置き換え

| 動作 | 設定 | 説明 |
|------|------|------|
| **新しいタブで開く** | デフォルト | 既に開いているファイルを保持 |
| **既存タブに切り替え** | 重複チェック | 同じファイルが既に開いていれば、そのタブをアクティブにする |
| **置き換え** | ユーザー設定（将来） | ダブルクリック時に現在のタブを置き換える |

```typescript
// src/store/tabActions.ts
export function openFileInTab(path: string): void {
  // 既に同じファイルが開いていれば、そのタブをアクティブにする
  const existingTab = tabs.find((t) => t.path === path);
  if (existingTab) {
    dispatch(setActiveTab(existingTab.id));
    return;
  }
  // 新しいタブで開く
  dispatch(addTab({ path }));
}
```

---

## 6. 全体アーキテクチャ

### 6.1 アプリケーション構造

```
┌─────────────────────────────────────────────────────┐
│  Tauri App（単一 WebviewWindow）                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  タイトルバー  [● file1.md - MarkdownEditor] │   │
│  ├─────────────────────────────────────────────┤   │
│  │  メニューバー  [ファイル][編集][表示][最近▼] │   │
│  ├─────────────────────────────────────────────┤   │
│  │  タブバー  [● file1.md ×] [file2.md ×] [+]  │   │
│  ├──────────┬──────────────────────────────────┤   │
│  │ サイドバー│  エディタ（TipTap）              │   │
│  │  ファイル │  activeTab の content を表示     │   │
│  │  ツリー  │                                  │   │
│  │  アウト  │                                  │   │
│  │  ライン  │                                  │   │
│  ├──────────┴──────────────────────────────────┤   │
│  │  ステータスバー  行:列 / 文字数 / エンコード  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Zustand Store                                      │
│  ├─ tabs: TabState[]                               │
│  ├─ activeTabId: string                            │
│  ├─ recentFiles: string[]                          │
│  └─ editorMode: EditorMode                         │
└─────────────────────────────────────────────────────┘
              ↕ Tauri Commands / Events
┌─────────────────────────────────────────────────────┐
│  Rust バックエンド                                   │
│  ├─ ファイル I/O（plugin-fs）                       │
│  ├─ セッション保存（plugin-store）                  │
│  ├─ シングルインスタンス制御（plugin-single-instance）│
│  ├─ ファイル変更監視（plugin-fs watch）             │
│  └─ SHAddToRecentDocs（Windows）                   │
└─────────────────────────────────────────────────────┘
```

### 6.2 Tauri プラグイン一覧

| プラグイン | 用途 |
|-----------|------|
| `@tauri-apps/plugin-fs` | ファイル読み書き・変更監視 |
| `@tauri-apps/plugin-dialog` | ネイティブファイルダイアログ・確認ダイアログ |
| `@tauri-apps/plugin-store` | セッション・設定の永続化 |
| `tauri-plugin-single-instance` | シングルインスタンス制御 |
| `@tauri-apps/api/menu` | ネイティブメニュー（最近使ったファイル等） |
| `@tauri-apps/api/webviewWindow` | ウィンドウ制御（タイトル変更・クローズガード） |

---

## 7. 状態管理設計（Zustand）

### 7.1 タブストア

```typescript
// src/store/tabStore.ts
import { create } from 'zustand';

export interface Tab {
  id: string;
  path: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  scrollPosition: number;
  cursorOffset: number;
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;

  addTab: (path: string, content: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, content: string) => void;
  getDirtyFiles: () => string[];
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (path, content) => {
    const id = crypto.randomUUID();
    set((s) => ({
      tabs: [...s.tabs, { id, path, content, savedContent: content, isDirty: false, scrollPosition: 0, cursorOffset: 0 }],
      activeTabId: id,
    }));
  },

  removeTab: (id) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id
          ? (tabs[tabs.length - 1]?.id ?? null)
          : s.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: content !== t.savedContent } : t
      ),
    }));
  },

  markSaved: (id, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, content, savedContent: content, isDirty: false } : t
      ),
    }));
  },

  getDirtyFiles: () => get().tabs.filter((t) => t.isDirty).map((t) => t.path),
}));
```

---

## 8. 実装フェーズ

Phase 1（MVP）に含める機能と、後フェーズに回す機能の区別。

### Phase 1 に含める（MVP）

- [ ] タブバー UI（開く・閉じる・切り替え）
- [ ] Zustand タブストア（`addTab` / `removeTab` / `updateContent` / `markSaved`）
- [ ] `onCloseRequested` による未保存ガード（ウィンドウ閉じる）
- [ ] タブ閉じる時の未保存確認ダイアログ
- [ ] タイトルバーへの未保存マーカー反映
- [ ] セッション復元（plugin-store）
- [ ] ファイル関連付け設定（tauri.conf.json）
- [ ] シングルインスタンス制御（tauri-plugin-single-instance）
- [ ] `useFileOpenListener` フック（外部ファイルオープンイベント受信）

### Phase 3 以降に含める

- [ ] 最近使ったファイル（Tauriネイティブメニュー動的更新）
- [ ] Windows ジャンプリスト登録（`SHAddToRecentDocs`）
- [ ] タブをウィンドウに切り出す機能（WebviewWindow）

---

## 9. 自動保存の詳細仕様

### 9.1 基本動作

編集内容はデバウンスを挟んで自動的にファイルに書き込まれる。ユーザーが `Ctrl+S` を押す必要はないが、明示保存も引き続きサポートする。

```
ユーザーがキーを押す
  → TipTap トランザクション発火
  → debounce タイマーをリセット（500ms）
  → 500ms 後にまだ入力がなければ保存処理を実行
```

### 9.2 ファイルサイズ別のデバウンス設定

大きなファイルでは Markdown シリアライズ自体に時間がかかるため、デバウンス間隔を延長する。

| ファイルサイズ | デバウンス間隔 | 備考 |
|-------------|-------------|------|
| ～ 100KB | **500ms** | 標準（Typora と同等） |
| 100KB ～ 1MB | **1,000ms** | 中規模ファイル |
| 1MB ～ 3MB | **2,000ms** | 大規模ファイル |
| 3MB 以上 | **手動保存のみ**（自動保存無効） | ソースモード固定のため別途対応 |

```typescript
// src/file/auto-save.ts

import { writeTextFile } from '@tauri-apps/plugin-fs';

const DEBOUNCE_TABLE: [number, number][] = [
  // [バイト閾値, デバウンスms]
  [1 * 1024 * 1024, 1000],    // 1MB 以上
  [3 * 1024 * 1024, 2000],    // 3MB 以上
];

export function getAutoSaveDebounce(contentBytes: number): number {
  for (const [threshold, delay] of DEBOUNCE_TABLE.reverse()) {
    if (contentBytes >= threshold) return delay;
  }
  return 500; // デフォルト
}

/** 自動保存の実行（Rustバックエンドの非同期書き込みを使用） */
export async function autoSave(
  filePath: string,
  content: string,
  onStart: () => void,
  onComplete: () => void,
  onError: (err: Error) => void
): Promise<void> {
  onStart(); // ステータスバーに "保存中..." を表示

  try {
    await writeTextFile(filePath, content);
    onComplete(); // ステータスバーに "保存済み ✓" を表示
  } catch (err) {
    onError(err as Error); // トースト通知 "保存に失敗しました"
  }
}
```

### 9.3 保存フロー

```
[TipTap ドキュメント変更]
  │
  ▼
[Zustand tabStore.updateContent(id, content)]
  │ isDirty = true
  ▼
[debounce タイマー起動（ファイルサイズに応じた間隔）]
  │
  ▼（タイマー満了）
[tiptapToMarkdown(editor.getJSON())]  ← Markdown シリアライズ
  │
  ▼
[writeTextFile(path, markdown)]  ← Rust バックエンドで非同期書き込み
  │ 成功
  ▼
[tabStore.markSaved(id, content)]  ← isDirty = false
[ファイルウォッチャーの "自分の保存" フラグを一時セット]
  │ 失敗
  ▼
[トースト通知: 保存失敗、3秒後に再試行]
```

### 9.4 保存失敗時のリトライ

```typescript
// src/file/auto-save.ts

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export async function autoSaveWithRetry(
  filePath: string,
  content: string,
  attempt = 1
): Promise<void> {
  try {
    await writeTextFile(filePath, content);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      // ステータスバーに "保存に失敗。再試行中 (1/3)..."
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return autoSaveWithRetry(filePath, content, attempt + 1);
    }
    // 最大リトライ超過: ユーザーに明示的な対処を促す
    showPersistentError(`"${basename(filePath)}" の保存に失敗しました。ディスク容量を確認してください。`);
  }
}
```

### 9.5 並行保存の防止

デバウンス中に Ctrl+S が押された場合、進行中の保存をキャンセルして即座に保存する。
ただし、**2つの保存処理が同時に走らないよう**ロックフラグを設ける。

```typescript
// src/file/auto-save.ts

let isSaving = false;
let pendingContent: string | null = null;

export async function scheduleSave(filePath: string, content: string): Promise<void> {
  if (isSaving) {
    // 現在保存中なら完了後に最新内容で再保存
    pendingContent = content;
    return;
  }

  isSaving = true;
  try {
    await writeTextFile(filePath, content);
  } finally {
    isSaving = false;
    if (pendingContent !== null) {
      const next = pendingContent;
      pendingContent = null;
      await scheduleSave(filePath, next); // 保留していた内容を保存
    }
  }
}
```

---

## 10. クラッシュリカバリ設計

### 10.1 概要

アプリが正常終了しなかった場合（クラッシュ、強制終了、システムシャットダウン等）に、
未保存の変更を次回起動時に復元する仕組み。

**設計方針**: `@tauri-apps/plugin-store` を使ったチェックポイントベースのリカバリ。

```
通常の動作:
  [編集]  →  [チェックポイント保存（30秒ごと）]  →  [自動保存（500ms debounce）]

クラッシュ発生:
  [クラッシュ] → チェックポイントが残る

次回起動時:
  [チェックポイントを検出] → [リカバリダイアログ表示] → [ユーザーが選択]
```

### 10.2 チェックポイントの実装

```typescript
// src/store/crash-recovery.ts

import { load } from '@tauri-apps/plugin-store';

const RECOVERY_STORE = 'crash-recovery.json';
const CHECKPOINT_INTERVAL_MS = 30_000; // 30秒ごと

export interface RecoveryEntry {
  filePath: string;
  content: string;           // エディタ内の最新テキスト（Markdownシリアライズ後）
  savedContent: string;      // 最後にディスクに書き込んだテキスト
  checkpointAt: string;      // ISO 8601 タイムスタンプ
}

/**
 * アクティブな全タブのチェックポイントを保存する。
 * 正常終了時には clearRecoveryData() を呼んで削除する。
 */
export async function saveCheckpoint(entries: RecoveryEntry[]): Promise<void> {
  const store = await load(RECOVERY_STORE, { autoSave: false });
  await store.set('entries', entries);
  await store.set('appVersion', APP_VERSION);
  await store.save();
}

/** 正常終了時にリカバリデータを削除する */
export async function clearRecoveryData(): Promise<void> {
  const store = await load(RECOVERY_STORE, { autoSave: false });
  await store.clear();
  await store.save();
}

/** 起動時にリカバリデータが残っているか確認する */
export async function loadRecoveryData(): Promise<RecoveryEntry[] | null> {
  const store = await load(RECOVERY_STORE, { autoSave: false });
  const entries = await store.get<RecoveryEntry[]>('entries');
  if (!entries || entries.length === 0) return null;

  // content と savedContent が一致するエントリ（実際に未保存でないもの）を除外
  const dirty = entries.filter((e) => e.content !== e.savedContent);
  return dirty.length > 0 ? dirty : null;
}
```

### 10.3 チェックポイントのスケジューリング

```typescript
// src/store/crash-recovery.ts

export function startCheckpointScheduler(
  getEntries: () => RecoveryEntry[]
): () => void {
  const intervalId = setInterval(async () => {
    const entries = getEntries();
    if (entries.some((e) => e.content !== e.savedContent)) {
      await saveCheckpoint(entries);
    }
  }, CHECKPOINT_INTERVAL_MS);

  return () => clearInterval(intervalId); // クリーンアップ関数を返す
}
```

```tsx
// src/app.tsx での利用
useEffect(() => {
  const cleanup = startCheckpointScheduler(() =>
    useTabStore.getState().tabs.map((tab) => ({
      filePath: tab.path,
      content: tab.content,
      savedContent: tab.savedContent,
      checkpointAt: new Date().toISOString(),
    }))
  );
  return cleanup;
}, []);
```

### 10.4 起動時のリカバリダイアログ

```tsx
// src/components/RecoveryDialog.tsx

interface RecoveryDialogProps {
  entries: RecoveryEntry[];
  onRestore: (entries: RecoveryEntry[]) => void;
  onDiscard: () => void;
}

export function RecoveryDialog({ entries, onRestore, onDiscard }: RecoveryDialogProps) {
  return (
    <Modal title="前回の変更を復元しますか？">
      <p>
        前回の終了時に保存されていない変更が見つかりました。
        復元すると、チェックポイント（最大30秒前）の状態に戻ります。
      </p>
      <ul>
        {entries.map((e) => (
          <li key={e.filePath}>
            {basename(e.filePath)} —{' '}
            <span className="text-muted">
              {new Date(e.checkpointAt).toLocaleString('ja-JP')} 時点
            </span>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button onClick={() => onRestore(entries)}>復元する</button>
        <button onClick={onDiscard}>破棄して最新ファイルを開く</button>
      </div>
    </Modal>
  );
}
```

### 10.5 正常終了フロー（リカバリデータの削除）

```typescript
// src/hooks/useCloseGuard.ts（既存コードに追記）

// アプリが正常に終了する直前に呼ぶ
export async function onNormalExit(): Promise<void> {
  await saveSession(getCurrentSession());  // セッション保存
  await clearRecoveryData();               // リカバリデータを削除（正常終了）
}
```

`onCloseRequested` → ユーザーが「閉じる」を承認 → `onNormalExit()` → `appWindow.destroy()`

### 10.6 リカバリデータの保持期間

| 状態 | 対応 |
|------|------|
| 正常終了 | リカバリデータを即座に削除 |
| クラッシュ後の次回起動（リカバリあり） | ダイアログで復元/破棄を選択させる |
| クラッシュ後の次回起動（変更なし） | リカバリデータを自動削除（ユーザー通知なし） |
| 7日以上古いリカバリデータ | 起動時に自動削除（タイムスタンプで判定） |

---

*このドキュメントは設計の方向性を示すものであり、実装進行に伴い更新される。*
