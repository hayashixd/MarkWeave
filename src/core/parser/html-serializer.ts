/**
 * html-serializer.ts
 *
 * 内部AST（hast互換）をHTML文字列にシリアライズするモジュール。
 *
 * Phase 5: tiptapToHtml (src/lib/tiptap-to-html.ts) が主要シリアライザ。
 * このモジュールは hast → HTML 変換が必要な場合に使用する。
 */

import { unified } from 'unified';
import rehypeStringify from 'rehype-stringify';
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
 */
export function serializeHtml(
  ast: Root,
  options: Partial<HtmlSerializeOptions> = {}
): string {
  const _opts = { ...defaultOptions, ...options };

  const processor = unified().use(rehypeStringify, {
    closeSelfClosing: _opts.selfClosing,
  });

  return processor.stringify(ast);
}
