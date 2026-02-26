# ファイル・ワークスペース管理設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.1
> 更新日: 2026-02-25

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
9. [新規ファイル作成フロー](#9-新規ファイル作成フロー)
10. [ファイルエンコーディング対応](#10-ファイルエンコーディング対応)
11. [改行コード対応](#11-改行コード対応)
12. [ファイル削除・ゴミ箱移動の UX](#12-ファイル削除ゴミ箱移動の-ux)
13. [バックアップ設計](#13-バックアップ設計)
14. [印刷機能](#14-印刷機能)
15. [ドラッグ&ドロップによるファイルオープン](#15-ドラッグドロップによるファイルオープン)
16. [実装フェーズ](#16-実装フェーズ)

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
  └─ フォルダを開く → ワークスペースに移行
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

### 3.5 ファイルツリーとタブの連携

```
ファイルツリーでクリック
        │
        ▼
同じパスのタブが存在するか？
        │
  Yes ──┤── そのタブをアクティブにする
        │
  No ───┴── 新規タブで開く
```

現在アクティブなタブのファイルをファイルツリーでハイライト表示する（逆方向の連携）。

---

## 4. 外部ファイル変更の検知と対応

### 4.1 ファイルウォッチの実装

```typescript
// src/file/workspace-watcher.ts
import { watch } from '@tauri-apps/plugin-fs';

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
        case 'modify': onChanged(event.paths[0]); break;
        case 'remove': onRemoved(event.paths[0]); break;
      }
    },
    { recursive: true },
  );
}
```

### 4.2 ファイル変更時の UX

| 状況 | 対応 |
|------|------|
| タブで開いていないファイルが変更 | ファイルツリーを自動更新 |
| タブで開いているファイルが変更、かつ未編集 | 自動リロード（確認なし）|
| タブで開いているファイルが変更、かつ編集中（未保存あり）| 競合ダイアログを表示 |

#### 4.2.1 競合解決ダイアログ（未保存変更がある場合）

```
┌─────────────────────────────────────────────────────────┐
│ ⚠  外部でファイルが変更されました                          │
│                                                         │
│  README.md が別のプログラムによって変更されました。          │
│  エディタには未保存の変更があります。                        │
│                                                         │
│  [ファイルを再読込]  [ローカル変更を保持]  [差分を表示…]     │
└─────────────────────────────────────────────────────────┘
```

| 操作 | 挙動 |
|------|------|
| ファイルを再読込 | ディスクの内容でエディタを上書き。未保存変更は破棄 |
| ローカル変更を保持 | ディスクの変更を無視。エディタの内容をそのまま継続編集 |
| 差分を表示 | スプリットビューでディスク版（左）とエディタ版（右）を表示。Phase 4 以降 |

**カーソル・スクロール位置の扱い**:
- 「ファイルを再読込」後は、変更前のカーソル位置（行番号ベース）に復元を試みる
- 自動保存中の競合: タイムスタンプ検証で外部変更を検出した場合は自動保存を中断してダイアログを表示

---

## 5. クロスファイルリンクの解決

### 5.1 Markdown の相対リンクを開く

```
リンクをクリック
      │
      ├─ http:// / https:// → デフォルトブラウザで開く
      ├─ #anchor → 同ファイル内スクロール
      ├─ ./path/to/file.md → ワークスペース内ファイルとして開く
      └─ ./path/to/file.html → HTML 編集モードで開く（Phase 5）
```

### 5.2 相対パスの解決ロジック

```typescript
export function resolveLink(
  href: string,
  currentFilePath: string,
  workspaceRoot: string | null,
): LinkResolution {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { type: 'external', url: href };
  }
  if (href.startsWith('#')) {
    return { type: 'anchor', id: href.slice(1) };
  }
  const baseDir = path.dirname(currentFilePath);
  const resolved = path.resolve(baseDir, href.split('#')[0]);
  const anchor = href.includes('#') ? href.split('#')[1] : undefined;
  return { type: 'local', filePath: resolved, anchor };
}
```

### 5.3 リネーム・移動時のリンク更新

MVP では、ファイルをリネーム・移動しても他のファイル内の相対リンクは自動更新しない。

**Phase 7 での実装方針（将来）:**
- リネーム・移動操作後に「○個のリンクが壊れる可能性があります。更新しますか？」と確認
- 承認後、ワークスペース内の全 `.md` ファイルをスキャンして相対リンクを更新

---

## 6. ファイル操作（作成・削除・リネーム・移動）

### 6.1 新規ファイル作成

```typescript
export async function createNewFile(
  parentDir: string,
  name: string,
): Promise<string> {
  const fileName = name.endsWith('.md') || name.endsWith('.html')
    ? name : `${name}.md`;
  const filePath = await join(parentDir, fileName);
  await create(filePath);
  return filePath;
}
```

### 6.2 削除（ゴミ箱へ移動）

```rust
#[tauri::command]
pub async fn move_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
    // Cargo.toml: trash = "3"
}
```

### 6.3 リネーム

```typescript
export async function renameFile(oldPath: string, newName: string): Promise<string> {
  const dir = await dirname(oldPath);
  const newPath = await join(dir, newName);
  await rename(oldPath, newPath);
  useTabStore.getState().updateFilePath(oldPath, newPath);
  return newPath;
}
```

---

## 7. フォルダ内全文検索との連携

[performance-design.md](../01_Architecture/performance-design.md) §6 で設計済みの全文検索機能と連携する。

- `Ctrl+Shift+F` でフォルダ内全文検索を起動
- 検索対象はワークスペースルート配下の全 `.md`・`.html` ファイル
- ワークスペースなしの場合は「フォルダを指定してください」のメッセージを表示

---

## 8. 状態管理設計（Zustand）

### 8.1 ワークスペースストア

```typescript
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
    const tree = await buildFileTree(dirPath, 2);
    set({ tree, isLoading: false });
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
}));
```

### 8.2 ファイルツリーの構築

```typescript
async function buildFileTree(dir: string, maxDepth: number, currentDepth = 0): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return [];
  const entries = await readDir(dir);
  const nodes: FileNode[] = [];

  for (const entry of entries.sort(compareEntries)) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (entry.isDirectory) {
      nodes.push({
        name: entry.name,
        path: `${dir}/${entry.name}`,
        type: 'directory',
        children: await buildFileTree(`${dir}/${entry.name}`, maxDepth, currentDepth + 1),
        isExpanded: false,
      });
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.html')) {
      nodes.push({ name: entry.name, path: `${dir}/${entry.name}`, type: 'file' });
    }
  }
  return nodes;
}

function compareEntries(a: FileEntry, b: FileEntry): number {
  if (a.isDirectory && !b.isDirectory) return -1;
  if (!a.isDirectory && b.isDirectory) return 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}
```

---

## 9. 新規ファイル作成フロー

### 9.1 作成トリガー

| 操作 | 動作 |
|------|------|
| `Ctrl+N` | 無題の新規ファイルをタブで開く |
| メニュー → ファイル → 新規ファイル | 同上 |
| ファイルツリーの `[+]` ボタン | 選択フォルダ内に新規ファイルを作成 |
| ファイルツリーの右クリック → 新規ファイル | 同上 |

### 9.2 Ctrl+N の動作（無題ファイル）

```
Ctrl+N 実行
  │
  ▼
「Untitled-N.md」の名前で仮の新規タブを作成
（ファイルシステム上にはまだ存在しない）
  │
  ▼
最初の Ctrl+S で「名前を付けて保存」ダイアログを表示
  │
  ├─ 保存先を選択 → .md ファイルとして保存
  └─ キャンセル   → 仮タブのまま継続
```

- 無題タブのタイトルは `Untitled-1`, `Untitled-2` ... と連番
- タブを閉じる際、未保存の場合は「保存しますか？」ダイアログを表示

### 9.3 ファイルツリーからの新規作成

```
  ▾ 📁 blog
  │   📄 existing.md
  │  [ new-file.md ▋ ]  ← インライン入力欄

  Enter: ファイル名を確定して作成・タブで開く
  Esc:   キャンセル
```

- 拡張子なしで入力した場合は `.md` を自動付与
- 既存ファイルと同名の場合はエラー表示

### 9.4 デフォルト保存先

`Ctrl+N` → `Ctrl+S` でのダイアログ初期ディレクトリ:

1. ワークスペースが開いている場合: ワークスペースルート
2. 最後に使ったファイルのディレクトリ
3. OS のドキュメントフォルダ（設定 `defaultSaveDir` に従う）

---

## 10. ファイルエンコーディング対応

### 10.1 サポートするエンコーディング

| エンコーディング | 読み込み | 書き込み |
|----------------|---------|---------|
| UTF-8（BOM なし） | ✅ | ✅（デフォルト） |
| UTF-8 BOM | ✅ | ✅（BOM を保持） |
| Shift-JIS（CP932） | ✅ | ✅ |
| EUC-JP | ✅ | ✅ |
| UTF-16 LE | ✅ | ❌（UTF-8 に変換して保存） |
| UTF-16 BE | ✅ | ❌（UTF-8 に変換して保存） |

### 10.2 エンコーディング自動検出

```
ファイル読み込み時:
  1. BOM チェック（UTF-8 BOM: EF BB BF / UTF-16 LE: FF FE / UTF-16 BE: FE FF）
  2. BOM なし → encoding-japanese ライブラリで推定
  3. 推定信頼度が低い場合（< 70%）→ UTF-8 として読み込み、ステータスバーに ⚠ を表示
```

```typescript
export async function readFileWithEncoding(
  filePath: string
): Promise<{ content: string; encoding: FileEncoding }> {
  const bytes = await readBinaryFile(filePath);
  const detected = detect(bytes, { returnsToBest: true });
  const encoder = new TextDecoder(detected.encoding ?? 'utf-8');
  const content = encoder.decode(bytes);
  return { content, encoding: detected.encoding as FileEncoding ?? 'UTF-8' };
}
```

### 10.3 エンコーディング操作 UI（ステータスバークリック）

ステータスバーの「UTF-8」などのエンコーディング表示をクリックすると、**2 つのアクション**を提供するポップオーバーを表示する。

```
┌─────────────────────────────────────────────────────┐
│  エンコーディング操作                                │
├─────────────────────────────────────────────────────┤
│  現在: Shift-JIS                                     │
│                                                      │
│  変換先:                                             │
│  ● UTF-8（推奨）  ○ UTF-8 BOM                       │
│  ○ Shift-JIS     ○ EUC-JP                           │
├─────────────────────────────────────────────────────┤
│  🔄 このエンコーディングで再読み込み（Reload）        │
│     ※ 未保存の変更は失われます                        │
│                                                      │
│  💾 このエンコーディングに変換して保存（Convert）     │
│     ※ ファイルの文字コードを変換して上書き保存します  │
├─────────────────────────────────────────────────────┤
│                                   [キャンセル]       │
└─────────────────────────────────────────────────────┘
```

| アクション | 動作 |
|-----------|------|
| **Reload（再読み込み）** | 選択エンコーディングでファイルをディスクから再読み込みする。未保存の変更がある場合は「変更を破棄しますか？」確認ダイアログを表示する |
| **Convert（変換保存）** | 現在の編集内容を選択エンコーディングに変換してファイルに上書き保存する。UTF-16 系はすべて UTF-8 に変換して保存する |

```typescript
// src/file/encoding-operations.ts

export async function reloadWithEncoding(filePath: string, encoding: FileEncoding) {
  const bytes = await readBinaryFile(filePath);
  const decoder = new TextDecoder(encoding);
  const content = decoder.decode(bytes);
  useTabStore.getState().updateContent(filePath, content);
  useFileStore.getState().setEncoding(filePath, encoding);
}

export async function convertAndSave(filePath: string, encoding: FileEncoding, content: string) {
  const encoder = new TextEncoder(); // JS の TextEncoder は UTF-8 固定
  // UTF-8 以外は Rust 側の encode コマンドに委譲
  if (encoding !== 'UTF-8') {
    await invoke('save_with_encoding', { path: filePath, content, encoding });
  } else {
    await writeFile(filePath, encoder.encode(content));
  }
  useFileStore.getState().setEncoding(filePath, encoding);
}
```

---

## 11. 改行コード対応

### 11.1 自動検出

```typescript
export function detectLineEnding(content: string): 'LF' | 'CRLF' | 'CR' {
  const crlfCount = (content.match(/\r\n/g) ?? []).length;
  const lfCount   = (content.match(/(?<!\r)\n/g) ?? []).length;
  const crCount   = (content.match(/\r(?!\n)/g) ?? []).length;

  if (crlfCount > lfCount && crlfCount > crCount) return 'CRLF';
  if (crCount > lfCount) return 'CR';
  return 'LF';
}
```

### 11.2 保存時の改行コード

| 設定 `lineEnding` | 保存時の動作 |
|------------------|------------|
| `'preserve'`（デフォルト）| ファイル読み込み時の改行コードを使用 |
| `'lf'` | 常に LF で保存 |
| `'crlf'` | 常に CRLF で保存 |
| `'os'` | OS ネイティブ（Windows: CRLF / macOS・Linux: LF） |

### 11.3 改行コード操作 UI（ステータスバークリック）

ステータスバーの「LF」/「CRLF」表示をクリックすると、**2 つのアクション**を提供するポップオーバーを表示する。

```
┌─────────────────────────────────────────────────────┐
│  改行コード操作                                      │
├─────────────────────────────────────────────────────┤
│  現在: LF                                            │
│                                                      │
│  変換先:  ● LF（Unix / macOS）  ○ CRLF（Windows）  │
├─────────────────────────────────────────────────────┤
│  💾 変換して保存（Convert and Save）                 │
│     ※ 現在のファイルの改行コードを変換して上書き保存  │
│                                                      │
│  ⚙ 設定を変更（Change Setting）                     │
│     ※ 以降の保存で使う改行コードを設定するのみ        │
│        （現在のファイルは変換しない）                 │
├─────────────────────────────────────────────────────┤
│                                   [キャンセル]       │
└─────────────────────────────────────────────────────┘
```

| アクション | 動作 |
|-----------|------|
| **Convert and Save** | 現在のファイル内の改行コードを変換して即座に上書き保存する |
| **Change Setting** | `AppSettings.lineEnding` の設定値のみを変更する。次回保存から適用される |

---

## 12. ファイル削除・ゴミ箱移動の UX

### 12.1 削除の動作方針

**完全削除は行わない**。ファイルツリーからの削除は必ず **OS ゴミ箱へ移動** する。

```
┌──────────────────────────────────────────────┐
│  「README.md」をゴミ箱に移動しますか？        │
│                                              │
│  この操作は OS のゴミ箱から元に戻すことができます。│
│            [キャンセル]  [ゴミ箱に移動]       │
└──────────────────────────────────────────────┘
```

### 12.2 削除後の処理

```
ゴミ箱に移動
  │
  ├─ そのファイルがタブで開いていた場合:
  │    トースト通知「README.md が削除されました」を表示
  │    タブに [削除済み] バッジを付与（編集内容は保持）
  │    「保存」すると元のパスで再作成される
  │
  └─ タブで開いていない場合:
       ファイルツリーからエントリを削除
```

---

## 13. バックアップ設計

### 13.1 上書き保存時バックアップ

ユーザー設定 `createBackup: true` の場合、上書き保存前に `.bak` ファイルを作成する。

```
保存フロー（createBackup: true の場合）:
  既存ファイル: note.md
    ├─ note.md → note.md.bak にコピー（上書き）
    └─ note.md に新しい内容を書き込み
```

- `.bak` ファイルは同ディレクトリに 1 世代のみ保持
- 複数世代のバックアップは対象外（ストレージ消費の懸念）

### 13.2 クラッシュリカバリとの関係

定期バックアップ（チェックポイント方式）は [window-tab-session-design.md](./window-tab-session-design.md) §10 の
クラッシュリカバリ設計に委ねる。本機能は「上書き保存の安全網」として機能する。

---

## 14. 印刷機能

### 14.1 印刷フロー

```
メニュー → ファイル → 印刷...  または  Ctrl+P（OSメニュー）
  │
  ▼
[印刷オプションダイアログ]
  テーマ選択: [GitHub ▼]  □ 目次を含める  □ ヘッダー/フッターを表示
  │
  [プレビュー]  [印刷]
  ▼
HTML エクスポートと同じパイプラインで印刷用 HTML を生成
  │
  ▼
window.print() を呼び出し（ブラウザのネイティブ印刷ダイアログ）
```

### 14.2 印刷用 CSS

`@media print` スタイルは [export-interop-design.md](../06_Export_Interop/export-interop-design.md) §3.3 の印刷用 CSS を共有する。

```css
@media print {
  .toolbar, .sidebar, .statusbar { display: none !important; }
  .editor-content { width: 100%; margin: 0; padding: 0; }
}
```

---

## 15. ドラッグ&ドロップによるファイルオープン

### 15.1 対応するドロップ対象

| ドロップ対象 | 動作 |
|------------|------|
| `.md` ファイル | Markdown 編集モードで新規タブで開く |
| `.html` ファイル | HTML 編集モードで新規タブで開く（Phase 5） |
| フォルダ | ワークスペースとして開く |
| その他ファイル | 「このファイル形式はサポートされていません」トースト |
| 複数ファイル | 全てを個別タブで開く（上限: 10 ファイル） |

### 15.2 Tauri での実装

```typescript
export function useDropListener() {
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://file-drop', async (event) => {
      for (const path of event.payload.paths) {
        if (path.endsWith('.md') || path.endsWith('.html')) {
          await useTabStore.getState().openFile(path);
        } else {
          const stat = await lstat(path);
          if (stat.isDirectory) {
            await useWorkspaceStore.getState().openWorkspace(path);
          }
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);
}
```

### 15.3 ドラッグ中のビジュアルフィードバック

```
┌─────────────────────────────────────────┐
│         📄 ここにドロップして開く        │
└─────────────────────────────────────────┘
```

---

## 16. 外部クラウドストレージ同期競合のエッジケース対応

### 16.1 問題定義

多くのユーザーはワークスペースを Dropbox・Google Drive・OneDrive・iCloud Drive などの
クラウド同期フォルダ内に置く。このような環境では以下のエッジケースが発生する:

| ケース | 発生状況 | 問題 |
|--------|---------|------|
| **競合ファイルの自動生成** | 同一ファイルを別デバイスで同時編集し、クラウドが競合を検知 | `report (1).md` のような競合コピーが突然ファイルツリーに出現する |
| **高速上書き（Git ブランチ切り替え）** | `git checkout` 等でワークスペース内のファイルが大量置換される | エディタで開いていたファイルの内容が外部から高速上書きされ、編集中の変更が失われる |
| **ファイルの瞬間消滅・再出現** | 同期ツールがファイルを一時削除してから再配置するパターン | `watch` イベントが delete → create と連続発火し、誤ってファイルクローズ処理が走る |
| **ロックファイルによる書き込み失敗** | 同期ツールがファイルを排他ロック中（アップロード中等） | `writeTextFile` が `EBUSY` 等のエラーで失敗する |

### 16.2 競合ファイル（`filename (1).md`）の検知と UX

Dropbox は `filename (1).md`、Google Drive は `filename - Conflict.md` といった命名規則で
競合コピーを生成する。

**検知ルール**:

```rust
// src-tauri/src/file_watch.rs

/// 競合ファイルのパターン（各クラウドサービスの命名規則）
const CONFLICT_PATTERNS: &[&str] = &[
    r"\(\d+\)\.",                   // Dropbox: "file (1).md"
    r"- Conflict \d{4}-\d{2}-\d{2}",// Google Drive: "file - Conflict 2026-02-26.md"
    r"\.conflicted copy \d{4}-\d{2}-\d{2}", // Dropbox 旧形式
    r" \(Case Conflict\)",           // macOS ファイルシステム
];

pub fn is_conflict_file(filename: &str) -> bool {
    CONFLICT_PATTERNS.iter().any(|pat| {
        regex::Regex::new(pat).unwrap().is_match(filename)
    })
}
```

**UX フロー**:

```
[ファイルツリーに競合ファイルが出現（watch イベント）]
  │
  ▼
[is_conflict_file() チェック]
  │
  ├─ 競合ファイルでない → 通常の新規ファイル表示
  │
  └─ 競合ファイルと判定
       │
       ▼
     [ファイルツリーで競合ファイルを黄色アイコン ⚠ で強調表示]
       │
       ▼
     [ステータスバーにトースト通知]
       「"report (1).md" が競合ファイルとして検出されました。」
       [元ファイルと比較] [競合ファイルを削除]
       │
       ├─ [元ファイルと比較] → Split Editor で両ファイルを並べて開く
       └─ [競合ファイルを削除] → ゴミ箱へ移動（確認ダイアログなし、Undo 可）
```

### 16.3 高速上書き（Git ブランチ切り替え等）の対処

Git の `checkout`・`rebase`・`stash pop` 等の操作でワークスペース内のファイルが
大量に書き換えられる場合の対応:

**ファイル変更の「バースト」検知**:

```rust
// src-tauri/src/file_watch.rs

// 直近 1 秒以内に 5 件以上のファイル変更イベントが発生した場合を「バースト」と判定
const BURST_THRESHOLD_COUNT: usize = 5;
const BURST_WINDOW_MS: u64 = 1000;

// バースト検知時の動作:
// 1. 個別の変更通知を抑制（UI フラッドを防ぐ）
// 2. 2 秒待機後に一括通知
// 3. エディタで開いているファイルのみ競合チェックを実行
```

**エディタで開いているファイルが外部変更された場合のフロー**（既存 §4.2.1 の拡張）:

```
Git チェックアウトによるファイル変更検知
  │
  ▼
[エディタで開いているファイルか確認]
  │
  ├─ 未保存変更あり → §4.2.1 の競合解決ダイアログを表示
  │                   （再読込 / 保持 / 差分表示の選択肢）
  │
  └─ 未保存変更なし → 自動的にファイルを再読込
                      ステータスバー: 「ファイルが外部で変更されました。再読込しました。」
```

### 16.4 ロックファイル・書き込み失敗のリトライ設計

クラウド同期ツールがファイルをアップロード中（排他ロック中）に `save_file` が呼ばれると
書き込みが失敗する場合がある。

**リトライ戦略**:

```rust
// src-tauri/src/file_ops.rs

pub async fn write_file_with_retry(
    path: &Path,
    content: &str,
    max_retries: u32,
) -> Result<(), FileError> {
    let mut attempt = 0;
    let delays_ms = [100, 300, 1000]; // 指数バックオフ

    loop {
        match tokio::fs::write(path, content).await {
            Ok(_) => return Ok(()),
            Err(e) if is_lock_error(&e) && attempt < max_retries => {
                attempt += 1;
                let delay = delays_ms.get(attempt as usize - 1).copied().unwrap_or(1000);
                tokio::time::sleep(Duration::from_millis(delay)).await;
                continue;
            }
            Err(e) => return Err(FileError::WriteFailed { path: path.to_owned(), source: e }),
        }
    }
}

fn is_lock_error(e: &std::io::Error) -> bool {
    matches!(e.kind(),
        std::io::ErrorKind::PermissionDenied |
        std::io::ErrorKind::WouldBlock |
        std::io::ErrorKind::TimedOut
    )
}
```

**リトライ失敗時の UX**:
- 3 回リトライ後も失敗 → エラートースト「ファイルの保存に失敗しました。クラウド同期が完了するまでお待ちください。」
- `Ctrl+S` による手動保存は即座にフィードバック（リトライなしで即失敗通知）

### 16.5 実装フェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 3 | 外部ファイル変更検知（§4.2.1）の実装と同時に `is_conflict_file` チェックを追加 |
| Phase 3 | バースト検知ロジックと自動再読込を実装 |
| Phase 5 | 競合ファイルの Split Editor 比較 UI を実装 |
| Phase 7 | ロックファイルのリトライロジックを実装（ユーザー報告に基づき優先度調整） |

---

## 17. 実装フェーズ

| フェーズ | 実装内容 |
|---------|---------|
| Phase 1（MVP）| ファイルを個別に開く（タブ管理）のみ。ワークスペース機能なし |
| Phase 1 | エンコーディング対応・改行コード対応・バックアップ・印刷・D&D |
| Phase 3 | ワークスペース基本実装（openWorkspace、ファイルツリー表示、クリックで開く）|
| Phase 3 | 外部ファイル変更の検知とリロード通知 |
| Phase 3 | 相対リンクのクリックで別ファイルを開く |
| Phase 7 | ファイルのドラッグ移動 |
| Phase 7 | リネーム・移動時の Markdown リンク自動更新 |
| Phase 7 | ワークスペース切り替え（最近使ったワークスペース）|

---

## 関連ドキュメント

- [window-tab-session-design.md](./window-tab-session-design.md) — タブ管理・セッション保存・クラッシュリカバリ
- [performance-design.md](../01_Architecture/performance-design.md) §6 — フォルダ内全文検索
- [keyboard-shortcuts.md](../03_UI_UX/keyboard-shortcuts.md) — `Ctrl+Shift+F`（全文検索）、`Ctrl+Shift+O`（フォルダを開く）
- [image-design.md](../05_Features/Image/image-design.md) — 相対パス設計（ワークスペースと密接に関連）
- [security-design.md](../01_Architecture/security-design.md) §4 — `plugin-fs` スコープ制限
- [export-interop-design.md](../06_Export_Interop/export-interop-design.md) — 印刷用 CSS（@media print 設計）
- [user-settings-design.md](../07_Platform_Settings/user-settings-design.md) — エンコーディング・改行コード設定
