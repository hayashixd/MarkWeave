# フォルダ/ワークスペース管理設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [概要と設計方針](#1-概要と設計方針)
2. [ワークスペースの概念設計](#2-ワークスペースの概念設計)
3. [ファイルツリー UI 設計](#3-ファイルツリー-ui-設計)
4. [外部ファイル変更の検知と対応](#4-外部ファイル変更の検知と対応)
5. [クロスファイルリンクの解決](#5-クロスファイルリンクの解決)
6. [ファイル操作（作成・削除・リネーム・移動）](#6-ファイル操作作成削除リネーム移動)
7. [フォルダ内全文検索との連携](#7-フォルダ内全文検索との連携)
8. [状態管理設計（Zustand）](#8-状態管理設計zustand)
9. [実装フェーズ](#9-実装フェーズ)

---

## 1. 概要と設計方針

### 1.1 ワークスペースとは

**ワークスペース** = ユーザーが「フォルダを開く」操作で指定したディレクトリ。
エディタはそのフォルダを起点としてファイルツリーを表示し、フォルダ内の `.md`・`.html` ファイルを一元管理する。

Typora における「フォルダを開く」機能に相当する。

### 1.2 設計方針

| 方針 | 詳細 |
|------|------|
| **シングルワークスペース** | 同時に開けるワークスペースは 1 つのみ。複数フォルダのマージは対象外 |
| **非破壊操作** | ファイルツリーからの削除は OS のゴミ箱へ移動（完全削除ではない）|
| **リンク自動修正の非実装**（MVP）| ファイルのリネーム・移動で既存の Markdown リンクは更新しない。Phase 7 以降で検討 |
| **タブとの連携** | ファイルツリーでファイルをクリック → 既存タブがあればそれをアクティブにし、なければ新規タブで開く |

---

## 2. ワークスペースの概念設計

### 2.1 ワークスペースを開く手段

| 手段 | 操作 |
|------|------|
| メニュー → ファイル → フォルダを開く | フォルダ選択ダイアログ |
| `Ctrl+Shift+O` | 同上 |
| ドラッグ＆ドロップ | フォルダをウィンドウにドロップ |
| コマンドライン引数 | `md-editor /path/to/folder` |
| セッション復元 | 前回開いていたワークスペースを起動時に自動復元 |

### 2.2 ワークスペースの状態

```
ワークスペースなし（起動直後）
  │
  ├─ ファイルを開く → タブ管理のみ（ファイルツリーなし）
  │
  └─ フォルダを開く → ワークスペースに移行
                          │
                          ├─ ファイルツリーサイドバーを表示
                          ├─ ワークスペースルートを記憶
                          └─ セッション保存に含める
```

### 2.3 セッションへの保存

[window-tab-session-design.md](./window-tab-session-design.md) のセッション設計と連携し、
ワークスペースのルートパスをセッションデータに含める。

```typescript
// window-tab-session-design.md の SessionData に追加
interface SessionData {
  tabs: TabState[];
  activeTabId: string;
  workspaceRoot: string | null;  // ← 追加
}
```

---

## 3. ファイルツリー UI 設計

### 3.1 表示構成

```
┌──────────────────────────────────────────┐
│ ≡  my-notes              [+] [↺] [✕]    │  ← ヘッダー
├──────────────────────────────────────────┤
│ 🔍 検索...                               │  ← フィルタ入力
├──────────────────────────────────────────┤
│ ▾ 📁 my-notes                           │
│   ▾ 📁 blog                             │
│   │   📄 2026-01-intro.md              │
│   │   📄 2026-02-tauri.md   ●          │  ● = 未保存
│   ▸ 📁 drafts                          │
│   📄 README.md                          │
│   📄 index.html                         │
└──────────────────────────────────────────┘
```

### 3.2 表示するファイル種別

| ファイル種別 | 表示 | 備考 |
|-----------|------|------|
| `.md` | ✅ | |
| `.html` | ✅ | HTML 編集モードで開く（Phase 5）|
| `.txt` | ❌ | 対象外 |
| ドットファイル（`.gitignore` 等）| ❌ | 非表示（設定で変更可能・将来）|
| `.git/` ディレクトリ | ❌ | 常に非表示 |
| `node_modules/` | ❌ | 常に非表示 |

### 3.3 操作一覧

| 操作 | 方法 |
|------|------|
| ファイルを開く | シングルクリック（既存タブへフォーカス or 新規タブ）|
| フォルダを展開/折りたたむ | クリック or 矢印キー |
| コンテキストメニューを開く | 右クリック |
| ファイルをリネーム | コンテキストメニュー → リネーム or `F2` |
| ファイルを削除 | コンテキストメニュー → 削除（ゴミ箱へ）or `Delete` |
| 新規ファイルを作成 | コンテキストメニュー → 新規ファイル or ヘッダーの `[+]` |
| ファイルをドラッグ移動 | ファイルを別フォルダにドラッグ（Phase 7）|
| ファイルツリーを更新 | ヘッダーの `[↺]` ボタン |
| ワークスペースを閉じる | ヘッダーの `[✕]` ボタン |

### 3.4 コンテキストメニュー

```
右クリック（ファイルの場合）
├── 新規ファイル
├── 新規フォルダ
├── ────────────
├── リネーム
├── ゴミ箱に移動
├── ────────────
├── Finder/エクスプローラで表示
└── パスをコピー
```

```
右クリック（フォルダの場合）
├── 新規ファイル
├── 新規フォルダ
├── ────────────
├── リネーム
├── ゴミ箱に移動
├── ────────────
└── Finder/エクスプローラで表示
```

### 3.5 ファイルツリーとタブの連携

```
ファイルツリーでクリック
        │
        ▼
同じパスのタブが存在するか？
        │
  Yes ──┤── そのタブをアクティブにする（ファイルを開きなおさない）
        │
  No ───┴── 新規タブで開く
```

現在アクティブなタブのファイルをファイルツリーでハイライト表示する（逆方向の連携）。

---

## 4. 外部ファイル変更の検知と対応

他のエディタやターミナルでワークスペース内のファイルが変更された場合に対応する。

### 4.1 ファイルウォッチの実装

`@tauri-apps/plugin-fs` の `watch` API を使用して、ワークスペースルート配下を監視する。

```typescript
// src/file/workspace-watcher.ts
import { watch } from '@tauri-apps/plugin-fs';

let unwatch: (() => void) | null = null;

export async function startWatching(
  workspaceRoot: string,
  onChanged: (path: string) => void,
  onRenamed: (from: string, to: string) => void,
  onRemoved: (path: string) => void,
): Promise<void> {
  unwatch = await watch(
    workspaceRoot,
    (event) => {
      switch (event.type) {
        case 'modify':
          onChanged(event.paths[0]);
          break;
        case 'rename':
          // rename イベントは古いパスと新しいパスの 2 回発火する場合がある
          // 実装時に OS 別の挙動を確認すること
          break;
        case 'remove':
          onRemoved(event.paths[0]);
          break;
      }
    },
    { recursive: true },
  );
}

export function stopWatching(): void {
  unwatch?.();
  unwatch = null;
}
```

### 4.2 ファイル変更時の UX

| 状況 | 対応 |
|------|------|
| タブで開いていないファイルが変更 | ファイルツリーを自動更新（アイコンや日時を更新）|
| タブで開いているファイルが変更、かつ未編集 | 自動リロード（確認なし）|
| タブで開いているファイルが変更、かつ編集中（未保存あり）| トースト通知で確認「外部で変更されました。リロードしますか？」|

### 4.3 ファイル削除時の UX

```
タブで開いているファイルが削除された
          │
          ▼
トースト通知:
「README.md が削除されました」
[タブを閉じる]  [そのまま保持（保存で復元可能）]
```

---

## 5. クロスファイルリンクの解決

### 5.1 Markdown の相対リンクを開く

Markdown ファイル内の `[リンクテキスト](./other.md)` をクリックしたとき：

```
リンクをクリック
      │
      ├─ http:// / https:// → デフォルトブラウザで開く
      │
      ├─ #anchor → 同ファイル内スクロール
      │
      ├─ ./path/to/file.md → ワークスペース内ファイルとして開く
      │     ├─ ワークスペースがある場合: ワークスペースルートから解決
      │     └─ ワークスペースなしの場合: 現在ファイルのディレクトリから解決
      │
      └─ ./path/to/file.html → HTML 編集モードで開く（Phase 5）
```

### 5.2 相対パスの解決ロジック

```typescript
// src/core/link-resolver.ts

/** クリックされたリンクの移動先を判定する */
export function resolveLink(
  href: string,
  currentFilePath: string,
  workspaceRoot: string | null,
): LinkResolution {
  // 外部 URL
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { type: 'external', url: href };
  }

  // アンカーリンク
  if (href.startsWith('#')) {
    return { type: 'anchor', id: href.slice(1) };
  }

  // ローカルファイル（相対パス）
  const baseDir = path.dirname(currentFilePath);
  const resolved = path.resolve(baseDir, href.split('#')[0]);
  const anchor = href.includes('#') ? href.split('#')[1] : undefined;

  return { type: 'local', filePath: resolved, anchor };
}
```

### 5.3 リネーム・移動時のリンク更新（MVP では非対応）

MVP では、ファイルをリネーム・移動しても他のファイル内の相対リンクは自動更新しない。
リンクが壊れた場合はユーザーが手動で修正する。

**Phase 7 での実装方針（将来）:**
- リネーム・移動操作後に「○個のリンクが壊れる可能性があります。更新しますか？」と確認
- 承認後、ワークスペース内の全 `.md` ファイルをスキャンして相対リンクを更新

---

## 6. ファイル操作（作成・削除・リネーム・移動）

### 6.1 新規ファイル作成

```typescript
// src/file/workspace-ops.ts
import { create } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export async function createNewFile(
  parentDir: string,
  name: string,
): Promise<string> {
  // 名前の正規化（拡張子がなければ .md を付与）
  const fileName = name.endsWith('.md') || name.endsWith('.html')
    ? name
    : `${name}.md`;

  const filePath = await join(parentDir, fileName);

  // 既存ファイルとの衝突チェック
  // （実装時: exists() で確認 → 衝突なら連番を付与）

  await create(filePath);
  return filePath;
}
```

### 6.2 削除（ゴミ箱へ移動）

完全削除ではなく OS のゴミ箱へ移動する。Tauri の `trash` API または `tauri-plugin-shell` で実装。

```typescript
// @tauri-apps/plugin-fs には trash 機能がないため、
// Rust コマンド経由でゴミ箱移動を実装する
// src-tauri/src/commands/file_ops.rs

#[tauri::command]
pub async fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
    // Cargo.toml: trash = "3"
}
```

### 6.3 リネーム

```typescript
export async function renameFile(
  oldPath: string,
  newName: string,
): Promise<string> {
  const dir = await dirname(oldPath);
  const newPath = await join(dir, newName);

  await rename(oldPath, newPath);  // @tauri-apps/plugin-fs

  // タブストアに反映（開いていれば）
  useTabStore.getState().updateFilePath(oldPath, newPath);

  return newPath;
}
```

---

## 7. フォルダ内全文検索との連携

[performance-design.md](./performance-design.md) §6 で設計済みの全文検索機能と連携する。

- `Ctrl+Shift+F` でフォルダ内全文検索を起動
- 検索対象はワークスペースルート配下の全 `.md`・`.html` ファイル
- ワークスペースなしの場合は「フォルダを指定してください」のメッセージを表示

---

## 8. 状態管理設計（Zustand）

### 8.1 ワークスペースストア

```typescript
// src/store/workspaceStore.ts
import { create } from 'zustand';
import { readDir } from '@tauri-apps/plugin-fs';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
}

interface WorkspaceStore {
  root: string | null;
  tree: FileNode[];
  isLoading: boolean;

  openWorkspace: (dirPath: string) => Promise<void>;
  closeWorkspace: () => void;
  refreshTree: () => Promise<void>;
  toggleNode: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  root: null,
  tree: [],
  isLoading: false,

  openWorkspace: async (dirPath) => {
    set({ root: dirPath, isLoading: true });
    const tree = await buildFileTree(dirPath, 2);  // 初期は 2 階層まで展開
    set({ tree, isLoading: false });
    // ファイルウォッチ開始
    startWatching(dirPath, ...);
  },

  closeWorkspace: () => {
    stopWatching();
    set({ root: null, tree: [] });
  },

  refreshTree: async () => {
    const { root } = get();
    if (!root) return;
    const tree = await buildFileTree(root, Infinity);
    set({ tree });
  },

  toggleNode: (path) => {
    set((state) => ({
      tree: toggleNodeInTree(state.tree, path),
    }));
  },
}));
```

### 8.2 ファイルツリーの構築

```typescript
async function buildFileTree(
  dir: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return [];

  const entries = await readDir(dir);
  const nodes: FileNode[] = [];

  for (const entry of entries.sort(compareEntries)) {
    // 除外パターン
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;

    if (entry.isDirectory) {
      nodes.push({
        name: entry.name,
        path: `${dir}/${entry.name}`,
        type: 'directory',
        children: await buildFileTree(`${dir}/${entry.name}`, maxDepth, currentDepth + 1),
        isExpanded: false,
      });
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.html')) {
      nodes.push({
        name: entry.name,
        path: `${dir}/${entry.name}`,
        type: 'file',
      });
    }
  }

  return nodes;
}

/** ディレクトリを先に、その中でアルファベット順 */
function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.isDirectory && !b.isDirectory) return -1;
  if (!a.isDirectory && b.isDirectory) return 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}
```

---

## 9. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| ファイルを個別に開く（タブ管理）のみ。ワークスペース機能なし |
| Phase 3 | ワークスペース基本実装（openWorkspace、ファイルツリー表示、クリックで開く）|
| Phase 3 | 外部ファイル変更の検知とリロード通知 |
| Phase 3 | 相対リンクのクリックで別ファイルを開く |
| Phase 7 | ファイルのドラッグ移動 |
| Phase 7 | リネーム・移動時の Markdown リンク自動更新 |
| Phase 7 | ワークスペース切り替え（最近使ったワークスペース）|

---

## 関連ドキュメント

- [window-tab-session-design.md](./window-tab-session-design.md) — タブ管理・セッション保存
- [performance-design.md](./performance-design.md) §6 — フォルダ内全文検索
- [keyboard-shortcuts.md](./keyboard-shortcuts.md) — `Ctrl+Shift+F`（全文検索）、`Ctrl+Shift+O`（フォルダを開く）
- [image-storage-design.md](./image-storage-design.md) — 相対パス設計（ワークスペースと密接に関連）
- [security-design.md](./security-design.md) §4 — `plugin-fs` スコープ制限（ワークスペース外へのアクセス禁止）
