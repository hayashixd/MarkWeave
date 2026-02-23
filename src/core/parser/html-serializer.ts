/**
 * html-serializer.ts
 *
 * 内部AST（hast互換）をHTML文字列にシリアライズするモジュール。
 *
 * 使用ライブラリ:
 *   - rehype-stringify: hast → HTML文字列変換
 *   - rehype-format:    出力HTMLの整形（インデント等）
 */

import type { Root } from 'hast';

export interface HtmlSerializeOptions {
  /** インデント整形をするか */
  format: boolean;
  /** 自己閉じタグを使うか（<br /> vs <br>） */
  selfClosing: boolean;
}

const defaultOptions: HtmlSerializeOptions = {
  format: true,
  selfClosing: false,
};

/**
 * 内部AST（hast Root）をHTML文字列に変換する。
 *
 * @param ast     - 内部AST（hast Root）
 * @param options - シリアライズオプション
 * @returns HTML文字列
 *
 * @example
 * const html = await serializeHtml(ast);
 */
export async function serializeHtml(
  ast: Root,
  options: Partial<HtmlSerializeOptions> = {}
): Promise<string> {
  const _opts = { ...defaultOptions, ...options };
  // TODO: rehype-stringify を使ってhastをHTML文字列に変換
  // const { unified } = await import('unified');
  // const rehypeStringify = (await import('rehype-stringify')).default;
  // const rehypeFormat = (await import('rehype-format')).default;
  // let processor = unified().use(rehypeStringify);
  // if (opts.format) processor = processor.use(rehypeFormat);
  // return processor.stringify(ast);
  void ast;
  throw new Error('serializeHtml: not implemented yet');
}
