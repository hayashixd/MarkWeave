/**
 * rawHtmlBlock TipTap 拡張
 *
 * <script> を含む HTML ブロックを安全にプレビュー表示する。
 * - プレビュー: DOMPurify でサニタイズ済み HTML を描画
 * - script 含有時: 警告バッジを表示
 * - 保存時: 生 HTML をそのまま保持（<script> も改変しない）
 *
 * 設計書: docs/01_Architecture/security-design.md §2.2
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useMemo } from 'react';
import { sanitizeHtml } from '../utils/dompurify-config';

// ---------------------------------------------------------------------------
// TipTap Node 定義
// ---------------------------------------------------------------------------

export const RawHtmlBlockNode = Node.create({
  name: 'rawHtmlBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      html: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-raw-html-block]',
        getAttrs: (el) => ({
          html: (el as HTMLElement).getAttribute('data-html') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-raw-html-block': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RawHtmlBlockView);
  },
});

// ---------------------------------------------------------------------------
// React NodeView コンポーネント
// ---------------------------------------------------------------------------

/** <script> タグ検出用正規表現 */
const SCRIPT_TAG_RE = /<script[\s\S]*?>/i;

function RawHtmlBlockView({ node }: NodeViewProps) {
  const rawHtml = node.attrs.html as string;

  const hasScript = useMemo(() => SCRIPT_TAG_RE.test(rawHtml), [rawHtml]);

  const sanitized = useMemo(() => sanitizeHtml(rawHtml), [rawHtml]);

  return (
    <NodeViewWrapper
      contentEditable={false}
      className="raw-html-block"
      data-raw-html-block=""
    >
      {hasScript && (
        <div
          className="raw-html-script-badge"
          title="スクリプトはプレビューで実行されません"
        >
          ⚠ script（保存時は維持）
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: sanitized }} />
    </NodeViewWrapper>
  );
}
