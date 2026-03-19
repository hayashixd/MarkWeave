/**
 * 画像ドラッグ&ドロップ / クリップボードからの画像貼り付け拡張
 *
 * image-design.md §1, §6 に準拠。
 *
 * プラットフォーム対応 (Phase 4):
 * - Zenn + ワークスペースあり + ファイル保存済み:
 *   Zenn CLI 慣習に従い <workspace>/images/ に保存し /images/filename.png として挿入
 * - Qiita + ワークスペースあり + ファイル保存済み:
 *   ファイルと同階層の images/ サブフォルダに保存し相対パスで挿入
 * - 上記以外: Data URI フォールバック（従来動作）
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useTabStore } from '../store/tabStore';
import { useTabProfileStore } from '../store/tabProfileStore';
import { detectPlatform } from '../lib/platform-detector';
import { parseFrontMatter } from '../lib/frontmatter';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

interface SaveImageResult {
  savedPath: string;
  relativePath: string;
}

/**
 * ファイルを Data URI に変換する
 */
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * エディタに画像ノードを挿入する
 */
function insertImage(view: EditorView, src: string, alt: string, pos?: number) {
  const { schema } = view.state;
  const imageNode = schema.nodes.image;
  if (!imageNode) return;

  const node = imageNode.create({ src, alt });
  const insertPos = pos ?? view.state.selection.from;
  const tr = view.state.tr.insert(insertPos, node);
  view.dispatch(tr);
}

/**
 * 画像ファイルを処理してエディタに挿入する。
 *
 * Zenn プラットフォームかつワークスペースが開かれているとき:
 *   - Tauri save_image コマンドで <workspace>/images/ に保存
 *   - /images/filename.png（Zenn CLI 慣習のワークスペースルート相対パス）として挿入
 *
 * Qiita プラットフォームかつワークスペースが開かれているとき:
 *   - ファイルと同階層の images/ サブフォルダに保存
 *   - 相対パスで挿入
 *
 * それ以外: Data URI フォールバック
 */
async function handleImageFile(view: EditorView, file: File, pos?: number) {
  const workspaceRoot = useWorkspaceStore.getState().root;
  const activeTabId = useTabStore.getState().activeTabId;
  const activeTab = activeTabId
    ? useTabStore.getState().tabs.find((t) => t.id === activeTabId)
    : null;
  const filePath = activeTab?.filePath ?? null;
  const tabContent = activeTab?.content ?? '';

  // プラットフォーム検出
  const { yaml } = parseFrontMatter(tabContent);
  const override = activeTabId
    ? useTabProfileStore.getState().overrides[activeTabId]
    : undefined;
  const platform = override ?? detectPlatform(yaml);

  // Zenn / Qiita かつワークスペースあり かつ ファイル保存済みの場合のみ Tauri 経由で保存
  if (
    (platform === 'zenn' || platform === 'qiita') &&
    workspaceRoot &&
    filePath
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const imageData = Array.from(new Uint8Array(arrayBuffer));

      const settings =
        platform === 'zenn'
          ? {
              // Zenn CLI 慣習: ワークスペースルートの /images/ に保存
              saveMode: 'custom-absolute',
              subfolderName: 'images',
              customPath: workspaceRoot + '/images',
              filenameStrategy: 'timestamp-original',
              deduplicateByHash: true,
            }
          : {
              // Qiita: ファイルと同階層の images/ サブフォルダに保存
              saveMode: 'subfolder',
              subfolderName: 'images',
              customPath: '',
              filenameStrategy: 'timestamp-original',
              deduplicateByHash: true,
            };

      const result = await invoke<SaveImageResult>('save_image', {
        markdownPath: filePath,
        imageData,
        originalName: file.name,
        settings,
      });

      let imageSrc: string;
      if (platform === 'zenn') {
        // savedPath: C:\ws\images\20240101_photo.png → /images/20240101_photo.png
        const savedNormalized = result.savedPath.replace(/\\/g, '/');
        const filename = savedNormalized.split('/').pop() ?? file.name;
        imageSrc = `/images/${filename}`;
      } else {
        // Qiita: ファイルからの相対パス（./images/filename.png）
        imageSrc = result.relativePath.startsWith('.')
          ? result.relativePath
          : `./${result.relativePath}`;
      }

      const alt = file.name.replace(/\.[^/.]+$/, '');
      insertImage(view, imageSrc, alt, pos);
      return;
    } catch (err) {
      console.error('画像のファイル保存に失敗しました（Data URI にフォールバック）:', err);
      // エラー時は Data URI にフォールバック
    }
  }

  // フォールバック: Data URI として埋め込む
  try {
    const dataUri = await fileToDataUri(file);
    const alt = file.name.replace(/\.[^/.]+$/, '');
    insertImage(view, dataUri, alt, pos);
  } catch (err) {
    console.error('画像の挿入に失敗しました:', err);
  }
}

export const ImageDropPasteExtension = Extension.create({
  name: 'imageDropPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageDropPaste'),
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of Array.from(items)) {
              if (!IMAGE_TYPES.includes(item.type)) continue;
              const file = item.getAsFile();
              if (!file) continue;

              event.preventDefault();
              handleImageFile(view, file);
              return true;
            }
            return false;
          },

          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files?.length) return false;

            const imageFiles = Array.from(files).filter((f) =>
              IMAGE_TYPES.includes(f.type),
            );
            if (imageFiles.length === 0) return false;

            event.preventDefault();

            // ドロップ位置を計算
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            const pos = coordinates?.pos;

            for (const file of imageFiles) {
              handleImageFile(view, file, pos);
            }
            return true;
          },
        },
      }),
    ];
  },
});
