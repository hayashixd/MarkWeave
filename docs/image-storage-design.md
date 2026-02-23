# 画像管理・ファイルパス設計ドキュメント

> プロジェクト: Markdown / HTML Editor
> 対象バージョン: Tauri 2.0
> 作成日: 2026-02-23

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
}

export const DEFAULT_IMAGE_SETTINGS: ImageStorageSettings = {
  saveMode: 'subfolder',
  subfolderName: 'assets',
  customPath: '',
  filenameStrategy: 'timestamp-original',
  deduplicateByHash: true,
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

  // ディレクトリ自動作成
  if (!(await exists(saveDir))) {
    await mkdir(saveDir, { recursive: true });
  }

  // 重複排除（ハッシュ一致なら既存ファイルのパスを返す）
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
import { saveImageFile } from '../file/imageStorage';
import { convertFileSrc } from '@tauri-apps/api/core';
import { relative, dirname } from '@tauri-apps/api/path';

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

async function handleImageFile(
  view: EditorView,
  file: File,
  markdownPath: string,
  settings: ImageStorageSettings
) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. ファイルシステムに保存（絶対パス）
  const absolutePath = await saveImageFile(
    markdownPath, bytes, file.name, settings
  );

  // 2. Markdownに埋め込む相対パスを計算
  const mdDir = await dirname(markdownPath);
  const relativePath = await relative(mdDir, absolutePath);

  // 3. TipTapに image ノードを挿入
  const { schema, tr, selection } = view.state;
  const node = schema.nodes.image.create({ src: relativePath, alt: file.name });
  view.dispatch(tr.replaceSelectionWith(node));
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
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:asset:allow-fetch-asset"
  ]
}
```

**Step 3: TipTap のカスタム Image NodeView で変換**

Markdownには相対パスで保存し、表示時のみ `convertFileSrc()` で変換する。

```typescript
// src/renderer/wysiwyg/ImageNodeView.tsx
import { NodeViewWrapper } from '@tiptap/react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolve, dirname } from '@tauri-apps/api/path';
import { useState, useEffect } from 'react';

interface Props {
  node: { attrs: { src: string; alt: string } };
  getCurrentFilePath: () => string;
}

export function ImageNodeView({ node, getCurrentFilePath }: Props) {
  const [displaySrc, setDisplaySrc] = useState<string>('');

  useEffect(() => {
    async function resolveSrc() {
      const src = node.attrs.src;

      // 外部URLはそのまま（キャッシュ処理は §4 参照）
      if (src.startsWith('http://') || src.startsWith('https://')) {
        setDisplaySrc(src);
        return;
      }

      // 相対パス → 絶対パス → asset://
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

### 2.3 モバイル（Android/iOS）での注意点

| プラットフォーム | プロトコル | 備考 |
|----------------|-----------|------|
| Windows/macOS/Linux | `https://asset.localhost/` | `convertFileSrc()` が自動変換 |
| Android | `https://asset.localhost/` | 同上（Tauri 2.0で統一） |
| iOS (WKWebView) | `https://asset.localhost/` | 同上 |

`convertFileSrc()` は全プラットフォームで正しいURLを返すため、
**コード上でプラットフォーム分岐は不要**。

---

## 3. ファイル移動・リネーム時の相対パス更新

### 3.1 方針: 自動更新を実装すべきか

**実装推奨**。ユーザーがGUI上でリネーム・移動する場合、
古いパスの画像が壊れることは許容できないUX。
Typora・Obsidianともに自動更新を実装している。

### 3.2 実装場所の選択

| 実装場所 | 推奨度 | 理由 |
|---------|--------|------|
| TypeScript（正規表現） | **個人開発向け・推奨** | 工数が少なく十分な精度 |
| Rust（pulldown-cmark） | 大規模向け | 完全なASTパースが必要な場合 |

### 3.3 TypeScript実装（正規表現ベース）

```typescript
// src/file/pathUpdater.ts
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { dirname, relative, resolve } from '@tauri-apps/api/path';

/**
 * Markdownファイル移動時に画像パスを更新する
 * @param oldFilePath 移動前のMarkdownファイルパス
 * @param newFilePath 移動後のMarkdownファイルパス
 */
export async function updateImagePathsOnMove(
  oldFilePath: string,
  newFilePath: string
): Promise<void> {
  const content = await readTextFile(newFilePath); // 移動済みを読む
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

  // Markdown画像記法: ![alt](path) と ![alt](path "title")
  const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s"]+)(\s+"[^"]*")?\)/g;

  const replacements: Array<[string, string]> = [];

  for (const match of content.matchAll(IMAGE_REGEX)) {
    const [full, alt, src, title = ''] = match;
    // 外部URL・dataURIはスキップ
    if (/^(https?:\/\/|data:)/.test(src)) continue;

    // 旧Markdownからの絶対パスを計算
    const absolutePath = await resolve(oldDir, src);
    // 新Markdownからの相対パスに変換
    const newRelative = await relative(newDir, absolutePath);
    // Windows対策: バックスラッシュをスラッシュに統一
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

### 3.4 ファイル操作フローとの統合

```typescript
// src/file/fileManager.ts
import { rename } from '@tauri-apps/plugin-fs';
import { updateImagePathsOnMove } from './pathUpdater';

export async function moveMarkdownFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  // 1. ファイルを移動（OSのrename = アトミック操作）
  await rename(oldPath, newPath);

  // 2. 移動後のファイル内の画像パスを更新
  await updateImagePathsOnMove(oldPath, newPath);

  // 3. エディタのアクティブファイルパスも更新（State管理側で処理）
}
```

> **注意**: 画像ファイル自体は移動しない（Markdownの参照先パスを更新するのみ）。
> 画像ファイルも一緒に移動するオプションは将来的な拡張として検討。

---

## 4. 外部URL画像のローカルキャッシュ

### 4.1 アーキテクチャ概要

```
TipTap ImageNodeView
  │
  ├─ src が http/https → invoke('cache_remote_image', { url })
  │                              │
  │                    Rustコマンド
  │                    1. キャッシュヒット? → キャッシュパスを返す
  │                    2. ミス → reqwest で fetch
  │                             → $APP_CACHE_DIR/images/{hash}.{ext} に保存
  │                             → キャッシュパスを返す
  │
  └─ convertFileSrc(localPath) → <img src="https://asset.localhost/...">
```

### 4.2 Rust側実装

```rust
// src-tauri/src/commands/image_cache.rs
use tauri::Manager;
use std::path::PathBuf;
use sha2::{Sha256, Digest};

#[tauri::command]
pub async fn cache_remote_image(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    // 1. URLハッシュからキャッシュキーを生成
    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        format!("{:x}", hasher.finalize())
    };

    // 2. キャッシュディレクトリを確定
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    // 3. 拡張子を推定（URLのパス末尾 or デフォルト "png"）
    let ext = url
        .split('?').next().unwrap_or(&url)  // クエリ除去
        .rsplit('.').next()
        .filter(|e| ["png","jpg","jpeg","gif","webp","svg"].contains(e))
        .unwrap_or("png");

    let cache_path = cache_dir.join(format!("{}.{}", &hash[..16], ext));

    // 4. キャッシュヒット → パスをそのまま返す
    if cache_path.exists() {
        return Ok(cache_path.to_string_lossy().to_string());
    }

    // 5. リモートから取得
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("fetch error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&cache_path, &bytes).map_err(|e| e.to_string())?;

    Ok(cache_path.to_string_lossy().to_string())
}
```

**`Cargo.toml` 依存関係の追加:**

```toml
[dependencies]
reqwest = { version = "0.12", features = ["json"] }
sha2 = "0.10"
tokio = { version = "1", features = ["full"] }
```

### 4.3 TypeScript側（ImageNodeViewへの組み込み）

```typescript
// src/renderer/wysiwyg/ImageNodeView.tsx（§2.3を拡張）
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

async function resolveSrc(src: string, mdFilePath: string): Promise<string> {
  // 外部URL → キャッシュ経由
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const localPath = await invoke<string>('cache_remote_image', { url: src });
      return convertFileSrc(localPath);
    } catch {
      return src; // キャッシュ失敗時はオリジナルURLにフォールバック
    }
  }

  // 相対パス → asset://
  const mdDir = await dirname(mdFilePath);
  const absolutePath = await resolve(mdDir, src);
  return convertFileSrc(absolutePath);
}
```

### 4.4 キャッシュ管理（工数効率重視の最小実装）

個人開発の工数を考慮した最小限のキャッシュ管理：

```rust
// src-tauri/src/commands/image_cache.rs に追加

/// キャッシュ容量超過時に古いファイルを削除（簡易LRU）
#[tauri::command]
pub async fn purge_image_cache(
    app: tauri::AppHandle,
    max_bytes: u64,  // 例: 500 * 1024 * 1024 = 500MB
) -> Result<u64, String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("images");

    let mut entries: Vec<(PathBuf, u64, std::time::SystemTime)> = std::fs::read_dir(&cache_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?;
            Some((e.path(), meta.len(), modified))
        })
        .collect();

    // 古い順にソート
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

アプリ起動時に `purge_image_cache(500MB)` を呼ぶだけで運用可能。

---

## 5. 設計まとめ・優先実装順序

個人開発での工数効率を考慮した実装優先度：

| 優先度 | 項目 | 工数感 | 備考 |
|--------|------|--------|------|
| 1 | §2: `asset://` プロトコル対応 | 小 | これがないと画像が表示されない |
| 2 | §1: 画像ペースト/D&D保存（`subfolder`固定） | 中 | 設定UI後回しで十分 |
| 3 | §3: ファイル移動時のパス更新 | 小 | 正規表現で十分 |
| 4 | §1: 保存先設定UI（4モード） | 中 | §2完成後に追加 |
| 5 | §4: 外部URL画像キャッシュ | 中 | オフライン要件がなければ後回し可 |

### データフロー整理

```
[保存時]  TipTap内部 → Markdown serialize
          img.src = "./assets/20260223_foo.png"  ← 相対パスで保存

[表示時]  Markdown parse → TipTap
          ImageNodeView: "./assets/foo.png"
            → resolve(mdDir, src) → "/Users/.../doc/assets/foo.png"
            → convertFileSrc()   → "https://asset.localhost/..."
            → <img src="https://asset.localhost/...">

[移動時]  rename(old, new)
            → rewriteImagePaths(content, oldDir, newDir)
            → writeFile(newPath, updatedContent)
```
