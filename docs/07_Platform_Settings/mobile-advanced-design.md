# モバイル詳細設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25

---

## 目次

1. [ソフトキーボード対応（ビューポート調整）](#1-ソフトキーボード対応ビューポート調整)
2. [Android SAF（Storage Access Framework）連携](#2-android-safstorage-access-framework連携)
3. [iCloud Drive 連携（iOS）](#3-icloud-drive-連携ios)
4. [モバイル向けエディタ最適化](#4-モバイル向けエディタ最適化)
5. [アクセサリービュー（ショートカットバー）詳細設計](#5-アクセサリービューショートカットバー詳細設計)
6. [SAF / iCloud エッジケースと例外処理フロー](#6-saf--icloud-エッジケースと例外処理フロー)

---

## 1. ソフトキーボード対応（ビューポート調整）

### 1.1 問題点

モバイルデバイスでソフトキーボードが表示されると、WebView の表示領域が縮小または
スクロールされ、エディタのレイアウトが崩れる。

```
ソフトキーボード表示前:          ソフトキーボード表示後（問題）:
┌────────────────────┐          ┌────────────────────┐
│ ツールバー         │          │ ツールバー         │
│ ─────────────────  │          │ ─────────────────  │
│                    │          │                    │
│  エディタ本文      │          │  エディタ本文      │
│                    │    →     │ ─────────────────  │
│                    │          │ ┌────────────────┐ │
│                    │          │ │ ソフトキーボード│ │
│                    │          │ └────────────────┘ │
│ ステータスバー     │          │（ステータスバーが   │
│ ─────────────────  │          │  キーボードの下に  │
└────────────────────┘          │  隠れる）          │
                                └────────────────────┘
```

### 1.2 解決策

**Visual Viewport API** を使用して、ソフトキーボードの表示状態を検知し、
レイアウトを動的に調整する。

```typescript
// src/hooks/useVisualViewport.ts
export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height ?? window.innerHeight
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setViewportHeight(vv.height);
      // スクロールオフセットを考慮してキーボードの高さを計算
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${Math.max(0, keyboardHeight)}px`
      );
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  return viewportHeight;
}
```

```css
/* モバイルレイアウト CSS */
.app-container {
  height: calc(100vh - var(--keyboard-height, 0px));
  /* ソフトキーボード表示時にアプリ全体の高さを縮小 */
}

.statusbar {
  /* ステータスバーをキーボードの上に固定 */
  position: fixed;
  bottom: var(--keyboard-height, 0px);
  left: 0;
  right: 0;
}
```

### 1.3 Android 固有の対応

Android では `adjustResize` と `adjustPan` の挙動が OS バージョンによって異なる。

```xml
<!-- src-tauri/gen/android/app/src/main/AndroidManifest.xml -->
<activity
  android:name=".MainActivity"
  android:windowSoftInputMode="adjustResize">
</activity>
```

```typescript
// Android では Tauri の keyboard plugin を使用
import { Keyboard } from '@capacitor/keyboard'; // または Tauri 同等 API

Keyboard.addListener('keyboardWillShow', (info) => {
  document.documentElement.style.setProperty(
    '--keyboard-height',
    `${info.keyboardHeight}px`
  );
});

Keyboard.addListener('keyboardWillHide', () => {
  document.documentElement.style.setProperty('--keyboard-height', '0px');
});
```

### 1.4 カーソル位置へのスクロール

キーボード表示後、アクティブなカーソル位置が見えるようにスクロールする。

```typescript
function scrollCursorIntoView() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  // カーソルがビューポートの下半分にある場合スクロール
  if (rect.bottom > viewportHeight * 0.7) {
    range.startContainer.parentElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}
```

---

## 2. Android SAF（Storage Access Framework）連携

### 2.1 SAF の必要性

Android 10 以降、アプリがアクセスできるファイルシステムは制限されている。
外部ストレージ（Documents フォルダ、Google Drive 等）にアクセスするには
SAF を使用する必要がある。

### 2.2 Tauri での SAF 実装

```rust
// src-tauri/src/android/saf.rs
#[cfg(target_os = "android")]
pub mod saf {
    use tauri::plugin::TauriPlugin;

    /// SAF を使用してファイルを開く
    #[tauri::command]
    pub async fn open_document_picker() -> Result<String, String> {
        // Android の Intent.ACTION_OPEN_DOCUMENT を起動
        // 返値: content:// URI
        todo!("Tauri Android plugin API を使用して実装")
    }

    /// content:// URI からファイルを読み込む
    #[tauri::command]
    pub async fn read_document(uri: String) -> Result<Vec<u8>, String> {
        // ContentResolver.openInputStream で読み込み
        todo!()
    }

    /// content:// URI へ書き込む
    #[tauri::command]
    pub async fn write_document(uri: String, content: Vec<u8>) -> Result<(), String> {
        // ContentResolver.openOutputStream で書き込み
        todo!()
    }
}
```

```typescript
// src/file/android-file-handler.ts
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

export async function openFileAndroid(): Promise<{ uri: string; content: string } | null> {
  if (await platform() !== 'android') return null;

  const uri = await invoke<string>('open_document_picker');
  if (!uri) return null;

  const bytes = await invoke<number[]>('read_document', { uri });
  const content = new TextDecoder().decode(new Uint8Array(bytes));
  return { uri, content };
}
```

### 2.3 最近使ったファイルの URI 永続化

SAF の `content://` URI は一時的。永続的なアクセスを維持するには
`takePersistableUriPermission` を呼び出す必要がある。

```rust
#[tauri::command]
pub async fn persist_uri_permission(uri: String) -> Result<(), String> {
    // ContentResolver.takePersistableUriPermission(uri,
    //   Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    todo!()
}
```

永続化した URI は `@tauri-apps/plugin-store` に保存し、
最近使ったファイルリストで再アクセス可能にする。

### 2.4 Android ワークスペースの考え方

デスクトップ版ワークスペース（フォルダ全体の監視）は Android では制限が多い。
Android 版の「ワークスペース」は:

1. SAF の **Document Tree** (`ACTION_OPEN_DOCUMENT_TREE`) で単一フォルダを選択
2. そのフォルダ以下のファイル一覧を都度取得（watch は非サポート）
3. 変更検知は手動リフレッシュ（プルダウン）またはアプリ復帰時

---

## 3. iCloud Drive 連携（iOS）

### 3.1 iCloud Drive アクセスの方法

iOS では iCloud Drive の Documents フォルダに配置されたファイルは
通常の `FileManager` でアクセス可能（Tauri の `plugin-fs` 経由）。

```
アクセス可能なパス:
  ~/Documents/          → アプリのサンドボックス内
  ~/Library/Mobile Documents/com~apple~CloudDocs/  → iCloud Drive（要設定）
```

### 3.2 iCloud 有効化設定

```xml
<!-- src-tauri/gen/ios/app/app.entitlements -->
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
  <string>iCloud.$(PRODUCT_BUNDLE_IDENTIFIER)</string>
</array>
<key>com.apple.developer.icloud-services</key>
<array>
  <string>CloudDocuments</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
  <string>iCloud.$(PRODUCT_BUNDLE_IDENTIFIER)</string>
</array>
```

### 3.3 iCloud Drive のファイル状態管理

iCloud Drive ではファイルが「クラウドにのみ存在」状態になる場合がある。
アクセス前にダウンロードが必要。

```swift
// iCloud ファイルのダウンロード確認（Swift / Tauri iOS bridge）
func ensureFileDownloaded(url: URL) async throws {
    let resourceValues = try url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
    if resourceValues.ubiquitousItemDownloadingStatus != .current {
        try FileManager.default.startDownloadingUbiquitousItem(at: url)
        // ダウンロード完了を待機
        while true {
            let status = try url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
            if status.ubiquitousItemDownloadingStatus == .current { break }
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5s ポーリング
        }
    }
}
```

### 3.4 ファイル競合解決

iCloud Drive で複数デバイスから同一ファイルを編集した場合の競合:

```
競合検知（アプリ復帰時）:
  │
  ▼
NSFileVersion.unresolvedConflictVersionsOfItem を確認
  │
  ├─ 競合なし → 通常通り開く
  │
  └─ 競合あり → 競合解決ダイアログ:
     ┌──────────────────────────────────────────────┐
     │  ファイルの競合が検出されました               │
     │                                              │
     │  「note.md」が別のデバイスでも編集されました。 │
     │                                              │
     │  バージョン A (このデバイス, 2分前)           │
     │  バージョン B (iPhone, 5分前)                │
     │                                              │
     │  [バージョン A を使用]  [バージョン B を使用] │
     │  [両方を開く（比較）]                        │
     └──────────────────────────────────────────────┘
```

---

## 4. モバイル向けエディタ最適化

### 4.1 タッチ操作対応

| 操作 | 動作 |
|------|------|
| タップ | カーソル移動 |
| ダブルタップ | 単語選択 |
| ロングタップ | コンテキストメニュー（カット/コピー/ペースト） |
| ピンチイン/アウト | フォントサイズ変更（一時的） |
| スワイプ（左右） | タブ切り替え |
| プルダウン | ファイル一覧のリフレッシュ |

### 4.2 モバイル向けツールバー

キーボード上部のツールバー（iOS の inputAccessoryView 相当）:

```
┌────────────────────────────────────────────────┐
│ **B** _I_ ~~S~~ `C` | H1 H2 | [🔗] [📷] | ↩  │
└────────────────────────────────────────────────┘
  太字 斜体 取消線 コード  見出し   リンク 画像  改行
```

```typescript
// src/components/MobileToolbar.tsx
// キーボード表示中にエディタ上部に固定表示
export function MobileToolbar({ editor }: { editor: Editor }) {
  return (
    <div
      className="mobile-toolbar"
      style={{ bottom: 'var(--keyboard-height, 0px)' }}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="B"
      />
      {/* ... */}
    </div>
  );
}
```

### 4.3 フォントサイズの自動調整

モバイルでは `16px` 未満のフォントは iOS が自動拡大する問題がある。

```css
/* モバイル向け CSS */
@media (max-width: 768px) {
  .editor-content {
    font-size: 16px; /* iOS の自動拡大を防ぐ最小値 */
  }

  input, textarea, select {
    font-size: 16px; /* フォーカス時の自動ズームを防止 */
  }
}
```

### 4.4 パフォーマンス最適化

モバイルの CPU/メモリ制約に対応するための最適化:

| 最適化 | 内容 |
|--------|------|
| 遅延読み込み | Mermaid, KaTeX を遅延インポート |
| 仮想スクロール | 長いドキュメント（1000行以上）で TipTap の NodeView を仮想化 |
| 画像縮小表示 | モバイルでは最大幅 400px に制限 |
| undo 履歴制限 | モバイルでは undo 履歴を 50 ステップに制限（デスクトップは 200） |

---

## 5. アクセサリービュー（ショートカットバー）詳細設計

### 5.1 概要と問題定義

iOS の `inputAccessoryView` / Android のカスタムキーボードバーに相当する「アクセサリービュー」は、ソフトキーボード表示時のみ画面に現れる Markdown 入力補助専用ツールバーである。

**設計上の課題**:
- WebView ベースの Tauri アプリでは、ネイティブの `inputAccessoryView` に直接アクセスできない
- Visual Viewport API を使ってキーボード高さを検知し、CSS `position: fixed` で位置を制御する
- キーボードが表示・非表示になるたびに、ツールバーの表示/非表示をアニメーションさせる
- ツールバーは §4.2 の `MobileToolbar` を拡張し、Zustand のキーボード状態に連動させる

### 5.2 アクセサリービューの UI 設計

```
ソフトキーボード表示時のレイアウト:
┌────────────────────────────────────────────────┐  ← 画面上端
│  アプリツールバー（ファイル操作等）               │
│  ─────────────────────────────────────────────  │
│                                                  │
│     エディタ本文（スクロール領域）                │
│                                                  │
│  ─────────────────────────────────────────────  │
│  **B** _I_ ~~S~~ `C` │ H1 H2 H3 │ [≡] [🖼] ↵   │  ← アクセサリービュー
│ ┌──────────────────────────────────────────────┐│
│ │  Q W E R T Y U I O P                        ││
│ │  A S D F G H J K L                          ││
│ │  Z X C V B N M                              ││
│ └──────────────────────────────────────────────┘│  ← ソフトキーボード
└────────────────────────────────────────────────┘  ← 画面下端
```

**アクセサリービューのボタン仕様**:

| ボタン | 表示 | TipTap コマンド | 備考 |
|--------|------|----------------|------|
| Bold | **B** | `toggleBold()` | トグル |
| Italic | _I_ | `toggleItalic()` | トグル |
| Strikethrough | ~~S~~ | `toggleStrike()` | トグル |
| Code | `` `C` `` | `toggleCode()` | インラインコード |
| H1 | H1 | `setHeading({ level: 1 })` | トグル |
| H2 | H2 | `setHeading({ level: 2 })` | トグル |
| H3 | H3 | `setHeading({ level: 3 })` | トグル |
| Bullet List | ≡ | `toggleBulletList()` | トグル |
| Image | 🖼 | `openImagePicker()` | SAF / PhotoLibrary を起動 |
| Line Break | ↵ | `setHardBreak()` | `<br>` 挿入 |

### 5.3 Visual Viewport API との連動

既存の `useVisualViewport` フック（§1.2）を拡張して、キーボード表示状態（`isKeyboardVisible`）を Zustand ストアに同期する。

```typescript
// src/hooks/useVisualViewport.ts（拡張）
import { useEffect } from 'react';
import { useMobileStore } from '../store/mobileStore';

/** これ以上 viewport が縮小したらキーボード表示と判断する閾値（px） */
const KEYBOARD_THRESHOLD_PX = 100;

export function useVisualViewport() {
  const { setKeyboardHeight, setKeyboardVisible } = useMobileStore();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      const isVisible = keyboardHeight > KEYBOARD_THRESHOLD_PX;

      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${keyboardHeight}px`
      );
      setKeyboardHeight(keyboardHeight);
      setKeyboardVisible(isVisible);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, [setKeyboardHeight, setKeyboardVisible]);
}
```

### 5.4 Zustand へのキーボード状態組み込み

```typescript
// src/store/mobileStore.ts
import { create } from 'zustand';

interface MobileStore {
  /** ソフトキーボードの現在の高さ（px）。非表示時は 0 */
  keyboardHeight: number;
  /** ソフトキーボードが表示されているか */
  isKeyboardVisible: boolean;
  setKeyboardHeight: (height: number) => void;
  setKeyboardVisible: (visible: boolean) => void;
}

export const useMobileStore = create<MobileStore>((set) => ({
  keyboardHeight: 0,
  isKeyboardVisible: false,
  setKeyboardHeight: (keyboardHeight) => set({ keyboardHeight }),
  setKeyboardVisible: (isKeyboardVisible) => set({ isKeyboardVisible }),
}));
```

### 5.5 アクセサリービューコンポーネント

```typescript
// src/components/mobile/AccessoryToolbar.tsx
import { useMobileStore } from '../../store/mobileStore';
import { Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
  onImageInsert: () => void;
}

export function AccessoryToolbar({ editor, onImageInsert }: Props) {
  const { isKeyboardVisible, keyboardHeight } = useMobileStore();

  // キーボード非表示時はレンダリングしない
  if (!isKeyboardVisible || !editor) return null;

  return (
    <div
      className="accessory-toolbar"
      style={{
        position: 'fixed',
        bottom: keyboardHeight,
        left: 0,
        right: 0,
        zIndex: 100,
        transform: 'translateY(0)',
        transition: 'bottom 0.2s ease-out',
      }}
      role="toolbar"
      aria-label="Markdown 入力補助"
    >
      {/* インライン書式グループ */}
      <AccessoryButton
        onPress={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="B"
        ariaLabel="太字"
      />
      <AccessoryButton
        onPress={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="I"
        ariaLabel="斜体"
      />
      <AccessoryButton
        onPress={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        label="S̶"
        ariaLabel="取り消し線"
      />
      <AccessoryButton
        onPress={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        label="`C`"
        ariaLabel="インラインコード"
      />
      <div className="accessory-divider" aria-hidden="true" />

      {/* 見出しグループ */}
      {([1, 2, 3] as const).map((level) => (
        <AccessoryButton
          key={level}
          onPress={() =>
            editor.chain().focus().setHeading({ level }).run()
          }
          active={editor.isActive('heading', { level })}
          label={`H${level}`}
          ariaLabel={`見出し ${level}`}
        />
      ))}
      <div className="accessory-divider" aria-hidden="true" />

      {/* リスト・挿入グループ */}
      <AccessoryButton
        onPress={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="≡"
        ariaLabel="箇条書きリスト"
      />
      <AccessoryButton
        onPress={onImageInsert}
        label="🖼"
        ariaLabel="画像を挿入"
      />
      <AccessoryButton
        onPress={() => editor.chain().focus().setHardBreak().run()}
        label="↵"
        ariaLabel="改行"
      />
    </div>
  );
}
```

```css
/* src/themes/mobile-accessory.css */
.accessory-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: var(--color-surface-secondary);
  border-top: 1px solid var(--color-border);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  /* スクロールバーを非表示にしてスワイプ操作を優先 */
  scrollbar-width: none;
}

.accessory-toolbar::-webkit-scrollbar {
  display: none;
}

.accessory-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
  margin: 0 4px;
  flex-shrink: 0;
}
```

### 5.6 スラッシュコマンド（`/`）の代替 UI 設計（モバイル向け）

デスクトップでは `/` を入力するとスラッシュコマンドポップアップが表示されるが、
ソフトキーボード環境では `/` の入力自体に手間がかかり、UX が低下する。

**モバイルでの代替導線: アクセサリービューに「＋」ボタンを追加**

```
┌────────────────────────────────────────────────────────┐  ← アクセサリービュー
│ **B** _I_ ~~S~~ `C` │ H1 H2 H3 │ [≡] [🖼] │ [＋] ↵   │
└────────────────────────────────────────────────────────┘
                                            ↑
                                     要素挿入ボタン
```

**「＋」ボタンを押すと下から要素挿入パネル（モーダルシート）が表示される**:

```
┌────────────────────────────────────────────────────────┐
│  要素を挿入                                   [✕]     │
├───────────────┬───────────────┬───────────────┬────────┤
│ 📋 コードブロック│ 📊 テーブル   │ ➗ 数式(KaTeX)  │ 🔗 リンク│
├───────────────┼───────────────┼───────────────┼────────┤
│ ──区切り線    │ 💬 引用       │ ☑ タスクリスト │ 📌 脚注 │
├───────────────┼───────────────┼───────────────┼────────┤
│ 🖼 画像       │ 📁 ファイルリンク│ 🗓 日付       │ [[]] リンク│
└───────────────┴───────────────┴───────────────┴────────┘
```

**実装**:

```typescript
// src/components/mobile/ElementInsertSheet.tsx
import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { useMobileStore } from '../../store/mobileStore';

interface InsertItem {
  label: string;
  icon: string;
  command: (editor: Editor) => void;
}

const INSERT_ITEMS: InsertItem[] = [
  { label: 'コードブロック', icon: '📋', command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'テーブル', icon: '📊', command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3 }).run() },
  { label: '数式', icon: '➗', command: (e) => e.chain().focus().insertContent({ type: 'mathBlock' }).run() },
  { label: 'リンク', icon: '🔗', command: (e) => { /* リンク挿入ダイアログを開く */ } },
  { label: '区切り線', icon: '──', command: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: '引用', icon: '💬', command: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'タスクリスト', icon: '☑', command: (e) => e.chain().focus().toggleTaskList().run() },
  { label: '脚注', icon: '📌', command: (e) => e.chain().focus().insertContent({ type: 'footnote' }).run() },
  { label: '画像', icon: '🖼', command: (e) => { /* SAF / PhotoLibrary 起動 */ } },
  { label: 'Wikiリンク', icon: '[[]]', command: (e) => e.chain().focus().insertContent('[[').run() },
];

export function ElementInsertSheet({ editor }: { editor: Editor }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="accessory-btn accessory-insert"
        onClick={() => setIsOpen(true)}
        aria-label="要素を挿入"
      >
        ＋
      </button>

      {isOpen && (
        <div className="element-insert-sheet" role="dialog" aria-label="要素を挿入">
          <div className="sheet-backdrop" onClick={() => setIsOpen(false)} />
          <div className="sheet-content">
            <div className="sheet-header">
              <span>要素を挿入</span>
              <button onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <div className="insert-grid">
              {INSERT_ITEMS.map(({ label, icon, command }) => (
                <button
                  key={label}
                  className="insert-item"
                  onClick={() => {
                    command(editor);
                    setIsOpen(false);
                  }}
                >
                  <span className="insert-icon">{icon}</span>
                  <span className="insert-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**デスクトップとの機能対応関係**:

| デスクトップ（スラッシュコマンド） | モバイル代替 |
|----------------------------------|------------|
| `/` → ポップアップ → コマンド選択 | アクセサリービューの `＋` ボタン → シート選択 |
| スラッシュコマンドのキーワードフィルタリング | シート内の固定グリッドレイアウト（スクロール対応） |
| スラッシュ入力の途中でエスケープ可 | シートは `backdrop` タップで閉じる |

> **注意**: モバイルでも `/` を入力してスラッシュコマンドを使うことは可能（無効化はしない）。
> ただし UX 的にはアクセサリービューの `＋` ボタンを主要な導線とする。

---

## 6. SAF / iCloud エッジケースと例外処理フロー

### 6.1 オフライン状態での編集

ネットワーク接続がない状態（機内モード等）でもファイル編集は継続できる。ただし、クラウドバックエンドへの同期タイミングによって挙動が異なる。

**オフライン時の動作マトリクス**:

| ストレージ | ファイル状態 | オフライン時の動作 |
|-----------|------------|----------------|
| Android ローカル | 常時アクセス可 | 通常通り読み書き可能 |
| Android SAF（Google Drive） | キャッシュあり | キャッシュから読み込み、保存はローカルのみ（復帰後にクラウド同期） |
| Android SAF（Google Drive） | キャッシュなし | `ContentResolver.openInputStream` が例外 → エラー UI 表示 |
| iOS iCloud Drive | ダウンロード済み | 通常通り読み書き可能 |
| iOS iCloud Drive | クラウドのみ | `startDownloadingUbiquitousItem` がタイムアウト → エラー UI 表示 |

**オフライン検知と UI フロー**:

```
[ファイルを開く操作]
  │
  ▼
[ネットワーク状態を確認（navigator.onLine）]
  │
  ├─ オンライン → 通常フロー
  │
  └─ オフライン
       ├─ SAF: ContentResolver でキャッシュ確認
       │    ├─ キャッシュあり → ファイルを開く + オフラインバナー表示
       │    └─ キャッシュなし → エラーモーダル「オフラインのため開けません」
       │
       └─ iCloud: ubiquitousItemDownloadingStatus を確認
            ├─ .current → ファイルを開く + オフラインバナー表示
            └─ .notDownloaded → エラーモーダル「オフラインのため開けません」
```

```typescript
// src/components/OfflineBanner.tsx
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus(); // navigator.onLine を監視
  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      ⚠ オフラインです。変更はローカルに保存され、
      オンライン復帰後に自動的に同期されます。
    </div>
  );
}

// src/hooks/useOnlineStatus.ts
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### 6.2 SAF URI 権限失効時のリカバリ UI

Android では `takePersistableUriPermission` で永続化した URI の権限が以下のケースで OS 側から剥奪される:

- ユーザーが「設定 → アプリ → ストレージ → アクセスを取り消し」を実行
- 対象ファイルが Google Drive / OneDrive から削除された
- アプリを再インストールした（URI の永続権限がリセットされる）

**権限失効の検知と対応フロー**:

```
[保存済み URI を使ってファイルを開こうとする]
  │
  ▼
[ContentResolver.openInputStream を呼び出す]
  │
  ├─ 成功 → 通常通り開く
  │
  └─ SecurityException（権限なし）
       │
       ▼
  [権限失効ダイアログを表示]
  ┌────────────────────────────────────────────────┐
  │  ファイルへのアクセス権が失われました            │
  │                                                │
  │  「note.md」へのアクセス権が取り消されました。   │
  │  ファイルを再度選択してアクセスを許可してください。│
  │                                                │
  │     [ファイルを再選択]      [キャンセル]        │
  └────────────────────────────────────────────────┘
  │
  ├─ [ファイルを再選択]
  │    → SAF ファイルピッカーを再起動
  │    → 選択後 takePersistableUriPermission を再実行
  │    → 保存済み URI を新しい URI で上書き
  │
  └─ [キャンセル] → タブを閉じる（またはコンテンツ保持のまま読み取り専用化）
```

```rust
// src-tauri/src/android/saf.rs
#[derive(Debug, Serialize)]
#[serde(tag = "kind")]
pub enum SafError {
    /// URI の権限が OS 側から失効している
    PermissionRevoked { uri: String },
    /// ファイルが削除・移動されてプロバイダーが見つからない
    FileNotFound { uri: String },
    /// ネットワーク接続なしでクラウドファイルにアクセスしようとした
    Offline { uri: String },
    /// その他の ContentResolver エラー
    Unknown { uri: String, message: String },
}

#[tauri::command]
pub async fn open_saf_document(uri: String) -> Result<Vec<u8>, SafError> {
    // ContentResolver.openInputStream を呼び出す
    // SecurityException → SafError::PermissionRevoked
    // FileNotFoundException → SafError::FileNotFound
    todo!("Tauri Android plugin API で実装")
}
```

```typescript
// src/file/android-file-handler.ts（エラーハンドリング追加）

export async function openSafFile(uri: string): Promise<string | null> {
  try {
    const bytes = await invoke<number[]>('open_saf_document', { uri });
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (err) {
    if (isSafError(err)) {
      switch (err.kind) {
        case 'PermissionRevoked':
          await showPermissionRevokedDialog(uri);
          return null;
        case 'FileNotFound':
          useToastStore.getState().show(
            'error',
            'ファイルが見つかりません。削除されたか移動された可能性があります。'
          );
          return null;
        case 'Offline':
          useToastStore.getState().show(
            'warning',
            'オフラインのため、このクラウドファイルにはアクセスできません。'
          );
          return null;
      }
    }
    throw err;
  }
}

/** 権限失効リカバリダイアログを表示し、再選択を促す */
async function showPermissionRevokedDialog(oldUri: string): Promise<void> {
  const confirmed = await ask(
    'このファイルへのアクセス権が取り消されました。\nファイルを再度選択してアクセスを許可してください。',
    { title: 'アクセス権が失われました', okLabel: 'ファイルを再選択', cancelLabel: 'キャンセル' }
  );
  if (confirmed) {
    const newUri = await invoke<string>('open_document_picker');
    if (newUri) {
      await invoke('persist_uri_permission', { uri: newUri });
      // 古い URI を新しい URI で置き換えてセッションを更新
      await replaceRecentFileUri(oldUri, newUri);
    }
  }
}
```

### 6.3 バックグラウンド同期中のコンフリクト通知と手動マージ

SAF（Google Drive / OneDrive）や iCloud Drive のバックグラウンド同期中に競合（コンフリクト）が発生した場合の通知と手動マージ画面を設計する。

**コンフリクト発生条件**:

| ストレージ | 発生タイミング |
|-----------|-------------|
| Android SAF + Google Drive | 別デバイスで同じファイルを編集後、このデバイスに戻ったとき |
| iOS iCloud Drive | `NSFileVersion.unresolvedConflictVersionsOfItem` が非空のとき |

**コンフリクト通知フロー**:

```
[アプリがフォアグラウンドに復帰]
  │
  ▼
[開いているファイルの競合状態を確認]
  │
  ├─ 競合なし → 通常通り
  │
  └─ 競合あり
       │
       ▼
  [非侵入的な通知バナーを表示（編集を中断しない）]
  ┌──────────────────────────────────────────────────┐
  │  ⚠ 「note.md」に競合があります  [確認する]  [✕]  │
  └──────────────────────────────────────────────────┘
  │
  └─ [確認する] → 手動マージ画面へ
```

**手動マージ画面の設計**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ファイルの競合を解決                             [✕ キャンセル] │
│                                                                 │
│  「note.md」が複数のデバイスで同時に編集されました。             │
│  保存するバージョンを選択するか、内容を統合してください。         │
│                                                                 │
│ ┌───────────────────────┐    ┌───────────────────────────────┐  │
│ │ このデバイスの変更      │    │ 別デバイス（iPhone）の変更    │  │
│ │ 更新: 2分前            │    │ 更新: 8分前                  │  │
│ │ ──────────────────── │    │ ─────────────────────────── │  │
│ │ # プロジェクト計画      │    │ # プロジェクト計画            │  │
│ │ - 新しいアイテム A      │  ← │ - 別のアイテム B              │  │
│ └───────────────────────┘    └───────────────────────────────┘  │
│                                                                 │
│  [このデバイスの変更を使用]  [別デバイスの変更を使用]            │
│  [手動で編集して統合する]                                        │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// src/components/mobile/ConflictResolutionModal.tsx

interface ConflictVersion {
  deviceName: string;
  modifiedAt: Date;
  content: string;
}

interface Props {
  filePath: string;
  localVersion: ConflictVersion;
  remoteVersions: ConflictVersion[];
  onResolve: (resolvedContent: string) => void;
  onDismiss: () => void;
}

export function ConflictResolutionModal({
  filePath,
  localVersion,
  remoteVersions,
  onResolve,
  onDismiss,
}: Props) {
  const remoteVersion = remoteVersions[0]; // 最初の競合バージョンを表示

  return (
    <Modal title="ファイルの競合を解決">
      <p>
        「{basename(filePath)}」が複数のデバイスで同時に編集されました。
        保存するバージョンを選択してください。
      </p>
      <div className="conflict-versions">
        <ConflictVersionPanel
          label="このデバイスの変更"
          version={localVersion}
          onSelect={() => onResolve(localVersion.content)}
        />
        <ConflictVersionPanel
          label={`${remoteVersion.deviceName}の変更`}
          version={remoteVersion}
          onSelect={() => onResolve(remoteVersion.content)}
        />
      </div>
      <button
        className="manual-merge-btn"
        onClick={() => {
          // 両バージョンを Git 風のマーカーで結合して手動編集させる
          onResolve(buildMergePlaceholder(localVersion.content, remoteVersion.content));
        }}
      >
        手動で編集して統合する
      </button>
      <button className="cancel-btn" onClick={onDismiss}>
        後で決める（読み取り専用で開く）
      </button>
    </Modal>
  );
}

/** 手動マージ用の diff マーカー付きテキストを生成する */
function buildMergePlaceholder(local: string, remote: string): string {
  return [
    '<<<<<<< このデバイスの変更',
    local,
    '=======',
    remote,
    '>>>>>>> 別デバイスの変更',
  ].join('\n');
}
```

---

## 関連ドキュメント

- [cross-platform-design.md](./cross-platform-design.md) — プラットフォーム共通設計
- [workspace-design.md](./workspace-design.md) — ファイルツリー・ワークスペース
- [security-design.md](./security-design.md) — サンドボックス・ファイルアクセス制限
- [../08_Testing_Quality/error-handling-design.md](../08_Testing_Quality/error-handling-design.md) §9 — モバイル固有ネットワーク・権限エラーマトリクス
