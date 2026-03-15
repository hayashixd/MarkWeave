/**
 * html-parser.ts
 *
 * HTMLファイルをパースして内部AST（hast互換）に変換するモジュール。
 *
 * Phase 5: htmlToTipTap (src/lib/html-to-tiptap.ts) へ処理を委譲。
 * このモジュールは型定義と MetadataPanel 向けインターフェースを提供する。
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Root, Element, Text } from 'hast';

export interface HtmlParseOptions {
  /** HTML全体をパースするか、<body>内コンテンツのみ対象とするか */
  fragment: boolean;
  /** エラー時に例外をスローするか（デフォルト: false） */
  strict: boolean;
}

const parser = unified().use(rehypeParse);

/**
 * HTML文字列を内部AST（hast Root）に変換する。
 *
 * @param html    - 入力HTML文字列
 * @param options - パースオプション
 * @returns hast Root ノード
 */
export function parseHtml(
  html: string,
  options: Partial<HtmlParseOptions> = {}
): Root {
  void options; // fragment/strict オプションは将来使用予定
  return parser.parse(html) as Root;
}

/**
 * HTMLファイルから<head>のメタデータを抽出する。
 *
 * @param ast - parseHtml() が返す hast Root
 * @returns メタデータオブジェクト
 */
export function extractMetadata(ast: Root): HtmlMetadata {
  const headElement = findElement(ast, 'head');
  if (!headElement) {
    return { title: '', description: '', cssLinks: [], jsLinks: [] };
  }

  const metadata: HtmlMetadata = {
    title: '',
    description: '',
    cssLinks: [],
    jsLinks: [],
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
          metadata.description = getAttr(child, 'content') ?? '';
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
          metadata.jsLinks.push(src);
        }
        break;
      }
    }
  }

  return metadata;
}

export interface HtmlMetadata {
  title: string;
  description: string;
  cssLinks: string[];
  jsLinks: string[];
}

// --- hast ユーティリティ ---

function isElement(node: Root['children'][number]): node is Element {
  return node.type === 'element';
}

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

function getTextContent(el: Element): string {
  let text = '';
  for (const child of el.children) {
    if ((child as Text).type === 'text') {
      text += (child as Text).value;
    } else if (isElement(child)) {
      text += getTextContent(child);
    }
  }
  return text;
}

function getAttr(el: Element, name: string): string | null {
  const val = el.properties?.[name];
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? '' : null;
  if (Array.isArray(val)) return val.join(' ');
  return String(val);
}
