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
import type { Root, RootContent, PhrasingContent, ListItem } from 'mdast';

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

/**
 * プラグイン組み合わせ別にパーサーを事前生成する。
 * 毎回 unified() を組み立てるとプラグイン初期化コストが発生するため
 * モジュール読み込み時に1度だけ生成してキャッシュする。
 */
const PARSER_GFM = unified().use(remarkParse).use(remarkGfm);
const PARSER_FULL = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/**
 * Markdown に含まれる構文の概要を素早く検出する。
 * 正規表現の1パスで判定することで、重いプラグインのスキップ判断に使う。
 *
 * hasMath: $$...$$（ブロック数式）または $x（インライン数式、空白で始まらない）
 *   - "$10.00" のような価格表記を誤検出しないよう、$ の直後が数字のみの場合は除外する。
 *     完全な除外は困難なため、false positive は PARSER_FULL を使うことで安全側に倒す。
 */
function detectMarkdownFeatures(markdown: string): { hasMath: boolean } {
  // \$\$ = ブロック数式、\$(?!\d) = インライン数式（$0.99 などの価格を緩やかに除外）
  const hasMath = /\$\$|\$(?!\d)/.test(markdown);
  return { hasMath };
}

/**
 * パースキャッシュ（1エントリ LRU）。
 * モード切替（WYSIWYG → ソース → WYSIWYG）で同一コンテンツを2回パースする
 * ケースを高速化する。200KB 超の大規模ファイルはメモリ負荷を避けてキャッシュしない。
 */
const PARSE_CACHE_MAX_BYTES = 200 * 1024; // 200KB
let parseCache: { input: string; doc: TipTapDoc } | null = null;

/**
 * Markdown テキストを TipTap JSON に変換する
 */
export function markdownToTipTap(markdown: string): TipTapDoc {
  // キャッシュヒット確認（小〜中規模ファイルのみ）
  if (parseCache && parseCache.input === markdown) {
    return parseCache.doc;
  }

  const { hasMath } = detectMarkdownFeatures(markdown);
  const parser = hasMath ? PARSER_FULL : PARSER_GFM;
  const tree = parser.parse(markdown) as Root;
  const content = tree.children.flatMap(convertBlockNode);

  // ProseMirror の doc は最低 1 つのブロックノードが必要
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  const doc: TipTapDoc = { type: 'doc', content };

  // 小〜中規模ファイルのみキャッシュ（メモリ節約）
  if (markdown.length <= PARSE_CACHE_MAX_BYTES) {
    parseCache = { input: markdown, doc };
  }

  return doc;
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
      const isTaskList = node.children.some((item: ListItem) => item.checked != null);

      if (isTaskList) {
        return [
          {
            type: 'taskList',
            content: node.children.map((item: ListItem) => convertTaskItem(item)),
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
        content: node.children.map((item: ListItem) => convertListItem(item)),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const codeMeta = (node as any).meta as string | null | undefined;
      return [
        {
          type: 'codeBlock',
          attrs: {
            language: node.lang ?? null,
            // remark はスペース区切りの info string を lang/meta に分割する。
            // 例: ```diff typescript → lang="diff", meta="typescript"
            // Zenn の diff 表示や他ツールの拡張記法を保持するため meta を保存する。
            ...(codeMeta ? { meta: codeMeta } : {}),
          },
          content: node.value ? [{ type: 'text', text: node.value }] : [],
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

    case 'footnoteDefinition': {
      // 脚注定義 [^id]: content をプレーンテキスト段落として保持する。
      // WYSIWYG では "[^1]: 内容" というテキストとして表示され、
      // シリアライズ時に remark が再度 footnoteDefinition として認識する。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defNode = node as any;
      const id = defNode.identifier ?? '';
      const prefix = `[^${id}]: `;
      const contentNodes: TipTapNode[] = [];
      for (const child of (defNode.children ?? []) as RootContent[]) {
        if (child.type === 'paragraph') {
          contentNodes.push(...convertInlineNodes(child.children));
        }
      }
      if (contentNodes.length > 0 && contentNodes[0]!.type === 'text') {
        contentNodes[0] = { ...contentNodes[0]!, text: prefix + (contentNodes[0]!.text ?? '') };
      } else {
        contentNodes.unshift({ type: 'text', text: prefix });
      }
      return [{ type: 'paragraph', content: contentNodes }];
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
        // [[ファイル名]] / [[ファイル名|表示テキスト]] をインライン wikilink ノードに変換
        const wikilinkNodes = parseWikilinks(node.value, parentMarks);
        result.push(...wikilinkNodes);
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

      case 'image': {
        result.push({
          type: 'image',
          attrs: {
            src: node.url,
            alt: node.alt ?? '',
            title: node.title ?? null,
          },
        });
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

      case 'footnoteReference': {
        // 脚注参照 [^id] をテキストとして保持する。
        // シリアライズ時に remark が再度 footnoteReference として認識する。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const refNode = node as any;
        const id = refNode.identifier ?? '';
        const refText: TipTapNode = { type: 'text', text: `[^${id}]` };
        if (parentMarks.length > 0) refText.marks = [...parentMarks];
        result.push(refText);
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

/**
 * テキスト内の [[...]] パターンを wikilink ノードに分解する。
 * 例: "前のテキスト [[PageA|表示]] 後のテキスト"
 *   → [text("前のテキスト "), wikilink(target="PageA", label="表示"), text(" 後のテキスト")]
 */
function parseWikilinks(text: string, marks: TipTapMark[]): TipTapNode[] {
  const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  const result: TipTapNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKILINK_RE.exec(text)) !== null) {
    // リンク前のテキスト
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      const node: TipTapNode = { type: 'text', text: before };
      if (marks.length > 0) node.marks = [...marks];
      result.push(node);
    }

    const target = match[1]!.trim();
    const label = match[2]?.trim() ?? null;
    result.push({ type: 'wikilink', attrs: { target, label } });

    lastIndex = match.index + match[0].length;
  }

  // リンク後の残りテキスト
  if (lastIndex < text.length) {
    const after = text.slice(lastIndex);
    const node: TipTapNode = { type: 'text', text: after };
    if (marks.length > 0) node.marks = [...marks];
    result.push(node);
  }

  // Wikilink が一つもなかった場合は元の text ノードを返す
  if (result.length === 0) {
    const node: TipTapNode = { type: 'text', text };
    if (marks.length > 0) node.marks = [...marks];
    result.push(node);
  }

  return result;
}
