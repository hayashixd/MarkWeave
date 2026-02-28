/**
 * Markdown → TipTap JSON 変換
 *
 * remark (unified) を使って Markdown を mdast にパースし、
 * TipTap (ProseMirror) が受け取れる JSON 構造に変換する。
 *
 * Phase 1 対応要素: Heading, Paragraph, Strong, Emphasis, List, ListItem, Code (inline)
 * Phase 2 対応要素: Table, TableRow, TableCell, TableHeader
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
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

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

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
      // タスクリスト判定: いずれかの item に checked が設定されていればタスクリスト
      const isTaskList = node.children.some((item) => item.checked != null);

      if (isTaskList) {
        return [
          {
            type: 'taskList',
            content: node.children.map((item) => convertTaskItem(item)),
          },
        ];
      }

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

    case 'code': {
      // mermaid コードブロックは専用ノードに変換
      if (node.lang === 'mermaid') {
        return [
          {
            type: 'mermaidBlock',
            attrs: { code: node.value ?? '' },
          },
        ];
      }
      return [
        {
          type: 'codeBlock',
          attrs: { language: node.lang ?? null },
          content: node.value ? [{ type: 'text', text: node.value }] : undefined,
        },
      ];
    }

    case 'math': {
      // remark-math が生成するブロック数式ノード ($$...$$)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mathNode = node as any;
      return [
        {
          type: 'mathBlock',
          attrs: { latex: mathNode.value ?? '' },
        },
      ];
    }

    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];

    case 'table': {
      // remark-gfm が生成する GFM テーブルノード
      // mdast-util-gfm-table 型定義に準拠: align は列ごとの配置
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableNode = node as any;
      const alignments: (string | null)[] = tableNode.align ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = tableNode.children ?? [];

      const tiptapRows = rows.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (row: any, rowIndex: number): TipTapNode => {
          const isHeaderRow = rowIndex === 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cells = (row.children as any[]).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cell: any, colIndex: number): TipTapNode => {
              const alignment = alignments[colIndex] ?? null;
              const cellType = isHeaderRow ? 'tableHeader' : 'tableCell';
              return {
                type: cellType,
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                  ...(alignment ? { style: `text-align: ${alignment}` } : {}),
                },
                content: [
                  {
                    type: 'paragraph',
                    content: convertInlineNodes(cell.children as PhrasingContent[]),
                  },
                ],
              };
            },
          );
          return { type: 'tableRow', content: cells };
        },
      );

      return [{ type: 'table', content: tiptapRows }];
    }

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

  return { type: 'listItem', content };
}

function convertTaskItem(
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

  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return {
    type: 'taskItem',
    attrs: { checked: node.checked ?? false },
    content,
  };
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

      case 'inlineMath': {
        // remark-math が生成するインライン数式ノード ($...$)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mathNode = node as any;
        result.push({
          type: 'mathInline',
          attrs: { latex: mathNode.value ?? '' },
        });
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
