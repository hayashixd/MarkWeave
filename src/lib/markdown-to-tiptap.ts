/**
 * Markdown → TipTap JSON 変換
 *
 * remark (unified) を使って Markdown を mdast にパースし、
 * TipTap (ProseMirror) が受け取れる JSON 構造に変換する。
 *
 * Phase 1 対応要素: Heading, Paragraph, Strong, Emphasis, List, ListItem, Code (inline)
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, PhrasingContent } from 'mdast';

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Markdown テキストを TipTap JSON に変換する
 */
export function markdownToTipTap(markdown: string): TipTapDoc {
  const tree = parser.parse(markdown) as Root;
  const content = tree.children.flatMap(convertBlockNode);

  // ProseMirror の doc は最低 1 つのブロックノードが必要
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return { type: 'doc', content };
}

function convertBlockNode(node: RootContent): TipTapNode[] {
  switch (node.type) {
    case 'heading':
      return [
        {
          type: 'heading',
          attrs: { level: node.depth },
          content: convertInlineNodes(node.children),
        },
      ];

    case 'paragraph':
      return [
        {
          type: 'paragraph',
          content: convertInlineNodes(node.children),
        },
      ];

    case 'list': {
      const listType = node.ordered ? 'orderedList' : 'bulletList';
      const attrs: Record<string, unknown> = {};
      if (node.ordered && node.start != null && node.start !== 1) {
        attrs.start = node.start;
      }
      const result: TipTapNode = {
        type: listType,
        content: node.children.map((item) => convertListItem(item)),
      };
      if (Object.keys(attrs).length > 0) {
        result.attrs = attrs;
      }
      return [result];
    }

    case 'blockquote':
      return [
        {
          type: 'blockquote',
          content: node.children.flatMap(convertBlockNode),
        },
      ];

    case 'code':
      return [
        {
          type: 'codeBlock',
          attrs: { language: node.lang ?? null },
          content: node.value ? [{ type: 'text', text: node.value }] : undefined,
        },
      ];

    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];

    default:
      // 未対応のブロック要素は段落として保持
      return [{ type: 'paragraph' }];
  }
}

function convertListItem(
  node: Extract<RootContent, { type: 'listItem' }>,
): TipTapNode {
  const content: TipTapNode[] = [];

  for (const child of node.children) {
    if (child.type === 'paragraph') {
      content.push({
        type: 'paragraph',
        content: convertInlineNodes(child.children),
      });
    } else if (child.type === 'list') {
      content.push(...convertBlockNode(child));
    } else {
      content.push(...convertBlockNode(child as RootContent));
    }
  }

  // ProseMirror の listItem は最低 1 つの paragraph が必要
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  const result: TipTapNode = { type: 'listItem', content };

  // タスクリスト対応
  if (node.checked != null) {
    result.attrs = { checked: node.checked };
  }

  return result;
}

/**
 * インラインノードを TipTap のフラットな marks 構造に変換する。
 * mdast のネスト構造（strong > text）を、TipTap の平坦な marks 配列に展開する。
 */
function convertInlineNodes(
  nodes: PhrasingContent[],
  parentMarks: TipTapMark[] = [],
): TipTapNode[] {
  const result: TipTapNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'text': {
        const textNode: TipTapNode = { type: 'text', text: node.value };
        if (parentMarks.length > 0) {
          textNode.marks = [...parentMarks];
        }
        result.push(textNode);
        break;
      }

      case 'strong': {
        const marks = [...parentMarks, { type: 'bold' }];
        result.push(...convertInlineNodes(node.children, marks));
        break;
      }

      case 'emphasis': {
        const marks = [...parentMarks, { type: 'italic' }];
        result.push(...convertInlineNodes(node.children, marks));
        break;
      }

      case 'delete': {
        const marks = [...parentMarks, { type: 'strike' }];
        result.push(...convertInlineNodes(node.children, marks));
        break;
      }

      case 'inlineCode': {
        const textNode: TipTapNode = { type: 'text', text: node.value };
        textNode.marks = [...parentMarks, { type: 'code' }];
        result.push(textNode);
        break;
      }

      case 'link': {
        // Link の属性は href と title のみ（target, rel は含めない）
        const linkMark: TipTapMark = {
          type: 'link',
          attrs: {
            href: node.url,
            target: null,
            rel: null,
            ...(node.title ? { title: node.title } : {}),
          },
        };
        const marks = [...parentMarks, linkMark];
        result.push(...convertInlineNodes(node.children, marks));
        break;
      }

      case 'break': {
        result.push({ type: 'hardBreak' });
        break;
      }

      default:
        // 未対応のインライン要素は無視
        break;
    }
  }

  return result;
}
