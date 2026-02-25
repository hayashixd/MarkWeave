# 画像管理設計ドキュメント（保存・操作・アノテーション）

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.1
> 更新日: 2026-02-25

---

## 目次

1. [画像ペースト/D&Dの保存先設計](#1-画像ペーストddの保存先設計)
2. [Tauri WebViewでのローカル画像表示](#2-tauri-webviewでのローカル画像表示)
3. [ファイル移動・リネーム時の相対パス更新](#3-ファイル移動リネーム時の相対パス更新)
4. [外部URL画像のローカルキャッシュ](#4-外部url画像のローカルキャッシュ)
5. [設計まとめ・優先実装順序](#5-設計まとめ優先実装順序)
6. [クリップボードからの画像貼り付けフロー](#6-クリップボードからの画像貼り付けフロー)
7. [画像の最適化・圧縮設定](#7-画像の最適化圧縮設定)
8. [alt テキスト（画像キャプション）の編集 UX](#8-alt-テキスト画像キャプションの編集-ux)
9. [画像アノテーション（簡易注釈）](#9-画像アノテーション簡易注釈)

---

## 1. 画像ペースト/D&Dの保存先設計

### 1.1 保存先モードの選択肢

Typora と同等の柔軟性を持たせるため、以下の4モードを提供する。

| モード | 保存先 | ユースケース |
|--------|--------|------------|
| `same-dir` | Markdownファイルと同じディレクトリ | 手軽な単一ファイル管理 |
| `subfolder` | `{md-dir}/{subfolderName}/` | **デフォルト推奨**・Typora互換 |
| `custom-relative` | `{md-dir}/{カスタムパス}/` | プロジェクト統一管理 |
| `custom-absolute` | 絶対パス指定 | 画像を一元管理したい場合 |

### 1.2 ユーザー設定の型定義

```typescript
// src/file/imageStorage.ts

export type ImageSaveMode =
  | 'same-dir'
  | 'subfolder'
  | 'custom-relative'
  | 'custom-absolute';

export type FilenameStrategy =
  | 'uuid'           // 3f2a1b4c-...png  ← 衝突なし・非可読
  | 'timestamp'      // 20260223_143022.png  ← 可読・ソート可
  | 'original'       // screenshot.png  ← 可読・衝突リスクあり
  | 'timestamp-original'; // 20260223_143022_screenshot.png ← 推奨

export interface ImageStorageSettings {
  saveMode: ImageSaveMode;
  subfolderName: string;       // デフォルト: "assets"
  customPath: string;          // custom-* モード時のパス
  filenameStrategy: FilenameStrategy;
  deduplicateByHash: boolean;  // 同一内容の画像を再保存しない
  // 最適化設定（§7 参照）
  autoResize: boolean;
  maxWidth: number;      // デフォルト: 1920
  maxHeight: number;     // デフォルト: 1080
  jpegQuality: number;   // デフォルト: 0.85
  preservePng: boolean;  // デフォルト: true
  convertToWebP: boolean; // デフォルト: false
}

export const DEFAULT_IMAGE_SETTINGS: ImageStorageSettings = {
  saveMode: 'subfolder',
  subfolderName: 'assets',
  customPath: '',
  filenameStrategy: 'timestamp-original',
  deduplicateByHash: true,
  autoResize: false,
  maxWidth: 1920,
  maxHeight: 1080,
  jpegQuality: 0.85,
  preservePng: true,
  convertToWebP: false,
};
```

### 1.3 保存先パスの解決ロジック（TypeScript側）

```typescript
// src/file/imageStorage.ts
import { dirname, join, resolve } from '@tauri-apps/api/path';
import { mkdir, exists, writeFile } from '@tauri-apps/plugin-fs';

export async function resolveImageSaveDir(
  markdownFilePath: string,
  settings: ImageStorageSettings
): Promise<string> {
  const mdDir = await dirname(markdownFilePath);

  switch (settings.saveMode) {
    case 'same-dir':
      return mdDir;
    case 'subfolder':
      return join(mdDir, settings.subfolderName);
    case 'custom-relative':
      return resolve(mdDir, settings.customPath);
    case 'custom-absolute':
      return settings.customPath;
  }
}

export async function generateImageFilename(
  originalName: string,
  strategy: FilenameStrategy
): Promise<string> {
  const ext = originalName.split('.').pop() ?? 'png';
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const ts = new Date().toISOString()
    .replace(/[-:T]/g, '')
    .substring(0, 15); // "20260223_143022"

  switch (strategy) {
    case 'uuid':
      return `${crypto.randomUUID()}.${ext}`;
    case 'timestamp':
      return `${ts}.${ext}`;
    case 'original':
      return originalName;
    case 'timestamp-original':
      return `${ts}_${baseName}.${ext}`;
  }
}

export async function saveImageFile(
  markdownFilePath: string,
  imageData: Uint8Array,
  originalName: string,
  settings: ImageStorageSettings
): Promise<string> {
  const saveDir = await resolveImageSaveDir(markdownFilePath, settings);

  if (!(await exists(saveDir))) {
    await mkdir(saveDir, { recursive: true });
  }

  if (settings.deduplicateByHash) {
    const existing = await findByHash(saveDir, imageData);
    if (existing) return existing;
  }

  const filename = await generateImageFilename(originalName, settings.filenameStrategy);
  const destPath = await join(saveDir, filename);
  await writeFile(destPath, imageData);
  return destPath;
}
```

### 1.4 TipTapへのペースト/D&Dハンドラ

```typescript
// src/plugins/imageDropPaste.ts
import { Plugin, PluginKey } from '@tiptap/pm/state';

export function createImageDropPastePlugin(
  getMarkdownPath: () => string,
  getSettings: () => ImageStorageSettings
) {
  return new Plugin({
    key: new PluginKey('imageDropPaste'),
    props: {
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (!item.type.startsWith('image/')) continue;
          const file = item.getAsFile();
          if (!file) continue;
          handleImageFile(view, file, getMarkdownPath(), getSettings());
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          handleImageFile(view, file, getMarkdownPath(), getSettings());
          return true;
        }
        return false;
      },
    },
  });
}
```

---

## 2. Tauri WebViewでのローカル画像表示

### 2.1 問題の核心

TipTap が `src="./assets/foo.png"` を `<img>` に展開しても、
WebView のオリジンは `https://tauri.localhost` であるため、
ローカルファイルへのアクセスはデフォルトでブロックされる。

### 2.2 Tauri 2.0 の解決策: `asset` プロトコル

```
ローカル絶対パス  →  convertFileSrc()  →  https://asset.localhost/...
```

**Step 1: `tauri.conf.json` の CSP 設定**

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost blob: data:; script-src 'self' 'unsafe-inline'"
    }
  }
}
```

**Step 2: Capabilities でアセットアクセスを許可**

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["core:default", "core:asset:allow-fetch-asset"]
}
```

**Step 3: TipTap のカスタム Image NodeView で変換**

```typescript
// src/renderer/wysiwyg/ImageNodeView.tsx
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolve, dirname } from '@tauri-apps/api/path';

export function ImageNodeView({ node, getCurrentFilePath }: Props) {
  const [displaySrc, setDisplaySrc] = useState<string>('');

  useEffect(() => {
    async function resolveSrc() {
      const src = node.attrs.src;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        setDisplaySrc(src);
        return;
      }
      const mdDir = await dirname(getCurrentFilePath());
      const absolutePath = await resolve(mdDir, src);
      setDisplaySrc(convertFileSrc(absolutePath));
    }
    resolveSrc();
  }, [node.attrs.src]);

  return (
    <NodeViewWrapper>
      <img src={displaySrc} alt={node.attrs.alt} />
    </NodeViewWrapper>
  );
}
```

### 2.3 モバイル（Android/iOS）での画像表示・保存設計

#### 2.3.1 asset:// プロトコルの挙動（全プラットフォーム共通）

| プラットフォーム | プロトコル | 備考 |
|----------------|-----------|------|
| Windows/macOS/Linux | `https://asset.localhost/` | `convertFileSrc()` が自動変換 |
| Android | `https://asset.localhost/` | 同上（Tauri 2.0で統一） |
| iOS (WKWebView) | `https://asset.localhost/` | 同上 |

`convertFileSrc()` は全プラットフォームで正しい URL を返すため、**コード上でプラットフォーム分岐は不要**。

#### 2.3.2 Android の画像保存先とアクセス制限

Android は **Scoped Storage**（Android 10 以降）により、アプリは任意のパスにファイルを書き込めない。

| ストレージ種別 | Tauri でのアクセス | 用途 |
|-------------|-----------------|------|
| アプリ専用内部ストレージ (`$APP_DATA_DIR`) | **無制限** | アセット・設定・キャッシュ |
| アプリ専用外部ストレージ | 許可不要でアクセス可 | 大容量アセット |
| 共有ストレージ（Downloads, Pictures 等） | Storage Access Framework 経由 | ユーザーが「保存先」を選択する場合 |

#### 2.3.3 iOS の画像保存先とアクセス制限

| アクセス先 | 方法 |
|-----------|------|
| アプリの Documents フォルダ | 無制限 |
| iCloud Drive（Documents） | `UIFileSharingEnabled` 設定で公開可能 |
| Files アプリで選択したファイル | Document Picker 経由 |

**iCloud Drive 連携方針**: `tauri.conf.json` の iOS 設定で `UIFileSharingEnabled: true` を有効化する。

#### 2.3.4 HEIF 形式の自動変換

```typescript
async function normalizeImageFormat(file: File): Promise<{ bytes: Uint8Array; name: string }> {
  const heifTypes = ['image/heif', 'image/heic', 'image/heif-sequence'];
  if (!heifTypes.includes(file.type)) {
    const buffer = await file.arrayBuffer();
    return { bytes: new Uint8Array(buffer), name: file.name };
  }
  // Canvas API で JPEG に変換
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const name = file.name.replace(/\.(heif|heic)$/i, '.jpg');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), name };
}
```

#### 2.3.5 モバイルでのタッチ操作対応（Phase 5 課題）

| 機能 | デスクトップ | モバイル代替 |
|------|------------|------------|
| 画像 D&D | ◎ | ✗ → 「写真を挿入」ボタン |
| クリップボードペースト | ◎ | ◎ 長押しメニューからペースト |
| カメラロールから選択 | ✗ | ◎ `input type="file" accept="image/*"` |

---

## 3. ファイル移動・リネーム時の相対パス更新

### 3.1 方針

**実装推奨**。ユーザーがGUI上でリネーム・移動する場合、古いパスの画像が壊れることは許容できないUX。Typora・Obsidianともに自動更新を実装している。

### 3.2 TypeScript実装（正規表現ベース）

```typescript
// src/file/pathUpdater.ts
export async function updateImagePathsOnMove(
  oldFilePath: string,
  newFilePath: string
): Promise<void> {
  const content = await readTextFile(newFilePath);
  const updated = await rewriteImagePaths(content, oldFilePath, newFilePath);
  if (updated !== content) {
    await writeTextFile(newFilePath, updated);
  }
}

async function rewriteImagePaths(
  content: string,
  oldFilePath: string,
  newFilePath: string
): Promise<string> {
  const oldDir = await dirname(oldFilePath);
  const newDir = await dirname(newFilePath);
  const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s"]+)(\s+"[^"]*")?\)/g;
  const replacements: Array<[string, string]> = [];

  for (const match of content.matchAll(IMAGE_REGEX)) {
    const [full, alt, src, title = ''] = match;
    if (/^(https?:\/\/|data:)/.test(src)) continue;
    const absolutePath = await resolve(oldDir, src);
    const newRelative = await relative(newDir, absolutePath);
    const normalizedPath = newRelative.replace(/\\/g, '/');
    replacements.push([full, `![${alt}](${normalizedPath}${title})`]);
  }

  let result = content;
  for (const [original, replacement] of replacements) {
    result = result.replace(original, replacement);
  }
  return result;
}
```

### 3.3 ファイル操作フローとの統合

```typescript
export async function moveMarkdownFile(oldPath: string, newPath: string): Promise<void> {
  await rename(oldPath, newPath);
  await updateImagePathsOnMove(oldPath, newPath);
}
```

> **注意**: 画像ファイル自体は移動しない。Markdownの参照先パスを更新するのみ。

---

## 4. 外部URL画像のローカルキャッシュ

### 4.1 アーキテクチャ概要

```
TipTap ImageNodeView
  │
  ├─ src が http/https → invoke('cache_remote_image', { url })
  │                    → キャッシュヒット? → キャッシュパスを返す
  │                    → ミス → reqwest で fetch → $APP_CACHE_DIR/images/{hash}.{ext} に保存
  └─ convertFileSrc(localPath) → <img src="https://asset.localhost/...">
```

### 4.2 Rust側実装

```rust
// src-tauri/src/commands/image_cache.rs
#[tauri::command]
pub async fn cache_remote_image(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        format!("{:x}", hasher.finalize())
    };
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| e.to_string())?.join("images");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let ext = url.split('?').next().unwrap_or(&url)
        .rsplit('.').next()
        .filter(|e| ["png","jpg","jpeg","gif","webp","svg"].contains(e))
        .unwrap_or("png");
    let cache_path = cache_dir.join(format!("{}.{}", &hash[..16], ext));

    if cache_path.exists() {
        return Ok(cache_path.to_string_lossy().to_string());
    }

    let response = reqwest::get(&url).await.map_err(|e| format!("fetch error: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&cache_path, &bytes).map_err(|e| e.to_string())?;
    Ok(cache_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn purge_image_cache(app: tauri::AppHandle, max_bytes: u64) -> Result<u64, String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| e.to_string())?.join("images");
    let mut entries: Vec<(PathBuf, u64, std::time::SystemTime)> = std::fs::read_dir(&cache_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            Some((e.path(), meta.len(), meta.modified().ok()?))
        }).collect();
    entries.sort_by_key(|(_, _, t)| *t);
    let total: u64 = entries.iter().map(|(_, size, _)| size).sum();
    let mut freed = 0u64;
    let mut to_delete = total.saturating_sub(max_bytes);
    for (path, size, _) in entries {
        if to_delete == 0 { break; }
        let _ = std::fs::remove_file(&path);
        freed += size;
        to_delete = to_delete.saturating_sub(size);
    }
    Ok(freed)
}
```

---

## 5. 設計まとめ・優先実装順序

| 優先度 | 項目 | 工数感 | 備考 |
|--------|------|--------|------|
| 1 | §2: `asset://` プロトコル対応 | 小 | これがないと画像が表示されない |
| 2 | §1: 画像ペースト/D&D保存（`subfolder`固定） | 中 | 設定UI後回しで十分 |
| 3 | §3: ファイル移動時のパス更新 | 小 | 正規表現で十分 |
| 4 | §1: 保存先設定UI（4モード） | 中 | §2完成後に追加 |
| 5 | §4: 外部URL画像キャッシュ | 中 | オフライン要件がなければ後回し可 |

### データフロー整理

```
[保存時]  img.src = "./assets/20260223_foo.png"  ← 相対パスで保存

[表示時]  ImageNodeView: "./assets/foo.png"
            → resolve(mdDir, src) → "/Users/.../doc/assets/foo.png"
            → convertFileSrc()   → "https://asset.localhost/..."
            → <img src="https://asset.localhost/...">

[移動時]  rename(old, new)
            → rewriteImagePaths(content, oldDir, newDir)
            → writeFile(newPath, updatedContent)
```

---

## 6. クリップボードからの画像貼り付けフロー

### 6.1 対応するクリップボード形式

| クリップボード形式 | 動作 |
|----------------|------|
| PNG / JPEG / WebP（スクリーンショット等） | 画像保存フローへ |
| ファイルパス（Explorerからコピー）| `![name](file:///path)` として挿入 |
| HTML `<img>` タグ | `src` 属性の URL を画像として扱う |
| data URI (`data:image/png;base64,...`) | デコードして画像保存フローへ |

### 6.2 画像貼り付けフロー

```
Ctrl+V（クリップボードに画像データあり）
  │
  ▼
[1] 画像データを取得（navigator.clipboard.read()）
  │
  ▼
[2] 画像保存設定（imageSettings）に従ってファイルを保存
  │
  ├─ 保存モード = 'ask' の場合:
  │    「この画像をどこに保存しますか？」ダイアログを表示
  └─ それ以外: 自動保存
  │
  ▼
[3] Markdown に `![](./images/paste-YYYYMMDD-HHmmSS.png)` を挿入
```

### 6.3 スクリーンショット対応

```typescript
export async function readClipboardImage(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) return await item.getType(imageType);
    }
    return null;
  } catch {
    return null;
  }
}
```

### 6.4 data URI の処理

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

---

## 7. 画像の最適化・圧縮設定

### 7.1 設定項目

`ImageStorageSettings` の最適化フィールド（§1.2 参照）:

- `autoResize`: 挿入時に自動リサイズするか
- `maxWidth` / `maxHeight`: リサイズ時の最大サイズ（px）
- `jpegQuality`: JPEG 保存品質（0.0〜1.0）
- `preservePng`: PNG をロスレスで保持するか
- `convertToWebP`: WebP に変換するか

### 7.2 自動リサイズフロー

```
画像挿入時（D&D・クリップボード・ダイアログ選択）
  │
  ├─ autoResize = false → そのまま保存
  └─ autoResize = true
       └─ 幅 > maxWidth または 高さ > maxHeight
            → アスペクト比を維持しつつリサイズして保存
            → トースト通知: 「画像を 1920x1080 にリサイズしました」
```

### 7.3 圧縮処理

```typescript
export async function processImage(
  input: Uint8Array,
  settings: ImageStorageSettings,
): Promise<{ data: Uint8Array; ext: string }> {
  const bitmap = await createImageBitmap(new Blob([input]));
  let { width, height } = bitmap;

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

### 7.4 設定 UI

```
画像設定
────────────────────────────────────────────────
自動リサイズ: [✓]
最大サイズ: [1920] × [1080] px

品質（JPEG / WebP）: [────●────] 85%

[ ] PNG を WebP に変換して保存（ファイルサイズ削減）
────────────────────────────────────────────────
```

---

## 8. alt テキスト（画像キャプション）の編集 UX

### 8.1 alt テキストの重要性

1. アクセシビリティ（スクリーンリーダー向け）
2. 画像読み込み失敗時のフォールバック表示
3. 検索エンジン最適化

### 8.2 編集トリガー

| 操作 | 動作 |
|------|------|
| 画像を選択して `Enter` | alt テキスト編集ダイアログを開く |
| 画像を右クリック → 「alt テキストを編集...」| 同上 |
| 画像選択時にツールバーの「Alt テキスト」ボタン | 同上 |

### 8.3 編集ダイアログ

```
┌────────────────────────────────────────────────┐
│  alt テキストを編集                             │
├────────────────────────────────────────────────┤
│  [サムネイル画像]                               │
│                                                │
│  alt テキスト:                                 │
│  [ スクリーンショット_2026-02-24              ] │
│                                                │
│  title（ホバーテキスト、任意）:                │
│  [                                           ] │
│                                                │
│  [ ] 装飾的な画像（スクリーンリーダーで読み飛ばす）│
│              [キャンセル]  [適用]               │
└────────────────────────────────────────────────┘
```

### 8.4 実装方針

```typescript
function ImageNodeView({ node, updateAttributes }: NodeViewProps) {
  const [showAltEditor, setShowAltEditor] = useState(false);

  return (
    <NodeViewWrapper>
      <img
        src={node.attrs.src}
        alt={node.attrs.alt}
        onKeyDown={(e) => { if (e.key === 'Enter') setShowAltEditor(true); }}
        onDoubleClick={() => setIsAnnotating(true)}
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

---

## 9. 画像アノテーション（簡易注釈）

### 9.1 概要と目的

エディタに貼り付けた画像に対して、エディタ内で直接「赤枠」「矢印」「テキスト注釈」「モザイク（ぼかし）」などの注釈を追加できる機能。マニュアル・ブログ・技術記事でスクリーンショットを多用するユーザーが、**外部画像編集ソフトを開かずにエディタ内で完結**して注釈を追加できる。

> **対象**: デスクトップ専用機能（モバイルは対象外）

### 9.2 提供するアノテーションツール

| ツール | アイコン | 説明 |
|-------|---------|------|
| **矩形（赤枠）** | □ | 強調したい領域を囲む矩形を描画 |
| **楕円** | ○ | 円形・楕円の強調枠を描画 |
| **矢印** | → | 指し示す矢印を描画 |
| **フリーハンド線** | ✏ | 自由な曲線を描画 |
| **テキスト** | T | 任意のテキストラベルを追加 |
| **モザイク（ぼかし）** | ▓ | 個人情報など隠したい領域をぼかす |
| **ステップ番号** | ❶ | 丸囲み数字（手順説明用） |
| **消しゴム** | ⌫ | 追加したアノテーションを削除 |

### 9.3 UI 設計

```
画像をダブルクリック → アノテーションモードに入る

┌───────────────────────────────────────────────────────┐
│ [□] [○] [→] [✏] [T] [▓] [❶] [⌫]  ─  ●  [色] [Undo]│  ← アノテーションツールバー
├───────────────────────────────────────────────────────┤
│     ┌──────────────────────────────────────────┐      │
│     │          アノテーション対象の画像          │      │
│     └──────────────────────────────────────────┘      │
│                [完了]  [キャンセル]                    │
└───────────────────────────────────────────────────────┘
```

カラープリセット: `[●赤] [●青] [●黄] [●緑] [●黒] [●白]  [カスタム...]`（デフォルト: 赤）

### 9.4 操作フロー

```
1. エディタ内の画像をダブルクリック
2. アノテーションモード開始（画像がキャンバスとしてオーバーレイ表示）
3. ツールバーでツールと色を選択
4. 画像上でドラッグして描画
5. [完了] をクリック
6. アノテーション済み画像が元画像ファイルに上書き保存される
7. Markdown の img タグは変更なし（ファイルパスが同じため）
```

### 9.5 描画ツールの詳細設計

| ツール | ショートカット | 詳細 |
|--------|------------|------|
| 矩形 | R | ドラッグで矩形。塗りつぶしなし/半透明塗りつぶし |
| 矢印 | A | 始点→終点でドラッグ。終点に塗りつぶし三角形 |
| テキスト | T | クリックで入力フィールド配置。16px Bold 固定 |
| モザイク | B | ドラッグ矩形範囲に 10×10px ブロックモザイク |
| ステップ番号 | N | クリックで ❶❷❸... 自動インクリメント（最大99） |

### 9.6 画像の保存設計

**保存フォーマット**: 入力画像の形式に合わせて保存（PNG → `toBlob('image/png')`、JPEG → `toBlob('image/jpeg', 0.95)`、SVG/GIF は PNG に変換）

**元画像バックアップ**:

```
1. 元ファイル: screenshot.png
2. バックアップ: screenshot_original.png（自動作成）
3. アノテーション後: screenshot.png に上書き

注意: バックアップは設定でオフ可能（デフォルト: オン）
```

**保存処理**:

```typescript
async function saveAnnotatedImage(
  originalPath: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const ext = originalPath.split('.').pop()!.toLowerCase();
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(b => resolve(b!), mimeType, 0.95)
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await invoke('write_file_bytes', { path: originalPath, bytes: Array.from(bytes) });
}
```

### 9.7 実装方針

**HTML Canvas API** を使用してブラウザ側で完結させる。

```typescript
const TOOL_HANDLERS: Record<AnnotationTool, DrawHandler> = {
  rect: drawRect, ellipse: drawEllipse, arrow: drawArrow,
  freehand: drawFreehand, text: drawText, mosaic: drawMosaic,
  stepNumber: drawStepNumber,
};
```

**Undo 実装** (最大 20 ステップ):

```typescript
const MAX_UNDO_STEPS = 20;
const undoStack: ImageData[] = [];

function saveUndoState(ctx: CanvasRenderingContext2D) {
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
}
```

### 9.8 制約事項

| 制約 | 詳細 |
|------|------|
| デスクトップ専用 | モバイルでは無効 |
| ラスタライズ方式 | 保存後は個別編集不可 |
| 外部 URL 画像は非対応 | ローカル保存画像のみ |
| アニメーション GIF | 最初のフレームのみ PNG としてアノテーション・保存 |
| 非破壊編集は将来対応 | Phase 9 以降で検討 |

---

## 関連ドキュメント

- [editor-ux-design.md](../../03_UI_UX/editor-ux-design.md) — 画像インラインリサイズ UI（§6）
- [accessibility-design.md](../../03_UI_UX/accessibility-design.md) — 画像の ARIA 設計
- [user-settings-design.md](../../07_Platform_Settings/user-settings-design.md) — imageSettings スキーマ
- [security-design.md](../../01_Architecture/security-design.md) — Canvas のセキュリティ（taint 対策）
- [smart-paste-design.md](../smart-paste-design.md) — HTML ペースト時の画像 data URI 処理
