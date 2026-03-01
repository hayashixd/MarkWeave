/**
 * HTML固有のTipTap拡張群
 *
 * Phase 5: HTML WYSIWYG 編集で必要な追加ノード/マーク。
 * Markdownモードでは使用しない。
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §4, §7
 */

import { Mark, Node, Extension, mergeAttributes } from '@tiptap/core';
import type { RawCommands } from '@tiptap/core';

// ---------------------------------------------------------------------------
// TipTap v3 コマンド型拡張
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      toggleHighlight: () => ReturnType;
    };
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
    subscript: {
      toggleSubscript: () => ReturnType;
    };
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
    backgroundColor: {
      setBackgroundColor: (color: string) => ReturnType;
      unsetBackgroundColor: () => ReturnType;
    };
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    textAlign: {
      setTextAlign: (align: string) => ReturnType;
      unsetTextAlign: () => ReturnType;
    };
    divBlock: {
      insertDivBlock: (attrs?: { class?: string }) => ReturnType;
    };
    semanticBlock: {
      insertSemanticBlock: (tag: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// マーク: ハイライト (<mark>)
// ---------------------------------------------------------------------------

export const HighlightMark = Mark.create({
  name: 'highlight',

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// マーク: 上付き文字 (<sup>)
// ---------------------------------------------------------------------------

export const SuperscriptMark = Mark.create({
  name: 'superscript',

  excludes: 'subscript',

  parseHTML() {
    return [{ tag: 'sup' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// マーク: 下付き文字 (<sub>)
// ---------------------------------------------------------------------------

export const SubscriptMark = Mark.create({
  name: 'subscript',

  excludes: 'superscript',

  parseHTML() {
    return [{ tag: 'sub' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSubscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// マーク: テキスト色 (color)
// ---------------------------------------------------------------------------

export const TextColorMark = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: { color?: string }) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el: HTMLElement) => {
          const color = el.style.color;
          if (!color) return false;
          return { color };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// マーク: 背景色 (background-color)
// ---------------------------------------------------------------------------

export const BackgroundColorMark = Mark.create({
  name: 'backgroundColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.style.backgroundColor || null,
        renderHTML: (attributes: { color?: string }) => {
          if (!attributes.color) return {};
          return { style: `background-color: ${attributes.color}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el: HTMLElement) => {
          const color = el.style.backgroundColor;
          if (!color) return false;
          return { color };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setBackgroundColor:
        (color: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetBackgroundColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// マーク: フォントサイズ
// ---------------------------------------------------------------------------

export const FontSizeMark = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: { size?: string }) => {
          if (!attributes.size) return {};
          return { style: `font-size: ${attributes.size}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (el: HTMLElement) => {
          const size = el.style.fontSize;
          if (!size) return false;
          return { size };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// テキスト配置拡張（既存ブロックノードへのグローバル属性追加）
// ---------------------------------------------------------------------------

export const TextAlignExtension = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.textAlign || null,
            renderHTML: (attributes: { textAlign?: string }) => {
              if (!attributes.textAlign) return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (align: string) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { textAlign: align }) ||
          commands.updateAttributes('heading', { textAlign: align }),
      unsetTextAlign:
        () =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { textAlign: null }) ||
          commands.updateAttributes('heading', { textAlign: null }),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// ノード: div ブロック
// ---------------------------------------------------------------------------

export const DivBlockNode = Node.create({
  name: 'divBlock',

  group: 'block',

  content: 'block+',

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('class') || null,
        renderHTML: (attributes: { class?: string }) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertDivBlock:
        (attrs?: { class?: string }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
            content: [{ type: 'paragraph' }],
          }),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// ノード: セマンティックブロック (section, article, header, footer, nav)
// ---------------------------------------------------------------------------

export const SemanticBlockNode = Node.create({
  name: 'semanticBlock',

  group: 'block',

  content: 'block+',

  addAttributes() {
    return {
      tag: {
        default: 'section',
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'section', attrs: { tag: 'section' } },
      { tag: 'article', attrs: { tag: 'article' } },
      { tag: 'header', attrs: { tag: 'header' } },
      { tag: 'footer', attrs: { tag: 'footer' } },
      { tag: 'nav', attrs: { tag: 'nav' } },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const tag = node.attrs.tag || 'section';
    return [tag, mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertSemanticBlock:
        (tag: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { tag },
            content: [{ type: 'paragraph' }],
          }),
    } as Partial<RawCommands>;
  },
});

// ---------------------------------------------------------------------------
// 全HTML拡張をまとめた配列
// ---------------------------------------------------------------------------

export const htmlExtensions = [
  HighlightMark,
  SuperscriptMark,
  SubscriptMark,
  TextColorMark,
  BackgroundColorMark,
  FontSizeMark,
  TextAlignExtension,
  DivBlockNode,
  SemanticBlockNode,
];
