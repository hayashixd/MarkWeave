/**
 * グラフビューパネル（サイドバータブ統合用）
 *
 * wikilinks-backlinks-design.md §11 に準拠。
 * Phase 7 簡易版: 開いているタブの Wikiリンク関係を D3.js SVG で可視化する。
 *
 * ペルソナ対応:
 * - 知識管理者: ノート間のリンク関係を視覚的に把握し、構造を俯瞰できる
 *
 * 制限:
 * - スキャン対象は「現在開いているタブ」のみ（バックエンドインデックスは Phase 7.5）
 */

import { useState, useMemo, useCallback } from 'react';
import { useTabStore } from '../../store/tabStore';
import { useOpenFileAsTab } from '../../hooks/useOpenFileAsTab';
import { buildGraphData } from './buildGraphData';
import { GraphView } from './GraphView';
import { GraphFilterBar } from './GraphFilterBar';
import type { GraphNode } from './graph-types';

export function GraphViewPanel() {
  const { tabs, activeTabId, setActiveTab } = useTabStore();
  const openFileAsTab = useOpenFileAsTab();

  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [hideIsolated, setHideIsolated] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const graphData = useMemo(
    () => buildGraphData(tabs, activeTabId),
    [tabs, activeTabId],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      // 未解決リンクはクリック不可
      if (node.id.startsWith('__unresolved__')) return;

      // タブ内に既にあるか確認
      const existingTab = tabs.find(
        (t) => (t.filePath ?? t.id) === node.id,
      );
      if (existingTab) {
        setActiveTab(existingTab.id);
      } else if (!node.id.startsWith('__unresolved__')) {
        openFileAsTab(node.id);
      }
    },
    [tabs, setActiveTab, openFileAsTab],
  );

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      setHoveredNode(node);
    },
    [],
  );

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.edges.length;

  if (tabs.length === 0) {
    return (
      <div className="graph-panel">
        <div className="graph-panel__header">
          <span className="graph-panel__title">グラフビュー</span>
        </div>
        <div className="graph-panel__empty">
          <p>ファイルを開くとリンクグラフが表示されます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-panel">
      <div className="graph-panel__header">
        <span className="graph-panel__title">グラフビュー</span>
        <span className="graph-panel__count">
          {nodeCount}ノード / {edgeCount}リンク
        </span>
      </div>

      {graphData.allTags.length > 0 && (
        <GraphFilterBar
          allTags={graphData.allTags}
          filterTags={filterTags}
          onFilterChange={setFilterTags}
          hideIsolated={hideIsolated}
          onHideIsolatedChange={setHideIsolated}
        />
      )}

      <div className="graph-panel__canvas">
        <GraphView
          data={graphData}
          filterTags={filterTags}
          hideIsolated={hideIsolated}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
        />

        {/* ホバーカード */}
        {hoveredNode && (
          <div className="graph-panel__hover-card">
            <div className="graph-panel__hover-name">
              {hoveredNode.name}
              {hoveredNode.id.startsWith('__unresolved__') && (
                <span className="graph-panel__hover-unresolved"> (未解決)</span>
              )}
            </div>
            {hoveredNode.title && (
              <div className="graph-panel__hover-title">{hoveredNode.title}</div>
            )}
            {hoveredNode.tags.length > 0 && (
              <div className="graph-panel__hover-tags">
                {hoveredNode.tags.map((t) => (
                  <span key={t} className="graph-panel__hover-tag">#{t}</span>
                ))}
              </div>
            )}
            <div className="graph-panel__hover-links">
              リンク {hoveredNode.linkCount}件
            </div>
          </div>
        )}
      </div>

      <div className="graph-panel__footer">
        ※ 開いているタブのみをスキャン
      </div>
    </div>
  );
}
