/**
 * 画像アノテーション拡張
 *
 * image-design.md §9 に準拠
 *
 * - 画像ダブルクリックでアノテーションモード開始のカスタムイベントを発火
 * - ProseMirror の handleDoubleClick でイメージノードを検出
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface ImageAnnotationEvent {
  /** 画像の src 属性（data URI またはファイルパス） */
  src: string;
  /** 画像の絶対ファイルパス（ローカルファイルの場合） */
  filePath: string | null;
  /** ProseMirror 内の画像ノードの位置 */
  pos: number;
}

/**
 * 画像のダブルクリックを検出してアノテーションイベントを発火する拡張
 */
export const ImageAnnotationExtension = Extension.create({
  name: 'imageAnnotation',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageAnnotation'),
        props: {
          handleDoubleClickOn(_view, pos, node) {
            if (node.type.name !== 'image') return false;

            const src = node.attrs.src as string;

            // data URI の場合はアノテーション非対応（ローカルファイルのみ）
            // ただし data URI でも一時保存してアノテーション可能にする
            const event = new CustomEvent<ImageAnnotationEvent>('image-annotation-start', {
              detail: {
                src,
                filePath: null, // TipTapEditor 側で解決する
                pos,
              },
            });
            window.dispatchEvent(event);
            return true;
          },
        },
      }),
    ];
  },
});
