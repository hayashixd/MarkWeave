/**
 * 仮想スクロール用ノード高さキャッシュ
 *
 * performance-design.md §3.3 に基づく実装。
 * ProseMirror ノードの高さを推定・キャッシュし、
 * ビューポート外ノードのプレースホルダー高さ決定に使用する。
 *
 * nodeId はポジションベース ("typeName:offset") で生成。
 * ドキュメント変更時にキャッシュを全クリアする。
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** nodeId = "${typeName}:${offset}" の形式 */
export function makeNodeId(node: ProseMirrorNode, offset: number): string {
  return `${node.type.name}:${offset}`;
}

// ノード高さキャッシュ（nodeId → 実測高さ px）
const heightCache = new Map<string, number>();

/**
 * ドキュメント変更時にキャッシュを全クリアする。
 * virtualScrollPlugin の apply() から呼び出すこと。
 */
export function invalidateHeightCache(): void {
  heightCache.clear();
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
 */
export function getEstimatedHeight(node: ProseMirrorNode, offset: number): number {
  const nodeId = makeNodeId(node, offset);

  // キャッシュヒット: 実測値を返す
  const cached = heightCache.get(nodeId);
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
  offset: number,
  dom: HTMLElement,
): void {
  const nodeId = makeNodeId(node, offset);
  heightCache.set(nodeId, dom.getBoundingClientRect().height);
}

/** テスト用: キャッシュの内容を取得 */
export function _getHeightCacheSize(): number {
  return heightCache.size;
}
