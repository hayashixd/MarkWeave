# ウィンドウ・タブ・セッション管理 設計ドキュメント

> プロジェクト: Markdown / HTML Editor
> バージョン: 1.0
> 更新日: 2026-02-25

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
9. [自動保存の詳細仕様](#9-自動保存の詳細仕様)
10. [クラッシュリカバリ設計](#10-クラッシュリカバリ設計)
11. [複数 WebviewWindow 設計（Phase 5+）](#11-複数-webviewwindow-設計phase-5)
12. [Undo / Redo 整合性と排他制御](#12-undo--redo-整合性と排他制御)

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

### 2.5 セッション復元と LRU タブ上限の整合性

Phase 4 以降で LRU（最近使用順）によるタブ上限（最大 5 タブ / `performance-design.md §7.2`）を導入する場合、
保存されているタブ数が上限を超えていることがある。その際の挙動は以下のとおり:

1. 保存セッションを最終アクセス日時（`FileSession.lastAccessedAt`）の降順に並び替える
2. 先頭 5 件を復元してエディタに開く
3. 残りのファイルはタブとして開かず、「前回のセッションから未復元のファイル」リストを
   ステータスバーまたは通知で提示する（クリックで任意に開けるようにする）
4. このリストは次回の `saveSession()` では含めない（明示的に開いた場合のみ保存対象になる）

```typescript
// セッション復元時の LRU フィルタリング（Phase 4 以降）
const MAX_RESTORED_TABS = 5;

const sortedByAccess = validFiles.sort(
  (a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0)
);
const restoredFiles = sortedByAccess.slice(0, MAX_RESTORED_TABS);
const overflowFiles = sortedByAccess.slice(MAX_RESTORED_TABS);
// overflowFiles を UI に提示（任意復元リスト）
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

/**
 * ファイルサイズ別デバウンス設定テーブル（降順に並べること）。
 * §9.2 の表と一致させる。
 * 3MB 以上は自動保存を行わない（手動保存のみ）ため、ここでは 3MB 未満のみ定義する。
 */
const DEBOUNCE_TABLE: [number, number][] = [
  // [バイト閾値（以上）, デバウンスms] — 降順で記述すること
  [1 * 1024 * 1024,  2000],   // 1MB 以上 3MB 未満
  [100 * 1024,       1000],   // 100KB 以上 1MB 未満
  // 100KB 未満 → デフォルト 500ms（下記 return）
];

/**
 * ファイルサイズに応じたデバウンス間隔（ms）を返す。
 * 3MB 以上は null を返し、呼び出し元で自動保存をスキップする。
 *
 * @param contentBytes - Markdown 文字列のバイト数（TextEncoder().encode(content).length）
 * @returns デバウンス間隔（ms）。null = 自動保存を行わない（手動保存のみ）
 */
export function getAutoSaveDebounce(contentBytes: number): number | null {
  const AUTO_SAVE_MAX_BYTES = 3 * 1024 * 1024; // 3MB
  if (contentBytes >= AUTO_SAVE_MAX_BYTES) return null; // 自動保存無効

  // 降順テーブルを先頭から検索し、最初にヒットした閾値のデバウンスを返す
  for (const [threshold, delay] of DEBOUNCE_TABLE) {
    if (contentBytes >= threshold) return delay;
  }
  return 500; // デフォルト（100KB 未満）
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

#### レースコンディションの回避

`session.json` と `crash-recovery.json` を別々に保存・削除すると、次の問題が起きる：

```
問題シナリオ（修正前）:
  1. onNormalExit() → saveSession() 成功
  2. onNormalExit() → clearRecoveryData() 失敗（ディスクエラー等）
  → 次回起動時: session.json にタブ一覧 + crash-recovery.json に未保存エントリ
  → セッション復元 AND リカバリダイアログが両方表示される

問題シナリオ2（修正前）:
  1. ユーザーが Ctrl+S で保存 → autoSave() 成功（content == savedContent）
  2. クラッシュ → crash-recovery.json に content == savedContent のエントリが残る
  → 次回起動時: "未保存の変更" として誤検知
  （loadRecoveryData() で content !== savedContent をフィルタするが、
    チェックポイント後にさらに保存が走るとこの条件が成立しないケースがある）
```

#### 修正後の正常終了フロー

**原則**: `clearRecoveryData()` を `saveSession()` の**前に**呼ぶ。
こうすることで「リカバリデータが消えていてセッションもない」状態は発生せず、
最悪でも「リカバリデータが残っているだけ」という安全な状態になる。

```typescript
// src/hooks/useCloseGuard.ts（修正後）

/**
 * アプリが正常に終了する直前に呼ぶ。
 *
 * 順序が重要:
 *   1. リカバリデータを先に削除（失敗しても次回起動時にユーザーに確認するだけ）
 *   2. セッションを保存（失敗しても前回のセッションで起動するだけ）
 */
export async function onNormalExit(): Promise<void> {
  // Step 1: リカバリデータを削除（正常終了フラグ）
  try {
    await clearRecoveryData();
  } catch {
    // 削除失敗は許容（次回起動時に loadRecoveryData が content/savedContent 比較で無害と判定）
    console.warn('[onNormalExit] clearRecoveryData failed');
  }

  // Step 2: セッション状態を保存
  try {
    await saveSession(getCurrentSession());
  } catch {
    console.warn('[onNormalExit] saveSession failed');
  }
}
```

#### 起動時のリカバリ判定の強化

起動時に「本当にクラッシュしたか」を確実に判定するため、
`session.json` に `lastCleanExit: boolean` フラグを追加する。
正常終了時に `true`、次回起動時に `false` にリセットする。

```typescript
// src/store/session.ts

export interface SessionState {
  openFiles: FileSession[];
  activeFilePath: string | null;
  editorMode: 'typora' | 'wysiwyg' | 'source' | 'split';
  sidebarVisible: boolean;
  sidebarWidth: number;
  lastCleanExit: boolean;  // ← 追加: 正常終了した場合のみ true
}

// 起動時のリカバリ判定
export async function checkNeedsRecovery(): Promise<RecoveryEntry[] | null> {
  const session = await loadSession();

  // 正常終了していた場合はリカバリ不要
  if (session?.lastCleanExit === true) return null;

  // クラッシュ（または初回起動）の場合のみリカバリデータを確認
  return await loadRecoveryData();
}

// onNormalExit() に追記
export async function onNormalExit(): Promise<void> {
  try { await clearRecoveryData(); } catch { /* 許容 */ }
  try {
    await saveSession({
      ...getCurrentSession(),
      lastCleanExit: true,  // ← 正常終了フラグをセット
    });
  } catch { /* 許容 */ }
}
```

```
起動時のフロー（修正後）:
  [session.json を読み込む]
  → lastCleanExit == true の場合:
       → リカバリスキップ（正常終了済み）
       → lastCleanExit を false にリセットして再保存
  → lastCleanExit == false / undefined の場合（クラッシュ):
       → crash-recovery.json を確認
       → dirty エントリがあればリカバリダイアログを表示
```

`onCloseRequested` → ユーザーが「閉じる」を承認 → `onNormalExit()` → `appWindow.destroy()`

### 10.6 リカバリデータの保持期間

| 状態 | 対応 |
|------|------|
| 正常終了 | リカバリデータを即座に削除 |
| クラッシュ後の次回起動（リカバリあり） | ダイアログで復元/破棄を選択させる |
| クラッシュ後の次回起動（変更なし） | リカバリデータを自動削除（ユーザー通知なし） |
| 7日以上古いリカバリデータ | 起動時に自動削除（タイムスタンプで判定） |

### 10.7 3MB 超ファイルのクラッシュリカバリ

`§9.2` の自動保存仕様により 3MB 超のファイルは自動保存を行わない（手動保存のみ）。
この仕様はクラッシュリカバリにも影響する。

**課題**: チェックポイント保存（§10.2）は 30 秒ごとに全タブの内容を `content` フィールドに書き込む。
3MB 超のファイルの場合、チェックポイント自体は動作するが、ストアに 3MB 以上の文字列を書き込む
コストが問題になる可能性がある。

**方針**:
1. **ユーザー向け警告の表示**: 3MB 超のファイルを開いた際にステータスバーへ警告を表示する
   「⚠ このファイルはクラッシュ時に未保存の変更が失われる可能性があります（定期的に Ctrl+S で保存してください）」
2. **差分チェックポイント（Phase 4+ の改善候補）**: フルコンテンツではなく変更行のみを記録する
   軽量なチェックポイント方式を将来的に検討する
3. **現フェーズの方針**: Phase 1〜3 では警告表示のみを実装し、差分チェックポイントは Phase 4 で検討する

```typescript
// src/store/auto-save.ts — 3MB 超ファイルの警告表示
const AUTO_SAVE_MAX_BYTES = 3 * 1024 * 1024;

if (contentBytes >= AUTO_SAVE_MAX_BYTES) {
  // 自動保存はスキップ
  setStatusBarWarning(
    '⚠ ファイルが大きいため自動保存は無効です。Ctrl+S で定期的に保存してください。'
  );
  return; // チェックポイントも記録しない（ストアへの書き込みコスト回避）
}
```

---

---

## 11. 複数 WebviewWindow 設計（Phase 5+）

### 11.1 アーキテクチャ概要

Phase 5 以降でタブをウィンドウに切り出す機能を実装する際、Tauri の `WebviewWindow` はそれぞれ独立した Renderer プロセスを持つため、React の Zustand ストアはウィンドウ間で共有されない。

```
┌─────────────────────────┐   ┌─────────────────────────┐
│  WebviewWindow 1         │   │  WebviewWindow 2         │
│  ┌─────────────────────┐│   │  ┌─────────────────────┐ │
│  │ React + Zustand     ││   │  │ React + Zustand     │ │
│  │ tabStore（独立）     ││   │  │ tabStore（独立）     │ │
│  └─────────────────────┘│   │  └─────────────────────┘ │
│  Renderer Process 1      │   │  Renderer Process 2      │
└────────────┬────────────┘   └────────────┬────────────┘
             │                             │
             └──────────────┬──────────────┘
                            │ IPC（同期が必要な状態）
                            ▼
          ┌─────────────────────────────────┐
          │  Rust バックエンド（全ウィンドウ共有） │
          │  - ファイル I/O                  │
          │  - 設定（plugin-store）          │
          │  - ファイルロック Registry       │
          │  - Source of Truth              │
          └─────────────────────────────────┘
```

### 11.2 IPC 方式の選定：BroadcastChannel vs Tauri Events

ウィンドウ間での状態同期に使用できる方式を比較する。

| 観点 | BroadcastChannel API | Tauri Events |
|------|---------------------|--------------|
| **方向** | 同一オリジンの全ウィンドウへブロードキャスト | Rust → フロントエンド、またはフロントエンド → Rust → フロントエンド |
| **Rust 関与** | 不要（フロントエンドのみで完結） | 必要（Rust がメッセージのルーティングに関与） |
| **信頼性** | 独立した Renderer プロセス間では動作が保証されない | Tauri IPC は Renderer → Rust → Renderer の経路で確実に動作 |
| **Source of Truth** | フロントエンドに分散 | Rust バックエンドに集中管理できる |
| **実装コスト** | 低 | 中 |

**採用方針**: **Tauri Events（Rust バックエンドを Source of Truth とする）**

理由:
1. BroadcastChannel は同一プロセス内の共有メモリに依存する実装が多く、Tauri の異なる WebviewWindow（独立した Renderer プロセス）では動作が保証されない
2. Rust バックエンドを Source of Truth とすることで、設定・ファイルロック状態・ワークスペース状態の整合性を保証しやすい
3. Tauri Events は `app.emit_to(label, ...)` で特定のウィンドウへ、または `app.emit(...)` で全ウィンドウへ送信できる

### 11.3 IPC メッセージペイロード定義

同期が必要な状態と対応するイベント名を定義する。

```typescript
// src/ipc/window-sync-events.ts

/**
 * ウィンドウ間同期イベントの種別と対応するペイロード型。
 * Tauri Events の payload フィールドに JSON シリアライズして送受信する。
 */
export type WindowSyncEventMap = {
  'settings-changed':        SettingsChangedPayload;
  'file-opened':             FileOpenedPayload;
  'file-closed':             FileClosedPayload;
  'file-saved':              FileSavedPayload;
  'workspace-changed':       WorkspaceChangedPayload;
  'file-lock-acquired':      FileLockPayload;
  'file-lock-released':      FileLockPayload;
  'write-access-transfer-requested': WriteAccessTransferPayload;
};

/** 設定変更（テーマ・フォントサイズ等）*/
export interface SettingsChangedPayload {
  key: string;     // 変更された設定キー（例: "theme", "fontSize"）
  value: unknown;  // 新しい値
}

/** あるウィンドウでファイルが開かれた（ロック通知用）*/
export interface FileOpenedPayload {
  windowLabel: string; // 開いたウィンドウの Tauri label（例: "main", "window-2"）
  filePath: string;
  isReadOnly: boolean; // 別ウィンドウがロック中のため読み取り専用で開いた場合 true
}

/** あるウィンドウでファイルが閉じられた（ロック解放通知）*/
export interface FileClosedPayload {
  windowLabel: string;
  filePath: string;
}

/** あるウィンドウでファイルが保存された（他ウィンドウへ外部変更通知）*/
export interface FileSavedPayload {
  windowLabel: string;
  filePath: string;
  savedAt: string; // ISO 8601
}

/** ワークスペース（フォルダ）の変更 */
export interface WorkspaceChangedPayload {
  workspacePath: string | null;
}

/** ファイルロック状態の変更 */
export interface FileLockPayload {
  filePath: string;
  windowLabel: string; // ロックを保有するウィンドウの label
}

/** Read-Only ウィンドウが書き込みウィンドウに権限譲渡をリクエスト */
export interface WriteAccessTransferPayload {
  filePath: string;
  requesterLabel: string; // 権限をほしいウィンドウ
  ownerLabel: string;     // 現在の書き込みウィンドウ
}
```

```rust
// src-tauri/src/commands/window_sync.rs
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// ファイルロック状態を Rust 側で一元管理する（Source of Truth）
pub struct FileLockRegistry(pub Mutex<HashMap<String, String>>);
//                                               ^ path  ^ window_label

impl FileLockRegistry {
    /// ロックの取得を試みる。成功すれば true を返す。
    pub fn try_acquire(&self, file_path: &str, window_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.contains_key(file_path) {
            return false;
        }
        map.insert(file_path.to_string(), window_label.to_string());
        true
    }

    /// ロックを解放する。保有者のみ解放できる。
    pub fn release(&self, file_path: &str, window_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.get(file_path).map(|s| s.as_str()) == Some(window_label) {
            map.remove(file_path);
            return true;
        }
        false
    }

    /// ロック保有者のウィンドウ label を返す。
    pub fn get_owner(&self, file_path: &str) -> Option<String> {
        self.0.lock().unwrap().get(file_path).cloned()
    }

    /// ロック保有者を別のウィンドウに移譲する。
    pub fn transfer(&self, file_path: &str, from_label: &str, to_label: &str) -> bool {
        let mut map = self.0.lock().unwrap();
        if map.get(file_path).map(|s| s.as_str()) == Some(from_label) {
            map.insert(file_path.to_string(), to_label.to_string());
            return true;
        }
        false
    }
}

#[tauri::command]
pub fn try_acquire_file_lock(
    app: AppHandle,
    registry: State<FileLockRegistry>,
    file_path: String,
    window_label: String,
) -> serde_json::Value {
    if registry.try_acquire(&file_path, &window_label) {
        // ロック取得成功：全ウィンドウに通知
        let _ = app.emit("file-lock-acquired", serde_json::json!({
            "filePath": file_path,
            "windowLabel": window_label,
        }));
        serde_json::json!({ "acquired": true, "ownerLabel": null })
    } else {
        let owner = registry.get_owner(&file_path);
        serde_json::json!({ "acquired": false, "ownerLabel": owner })
    }
}

#[tauri::command]
pub fn release_file_lock(
    app: AppHandle,
    registry: State<FileLockRegistry>,
    file_path: String,
    window_label: String,
) {
    if registry.release(&file_path, &window_label) {
        let _ = app.emit("file-lock-released", serde_json::json!({
            "filePath": file_path,
            "windowLabel": window_label,
        }));
    }
}
```

### 11.4 Zustand ストアのウィンドウ間同期

各ウィンドウの Zustand は独立しているため、同期が必要な状態（設定・ワークスペース）は Tauri Events を受信して更新する。

```typescript
// src/hooks/useWindowSync.ts
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useSettingsStore } from '../store/settingsStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useTabStore } from '../store/tabStore';

/**
 * 他のウィンドウからの状態変更イベントを受信して Zustand ストアを更新する。
 * AppRoot コンポーネントで一度だけマウントする。
 */
export function useWindowSync() {
  useEffect(() => {
    const unlisten: Array<() => void> = [];
    const myLabel = getCurrentWebviewWindow().label;

    // 設定変更の同期（テーマ・フォントサイズ等）
    listen<SettingsChangedPayload>('settings-changed', ({ payload }) => {
      useSettingsStore.getState().setFromSync(payload.key, payload.value);
    }).then((fn) => unlisten.push(fn));

    // ワークスペース変更の同期
    listen<WorkspaceChangedPayload>('workspace-changed', ({ payload }) => {
      useWorkspaceStore.getState().setWorkspace(payload.workspacePath);
    }).then((fn) => unlisten.push(fn));

    // 他ウィンドウでのファイル保存通知（外部変更ダイアログのトリガー）
    listen<FileSavedPayload>('file-saved', ({ payload }) => {
      if (payload.windowLabel === myLabel) return; // 自分の保存は無視

      const openTab = useTabStore
        .getState()
        .tabs.find((t) => t.path === payload.filePath);
      if (openTab) {
        // 外部変更検知フラグを立てる（既存の外部変更通知フローに乗せる）
        useFileWatchStore.getState().markExternalChange(payload.filePath);
      }
    }).then((fn) => unlisten.push(fn));

    // ファイルロック解放通知（Read-Only → 書き込み可能に切り替えを促す）
    listen<FileLockPayload>('file-lock-released', ({ payload }) => {
      const tab = useTabStore
        .getState()
        .tabs.find((t) => t.path === payload.filePath && t.isReadOnly);
      if (tab) {
        useToastStore.getState().show(
          'info',
          `「${basename(tab.path)}」の編集ロックが解放されました。編集できます。`,
          {
            label: '編集を開始',
            onClick: () => acquireFileLock(tab.path),
          }
        );
      }
    }).then((fn) => unlisten.push(fn));

    return () => unlisten.forEach((fn) => fn());
  }, []);
}
```

### 11.5 同一ファイル多重オープンの制御

同じファイルを複数ウィンドウで**書き込み可能モード**で同時に開くと、後から保存した方が先の変更を上書きしてしまう。**ファイルロック機構**（§12 参照）によりこれを防ぐ。

**同一ファイルを別ウィンドウで開こうとしたときのフロー**:

```
[Window 2 で既にロック済みのファイルを開こうとする]
  │
  ▼
[Rust: try_acquire_file_lock → { acquired: false, ownerLabel: "main" }]
  │
  ▼
  ┌──────────────────────────────────────────────┐
  │  このファイルは別のウィンドウで開かれています  │
  │                                              │
  │  「note.md」はウィンドウ 1 で編集中です。     │
  │  読み取り専用で開きますか？                  │
  │                                              │
  │     [読み取り専用で開く]   [キャンセル]       │
  └──────────────────────────────────────────────┘
```

```typescript
// src/file/fileManager.ts（マルチウィンドウ対応）
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ask } from '@tauri-apps/plugin-dialog';

export async function openFileInWindow(filePath: string): Promise<void> {
  const windowLabel = getCurrentWebviewWindow().label;

  const lockResult = await invoke<{ acquired: boolean; ownerLabel: string | null }>(
    'try_acquire_file_lock',
    { filePath, windowLabel }
  );

  if (lockResult.acquired) {
    await openFileWritable(filePath);
    await invoke('notify_file_opened', { windowLabel, filePath, isReadOnly: false });
  } else {
    const confirmed = await ask(
      `「${basename(filePath)}」は別のウィンドウで編集中です。\n読み取り専用で開きますか？`,
      {
        title: 'ファイルが開かれています',
        okLabel: '読み取り専用で開く',
        cancelLabel: 'キャンセル',
      }
    );
    if (confirmed) {
      await openFileReadOnly(filePath);
      await invoke('notify_file_opened', { windowLabel, filePath, isReadOnly: true });
    }
  }
}
```

---

## 12. Undo / Redo 整合性と排他制御

### 12.1 問題定義

ProseMirror / TipTap の Undo 履歴（`EditorHistory`）は各ウィンドウの Renderer プロセスに独立して存在する。同一ファイルを 2 つのウィンドウで書き込み可能モードで開いた場合、次のような問題が生じる。

```
シナリオ: note.md を Window 1（書き込み）と Window 2（書き込み）の両方で開く

[Window 1]: 段落 A を追加 → 自動保存（disk: A）
[Window 2]: 段落 B を追加 → 自動保存（disk: B ← A が上書きされ消える）
[Window 1]: Undo → 「段落 A 追加前」の状態をディスクに書き込む（disk: 段落なし）
                    → Window 2 が書いた段落 B も消える

→ 段落 B が失われる！
```

この問題はファイルロック機構（§12.2）で根本的に回避する。

### 12.2 ファイルロック機構による排他制御（採用方針）

**設計方針**: ファイルは必ず 1 ウィンドウだけが書き込み権限を持つ。他のウィンドウは Read-Only モードでのみ開ける。

これにより Undo/Redo の整合性問題は根本的に回避できる。

**Read-Only モードの仕様**:

| 機能 | 書き込みモード | Read-Only モード |
|------|-------------|----------------|
| テキスト編集 | ✅ | ❌（入力を無効化） |
| Undo / Redo | ✅ | ❌ |
| 自動保存 | ✅ | ❌ |
| コピー / 検索 | ✅ | ✅ |
| 外部変更の自動リロード | ✅ | ✅（書き込みウィンドウが保存したら即リロード） |

```typescript
// src/store/tabStore.ts（Read-Only フラグ追加）
export interface Tab {
  id: string;
  path: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  scrollPosition: number;
  cursorOffset: number;
  isReadOnly: boolean; // ← 追加: true のとき編集・Undo 不可
}
```

```typescript
// src/components/Editor/EditorWrapper.tsx
export function EditorWrapper({ tab }: { tab: Tab }) {
  return (
    <div className={`editor-wrapper ${tab.isReadOnly ? 'read-only' : ''}`}>
      {tab.isReadOnly && (
        <div className="read-only-banner" role="status">
          🔒 読み取り専用（別のウィンドウで編集中）
          <button onClick={() => requestWriteAccess(tab.path)}>
            編集権限を取得する
          </button>
        </div>
      )}
      <TipTapEditor
        editable={!tab.isReadOnly}
        content={tab.content}
        // editable=false のとき TipTap は入力・Undo/Redo を無効化する
      />
    </div>
  );
}
```

### 12.3 書き込み権限の譲渡フロー

Read-Only ウィンドウから「編集権限を取得する」ボタンを押したとき、現在の書き込みウィンドウへ権限譲渡をリクエストする。

```
[Window 2（Read-Only）が「編集権限を取得」を押す]
  │
  ▼
[Rust: write_access_transfer_requested イベントを Window 1 に送信]
  │
  ▼
[Window 1: 確認ダイアログを表示]
  ┌──────────────────────────────────────────────────┐
  │  別のウィンドウが編集権限をリクエストしています     │
  │                                                  │
  │  ウィンドウ 2 が「note.md」の編集権限を要求中です。 │
  │  このウィンドウでの編集権限を手放しますか？         │
  │                                                  │
  │    [権限を譲渡する（Read-Only になる）]  [拒否]    │
  └──────────────────────────────────────────────────┘
  │
  ├─ 譲渡する
  │    → Window 1 が Read-Only になる
  │    → Rust: FileLockRegistry で所有者を Window 2 に変更
  │    → 全ウィンドウに "file-lock-acquired/released" イベント送信
  │
  └─ 拒否する → Window 2 に拒否通知（トースト）
```

```typescript
// src/hooks/useWriteAccessTransfer.ts

/** Window 1 側: 権限譲渡リクエストを受信して確認ダイアログを表示する */
export function useWriteAccessTransferHandler() {
  useEffect(() => {
    const unlistenPromise = listen<WriteAccessTransferPayload>(
      'write-access-transfer-requested',
      async ({ payload }) => {
        const myLabel = getCurrentWebviewWindow().label;
        if (payload.ownerLabel !== myLabel) return; // 自分宛てでなければ無視

        const confirmed = await ask(
          `ウィンドウ 2 が「${basename(payload.filePath)}」の編集権限を要求しています。\n` +
            'このウィンドウは読み取り専用になります。権限を譲渡しますか？',
          { title: '編集権限の譲渡', okLabel: '譲渡する', cancelLabel: '拒否' }
        );

        if (confirmed) {
          await invoke('transfer_file_lock', {
            filePath: payload.filePath,
            fromLabel: myLabel,
            toLabel: payload.requesterLabel,
          });
          // 自ウィンドウのタブを Read-Only に変更
          useTabStore.getState().setReadOnly(payload.filePath, true);
        } else {
          // 拒否通知を requester に送信
          await invoke('notify_write_access_denied', {
            filePath: payload.filePath,
            requesterLabel: payload.requesterLabel,
          });
        }
      }
    );
    return () => { unlistenPromise.then((fn) => fn()); };
  }, []);
}
```

### 12.4 Yjs CRDT による同期（将来オプションとしての検討）

ファイルロックによる排他制御の代わりに Yjs などの CRDT を導入することで、複数ウィンドウからの真のリアルタイム同時編集を実現できる。

**比較**:

| 観点 | ファイルロック（Phase 5 採用） | Yjs CRDT（将来オプション） |
|------|--------------------------|------------------------|
| **実装コスト** | 低（Phase 5 で実装可能） | 高（`@tiptap/extension-collaboration` + `y-protocols` 必要） |
| **ユーザー体験** | 1 ウィンドウのみ編集可能 | 複数ウィンドウで同時編集可能 |
| **Undo の整合性** | 完全（書き込みウィンドウのみ履歴あり） | `Y.UndoManager` で各ウィンドウ独立管理 |
| **ネットワーク** | 不要（ローカル IPC のみ） | 不要（Y-IPC や SharedArrayBuffer でローカル同期可能） |
| **ファイル保存** | シンプル（書き込みウィンドウが責任を持つ） | Y.Doc → Markdown のシリアライズコストが発生 |

**採用決定**: Phase 5 では**ファイルロック方式**を採用する。Yjs の導入は「複数ウィンドウからの同時コラボレーション」が明確なニーズとして浮上した段階で Phase 6 以降に再検討する。

### 12.5 実装フェーズ（複数ウィンドウ関連）

| フェーズ | 実装内容 |
|---------|---------|
| Phase 5（前半）| タブのウィンドウ切り出し UI、`FileLockRegistry`（Rust）、`try_acquire_file_lock` / `release_file_lock` コマンド、`notify_file_opened/closed` イベント、Read-Only モードのエディタ表示 |
| Phase 5（後半）| 設定・ワークスペースのウィンドウ間同期（`useWindowSync` フック）、書き込み権限譲渡フロー（`useWriteAccessTransferHandler`）、ファイルロック解放通知によるトースト |
| Phase 6（将来）| Yjs CRDT の評価・試験実装（同時編集ニーズが確定した場合） |

---

*このドキュメントは設計の方向性を示すものであり、実装進行に伴い更新される。*
