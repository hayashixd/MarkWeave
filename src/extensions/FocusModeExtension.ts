/**
 * フォーカスモード TipTap 拡張
 *
 * ペルソナ対応:
 * - 知識管理者: 長文ノート執筆時に現在のブロックだけに集中できる
 * - 一般ライター/ブロガー: 他の段落を気にせず書き続けられる
 *
 * 動作:
 * - フォーカスモード有効時、カーソルのあるブロックに `data-pm-focused` 属性を付与
 * - CSS で `.focus-mode-enabled .ProseMirror > *:not([data-pm-focused])` を薄く表示
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';

const pluginKey = new PluginKey('focusMode');

/**
 * カーソルが存在するトップレベルブロックの位置を返す。
 * ネストされた要素（テーブルセル内等）も考慮して最上位のブロックを取得する。
 */
function getFocusedTopLevelBlockPos(state: EditorState): number | null {
  const { $head } = state.selection;
  // depth=1 がドキュメント直下の子ノード
  if ($head.depth < 1) return null;

  // ドキュメント直下の位置を取得
  return $head.before(1);
}

function createDecorations(state: EditorState, enabled: boolean): DecorationSet {
  if (!enabled) return DecorationSet.empty;

  const focusedPos = getFocusedTopLevelBlockPos(state);
  if (focusedPos === null) return DecorationSet.empty;

  return DecorationSet.create(state.doc, [
    Decoration.node(focusedPos, focusedPos + state.doc.nodeAt(focusedPos)!.nodeSize, {
      'data-pm-focused': 'true',
    }),
  ]);
}

export interface FocusModeOptions {
  enabled: boolean;
}

/**
 * フォーカスモード拡張。
 * `enabled` オプションが true の場合に動作する。
 */
export const FocusModeExtension = Extension.create<FocusModeOptions>({
  name: 'focusMode',

  addOptions() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    const self = this;
    return [
      new Plugin({
        key: pluginKey,

        state: {
          init(_: unknown, state: EditorState): DecorationSet {
            return createDecorations(state, self.options.enabled);
          },
          apply(
            tr: { docChanged: boolean; selectionSet: boolean },
            oldDecos: DecorationSet,
            _oldState: EditorState,
            newState: EditorState,
          ): DecorationSet {
            if (tr.docChanged || tr.selectionSet) {
              return createDecorations(newState, self.options.enabled);
            }
            return oldDecos;
          },
        },

        props: {
          decorations(state: EditorState): DecorationSet {
            return pluginKey.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },
});
