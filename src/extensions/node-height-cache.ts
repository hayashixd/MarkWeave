/**
 * 仮想スクロール用ノード高さキャッシュ
 *
 * performance-design.md §3.3 に基づく実装。
 * ProseMirror ノードの高さを推定・キャッシュし、
 * ビューポート外ノードのプレースホルダー高さ決定に使用する。
 *
 * キャッシュキーはコンテンツベースのフィンガープリント
 * ("typeName:textLength:childCount:textHash") を使用する。
 * これにより、ドキュメント内のオフセットが変わっても
 * 同一内容のノードはキャッシュヒットする。
 *
 * docChanged 時の全クリアは行わず、LRU 的にサイズ上限で古いエントリを除去する。
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** キャッシュの最大エントリ数 */
const MAX_CACHE_SIZE = 2000;

/**
 * ノードのコンテンツに基づくフィンガープリントを生成する。
 * テキスト内容の簡易ハッシュ + 構造情報でキーを構成する。
 */
function makeContentFingerprint(node: ProseMirrorNode): string {
  const text = node.textContent;
  const hash = simpleHash(text);
  return `${node.type.name}:${text.length}:${node.childCount}:${hash}`;
}

/**
 * 簡易ハッシュ関数（FNV-1a ベース）。
 * 暗号学的安全性は不要、高速かつ低衝突が目的。
 */
function simpleHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0; // FNV prime, keep 32-bit
  }
  return hash >>> 0; // unsigned
}

// ノード高さキャッシュ（contentFingerprint → 実測高さ px）
const heightCache = new Map<string, number>();

/**
 * ドキュメント変更時に呼ばれる。
 * 全クリアではなく、キャッシュサイズが上限を超えた場合のみ縮小する。
 * コンテンツベースのフィンガープリントにより、変更されていないノードは
 * キャッシュヒットし続ける。
 */
export function invalidateHeightCache(): void {
  // キャッシュが上限を超えた場合、古いエントリの半分を削除
  if (heightCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(heightCache.keys());
    const deleteCount = Math.floor(entries.length / 2);
    for (let i = 0; i < deleteCount; i++) {
      heightCache.delete(entries[i]!);
    }
  }
}

// CJK テキスト（日本語・中国語）は英語より行高が高い
const CJK_HEIGHT_BONUS_PER_LINE = 4;
const CJK_REGEX = /[\u3000-\u9FFF\uF900-\uFAFF]/;

// performance-design.md §3.4 に基づくデフォルト高さ（実測ベース）
const DEFAULT_HEIGHTS: Record<string, number> = {
  paragraph: 28,    // 1行: line-height 1.6 × 14px ≈ 22px + margin 6px
  heading: 40,      // 見出しの推定高さ
  codeBlock: 104,   // min-height: 4行分 = 22px × 4 + padding 16px
  table: 132,       // header + 2行 = 33px × 4
  blockquote: 52,   // padding 8px + 1行 22px + border 4px + margin 18px
  listItem: 28,     // 1行と同じ
  bulletList: 56,   // 2行分
  orderedList: 56,  // 2行分
  taskList: 56,     // 2行分
  taskItem: 28,     // 1行と同じ
  mathBlock: 64,    // KaTeX のデフォルト高さ + margin
  image: 200,       // 画像ロード前のプレースホルダー高さ
  horizontalRule: 20, // 水平線
  mermaidBlock: 200,  // Mermaid 図表のプレースホルダー
};

/**
 * ノードの推定高さを返す。
 * キャッシュにヒットすれば実測値、なければテキスト量ベースの推定値を返す。
 *
 * @param node ProseMirror ノード
 * @param _offset オフセット（後方互換のために残すが、キャッシュキーには使用しない）
 */
export function getEstimatedHeight(node: ProseMirrorNode, _offset: number): number {
  const fingerprint = makeContentFingerprint(node);

  // キャッシュヒット: 実測値を返す
  const cached = heightCache.get(fingerprint);
  if (cached !== undefined) return cached;

  // キャッシュミス: ノードタイプのデフォルト値 + テキスト量に比例した推定
  const base = DEFAULT_HEIGHTS[node.type.name] ?? 28;

  // テキスト量による行数推定（CJK は1文字が幅広）
  const textLength = node.textContent.length;
  if (textLength === 0) return base;

  const hasCjk = CJK_REGEX.test(node.textContent);
  const charsPerLine = hasCjk ? 30 : 60;
  const lines = Math.max(1, Math.ceil(textLength / charsPerLine));

  return base + (lines - 1) * (22 + (hasCjk ? CJK_HEIGHT_BONUS_PER_LINE : 0));
}

/**
 * DOM がレンダリングされた後に実測値をキャッシュする。
 */
export function updateHeightCache(
  node: ProseMirrorNode,
  _offset: number,
  dom: HTMLElement,
): void {
  const fingerprint = makeContentFingerprint(node);
  heightCache.set(fingerprint, dom.getBoundingClientRect().height);
}

/** テスト用: キャッシュの内容を取得 */
export function _getHeightCacheSize(): number {
  return heightCache.size;
}
