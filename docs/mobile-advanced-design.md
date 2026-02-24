# モバイル詳細設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [ソフトキーボード対応（ビューポート調整）](#1-ソフトキーボード対応ビューポート調整)
2. [Android SAF（Storage Access Framework）連携](#2-android-safstorage-access-framework連携)
3. [iCloud Drive 連携（iOS）](#3-icloud-drive-連携ios)
4. [モバイル向けエディタ最適化](#4-モバイル向けエディタ最適化)

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

## 関連ドキュメント

- [cross-platform-design.md](./cross-platform-design.md) — プラットフォーム共通設計
- [workspace-design.md](./workspace-design.md) — ファイルツリー・ワークスペース
- [security-design.md](./security-design.md) — サンドボックス・ファイルアクセス制限
