/**
 * html-parser.ts
 *
 * HTMLファイルをパースして内部AST（hast互換）に変換するモジュール。
 *
 * 使用ライブラリ:
 *   - rehype-parse: HTML文字列 → hast変換
 *   - hast-util-*: hast操作ユーティリティ
 */

import type { Root } from 'hast';

export interface HtmlParseOptions {
  /** HTML全体をパースするか、<body>内コンテンツのみ対象とするか */
  fragment: boolean;
  /** エラー時に例外をスローするか（デフォルト: false） */
  strict: boolean;
}

const defaultOptions: HtmlParseOptions = {
  fragment: false,
  strict: false,
};

/**
 * HTML文字列を内部AST（hast Root）に変換する。
 *
 * @param html    - 入力HTML文字列
 * @param options - パースオプション
 * @returns hast Root ノード
 *
 * @example
 * const ast = parseHtml('<h1>Hello</h1><p>World</p>');
 */
export async function parseHtml(
  html: string,
  options: Partial<HtmlParseOptions> = {}
): Promise<Root> {
  const _opts = { ...defaultOptions, ...options };
  // TODO: rehype-parse を使ってHTMLをhastにパース
  // const { unified } = await import('unified');
  // const rehypeParse = (await import('rehype-parse')).default;
  // const processor = unified().use(rehypeParse, { fragment: opts.fragment });
  // return processor.parse(html) as Root;
  throw new Error('parseHtml: not implemented yet');
}

/**
 * HTMLファイルから<head>のメタデータを抽出する。
 *
 * @param ast - parseHtml() が返す hast Root
 * @returns メタデータオブジェクト
 */
export function extractMetadata(ast: Root): HtmlMetadata {
  // TODO: hast-util-select 等で head > title, meta 要素を取得
  void ast;
  return {
    title: '',
    description: '',
    cssLinks: [],
    jsLinks: [],
  };
}

export interface HtmlMetadata {
  title: string;
  description: string;
  cssLinks: string[];
  jsLinks: string[];
}
