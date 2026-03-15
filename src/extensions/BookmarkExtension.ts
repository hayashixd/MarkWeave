/**
 * 行ブックマーク拡張（Phase 3）
 *
 * editor-ux-design.md §13 に準拠:
 * - Ctrl+F2: カーソル行のブックマークをトグル
 * - F2: 次のブックマークへジャンプ（末尾→先頭に戻る）
 * - Shift+F2: 前のブックマークへジャンプ（先頭→末尾に戻る）
 *
 * TipTap の ProseMirror Plugin / Decoration API で実装。
 * ブックマーク位置はドキュメント変更時に mapping で追従。
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const bookmarkPluginKey = new PluginKey<BookmarkState>('bookmark');

interface BookmarkState {
  /** ブックマークされたドキュメント位置の集合（各ブロックノードの開始位置） */
  positions: Set<number>;
}

interface BookmarkMeta {
  type: 'toggle' | 'set';
  pos?: number;
  positions?: Set<number>;
}

/**
 * カーソル位置を含むトップレベルブロックノードの開始位置を取得する
 */
function getBlockStartPos(doc: PmNode, pos: number): number {
  const resolved = doc.resolve(pos);
  if (resolved.depth >= 1) {
    return resolved.before(1);
  }
  return 0;
}

export const BookmarkExtension = Extension.create({
  name: 'bookmark',

  addProseMirrorPlugins() {
    return [
      new Plugin<BookmarkState>({
        key: bookmarkPluginKey,

        state: {
          init(): BookmarkState {
            return { positions: new Set() };
          },

          apply(tr, prev): BookmarkState {
            const meta = tr.getMeta(bookmarkPluginKey) as BookmarkMeta | undefined;

            if (meta?.type === 'set' && meta.positions) {
              return { positions: meta.positions };
            }

            if (meta?.type === 'toggle' && meta.pos !== undefined) {
              const newPositions = new Set(prev.positions);
              if (newPositions.has(meta.pos)) {
                newPositions.delete(meta.pos);
              } else {
                newPositions.add(meta.pos);
              }
              return { positions: newPositions };
            }

            // ドキュメント変更があった場合、位置を mapping で追従
            if (tr.docChanged && prev.positions.size > 0) {
              const mapped = new Set<number>();
              for (const pos of prev.positions) {
                const newPos = tr.mapping.map(pos);
                if (newPos >= 0 && newPos < tr.doc.content.size) {
                  mapped.add(newPos);
                }
              }
              return { positions: mapped };
            }

            return prev;
          },
        },

        props: {
          decorations(state) {
            const pluginState = bookmarkPluginKey.getState(state);
            if (!pluginState || pluginState.positions.size === 0) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            for (const pos of pluginState.positions) {
              const node = state.doc.nodeAt(pos);
              if (node) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'bookmark-line',
                  }),
                );
              }
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl+F2: ブックマークのトグル
      'Mod-F2': ({ editor }) => {
        const { state, view } = editor;
        const { from } = state.selection;
        const blockPos = getBlockStartPos(state.doc, from);

        const tr = state.tr.setMeta(bookmarkPluginKey, {
          type: 'toggle',
          pos: blockPos,
        } as BookmarkMeta);
        view.dispatch(tr);
        return true;
      },

      // F2: 次のブックマークへジャンプ
      'F2': ({ editor }) => {
        const { state, view } = editor;
        const pluginState = bookmarkPluginKey.getState(state);
        if (!pluginState || pluginState.positions.size === 0) return false;

        const { from } = state.selection;
        const currentBlockPos = getBlockStartPos(state.doc, from);
        const sorted = [...pluginState.positions].sort((a, b) => a - b);

        // 現在位置より後のブックマークを探す
        let nextPos = sorted.find((p) => p > currentBlockPos);
        // 末尾に達したら先頭に戻る
        if (nextPos === undefined) {
          nextPos = sorted[0];
        }

        if (nextPos !== undefined) {
          const resolved = state.doc.resolve(nextPos + 1);
          const sel = TextSelection.near(resolved);
          view.dispatch(state.tr.setSelection(sel).scrollIntoView());
        }
        return true;
      },

      // Shift+F2: 前のブックマークへジャンプ
      'Shift-F2': ({ editor }) => {
        const { state, view } = editor;
        const pluginState = bookmarkPluginKey.getState(state);
        if (!pluginState || pluginState.positions.size === 0) return false;

        const { from } = state.selection;
        const currentBlockPos = getBlockStartPos(state.doc, from);
        const sorted = [...pluginState.positions].sort((a, b) => a - b);

        // 現在位置より前のブックマークを探す
        const candidates = sorted.filter((p) => p < currentBlockPos);
        let prevPos = candidates.length > 0 ? candidates[candidates.length - 1] : undefined;
        // 先頭に達したら末尾に戻る
        if (prevPos === undefined) {
          prevPos = sorted[sorted.length - 1];
        }

        if (prevPos !== undefined) {
          const resolved = state.doc.resolve(prevPos + 1);
          const sel = TextSelection.near(resolved);
          view.dispatch(state.tr.setSelection(sel).scrollIntoView());
        }
        return true;
      },
    };
  },
});
