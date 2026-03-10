/**
 * Query Block TipTap 拡張
 *
 * ```query コードブロックを検出し、メタデータクエリの結果を
 * インタラクティブなテーブル/リストとしてレンダリングする。
 *
 * Phase 7.5: メタデータクエリエンジン
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { QueryBlockView } from '../features/metadata/QueryBlockView';

export const QueryBlock = Node.create({
  name: 'queryBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      query: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-query-block]',
        getAttrs: (el) => ({
          query: (el as HTMLElement).getAttribute('data-query') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-query-block': '',
        'data-query': HTMLAttributes.query,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QueryBlockView);
  },
});
