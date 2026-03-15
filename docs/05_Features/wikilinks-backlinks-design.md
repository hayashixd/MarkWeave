# 双方向リンク（Wikiリンク）・バックリンク設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-25
> ※ §11 グラフビュー追加（2026-02-25）

---

## 目次

1. [概要と目的](#1-概要と目的)
2. [Wikiリンク記法の仕様](#2-wikiリンク記法の仕様)
3. [オートコンプリート設計](#3-オートコンプリート設計)
4. [バックリンクパネル設計](#4-バックリンクパネル設計)
5. [インデックス設計](#5-インデックス設計)
6. [リンク解決ロジック](#6-リンク解決ロジック)
7. [ファイルリネーム時の自動更新](#7-ファイルリネーム時の自動更新)
8. [WYSIWYG 表示設計](#8-wysiwyg-表示設計)
9. [実装方針](#9-実装方針)
10. [Markdown 出力形式](#10-markdown-出力形式)
11. [グラフビュー（リンクグラフ可視化）](#11-グラフビューリンクグラフ可視化)

---

## 1. 概要と目的

### 1.1 概要

`[[ファイル名]]` と入力するだけで同じワークスペース内の別ファイルへのリンクを作成し、リンク先のファイルには「このページへのリンク（バックリンク）」をサイドバーパネルに表示する機能。

### 1.2 目的・設計思想

- Obsidian・Roam Research 等で普及したナレッジネットワーク構築のUXを採用
- ワークスペース機能（フォルダ管理）と組み合わせることで、ファイル同士をグラフ状に繋いだ **パーソナルナレッジベース（PKM）** として機能する
- 既存の標準 Markdown リンク (`[text](path)`) と共存し、どちらも使用可能

---

## 2. Wikiリンク記法の仕様

### 2.1 基本記法

```markdown
[[ファイル名]]                    # ファイル名表示
[[ファイル名|表示テキスト]]        # 任意の表示テキストを指定
[[ディレクトリ/ファイル名]]        # パスを含む指定
[[ファイル名#見出し]]              # 見出しへのアンカー指定
[[ファイル名#見出し|表示テキスト]] # 全オプション組み合わせ
```

### 2.2 記法の詳細ルール

| 記法要素 | 仕様 |
|---------|------|
| ファイル名の大文字小文字 | 大文字小文字を区別しない（OS依存を避けるため） |
| 拡張子 | `.md` は省略可（`[[note]]` → `note.md` を解決）|
| 重複ファイル名 | ファイル名+パスの候補リストを表示して選択させる |
| 存在しないファイル | **未解決リンク**として表示（赤色・波線下線） |
| スペース | `[[my note]]`（スペースを含むファイル名をそのまま記述）|

---

## 3. オートコンプリート設計

### 3.1 UX フロー

```
1. ユーザーが [[ を入力
2. ワークスペース内のファイル候補ポップアップが表示される
3. 文字を入力するとリアルタイムでファジーフィルタリング
4. ↑↓ で選択、Enter または Tab で確定
5. 確定後: [[ファイル名]] が挿入され ]] 後ろにカーソル移動
```

### 3.2 候補ポップアップ

```
[[ を入力後:

┌──────────────────────────────────────────────┐
│ 🔍 note                                      │  ← 入力中のクエリ
├──────────────────────────────────────────────┤
│ 📄 meeting-notes.md          /docs/          │
│ ▶ 📄 meeting-notes-2026.md   /docs/ ← 選択中 │
│ 📄 note-taking-tips.md       /blog/          │
│ 📄 design-notes.md           /               │
└──────────────────────────────────────────────┘
  ↑↓ で移動  Enter で選択  Esc で閉じる
```

### 3.3 候補表示ルール

- **ソート**: 最近開いたファイル順（LRU）> ファジーマッチスコア順
- **除外**: 現在編集中のファイル自身は除外
- **最大表示数**: 10 件（超過時はスクロール可）

---

## 4. バックリンクパネル設計

### 4.1 パネル表示

サイドバーの「バックリンク」タブとして実装する。

```
┌────────────────────────────────────────────────────┐
│ バックリンク                          [更新 🔄]    │
├────────────────────────────────────────────────────┤
│ このファイルへのリンク: 3 件                       │
├────────────────────────────────────────────────────┤
│ 📄 project-overview.md              /              │
│   > 設計については [[system-design]] を参照...    │  ← コンテキスト引用
│                                                    │
│ 📄 roadmap.md                       /docs/         │
│   > 詳細は [[system-design#アーキテクチャ]] へ... │
│                                                    │
│ 📄 README.md                        /              │
│   > ドキュメント一覧: [[system-design]]           │
└────────────────────────────────────────────────────┘
```

### 4.2 バックリンク機能

| 機能 | 詳細 |
|------|------|
| リンク元のクリック | リンク元ファイルを新規タブで開き、該当行へジャンプ |
| コンテキスト表示 | リンクを含む段落のテキスト（最大140文字）を引用表示 |
| リアルタイム更新 | ファイル保存時にバックリンクインデックスを自動更新 |
| 未解決リンク表示 | バックリンクとして解決済みリンクのみ表示（未解決は別セクション） |

---

## 5. インデックス設計

### 5.1 インデックス構造

ワークスペース内の全 `.md` ファイルをスキャンし、Wikiリンクのインデックスを構築・管理する。

```typescript
// src/core/wikilinks/index.ts

interface WikilinkIndex {
  /** ファイルパス → そのファイルが持つ Wikiリンク一覧 */
  outgoingLinks: Map<string, WikilinkEntry[]>;

  /** リンク解決名（ファイル名）→ リンク元ファイルパス一覧（バックリンク） */
  incomingLinks: Map<string, BacklinkEntry[]>;

  /** ファイル名（拡張子なし）→ 実際のファイルパス一覧（重複解決用） */
  fileNameMap: Map<string, string[]>;
}

interface WikilinkEntry {
  targetName: string;     // [[targetName]] の targetName 部分
  targetAnchor?: string;  // #見出し 部分
  displayText?: string;   // |表示テキスト 部分
  lineNumber: number;     // リンクが存在する行番号
  context: string;        // 周辺テキスト（コンテキスト表示用）
}

interface BacklinkEntry {
  sourceFilePath: string;
  lineNumber: number;
  context: string;
}
```

### 5.2 インデックス更新タイミング

| イベント | 動作 |
|---------|------|
| ワークスペースを開く | 全ファイルをスキャンしてインデックスを構築（バックグラウンド） |
| ファイル保存時 | 保存したファイルのリンクを更新 |
| ファイル作成時 | 新ファイルをインデックスに追加 |
| ファイル削除時 | インデックスから削除（他ファイルの未解決リンクが増える） |
| ファイルリネーム時 | リネーム処理と連動して更新（§7 参照） |

### 5.3 パフォーマンス考慮

- インデックス構築は Tauri バックエンド（Rust）で実装し、walkdir クレートでスキャン
- 差分更新（変更ファイルのみ再スキャン）でパフォーマンスを維持
- フロントエンドには `zustand` ストアで結果を同期

---

## 6. リンク解決ロジック

### 6.1 ファイル解決の優先順位

`[[note]]` を解決する場合:

```
1. 現在ファイルと同じディレクトリ内の note.md
2. ワークスペース直下の note.md
3. ワークスペース全体で一意に解決できる note.md
4. 複数候補 → ユーザーに選択を促す（次回から記憶）
5. 解決不可 → 未解決リンクとして表示
```

### 6.2 見出しアンカーの解決

```typescript
// [[ファイル名#見出しテキスト]] の解決
function resolveAnchor(filePath: string, anchorText: string): number | null {
  // ファイルの見出し一覧から、スラッグ化した値で一致する見出しの行番号を返す
  const headings = extractHeadingsFromFile(filePath);
  return headings.find(h => slugify(h.text) === slugify(anchorText))?.lineNumber ?? null;
}
```

---

## 7. ファイルリネーム時の自動更新

### 7.1 自動更新の仕組み

ワークスペース内でファイルをリネームすると、そのファイルへの Wikiリンクを自動的に更新する。

```
ファイルリネーム: old-name.md → new-name.md

自動更新対象:
  - [[old-name]] → [[new-name]]
  - [[old-name|表示テキスト]] → [[new-name|表示テキスト]]
  - [[old-name#見出し]] → [[new-name#見出し]]
```

### 7.2 UX フロー

```
1. ファイルリネーム実行
2. トースト通知: 「○○のリンクを X 件更新しますか？」[更新する] [スキップ]
3. [更新する] 選択時: バックグラウンドで一括更新
4. 更新完了後: 「X 件のリンクを更新しました」（Undo 可能）
```

- 既存の標準 Markdown リンク (`[text](path)`) も同時に更新対象
- 詳細は [workspace-design.md](./workspace-design.md) §6「リネーム・移動時のリンク自動更新」と連携

---

## 8. WYSIWYG 表示設計

### 8.1 解決済みリンクの表示

```
WYSIWYG モードでの表示:

  解決済み: [meeting-notes]  ← クリックで対象ファイルを開く（下線付き・青色）
  未解決:   [broken-link]    ← 赤色・波線下線（ファイルが存在しない）
```

### 8.2 NodeView 設計

```typescript
// src/renderer/wysiwyg/node-views/wikilink-view.tsx

interface WikilinkAttrs {
  targetName: string;
  targetAnchor?: string;
  displayText?: string;
  resolvedPath?: string;  // 解決済みファイルパス（null なら未解決）
}

function WikilinkNodeView({ node }: NodeViewProps) {
  const { targetName, targetAnchor, displayText, resolvedPath } = node.attrs;
  const isResolved = resolvedPath !== null;
  const label = displayText || targetName + (targetAnchor ? `#${targetAnchor}` : '');

  return (
    <NodeViewWrapper
      as="span"
      className={isResolved ? 'wikilink-resolved' : 'wikilink-unresolved'}
      onClick={() => isResolved && openFile(resolvedPath)}
      title={isResolved ? resolvedPath : 'ファイルが見つかりません'}
    >
      {label}
    </NodeViewWrapper>
  );
}
```

### 8.3 ソースモードでの表示

ソースモードでは `[[ファイル名]]` がそのままシンタックスハイライト付きで表示される。

---

## 9. 実装方針

### 9.1 TipTap 拡張

```typescript
// src/renderer/wysiwyg/extensions/wikilink.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from 'prosemirror-inputrules';

export const WikilinkExtension = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,  // 内部は編集不可のアトムノード

  addAttributes() {
    return {
      targetName: { default: null },
      targetAnchor: { default: null },
      displayText: { default: null },
      resolvedPath: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-wikilink': '' }, HTMLAttributes)];
  },

  addInputRules() {
    return [
      // [[ で始まり ]] で終わるパターンを検出
      new InputRule(
        /\[\[([^\]]+)\]\]/,
        (state, match, start, end) => {
          const [fullMatch, inner] = match;
          const [nameAndAnchor, displayText] = inner.split('|');
          const [targetName, targetAnchor] = nameAndAnchor.split('#');
          // WikilinkIndex から resolvedPath を解決
          const resolvedPath = wikilinkStore.resolve(targetName);
          return state.tr.replaceWith(start, end, this.type.create({
            targetName, targetAnchor, displayText, resolvedPath,
          }));
        }
      ),
    ];
  },
});
```

### 9.2 Zustand ストア

```typescript
// src/store/wikilinkStore.ts
interface WikilinkStore {
  index: WikilinkIndex;
  buildIndex: (workspaceRoot: string) => Promise<void>;
  resolve: (targetName: string, fromFilePath?: string) => string | null;
  getBacklinks: (filePath: string) => BacklinkEntry[];
  updateOnSave: (filePath: string, content: string) => void;
}
```

---

## 10. Markdown 出力形式

### 10.1 保存時の形式

Wikiリンクは `.md` ファイルに保存する際、そのまま `[[...]]` 記法で保存する。

```markdown
設計については [[system-design]] を参照してください。

また [[ai-features|AI 機能の詳細]] も参照すること。
```

### 10.2 標準 Markdown リンクとの共存

- `[[...]]` 形式と `[text](path)` 形式は完全に共存
- エクスポート時（HTML/PDF）は `[[...]]` を `<a href="./target.html">...</a>` に変換
- 変換オプション: エクスポートダイアログで Wikiリンクを通常リンクに展開するかを選択可能

---

---

## 11. グラフビュー（リンクグラフ可視化）

### 11.1 レンダリングエンジン選定

ファイル間の Wikiリンク関係をノード-エッジグラフとして可視化する。Phase 7.5 では **D3.js（SVG ベース）** を採用し、Phase 8+ で大規模グラフへの対応として Canvas/WebGL への移行を検討する。

| 指標 | D3.js / SVG | Cytoscape.js | PixiJS（WebGL）|
|------|------------|--------------|----------------|
| 実装コスト | 低〜中 | 低 | 高 |
| ノード数上限 | 〜2,000 | 〜5,000 | 〜100,000 |
| インタラクション | CSS/SVG で容易 | 組み込み豊富 | 手動実装が必要 |
| バンドルサイズ | ~80KB | ~200KB | ~500KB |
| **採用フェーズ** | **Phase 7.5** | Phase 8 候補 | Phase 8 以降 |

**D3.js 採用の理由:**
- Force Simulation（力学シミュレーション）によるノード自動配置が直感的
- SVG なので CSS でスタイリングでき、テーマ変数（`--color-accent` 等）と統合しやすい
- 2,000 ノード以下（一般的な PKM ワークスペース）では十分なパフォーマンス

### 11.2 グラフデータ構造と IPC ペイロード

```typescript
// src/features/wikilinks/graph-types.ts

/** グラフビュー用のノード */
export interface GraphNode {
  id: string;          // ファイルパス（ユニーク ID）
  name: string;        // ファイル名（拡張子なし）
  title: string | null;
  /** リンク数（多いほど大きく表示）*/
  linkCount: number;
  /** タグ一覧（色分けやフィルタリングに使用）*/
  tags: string[];
  /** 現在アクティブなタブで開いているか */
  isActive: boolean;
}

/** グラフビュー用のエッジ */
export interface GraphEdge {
  source: string;      // source ファイルパス
  target: string;      // target ファイルパス
  /** 未解決リンク（target が存在しない）*/
  isUnresolved: boolean;
}

/** Tauri コマンドの返却型 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** ワークスペース内の全タグ一覧（フィルタ UI 用）*/
  allTags: string[];
}
```

**Tauri コマンド:**

```rust
// src-tauri/src/wikilinks/commands.rs（追加）

/// グラフビュー用データを構築して返す
#[tauri::command]
pub async fn get_graph_data(
    app: AppHandle,
    workspace_root: String,
) -> Result<GraphData, String> {
    let index = get_wikilink_index(&app)?;
    let nodes = build_graph_nodes(&index)?;
    let edges = build_graph_edges(&index)?;
    let all_tags = collect_all_tags(&index)?;
    Ok(GraphData { nodes, edges, all_tags })
}
```

**IPC ペイロードサイズ見積もり（1,000 ファイル）:**

| 要素 | 件数 | バイト/件 | 合計 |
|------|------|----------|------|
| nodes | 1,000 | ~120B | ~120KB |
| edges | 3,000 | ~80B | ~240KB |
| allTags | 200 | ~20B | ~4KB |
| **合計** | | | **~364KB** |

初回取得のみ全量転送し、以降は差分更新（ファイル保存時に `update_graph_edge` を呼ぶ）。

### 11.3 D3.js グラフコンポーネント実装方針

```tsx
// src/features/wikilinks/GraphView.tsx

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphData } from './graph-types';

interface GraphViewProps {
  data: GraphData;
  /** フィルタ中のタグ（空配列なら全ノード表示）*/
  filterTags: string[];
  onNodeClick: (node: GraphNode) => void;
  onNodeHover: (node: GraphNode | null) => void;
}

export function GraphView({ data, filterTags, onNodeClick, onNodeHover }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();

    const { width, height } = svgRef.current!.getBoundingClientRect();

    // フィルタ適用
    const visibleNodeIds = new Set(
      filterTags.length === 0
        ? data.nodes.map(n => n.id)
        : data.nodes
            .filter(n => filterTags.some(t => n.tags.includes(t)))
            .map(n => n.id)
    );
    const nodes = data.nodes.filter(n => visibleNodeIds.has(n.id));
    const edges = data.edges.filter(
      e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    // ズーム・パン
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    const g = svg.append('g');

    // Force Simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(edges).id((d: unknown) => (d as GraphNode).id).distance(80))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // エッジ描画
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', d => d.isUnresolved ? 'var(--color-danger)' : 'var(--color-border)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // ノード描画
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => Math.max(5, Math.min(20, 5 + d.linkCount * 1.5)))
      .attr('fill', d => d.isActive ? 'var(--color-accent)' : 'var(--color-bg-secondary)')
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('click', (_, d) => onNodeClick(d))
      .on('mouseenter', (_, d) => onNodeHover(d))
      .on('mouseleave', () => onNodeHover(null))
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); (d as d3.SimulationNodeDatum).fx = d3.pointer(e)[0]; })
          .on('drag', (e, d) => { (d as d3.SimulationNodeDatum).fx = e.x; (d as d3.SimulationNodeDatum).fy = e.y; })
          .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); (d as d3.SimulationNodeDatum).fx = null; (d as d3.SimulationNodeDatum).fy = null; })
      );

    // ノードラベル（ノード数 < 200 の場合のみ表示）
    if (nodes.length < 200) {
      g.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.name)
        .attr('font-size', 10)
        .attr('fill', 'var(--color-text-muted)')
        .attr('dy', '0.35em')
        .attr('dx', d => Math.max(5, Math.min(20, 5 + d.linkCount * 1.5)) + 4);
    }

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as d3.SimulationNodeDatum).x!)
        .attr('y1', d => (d.source as d3.SimulationNodeDatum).y!)
        .attr('x2', d => (d.target as d3.SimulationNodeDatum).x!)
        .attr('y2', d => (d.target as d3.SimulationNodeDatum).y!);
      node
        .attr('cx', d => (d as d3.SimulationNodeDatum).x!)
        .attr('cy', d => (d as d3.SimulationNodeDatum).y!);
    });

    return () => simulation.stop();
  }, [data, filterTags]);

  return <svg ref={svgRef} className="graph-view" style={{ width: '100%', height: '100%' }} />;
}
```

### 11.4 インタラクション設計

```
グラフビューのインタラクション一覧:

┌──────────────────────────────────────────────────────────────────┐
│  グラフビュー                              [フィルタ] [全体表示]  │
│                                                                  │
│          ● meeting-notes ←───────── ● project-overview          │
│         ↗ ↖                                   │                 │
│        ●  ●                                   ▼                 │
│  sprint  design                         ● system-design          │
│    │                                          │                 │
│    └──────────────── ● roadmap ───────────────┘                 │
│                                                                  │
│  [ホバー中: meeting-notes.md]                                    │
│  ┌──────────────────────────────────────┐                       │
│  │ meeting-notes.md                     │                       │
│  │ 更新: 2026-02-24  ·  #project #work  │                       │
│  │ リンク 3件 / 被リンク 2件            │                       │
│  └──────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

| 操作 | 動作 |
|------|------|
| ノードをホバー | ホバーカード表示（タイトル・タグ・更新日・リンク数）|
| ノードをクリック | 対象ファイルを新規タブで開く |
| ノードをダブルクリック | そのノードを中心に 1-hop ネイバーをハイライト |
| エッジをホバー | リンク元→リンク先のパスを示すラベル表示 |
| ホイールスクロール | ズームイン/アウト |
| ドラッグ（背景）| パン（移動）|
| ドラッグ（ノード）| ノードを手動配置（固定ピン）|
| 「全体表示」ボタン | fitView（全ノードが見えるようにズーム調整）|

### 11.5 フィルタ UI

```
┌────────────────────────────────────────────────────────┐
│ タグでフィルタ:                                         │
│ [#project ✕] [#work ✕] [+ タグを追加]                 │
│                                                        │
│ ○ 全ノード表示   ● 接続ノードのみ表示                   │
│ [孤立ノードを非表示]                                   │
└────────────────────────────────────────────────────────┘
```

```tsx
// src/features/wikilinks/GraphFilterBar.tsx
interface GraphFilterBarProps {
  allTags: string[];
  filterTags: string[];
  onFilterChange: (tags: string[]) => void;
  hideIsolated: boolean;
  onHideIsolatedChange: (v: boolean) => void;
}

export function GraphFilterBar({ allTags, filterTags, onFilterChange, hideIsolated, onHideIsolatedChange }: GraphFilterBarProps) {
  return (
    <div className="graph-filter-bar">
      <span>タグでフィルタ:</span>
      {filterTags.map(tag => (
        <span key={tag} className="filter-chip">
          #{tag}
          <button onClick={() => onFilterChange(filterTags.filter(t => t !== tag))}>✕</button>
        </span>
      ))}
      <select
        value=""
        onChange={e => {
          if (e.target.value) onFilterChange([...filterTags, e.target.value]);
          e.target.value = '';
        }}
      >
        <option value="">+ タグを追加</option>
        {allTags.filter(t => !filterTags.includes(t)).map(t => (
          <option key={t} value={t}>#{t}</option>
        ))}
      </select>
      <label>
        <input type="checkbox" checked={hideIsolated} onChange={e => onHideIsolatedChange(e.target.checked)} />
        孤立ノードを非表示
      </label>
    </div>
  );
}
```

### 11.6 実装フェーズ

| フェーズ | 内容 |
|---------|------|
| Phase 7.5 | `get_graph_data` Tauri コマンド、D3.js Force グラフ基本実装（ノード・エッジ描画）|
| Phase 7.5 | ホバーカード、クリックでファイルオープン、ズーム/パン |
| Phase 7.5 | タグフィルタ UI、孤立ノード非表示 |
| Phase 8 | 1-hop ネイバーハイライト、ノードピン機能 |
| Phase 8 | 大規模グラフ対応（2,000 ノード以上）: Cytoscape.js への移行検討 |

---

## 関連ドキュメント

- [workspace-design.md](./workspace-design.md) — ワークスペース・ファイルツリー設計（リネーム時リンク更新）
- [editor-ux-design.md](./editor-ux-design.md) §7 — リンクのクリック動作設計
- [search-design.md](./search-design.md) — 全文検索設計（Wikiリンクのインデックス連携）
- [export-design.md](./export-design.md) — エクスポート時の Wikiリンク変換
- [performance-design.md](./performance-design.md) — バックグラウンドインデックス更新のパフォーマンス
- [metadata-query-design.md](./metadata-query-design.md) — メタデータクエリエンジン（links テーブル連携）
