# ファイル操作設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [新規ファイル作成フロー](#1-新規ファイル作成フロー)
2. [ファイルエンコーディング対応](#2-ファイルエンコーディング対応)
3. [改行コード対応](#3-改行コード対応)
4. [ファイル削除・ゴミ箱移動の UX](#4-ファイル削除ゴミ箱移動の-ux)
5. [バックアップ設計](#5-バックアップ設計)
6. [印刷機能](#6-印刷機能)
7. [ドラッグ&ドロップによるファイルオープン](#7-ドラッグドロップによるファイルオープン)

---

## 1. 新規ファイル作成フロー

### 1.1 作成トリガー

| 操作 | 動作 |
|------|------|
| `Ctrl+N` | 無題の新規ファイルをタブで開く |
| メニュー → ファイル → 新規ファイル | 同上 |
| ファイルツリーの `[+]` ボタン | 選択フォルダ内に新規ファイルを作成 |
| ファイルツリーの右クリック → 新規ファイル | 同上 |

### 1.2 Ctrl+N の動作（無題ファイル）

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
- 複数の無題タブを同時に開ける
- タブを閉じる際、未保存の場合は「保存しますか？」ダイアログを表示

### 1.3 ファイルツリーからの新規作成

```
ファイルツリーの右クリックメニュー → 「新規ファイル」
  │
  ▼
ファイルツリー内のフォルダ直下にインライン入力欄を表示:

  ▾ 📁 blog
  │   📄 existing.md
  │  [ new-file.md ▋ ]  ← インライン入力欄

  Enter: ファイル名を確定して作成・タブで開く
  Esc:   キャンセル
```

- 拡張子なしで入力した場合は `.md` を自動付与
- 既存ファイルと同名の場合は「○○ は既に存在します」エラー表示

### 1.4 デフォルト保存先

`Ctrl+N` → `Ctrl+S` でのダイアログ初期ディレクトリ:

1. ワークスペースが開いている場合: ワークスペースルート
2. 最後に使ったファイルのディレクトリ
3. OS のドキュメントフォルダ（設定 `defaultSaveDir` に従う）

---

## 2. ファイルエンコーディング対応

### 2.1 サポートするエンコーディング

| エンコーディング | 読み込み | 書き込み |
|----------------|---------|---------|
| UTF-8（BOM なし） | ✅ | ✅（デフォルト） |
| UTF-8 BOM | ✅ | ✅（BOM を保持） |
| Shift-JIS（CP932） | ✅ | ✅ |
| EUC-JP | ✅ | ✅ |
| UTF-16 LE | ✅ | ❌（UTF-8 に変換して保存） |
| UTF-16 BE | ✅ | ❌（UTF-8 に変換して保存） |

### 2.2 エンコーディング自動検出

```
ファイル読み込み時:
  1. BOM チェック（UTF-8 BOM: EF BB BF / UTF-16 LE: FF FE / UTF-16 BE: FE FF）
  2. BOM なし → chardet（または encoding-japanese ライブラリ）で推定
  3. 推定信頼度が低い場合（< 70%）→ UTF-8 として読み込み、ステータスバーに ⚠ を表示
```

```typescript
// src/file/encoding.ts
import { detect } from 'encoding-japanese';

export async function readFileWithEncoding(
  filePath: string
): Promise<{ content: string; encoding: FileEncoding }> {
  const bytes = await readBinaryFile(filePath); // Tauri plugin-fs
  const detected = detect(bytes, { returnsToBest: true });

  const encoder = new TextDecoder(detected.encoding ?? 'utf-8');
  const content = encoder.decode(bytes);

  return { content, encoding: detected.encoding as FileEncoding ?? 'UTF-8' };
}
```

### 2.3 エンコーディング変更

ステータスバーのエンコーディング表示をクリック → ダイアログ:

```
現在のエンコーディング: Shift-JIS

再読み込みのエンコーディング:
○ UTF-8（推奨）
○ UTF-8 BOM
● Shift-JIS
○ EUC-JP

[このエンコーディングで再読み込み]  [キャンセル]
```

保存時のエンコーディングは「読み込み時のエンコーディングを維持」がデフォルト。
別エンコーディングで保存したい場合は「名前を付けて保存」ダイアログで変更可能。

---

## 3. 改行コード対応

### 3.1 自動検出

ファイル読み込み時に改行コードを検出する。

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

### 3.2 保存時の改行コード

デフォルト: **読み込み時の改行コードを維持**

| 設定 `lineEnding` | 保存時の動作 |
|------------------|------------|
| `'preserve'`（デフォルト）| ファイル読み込み時の改行コードを使用 |
| `'lf'` | 常に LF で保存 |
| `'crlf'` | 常に CRLF で保存 |
| `'os'` | OS ネイティブ（Windows: CRLF / macOS・Linux: LF） |

### 3.3 改行コード変換

ステータスバーの改行コード表示をクリック → メニュー:

```
● LF（現在）
○ CRLF
─────────────
[LF に変換して保存]  [CRLF に変換して保存]
```

変換は次の保存から反映する（即時ではない）。

---

## 4. ファイル削除・ゴミ箱移動の UX

### 4.1 削除の動作方針

**完全削除は行わない**。ファイルツリーからの削除は必ず **OS ゴミ箱へ移動** する。

```
ファイルツリーで右クリック → 「ゴミ箱に移動」
  │
  ▼
確認ダイアログを表示:

┌──────────────────────────────────────────────┐
│  「README.md」をゴミ箱に移動しますか？        │
│                                              │
│  この操作は OS のゴミ箱から元に戻すことができます。│
│                                              │
│            [キャンセル]  [ゴミ箱に移動]       │
└──────────────────────────────────────────────┘
```

### 4.2 削除後の処理

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
       トースト通知は表示しない
```

### 4.3 Delete キーによる削除

ファイルツリーでファイルを選択して `Delete` キーを押した場合も同じ確認ダイアログを表示する。

---

## 5. バックアップ設計

### 5.1 上書き保存時バックアップ

ユーザー設定 `createBackup: true` の場合、上書き保存前に `.bak` ファイルを作成する。

```
保存フロー（createBackup: true の場合）:
  既存ファイル: note.md
    │
    ├─ note.md → note.md.bak にコピー（上書き）
    └─ note.md に新しい内容を書き込み
```

- `.bak` ファイルは同ディレクトリに 1 世代のみ保持（前回の `.bak` を上書き）
- 複数世代のバックアップは対象外（ストレージ消費の懸念）

### 5.2 バックアップ先設定

将来的に `backupDir` 設定で別フォルダへのバックアップを検討するが、MVP では `.bak` 方式のみ実装する。

### 5.3 クラッシュリカバリとの関係

定期バックアップ（チェックポイント方式）は [window-tab-session-design.md](./window-tab-session-design.md) §10 の
クラッシュリカバリ設計に委ねる。本機能は「上書き保存の安全網」として機能する。

---

## 6. 印刷機能

### 6.1 印刷フロー

```
メニュー → ファイル → 印刷...  または  Ctrl+P（OSメニュー）
  │
  ▼
[印刷オプションダイアログ]
  テーマ選択: [GitHub ▼]
  □ 目次を含める
  □ ヘッダー/フッターを表示
  │
  [プレビュー]  [印刷]

  ▼ [印刷] クリック
HTML エクスポートと同じパイプラインで印刷用 HTML を生成
  │
  ▼
window.print() を呼び出し（ブラウザのネイティブ印刷ダイアログ）
```

### 6.2 印刷用 CSS

`@media print` スタイルは [export-design.md](./export-design.md) §3.3 の印刷用 CSS を共有する。

```css
@media print {
  /* ツールバー・サイドバーを非表示 */
  .toolbar, .sidebar, .statusbar { display: none !important; }
  /* エディタ本文のみ印刷 */
  .editor-content { width: 100%; margin: 0; padding: 0; }
}
```

### 6.3 Tauri との連携

`window.print()` は WebView 経由でネイティブ印刷ダイアログを起動する。
WebView2（Windows）および WKWebView（macOS）はともに `window.print()` に対応している。

---

## 7. ドラッグ&ドロップによるファイルオープン

### 7.1 対応するドロップ対象

| ドロップ対象 | 動作 |
|------------|------|
| `.md` ファイル | Markdown 編集モードで新規タブで開く |
| `.html` ファイル | HTML 編集モードで新規タブで開く（Phase 5） |
| フォルダ | ワークスペースとして開く |
| その他ファイル | 「このファイル形式はサポートされていません」トースト |
| 複数ファイル | 全てを個別タブで開く（上限: 10 ファイル） |

### 7.2 Tauri での実装

```typescript
// src/hooks/useDropListener.ts
import { listen } from '@tauri-apps/api/event';

export function useDropListener() {
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://file-drop', async (event) => {
      for (const path of event.payload.paths) {
        if (path.endsWith('.md') || path.endsWith('.html')) {
          await useTabStore.getState().openFile(path);
        } else {
          // フォルダかどうかを確認
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

### 7.3 ドラッグ中のビジュアルフィードバック

```typescript
// tauri://file-drop-hover イベント
listen('tauri://file-drop-hover', () => {
  // エディタ全体にオーバーレイを表示
  setShowDropOverlay(true);
});

// tauri://file-drop-cancelled イベント
listen('tauri://file-drop-cancelled', () => {
  setShowDropOverlay(false);
});
```

ドロップオーバーレイ:
```
┌─────────────────────────────────────────┐
│                                         │
│         📄 ここにドロップして開く        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 関連ドキュメント

- [window-tab-session-design.md](./window-tab-session-design.md) — タブ管理・セッション復元
- [workspace-design.md](./workspace-design.md) — ワークスペース管理・ファイルツリー
- [user-settings-design.md](./user-settings-design.md) — エンコーディング・改行コード設定
- [export-design.md](./export-design.md) — 印刷用 CSS（@media print 設計）
- [error-handling-design.md](./error-handling-design.md) — ファイル操作エラーのハンドリング
