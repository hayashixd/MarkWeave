/**
 * フロントエンド版グラフデータビルダー
 *
 * 開いているタブの Markdown コンテンツから [[Wikiリンク]] を抽出し、
 * GraphNode / GraphEdge を構築する。
 *
 * 制限:
 * - スキャン対象は「現在開いているタブ」のみ（BacklinksPanel と同じ制約）
 * - バックエンドインデックスは Phase 7.5 以降で対応
 */

import type { TabState } from '../../store/tabStore';
import type { GraphData, GraphNode, GraphEdge } from './graph-types';
import { parseFrontMatter, parseYamlFields } from '../../lib/frontmatter';

/** `[[target]]` or `[[target|label]]` にマッチ */
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/** ファイル名から拡張子を除いたベース名を返す */
function baseName(fileName: string): string {
  return fileName.replace(/\.(md|html|txt)$/i, '');
}

/**
 * 開いているタブからグラフデータを構築する。
 */
export function buildGraphData(
  tabs: TabState[],
  activeTabId: string | null,
): GraphData {
  // ベース名 → タブ のマップ（リンク解決用）
  const baseNameToTab = new Map<string, TabState>();
  for (const tab of tabs) {
    const base = baseName(tab.fileName).toLowerCase();
    if (!baseNameToTab.has(base)) {
      baseNameToTab.set(base, tab);
    }
  }

  // ノード構築
  const nodeMap = new Map<string, GraphNode>();
  const allTagsSet = new Set<string>();

  for (const tab of tabs) {
    const { yaml } = parseFrontMatter(tab.content);
    const fields = yaml ? parseYamlFields(yaml) : {};
    const tags = fields.tags?.map((t) => t.toLowerCase().trim()).filter(Boolean) ?? [];
    tags.forEach((t) => allTagsSet.add(t));

    const nodeId = tab.filePath ?? tab.id;
    nodeMap.set(nodeId, {
      id: nodeId,
      name: baseName(tab.fileName),
      title: fields.title ?? null,
      linkCount: 0,
      tags,
      isActive: tab.id === activeTabId,
    });
  }

  // エッジ構築 + linkCount 集計
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>(); // 重複排除

  for (const tab of tabs) {
    const sourceId = tab.filePath ?? tab.id;
    const { body } = parseFrontMatter(tab.content);

    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(body)) !== null) {
      const linkTarget = match[1]!.trim().toLowerCase();
      const targetTab = baseNameToTab.get(linkTarget);
      const targetId = targetTab ? (targetTab.filePath ?? targetTab.id) : `__unresolved__${linkTarget}`;
      const isUnresolved = !targetTab;

      // 未解決リンクの仮ノードを追加
      if (isUnresolved && !nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          name: match[1]!.trim(),
          title: null,
          linkCount: 0,
          tags: [],
          isActive: false,
        });
      }

      // 自己参照はスキップ
      if (sourceId === targetId) continue;

      // 重複エッジ排除
      const edgeKey = `${sourceId}→${targetId}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      edges.push({ source: sourceId, target: targetId, isUnresolved });

      // linkCount を加算
      const sourceNode = nodeMap.get(sourceId);
      if (sourceNode) sourceNode.linkCount++;
      const targetNode = nodeMap.get(targetId);
      if (targetNode) targetNode.linkCount++;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    allTags: Array.from(allTagsSet).sort(),
  };
}
