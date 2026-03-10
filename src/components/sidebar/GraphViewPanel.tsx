/**
 * グラフビューパネル（サイドバータブ統合用）
 *
 * wikilinks-backlinks-design.md §11 に準拠。
 *
 * Phase 7.5:
 * - ワークスペースが開いている場合: Tauri get_graph_data コマンドで SQLite から
 *   ワークスペース全体のリンクグラフを取得する。
 * - ワークスペースなし: 開いているタブから buildGraphData でグラフを構築する
 *   （Phase 7 簡易版と同等のフォールバック）。
 *
 * ペルソナ対応:
 * - 知識管理者: ノート間のリンク関係を視覚的に把握し、構造を俯瞰できる
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTabStore } from '../../store/tabStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useOpenFileAsTab } from '../../hooks/useOpenFileAsTab';
import { buildGraphData } from './buildGraphData';
import { GraphView } from './GraphView';
import { GraphFilterBar } from './GraphFilterBar';
import type { GraphNode, GraphData } from './graph-types';

/** Tauri コマンドが返す GraphData と同形（フロントエンド型を再利用） */
type TauriGraphData = GraphData;

export function GraphViewPanel() {
  const { tabs, activeTabId, setActiveTab } = useTabStore();
  const workspaceRoot = useWorkspaceStore((s) => s.root);
  const openFileAsTab = useOpenFileAsTab();

  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [hideIsolated, setHideIsolated] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // ワークスペースあり: Tauri コマンドで取得したグラフデータ
  const [workspaceGraph, setWorkspaceGraph] = useState<TauriGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ワークスペースが変わったらグラフを再取得
  useEffect(() => {
    if (!workspaceRoot) {
      setWorkspaceGraph(null);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    invoke<TauriGraphData>('get_graph_data')
      .then((data) => {
        // アクティブタブのパスに isActive フラグを設定
        const activeTab = tabs.find((t) => t.id === activeTabId);
        const activeFilePath = activeTab?.filePath ?? null;
        const nodes = data.nodes.map((n) => ({
          ...n,
          isActive: n.id === activeFilePath,
        }));
        setWorkspaceGraph({ ...data, nodes });
      })
      .catch((e: unknown) => {
        setFetchError(String(e));
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  // アクティブタブが変わったら isActive フラグのみ更新（再フェッチ不要）
  useEffect(() => {
    if (!workspaceGraph) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const activeFilePath = activeTab?.filePath ?? null;
    setWorkspaceGraph((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => ({
          ...n,
          isActive: n.id === activeFilePath,
        })),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // フォールバック: タブのみのグラフ（ワークスペースなし時）
  const tabGraphData = useMemo(
    () => buildGraphData(tabs, activeTabId),
    [tabs, activeTabId],
  );

  const graphData: GraphData = workspaceRoot
    ? (workspaceGraph ?? tabGraphData)
    : tabGraphData;

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.id.startsWith('__unresolved__')) return;

      const existingTab = tabs.find(
        (t) => (t.filePath ?? t.id) === node.id,
      );
      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        openFileAsTab(node.id);
      }
    },
    [tabs, setActiveTab, openFileAsTab],
  );

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
  }, []);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.edges.length;

  if (!workspaceRoot && tabs.length === 0) {
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
          {isLoading ? '読み込み中…' : `${nodeCount}ノード / ${edgeCount}リンク`}
        </span>
      </div>

      {fetchError && (
        <div className="graph-panel__error">グラフ取得エラー: {fetchError}</div>
      )}

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
        {workspaceRoot ? 'ワークスペース全体をスキャン' : '※ 開いているタブのみをスキャン'}
      </div>
    </div>
  );
}
