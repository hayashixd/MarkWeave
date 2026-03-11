/**
 * D3.js Force グラフコンポーネント
 *
 * wikilinks-backlinks-design.md §11.3 に準拠。
 * SVG ベースの力学シミュレーションで Wikiリンク関係を可視化する。
 *
 * Phase 7 簡易版:
 * - 開いているタブから構築したグラフデータを描画
 * - ズーム / パン / ノードドラッグ対応
 * - ノードクリックでファイルオープン
 * - ホバーカード表示
 */

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphData } from './graph-types';

/** D3 シミュレーション用に拡張された型 */
type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimEdge = GraphEdge & d3.SimulationLinkDatum<SimNode>;

interface GraphViewProps {
  data: GraphData;
  /** フィルタ中のタグ（空配列なら全ノード表示） */
  filterTags: string[];
  /** 孤立ノード非表示 */
  hideIsolated: boolean;
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null, event?: MouseEvent) => void;
}

/** ノードのリンク数に基づく半径計算 */
function nodeRadius(d: GraphNode): number {
  return Math.max(5, Math.min(20, 5 + d.linkCount * 1.5));
}

export function GraphView({
  data,
  filterTags,
  hideIsolated,
  onNodeClick,
  onNodeHover,
}: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const onNodeHoverRef = useRef(onNodeHover);
  onNodeHoverRef.current = onNodeHover;

  const fitView = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const g = d3.select(svg).select<SVGGElement>('g.graph-container');
    if (g.empty()) return;

    const bounds = (g.node() as SVGGElement).getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;

    const { width, height } = svg.getBoundingClientRect();
    const padding = 40;
    const scale = Math.min(
      (width - padding * 2) / bounds.width,
      (height - padding * 2) / bounds.height,
      2,
    );
    const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
    const ty = height / 2 - (bounds.y + bounds.height / 2) * scale;

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    d3.select(svg)
      .transition()
      .duration(500)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();

    const { width, height } = svgRef.current!.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // フィルタ適用
    const visibleNodeIds = new Set(
      filterTags.length === 0
        ? data.nodes.map((n) => n.id)
        : data.nodes
            .filter((n) => filterTags.some((t) => n.tags.includes(t)))
            .map((n) => n.id),
    );

    let filteredEdges = data.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );

    // 孤立ノード非表示
    let filteredNodes: GraphNode[];
    if (hideIsolated) {
      const connectedIds = new Set<string>();
      for (const e of filteredEdges) {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
      }
      filteredNodes = data.nodes.filter(
        (n) => visibleNodeIds.has(n.id) && connectedIds.has(n.id),
      );
      // ノードを再フィルタしたのでエッジも再フィルタ
      const finalIds = new Set(filteredNodes.map((n) => n.id));
      filteredEdges = filteredEdges.filter(
        (e) => finalIds.has(e.source) && finalIds.has(e.target),
      );
    } else {
      filteredNodes = data.nodes.filter((n) => visibleNodeIds.has(n.id));
    }

    if (filteredNodes.length === 0) return;

    // ディープコピー（D3 がオブジェクトを変更するため）
    const nodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = filteredEdges.map((e) => ({ ...e }));

    // ズーム・パン
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);

    const g = svg.append('g').attr('class', 'graph-container');

    // Force Simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    simulationRef.current = simulation;

    // performance-design.md §9.3: 大規模グラフはメインスレッド負荷軽減のため
    // シミュレーションを事前計算し、tick イベントによるリアルタイム更新を省略
    const isLargeGraph = nodes.length > 200;
    if (isLargeGraph) {
      simulation.stop();
      // 固定回数のイテレーションで収束させる（tick イベントなし）
      const iterations = Math.min(300, Math.max(100, nodes.length));
      for (let i = 0; i < iterations; ++i) {
        simulation.tick();
      }
    }

    // エッジ描画
    const link = g
      .append('g')
      .attr('class', 'graph-edges')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) =>
        d.isUnresolved ? '#ef4444' : '#cbd5e1',
      )
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', (d) => (d.isUnresolved ? '4 2' : 'none'));

    // ノード描画
    const nodeGroup = g
      .append('g')
      .attr('class', 'graph-nodes');

    const node = nodeGroup
      .selectAll<SVGCircleElement, SimNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) =>
        d.isActive
          ? '#3b82f6'
          : d.id.startsWith('__unresolved__')
            ? '#fca5a5'
            : '#e2e8f0',
      )
      .attr('stroke', (d) => (d.isActive ? '#1d4ed8' : '#94a3b8'))
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClickRef.current(d);
      })
      .on('mouseenter', (event, d) => {
        onNodeHoverRef.current(d, event);
        d3.select<SVGCircleElement, SimNode>(event.currentTarget)
          .attr('stroke-width', 3)
          .attr('stroke', '#3b82f6');
      })
      .on('mouseleave', (event) => {
        onNodeHoverRef.current(null);
        const sel = d3.select<SVGCircleElement, SimNode>(event.currentTarget);
        const d = sel.datum();
        sel
          .attr('stroke-width', 1.5)
          .attr('stroke', d.isActive ? '#1d4ed8' : '#94a3b8');
      });

    // ドラッグ動作を適用
    const dragBehavior = d3
      .drag<SVGCircleElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(dragBehavior);

    // ノードラベル（ノード数 < 200 の場合のみ表示）
    let label: d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown> | null = null;
    if (nodes.length < 200) {
      label = g
        .append('g')
        .attr('class', 'graph-labels')
        .selectAll<SVGTextElement, SimNode>('text')
        .data(nodes)
        .join('text')
        .text((d) => d.name)
        .attr('font-size', 10)
        .attr('fill', '#64748b')
        .attr('dy', '0.35em')
        .attr('dx', (d) => nodeRadius(d) + 4)
        .attr('pointer-events', 'none');
    }

    if (isLargeGraph) {
      // 事前計算済み: 静的に座標を適用
      link
        .attr('x1', (d) => ((d.source as SimNode).x ?? 0))
        .attr('y1', (d) => ((d.source as SimNode).y ?? 0))
        .attr('x2', (d) => ((d.target as SimNode).x ?? 0))
        .attr('y2', (d) => ((d.target as SimNode).y ?? 0));
      node
        .attr('cx', (d) => (d.x ?? 0))
        .attr('cy', (d) => (d.y ?? 0));
      if (label) {
        label
          .attr('x', (d) => (d.x ?? 0))
          .attr('y', (d) => (d.y ?? 0));
      }
    } else {
      // 小規模グラフ: リアルタイム tick 更新
      simulation.on('tick', () => {
        link
          .attr('x1', (d) => ((d.source as SimNode).x ?? 0))
          .attr('y1', (d) => ((d.source as SimNode).y ?? 0))
          .attr('x2', (d) => ((d.target as SimNode).x ?? 0))
          .attr('y2', (d) => ((d.target as SimNode).y ?? 0));
        node
          .attr('cx', (d) => (d.x ?? 0))
          .attr('cy', (d) => (d.y ?? 0));
        if (label) {
          label
            .attr('x', (d) => (d.x ?? 0))
            .attr('y', (d) => (d.y ?? 0));
        }
      });
    }

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [data, filterTags, hideIsolated]);

  return (
    <div className="graph-view-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        className="graph-view-svg"
        style={{ width: '100%', height: '100%' }}
      />
      <button
        type="button"
        className="graph-view__fit-btn"
        onClick={fitView}
        title="全体表示"
        aria-label="全体表示"
      >
        ⊡
      </button>
    </div>
  );
}
