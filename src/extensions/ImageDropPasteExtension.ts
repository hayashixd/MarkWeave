/**
 * 画像ドラッグ&ドロップ / クリップボードからの画像貼り付け拡張
 *
 * image-design.md §1, §6 に準拠。
 *
 * - ドラッグ&ドロップで画像ファイルを挿入
 * - クリップボードからの画像貼り付け
 * - Data URI フォールバック（Tauri が利用不可の場合）
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

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
 * 画像ファイルを処理してエディタに挿入する
 */
async function handleImageFile(view: EditorView, file: File, pos?: number) {
  try {
    // Data URI に変換して挿入（Phase 4 で Tauri ファイル保存に置き換え）
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
