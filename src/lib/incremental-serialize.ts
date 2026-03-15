/**
 * インクリメンタルシリアライザ
 *
 * performance-design.md §4 に基づく実装。
 *
 * ProseMirror ドキュメントのトップレベルブロックごとにシリアライズ結果をキャッシュし、
 * 変更されたブロックのみを再シリアライズすることで、大規模ドキュメントの保存時
 * パフォーマンスを改善する。
 *
 * 比較方法: コンテンツベースのフィンガープリント（簡易ハッシュ）。
 * 位置ベース（index）ではなくコンテンツベースのため、ブロックの挿入・削除時にも
 * 変更されていないブロックのキャッシュがヒットする。
 */

import type { TipTapDoc, TipTapNode } from './markdown-to-tiptap';
import { serializeBlockNode } from './tiptap-to-markdown';

/**
 * FNV-1a ベースの簡易ハッシュ。
 * JSON.stringify 全体の文字列比較より高速。
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0;
  }
  return hash >>> 0;
}

/**
 * TipTap ノードのフィンガープリントを生成する。
 * ノードのタイプ・属性・内容に基づく安定した識別子。
 */
function makeFingerprint(node: TipTapNode): string {
  const json = JSON.stringify(node);
  return `${node.type}:${json.length}:${fnv1aHash(json)}`;
}

export class IncrementalSerializer {
  /** コンテンツベースのキャッシュ（fingerprint → markdown） */
  private contentCache = new Map<string, string>();
  /** 前回のシリアライズ時に使用されたフィンガープリント一覧（キャッシュ世代管理用） */
  private lastUsedFingerprints = new Set<string>();

  /**
   * TipTap JSON ドキュメントをインクリメンタルに Markdown へ変換する。
   * 前回と同一のブロックはキャッシュから返し、変更ブロックのみ再シリアライズする。
   */
  serialize(doc: TipTapDoc): string {
    if (!doc.content || doc.content.length === 0) {
      this.contentCache.clear();
      this.lastUsedFingerprints.clear();
      return '';
    }

    const blocks = doc.content;
    const markdowns: string[] = new Array(blocks.length);
    const currentFingerprints = new Set<string>();

    for (let i = 0; i < blocks.length; i++) {
      const node = blocks[i]!;
      const fingerprint = makeFingerprint(node);
      currentFingerprints.add(fingerprint);

      // キャッシュヒット: 同一コンテンツのブロックがあれば再利用
      const cached = this.contentCache.get(fingerprint);
      if (cached !== undefined) {
        markdowns[i] = cached;
      } else {
        // キャッシュミス: 再シリアライズ
        const markdown = serializeBlockNode(node, i, blocks);
        this.contentCache.set(fingerprint, markdown);
        markdowns[i] = markdown;
      }
    }

    // 前回使われたが今回使われなかったフィンガープリントを削除（メモリリーク防止）
    for (const fp of this.lastUsedFingerprints) {
      if (!currentFingerprints.has(fp)) {
        this.contentCache.delete(fp);
      }
    }
    this.lastUsedFingerprints = currentFingerprints;

    return markdowns.join('\n\n') + '\n';
  }

  /**
   * キャッシュをクリアする。
   * エディタのコンテンツが外部から完全に置き換えられた場合に使用。
   */
  invalidate(): void {
    this.contentCache.clear();
    this.lastUsedFingerprints.clear();
  }
}
