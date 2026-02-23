/**
 * Markdown Parser
 *
 * マークダウンテキストを内部AST（Root）に変換する。
 * unified / remark エコシステムを使用予定。
 *
 * TODO: Phase 1 で実装
 *   - remark-parse による基本パース
 *   - remark-gfm による GFM（テーブル、タスクリスト等）対応
 *   - remark-math によるKaTeX数式対応
 *   - YAML front matter 対応
 */

import type { Root } from '../document/ast';

export interface ParseOptions {
  /** GFM（GitHub Flavored Markdown）を有効にする */
  gfm: boolean;
  /** 数式を有効にする */
  math: boolean;
  /** YAML front matter を有効にする */
  frontmatter: boolean;
}

export const defaultParseOptions: ParseOptions = {
  gfm: true,
  math: true,
  frontmatter: true,
};

/**
 * マークダウンテキストをASTに変換する
 */
export function parseMarkdown(text: string, options?: Partial<ParseOptions>): Root {
  // TODO: unified + remark で実装
  throw new Error('Not implemented');
}
