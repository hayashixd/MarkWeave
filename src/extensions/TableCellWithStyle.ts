/**
 * スタイル対応テーブルセル拡張
 *
 * TipTap 標準の TableCell / TableHeader に `style` 属性を追加する。
 * これにより setCellAttribute('style', 'text-align: center') で
 * 列の配置（左/中央/右）を動的に変更できる。
 *
 * Phase 2: 列の配置（左/中央/右）
 */

import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

/** style 属性を追加した TableCell 拡張 */
export const TableCellWithStyle = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('style') || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.style) return {};
          return { style: attributes.style as string };
        },
      },
    };
  },
});

/** style 属性を追加した TableHeader 拡張 */
export const TableHeaderWithStyle = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('style') || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.style) return {};
          return { style: attributes.style as string };
        },
      },
    };
  },
});
