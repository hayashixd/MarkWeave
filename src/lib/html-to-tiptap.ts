/**
 * HTML → TipTap JSON 変換
 *
 * rehype-parse (unified) を使って HTML を hast にパースし、
 * TipTap (ProseMirror) が受け取れる JSON 構造に変換する。
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §6
 *
 * パイプライン:
 *   HTML 文字列
 *     → rehype-parse（hast: HTML AST）
 *     → hast → TipTap JSON 変換
 *     → TipTapDoc
 *
 * Phase 5 基盤構築タスク: rehype-parse 統合（HTML → 内部AST）
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Root, Element, Text, Comment, RootContent } from 'hast';
import type { TipTapDoc, TipTapNode, TipTapMark } from './markdown-to-tiptap';

/**
 * HTML の <head> から抽出したメタデータ。
 * メタデータパネル（Phase 5 後続タスク）で使用する。
 */
export interface HtmlMetadata {
  /** <title> タグの内容 */
  title: string;
  /** <meta name="description"> の content */
  metaDescription: string;
  /** <link rel="stylesheet"> の href 一覧 */
  cssLinks: string[];
  /** <script src="..."> の src 一覧 */
  scriptLinks: string[];
}

/**
 * HTML パース結果。TipTap ドキュメントとメタデータを含む。
 */
export interface HtmlParseResult {
  /** TipTap JSON ドキュメント（<body> の内容） */
  doc: TipTapDoc;
  /** <head> から抽出したメタデータ */
  metadata: HtmlMetadata;
}

const defaultMetadata: HtmlMetadata = {
  title: '',
  metaDescription: '',
  cssLinks: [],
  scriptLinks: [],
};

const htmlParser = unified().use(rehypeParse);

/**
 * HTML テキストを TipTap JSON に変換する。
 *
 * 完全な HTML ドキュメント（<!DOCTYPE html>...）でも、
 * HTML フラグメント（<p>Hello</p>）でも受け付ける。
 *
 * @param html - 入力 HTML テキスト
 * @returns パース結果（TipTap ドキュメント + メタデータ）
 *
 * @example
 * const result = htmlToTipTap('<h1>Hello</h1><p>World</p>');
 * // result.doc.content → [heading, paragraph]
 * // result.metadata.title → ''
 *
 * @example
 * const result = htmlToTipTap('<!DOCTYPE html><html><head><title>My Page</title></head><body><p>Content</p></body></html>');
 * // result.doc.content → [paragraph]
 * // result.metadata.title → 'My Page'
 */
export function htmlToTipTap(html: string): HtmlParseResult {
  const tree = htmlParser.parse(html) as Root;

  // <head> からメタデータを抽出
  const metadata = extractMetadata(tree);

  // <body> の内容を TipTap JSON に変換
  const bodyElement = findElement(tree, 'body');
  const sourceChildren = bodyElement ? bodyElement.children : tree.children;
  const content = convertChildren(sourceChildren as RootContent[]);

  // ProseMirror の doc は最低 1 つのブロックノードが必要
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return {
    doc: { type: 'doc', content },
    metadata,
  };
}

// ---------------------------------------------------------------------------
// メタデータ抽出
// ---------------------------------------------------------------------------

/**
 * hast ツリーから <head> 内のメタデータを抽出する。
 */
function extractMetadata(tree: Root): HtmlMetadata {
  const headElement = findElement(tree, 'head');
  if (!headElement) return { ...defaultMetadata };

  const metadata: HtmlMetadata = {
    title: '',
    metaDescription: '',
    cssLinks: [],
    scriptLinks: [],
  };

  for (const child of headElement.children) {
    if (!isElement(child)) continue;

    switch (child.tagName) {
      case 'title':
        metadata.title = getTextContent(child);
        break;

      case 'meta': {
        const name = getAttr(child, 'name');
        if (name === 'description') {
          metadata.metaDescription = getAttr(child, 'content') ?? '';
        }
        break;
      }

      case 'link': {
        const rel = getAttr(child, 'rel');
        const href = getAttr(child, 'href');
        if (rel === 'stylesheet' && href) {
          metadata.cssLinks.push(href);
        }
        break;
      }

      case 'script': {
        const src = getAttr(child, 'src');
        if (src) {
          metadata.scriptLinks.push(src);
        }
        break;
      }
    }
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// hast → TipTap ブロックノード変換
// ---------------------------------------------------------------------------

/**
 * hast の子ノード配列を TipTap ブロックノード配列に変換する。
 * テキストノードが直接ある場合は暗黙の段落にラップする。
 */
function convertChildren(nodes: RootContent[]): TipTapNode[] {
  const result: TipTapNode[] = [];
  let pendingInlines: RootContent[] = [];

  const flushInlines = () => {
    if (pendingInlines.length === 0) return;
    // 空白のみのテキストノードは無視
    const hasContent = pendingInlines.some((n) => {
      if (isText(n)) return n.value.trim().length > 0;
      return true;
    });
    if (hasContent) {
      const inlineContent = convertInlineNodes(pendingInlines);
      if (inlineContent.length > 0) {
        result.push({ type: 'paragraph', content: inlineContent });
      }
    }
    pendingInlines = [];
  };

  for (const node of nodes) {
    if (isElement(node) && isBlockElement(node.tagName)) {
      flushInlines();
      result.push(...convertBlockElement(node));
    } else if (isText(node) || (isElement(node) && !isBlockElement(node.tagName))) {
      pendingInlines.push(node);
    }
    // comment ノードは無視
  }

  flushInlines();
  return result;
}

/**
 * hast のブロック要素を TipTap ノードに変換する。
 */
function convertBlockElement(el: Element): TipTapNode[] {
  switch (el.tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(el.tagName[1]!, 10);
      const content = convertInlineNodes(el.children as RootContent[]);
      return [{ type: 'heading', attrs: { level }, content }];
    }

    case 'p': {
      const content = convertInlineNodes(el.children as RootContent[]);
      return [{ type: 'paragraph', content }];
    }

    case 'ul': {
      // タスクリスト判定: <li> に <input type="checkbox"> があればタスクリスト
      const items = getChildElements(el, 'li');
      const isTaskList = items.some(isTaskListItem);

      if (isTaskList) {
        return [
          {
            type: 'taskList',
            content: items.map(convertTaskItem),
          },
        ];
      }

      return [
        {
          type: 'bulletList',
          content: items.map(convertListItem),
        },
      ];
    }

    case 'ol': {
      const items = getChildElements(el, 'li');
      const startAttr = getAttr(el, 'start');
      const start = startAttr ? parseInt(startAttr, 10) : 1;
      const node: TipTapNode = {
        type: 'orderedList',
        content: items.map(convertListItem),
      };
      if (start !== 1) {
        node.attrs = { start };
      }
      return [node];
    }

    case 'blockquote': {
      const content = convertChildren(el.children as RootContent[]);
      if (content.length === 0) {
        content.push({ type: 'paragraph' });
      }
      return [{ type: 'blockquote', content }];
    }

    case 'pre': {
      return [convertPreElement(el)];
    }

    case 'table': {
      return [convertTableElement(el)];
    }

    case 'hr': {
      return [{ type: 'horizontalRule' }];
    }

    // セマンティックコンテナ要素: 子要素を展開する
    case 'div':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'nav':
    case 'main':
    case 'aside':
    case 'figure': {
      const content = convertChildren(el.children as RootContent[]);
      return content.length > 0 ? content : [{ type: 'paragraph' }];
    }

    default: {
      // 未知のブロック要素: 子要素を展開する
      const content = convertChildren(el.children as RootContent[]);
      return content.length > 0 ? content : [];
    }
  }
}

// ---------------------------------------------------------------------------
// リストアイテム変換
// ---------------------------------------------------------------------------

function convertListItem(li: Element): TipTapNode {
  const content = convertListItemContent(li);
  return { type: 'listItem', content };
}

function convertTaskItem(li: Element): TipTapNode {
  const checkbox = findNestedElement(li, 'input');
  const checked =
    checkbox !== null &&
    (getAttr(checkbox, 'checked') !== null ||
      checkbox.properties?.checked === true ||
      checkbox.properties?.checked === '');

  const content = convertListItemContent(li, true);
  return {
    type: 'taskItem',
    attrs: { checked },
    content,
  };
}

function convertListItemContent(li: Element, skipCheckbox = false): TipTapNode[] {
  const result: TipTapNode[] = [];
  let pendingInlines: RootContent[] = [];

  const flushInlines = () => {
    if (pendingInlines.length === 0) return;
    const hasContent = pendingInlines.some((n) => {
      if (isText(n)) return n.value.trim().length > 0;
      return true;
    });
    if (hasContent) {
      const inlineContent = convertInlineNodes(pendingInlines);
      if (inlineContent.length > 0) {
        result.push({ type: 'paragraph', content: inlineContent });
      }
    }
    pendingInlines = [];
  };

  for (const child of li.children as RootContent[]) {
    // タスクリストの checkbox は無視
    if (skipCheckbox && isElement(child) && child.tagName === 'input') {
      continue;
    }

    if (isElement(child)) {
      if (child.tagName === 'p') {
        flushInlines();
        const content = convertInlineNodes(child.children as RootContent[]);
        result.push({ type: 'paragraph', content });
      } else if (child.tagName === 'ul' || child.tagName === 'ol') {
        flushInlines();
        result.push(...convertBlockElement(child));
      } else if (isBlockElement(child.tagName)) {
        flushInlines();
        result.push(...convertBlockElement(child));
      } else {
        pendingInlines.push(child);
      }
    } else {
      pendingInlines.push(child);
    }
  }

  flushInlines();

  // ProseMirror の listItem は最低 1 つの paragraph が必要
  if (result.length === 0) {
    result.push({ type: 'paragraph' });
  }

  return result;
}

function isTaskListItem(li: Element): boolean {
  // <li> 直下（または <p> 内）に <input type="checkbox"> があるか
  for (const child of li.children) {
    if (isElement(child)) {
      if (child.tagName === 'input' && getAttr(child, 'type') === 'checkbox') {
        return true;
      }
      if (child.tagName === 'p') {
        for (const grandChild of child.children) {
          if (
            isElement(grandChild) &&
            grandChild.tagName === 'input' &&
            getAttr(grandChild, 'type') === 'checkbox'
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// <pre> / コードブロック変換
// ---------------------------------------------------------------------------

function convertPreElement(pre: Element): TipTapNode {
  // <pre><code class="language-xxx">...</code></pre> パターンを検出
  const codeEl = getChildElements(pre, 'code')[0];
  let language: string | null = null;
  let text = '';

  if (codeEl) {
    // rehype-parse は class 属性を className プロパティ（配列）として格納する
    const classNames = codeEl.properties?.className;
    if (Array.isArray(classNames)) {
      for (const cls of classNames) {
        const langMatch = String(cls).match(/^language-(\S+)$/);
        if (langMatch) {
          language = langMatch[1]!;
          break;
        }
      }
    }
    text = getTextContent(codeEl);
  } else {
    text = getTextContent(pre);
  }

  return {
    type: 'codeBlock',
    attrs: { language },
    content: text ? [{ type: 'text', text }] : undefined,
  };
}

// ---------------------------------------------------------------------------
// テーブル変換
// ---------------------------------------------------------------------------

function convertTableElement(table: Element): TipTapNode {
  const rows: TipTapNode[] = [];

  // <thead> と <tbody> をフラットに走査
  const processRows = (container: Element) => {
    for (const child of container.children) {
      if (isElement(child) && child.tagName === 'tr') {
        rows.push(convertTableRow(child));
      }
    }
  };

  for (const child of table.children) {
    if (isElement(child)) {
      if (child.tagName === 'thead' || child.tagName === 'tbody' || child.tagName === 'tfoot') {
        processRows(child);
      } else if (child.tagName === 'tr') {
        rows.push(convertTableRow(child));
      }
    }
  }

  return { type: 'table', content: rows };
}

function convertTableRow(tr: Element): TipTapNode {
  const cells: TipTapNode[] = [];

  for (const child of tr.children) {
    if (isElement(child) && (child.tagName === 'th' || child.tagName === 'td')) {
      const cellType = child.tagName === 'th' ? 'tableHeader' : 'tableCell';
      // rehype-parse は colspan/rowspan を colSpan/rowSpan (camelCase) で格納する
      const colspanVal = child.properties?.colSpan ?? child.properties?.colspan;
      const rowspanVal = child.properties?.rowSpan ?? child.properties?.rowspan;
      const colspan = colspanVal ? Number(colspanVal) || 1 : 1;
      const rowspan = rowspanVal ? Number(rowspanVal) || 1 : 1;

      // style 属性から text-align を抽出
      const style = getAttr(child, 'style') ?? '';
      const alignMatch = style.match(/text-align:\s*(left|center|right)/);
      const styleAttr = alignMatch ? `text-align: ${alignMatch[1]}` : undefined;

      const content = convertChildren(child.children as RootContent[]);
      if (content.length === 0) {
        content.push({ type: 'paragraph' });
      }

      cells.push({
        type: cellType,
        attrs: {
          colspan,
          rowspan,
          colwidth: null,
          ...(styleAttr ? { style: styleAttr } : {}),
        },
        content,
      });
    }
  }

  return { type: 'tableRow', content: cells };
}

// ---------------------------------------------------------------------------
// hast → TipTap インラインノード変換
// ---------------------------------------------------------------------------

/**
 * hast の子ノード配列を TipTap のフラットな marks 構造に変換する。
 * markdown-to-tiptap.ts と同様のパターン: ネストされた要素を marks 配列に展開する。
 */
function convertInlineNodes(
  nodes: RootContent[],
  parentMarks: TipTapMark[] = [],
): TipTapNode[] {
  const result: TipTapNode[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      if (node.value.length === 0) continue;
      const textNode: TipTapNode = { type: 'text', text: node.value };
      if (parentMarks.length > 0) {
        textNode.marks = [...parentMarks];
      }
      result.push(textNode);
      continue;
    }

    if (!isElement(node)) continue;

    switch (node.tagName) {
      case 'strong':
      case 'b': {
        const marks = [...parentMarks, { type: 'bold' }];
        result.push(...convertInlineNodes(node.children as RootContent[], marks));
        break;
      }

      case 'em':
      case 'i': {
        const marks = [...parentMarks, { type: 'italic' }];
        result.push(...convertInlineNodes(node.children as RootContent[], marks));
        break;
      }

      case 's':
      case 'del': {
        const marks = [...parentMarks, { type: 'strike' }];
        result.push(...convertInlineNodes(node.children as RootContent[], marks));
        break;
      }

      case 'code': {
        const text = getTextContent(node);
        if (text) {
          const textNode: TipTapNode = { type: 'text', text };
          textNode.marks = [...parentMarks, { type: 'code' }];
          result.push(textNode);
        }
        break;
      }

      case 'a': {
        const href = getAttr(node, 'href') ?? '';
        const title = getAttr(node, 'title');
        const linkMark: TipTapMark = {
          type: 'link',
          attrs: {
            href,
            target: null,
            rel: null,
            ...(title ? { title } : {}),
          },
        };
        const marks = [...parentMarks, linkMark];
        result.push(...convertInlineNodes(node.children as RootContent[], marks));
        break;
      }

      case 'img': {
        const src = getAttr(node, 'src') ?? '';
        const alt = getAttr(node, 'alt') ?? '';
        const title = getAttr(node, 'title') ?? null;
        result.push({
          type: 'image',
          attrs: { src, alt, title },
        });
        break;
      }

      case 'br': {
        result.push({ type: 'hardBreak' });
        break;
      }

      // HTML 固有インライン要素: Phase 5 後続タスクで ProseMirror スキーマ追加後に
      // 専用マーク対応するが、現時点ではテキスト内容を保持する
      case 'mark':
      case 'span':
      case 'sup':
      case 'sub':
      case 'u': {
        // 子要素のテキストを親マークを継承して変換
        result.push(...convertInlineNodes(node.children as RootContent[], parentMarks));
        break;
      }

      default: {
        // 未知のインライン要素: 子要素を展開
        result.push(...convertInlineNodes(node.children as RootContent[], parentMarks));
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// hast ユーティリティ
// ---------------------------------------------------------------------------

/** ブロック要素として扱う HTML タグ名 */
const BLOCK_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li',
  'blockquote', 'pre', 'table',
  'hr',
  'div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
  'figure', 'figcaption', 'details', 'summary',
  'thead', 'tbody', 'tfoot', 'tr',
  'dl', 'dt', 'dd',
  'address', 'fieldset', 'form',
]);

function isBlockElement(tagName: string): boolean {
  return BLOCK_ELEMENTS.has(tagName);
}

function isElement(node: RootContent | Root['children'][number]): node is Element {
  return node.type === 'element';
}

function isText(node: RootContent | Root['children'][number]): node is Text {
  return node.type === 'text';
}

function isComment(node: RootContent | Root['children'][number]): node is Comment {
  return node.type === 'comment';
}

/**
 * hast ツリーから指定タグ名の要素を深さ優先で探す。
 */
function findElement(tree: Root | Element, tagName: string): Element | null {
  for (const child of tree.children) {
    if (isElement(child)) {
      if (child.tagName === tagName) return child;
      const found = findElement(child, tagName);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 要素の直接の子要素で指定タグ名のものを取得する。
 */
function getChildElements(parent: Element, tagName: string): Element[] {
  return parent.children.filter(
    (c: RootContent): c is Element => isElement(c) && c.tagName === tagName,
  );
}

/**
 * 要素内（再帰的に）から指定タグ名の最初の要素を探す。
 */
function findNestedElement(parent: Element, tagName: string): Element | null {
  for (const child of parent.children) {
    if (isElement(child)) {
      if (child.tagName === tagName) return child;
      const found = findNestedElement(child, tagName);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 要素のテキスト内容を再帰的に取得する。
 */
function getTextContent(el: Element): string {
  let text = '';
  for (const child of el.children) {
    if (isText(child)) {
      text += child.value;
    } else if (isElement(child)) {
      text += getTextContent(child);
    }
  }
  return text;
}

/**
 * hast 要素の属性を取得する。
 * rehype-parse は properties オブジェクトに属性を格納する。
 */
function getAttr(el: Element, name: string): string | null {
  const val = el.properties?.[name];
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? '' : null;
  if (Array.isArray(val)) return val.join(' ');
  return String(val);
}

// isComment は将来の HTML コメント保持で使用予定
void isComment;
