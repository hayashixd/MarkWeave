/**
 * グラフビュー用の型定義
 *
 * wikilinks-backlinks-design.md §11.2 に準拠。
 * Phase 7 簡易版ではフロントエンド（開いているタブ）のみをスキャンする。
 */

/** グラフビュー用のノード */
export interface GraphNode {
  id: string;          // ファイルパス or タブID（ユニーク ID）
  name: string;        // ファイル名（拡張子なし）
  title: string | null;
  /** リンク数（多いほど大きく表示） */
  linkCount: number;
  /** タグ一覧（色分けやフィルタリングに使用） */
  tags: string[];
  /** 現在アクティブなタブで開いているか */
  isActive: boolean;
}

/** グラフビュー用のエッジ */
export interface GraphEdge {
  source: string;      // source ノードID
  target: string;      // target ノードID
  /** 未解決リンク（target が存在しない） */
  isUnresolved: boolean;
}

/** グラフデータ全体 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** ワークスペース内の全タグ一覧（フィルタ UI 用） */
  allTags: string[];
}
