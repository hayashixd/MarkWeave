# 画像操作詳細設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [クリップボードからの画像貼り付けフロー](#1-クリップボードからの画像貼り付けフロー)
2. [画像の最適化・圧縮設定](#2-画像の最適化圧縮設定)
3. [alt テキスト（画像キャプション）の編集 UX](#3-alt-テキスト画像キャプションの編集-ux)

---

## 1. クリップボードからの画像貼り付けフロー

### 1.1 対応するクリップボード形式

| クリップボード形式 | 動作 |
|----------------|------|
| PNG / JPEG / WebP（スクリーンショット等） | 画像保存フローへ（後述）|
| ファイルパス（Explorerからコピー）| `![name](file:///path)` として挿入（後で相対パスに変換）|
| HTML `<img>` タグ | `src` 属性の URL を画像として扱う |
| data URI (`data:image/png;base64,...`) | デコードして画像保存フローへ |

### 1.2 画像貼り付けフロー

```
Ctrl+V（クリップボードに画像データあり）
  │
  ▼
[1] 画像データを取得（navigator.clipboard.read()）
  │
  ▼
[2] 画像保存設定（imageSettings）に従ってファイルを保存:
      → image-storage-design.md §1 の保存先モードを参照
      → ファイル名: `paste-YYYYMMDD-HHmmSS.png`
  │
  ├─ 保存モード = 'ask' の場合:
  │    「この画像をどこに保存しますか？」ダイアログを表示
  │    [カレントフォルダの ./images/]  [別のフォルダを選択]
  │
  └─ それ以外: 自動保存
  │
  ▼
[3] Markdown に `![](./images/paste-YYYYMMDD-HHmmSS.png)` を挿入
```

### 1.3 スクリーンショット対応

Windows のスクリーンショット（`Win+Shift+S` / `PrtScr`）は PNG 形式でクリップボードに格納される。
macOS のスクリーンショット（`Cmd+Shift+4`）も同様。

```typescript
// src/file/clipboard-image.ts

export async function readClipboardImage(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        return await item.getType(imageType);
      }
    }
    return null;
  } catch {
    // clipboard.read() が拒否された場合（HTTPS コンテキスト外等）
    return null;
  }
}
```

### 1.4 data URI の処理

スマートペーストや Web からのコピーで `data:image/...` 形式の画像が来た場合:

```typescript
export function isDataUri(src: string): boolean {
  return src.startsWith('data:image/');
}

export async function saveDataUri(
  dataUri: string,
  saveDir: string,
  fileName: string,
): Promise<string> {
  const [header, base64] = dataUri.split(',');
  const ext = header.match(/data:image\/(\w+)/)?.[1] ?? 'png';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const filePath = `${saveDir}/${fileName}.${ext}`;
  await writeBinaryFile(filePath, bytes);
  return filePath;
}
```

### 1.5 WebP への自動変換（オプション）

設定 `imageConvertToWebP: boolean`（デフォルト: `false`）が有効な場合、
クリップボード画像を WebP に変換してから保存する。

```typescript
// OffscreenCanvas を使った WebP 変換
async function convertToWebP(blob: Blob, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/webp', quality });
}
```

---

## 2. 画像の最適化・圧縮設定

### 2.1 設定項目

`user-settings-design.md` の `imageSettings` に以下を追加:

```typescript
interface ImageStorageSettings {
  // 既存フィールド（image-storage-design.md より）
  storageMode: 'adjacent' | 'custom' | 'embedded' | 'none';
  customDir: string;

  // 新規追加: 最適化設定
  /** 挿入時に自動リサイズするか */
  autoResize: boolean;
  /** autoResize 時の最大幅（px）。0 = 制限なし */
  maxWidth: number;      // デフォルト: 1920
  /** autoResize 時の最大高さ（px）。0 = 制限なし */
  maxHeight: number;     // デフォルト: 1080
  /** JPEG 保存品質（0.0〜1.0）*/
  jpegQuality: number;   // デフォルト: 0.85
  /** PNG をロスレスで保持するか（false = WebP に変換） */
  preservePng: boolean;  // デフォルト: true
  /** WebP に変換するか */
  convertToWebP: boolean; // デフォルト: false
}
```

### 2.2 自動リサイズフロー

```
画像挿入時（D&D・クリップボード・ダイアログ選択）
  │
  ├─ autoResize = false → そのまま保存
  │
  └─ autoResize = true
       └─ 画像サイズを取得
            │
            ├─ 幅 > maxWidth または 高さ > maxHeight
            │   → アスペクト比を維持しつつリサイズして保存
            │   → トースト通知: 「画像を 1920x1080 にリサイズしました」
            │
            └─ 制限以内 → そのまま保存
```

### 2.3 圧縮処理

```typescript
// src/file/image-processor.ts
import sharp from 'sharp'; // Rust サイドで tauri-plugin-shell 経由で呼び出し
// または OffscreenCanvas (WebP/JPEG リサイズ)

export async function processImage(
  input: Uint8Array,
  settings: ImageStorageSettings,
): Promise<{ data: Uint8Array; ext: string }> {
  const bitmap = await createImageBitmap(new Blob([input]));
  let { width, height } = bitmap;

  // リサイズ計算
  if (settings.autoResize && settings.maxWidth > 0) {
    const ratio = Math.min(settings.maxWidth / width, settings.maxHeight / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);

  if (settings.convertToWebP) {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: settings.jpegQuality });
    return { data: new Uint8Array(await blob.arrayBuffer()), ext: 'webp' };
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { data: new Uint8Array(await blob.arrayBuffer()), ext: 'png' };
}
```

### 2.4 設定 UI

`user-settings-design.md` の「ファイル」カテゴリの「画像」サブセクションに表示:

```
画像設定
────────────────────────────────────────────────
自動リサイズ: [✓]
最大サイズ: [1920] × [1080] px

品質（JPEG / WebP）: [────●────] 85%
                      低品質      高品質

[ ] PNG を WebP に変換して保存（ファイルサイズ削減）
────────────────────────────────────────────────
```

---

## 3. alt テキスト（画像キャプション）の編集 UX

### 3.1 alt テキストの重要性

alt テキストは:
1. アクセシビリティ（スクリーンリーダー向け）
2. 画像読み込み失敗時のフォールバック表示
3. 検索エンジン最適化

### 3.2 編集トリガー

| 操作 | 動作 |
|------|------|
| 画像を選択して `Enter` | alt テキスト編集ダイアログを開く |
| 画像を右クリック → 「alt テキストを編集...」| 同上 |
| 画像選択時にツールバーの「Alt テキスト」ボタン | 同上 |
| 直接ソースモードで編集 | `![ここを編集](path)` |

### 3.3 編集ダイアログ

```
┌────────────────────────────────────────────────┐
│  alt テキストを編集                             │
├────────────────────────────────────────────────┤
│                                                │
│  ┌───────────────────────────────────────────┐ │
│  │  [サムネイル画像]                          │ │
│  └───────────────────────────────────────────┘ │
│                                                │
│  alt テキスト:                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ スクリーンショット_2026-02-24              │ │
│  └───────────────────────────────────────────┘ │
│                                                │
│  title（ホバーテキスト、任意）:                │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                │
│  [ ] 装飾的な画像（スクリーンリーダーで読み飛ばす）│
│                                                │
│              [キャンセル]  [適用]               │
└────────────────────────────────────────────────┘
```

### 3.4 実装方針

```typescript
// src/renderer/wysiwyg/node-views/image-view.tsx

function ImageNodeView({ node, updateAttributes }: NodeViewProps) {
  const [showAltEditor, setShowAltEditor] = useState(false);

  return (
    <NodeViewWrapper>
      <img
        src={node.attrs.src}
        alt={node.attrs.alt}
        title={node.attrs.title}
        onKeyDown={(e) => { if (e.key === 'Enter') setShowAltEditor(true); }}
      />
      {showAltEditor && (
        <AltTextDialog
          alt={node.attrs.alt}
          title={node.attrs.title}
          onSave={(alt, title) => {
            updateAttributes({ alt, title });
            setShowAltEditor(false);
          }}
          onClose={() => setShowAltEditor(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
```

### 3.5 装飾的な画像

「装飾的な画像」チェックボックスをオンにすると、Markdown に `![](path)`（alt 空文字）として保存する。
ARIA 設計では `aria-hidden="true"` を付与する（[accessibility-design.md](./accessibility-design.md) §3 参照）。

---

## 関連ドキュメント

- [image-storage-design.md](./image-storage-design.md) — 画像保存先モード・ファイル命名・重複排除
- [smart-paste-design.md](./smart-paste-design.md) — HTML ペースト時の画像 data URI 処理
- [editor-ux-design.md](./editor-ux-design.md) — 画像インラインリサイズ UI
- [accessibility-design.md](./accessibility-design.md) — 画像の ARIA 設計
- [user-settings-design.md](./user-settings-design.md) — imageSettings スキーマ
