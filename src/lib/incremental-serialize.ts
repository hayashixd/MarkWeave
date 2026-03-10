/**
 * インクリメンタルシリアライザ
 *
 * performance-design.md §4 に基づく実装。
 *
 * ProseMirror ドキュメントのトップレベルブロックごとにシリアライズ結果をキャッシュし、
 * 変更されたブロックのみを再シリアライズすることで、大規模ドキュメントの保存時
 * パフォーマンスを改善する。
 *
 * 比較方法: JSON.stringify による構造比較（TipTap ノードはプレーン JSON）。
 * キャッシュ無効化: ドキュメント構造が大幅に変化した場合（ブロック数変動）は
 * 全ブロックを再比較する。
 */

import type { TipTapDoc } from './markdown-to-tiptap';
import { serializeBlockNode } from './tiptap-to-markdown';

interface BlockCacheEntry {
  /** ブロックノードの JSON 文字列（比較用） */
  fingerprint: string;
  /** シリアライズ済み Markdown */
  markdown: string;
}

export class IncrementalSerializer {
  private blockCache: BlockCacheEntry[] = [];

  /**
   * TipTap JSON ドキュメントをインクリメンタルに Markdown へ変換する。
   * 前回と同一のブロックはキャッシュから返し、変更ブロックのみ再シリアライズする。
   */
  serialize(doc: TipTapDoc): string {
    if (!doc.content || doc.content.length === 0) {
      this.blockCache = [];
      return '';
    }

    const blocks = doc.content;
    const newCache: BlockCacheEntry[] = new Array(blocks.length);
    const markdowns: string[] = new Array(blocks.length);

    for (let i = 0; i < blocks.length; i++) {
      const node = blocks[i]!;
      const fingerprint = JSON.stringify(node);

      // キャッシュヒット: 同じ位置に同じブロックがあれば再利用
      const cached = this.blockCache[i];
      if (cached && cached.fingerprint === fingerprint) {
        newCache[i] = cached;
        markdowns[i] = cached.markdown;
      } else {
        // キャッシュミス: 再シリアライズ
        const markdown = serializeBlockNode(node, i, blocks);
        newCache[i] = { fingerprint, markdown };
        markdowns[i] = markdown;
      }
    }

    this.blockCache = newCache;
    return markdowns.join('\n\n') + '\n';
  }

  /**
   * キャッシュをクリアする。
   * エディタのコンテンツが外部から完全に置き換えられた場合に使用。
   */
  invalidate(): void {
    this.blockCache = [];
  }
}
