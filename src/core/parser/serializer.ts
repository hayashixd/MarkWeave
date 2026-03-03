/**
 * Markdown Serializer
 *
 * 内部AST（Root）をマークダウンテキストに変換する。
 *
 * TODO: Phase 1 で実装
 *   - remark-stringify による変換
 *   - テーブルの整形（列幅をそろえる）
 *   - 数式のシリアライズ
 */

import type { Root } from '../document/ast';

export interface SerializeOptions {
  /** テーブルの列幅を揃えるか */
  alignTableColumns: boolean;
  /** コードブロックのfence文字 */
  fence: '`' | '~';
}

export const defaultSerializeOptions: SerializeOptions = {
  alignTableColumns: true,
  fence: '`',
};

/**
 * ASTをマークダウンテキストに変換する
 */
export function serializeToMarkdown(_ast: Root, _options?: Partial<SerializeOptions>): string {
  // TODO: unified + remark-stringify で実装
  throw new Error('Not implemented');
}
