# パフォーマンス設計ドキュメント

> プロジェクト: Markdown / HTML Editor - Typora ライク WYSIWYG エディタ
> バージョン: 1.0
> 更新日: 2026-02-24

---

## 目次

1. [パフォーマンス目標と計測指標](#1-パフォーマンス目標と計測指標)
2. [ファイルサイズ閾値とモード自動切り替え](#2-ファイルサイズ閾値とモード自動切り替え)
3. [仮想スクロール設計](#3-仮想スクロール設計)
4. [インクリメンタルパース設計](#4-インクリメンタルパース設計)
5. [バックグラウンド保存と非同期 I/O](#5-バックグラウンド保存と非同期-io)
6. [全文検索のパフォーマンス](#6-全文検索のパフォーマンス)
7. [メモリ管理設計](#7-メモリ管理設計)
8. [パフォーマンス計測・プロファイリング方法](#8-パフォーマンス計測プロファイリング方法)

---

## 1. パフォーマンス目標と計測指標

### 1.1 パフォーマンスバジェット

| 指標 | 目標値 | 計測方法 |
|------|--------|---------|
| 起動時間（コールドスタート） | **< 1.0秒** | `performance.now()` from main.tsx mount |
| 10,000行ファイルのロード → 表示 | **< 500ms** | `markdownToTipTap()` + `editor.setContent()` の合計 |
| 通常キー入力のレイテンシ | **< 16ms** (60fps) | Chrome DevTools → Performance |
| 1,000行ファイルのキー入力レイテンシ | **< 16ms** | 同上 |
| 3,000行ファイルのキー入力レイテンシ | **< 32ms** (30fps) | WYSIWYG モードが厳しくなる閾値 |
| 自動保存（500KB ファイル）の書き込み | **< 50ms** | `writeTextFile` の実行時間 |
| メモリ使用量（通常使用時） | **< 200MB** | Windows タスクマネージャー |
| メモリ使用量（3MB ファイル開放後） | **< 400MB** | 同上（ソースモード使用） |

### 1.2 計測シナリオ

パフォーマンス退行を検出するため、以下のシナリオを定期的に計測する。

| シナリオ | ファイルサイズ | モード |
|---------|-------------|------|
| 小規模ファイル（日常的な用途） | ～ 50KB (約 1,000行) | Typora式 |
| 中規模ファイル（技術文書） | ～ 300KB (約 5,000行) | Typora式 |
| 大規模ファイル（自動ソースモード） | ～ 3MB | ソースモード |
| テーブル多用ドキュメント | 100テーブル × 10行 | Typora式 |
| 数式多用ドキュメント | 500個の KaTeX ブロック | Typora式 |

---

## 2. ファイルサイズ閾値とモード自動切り替え

> `system-design.md §2.2 ファイルサイズ閾値` の詳細版。

### 2.1 閾値設計の根拠

**3MB / ノード数 3,000** という閾値は以下の実験的根拠に基づく仮値。
実装後に実機計測で調整する。

| 計測条件 | 閾値の根拠 |
|---------|----------|
| Markdown 3MB ≒ 約6万行 | 書籍1冊分相当。WYSIWYG 編集が実用的でない規模 |
| ProseMirror ノード 3,000 | NodeView の DOM 描画コストが蓄積し 60fps を維持できなくなる目安 |

### 2.2 閾値チェックのタイミング

```typescript
// src/core/editor.ts

/**
 * ファイルを開く際にモードを決定する。
 * パース前にサイズチェック、パース後にノード数チェックを行う。
 */
export async function openDocument(
  filePath: string,
  userPreference: EditorMode
): Promise<{ content: TipTapDoc; initialMode: EditorMode }> {

  // Step 1: ファイルを読み込む
  const markdown = await readTextFile(filePath);
  const sizeBytes = new TextEncoder().encode(markdown).length;

  // Step 2: ファイルサイズチェック（パース前に早期リターン可能）
  if (sizeBytes >= FILE_SIZE_THRESHOLD_BYTES) {
    showToast(`ファイルが大きいためソースモードで開きます (${formatBytes(sizeBytes)})`);
    return { content: parseForSourceMode(markdown), initialMode: 'source' };
  }

  // Step 3: パースしてノード数チェック
  const doc = markdownToTipTap(markdown);
  const nodeCount = countNodes(doc);

  if (nodeCount >= NODE_COUNT_THRESHOLD) {
    showToast(`ノード数が多いためソースモードで開きます (${nodeCount} ノード)`);
    return { content: doc, initialMode: 'source' };
  }

  return { content: doc, initialMode: userPreference };
}

function countNodes(doc: TipTapDoc): number {
  let count = 0;
  function walk(node: TipTapNode) {
    count++;
    node.content?.forEach(walk);
  }
  walk(doc);
  return count;
}
```

### 2.3 ソースモード固定時の UX

```
閾値超過時のユーザーフロー:

[ファイルを開く]
  → サイズ/ノード数チェック
  → 閾値超過
  → トースト通知:「ファイルが大きいためソースモード (CodeMirror) で開きました」
  → [WYSIWYG で開く] ボタン付き（クリックで強制 WYSIWYG、速度低下の旨を警告）

WYSIWYG で強制的に開く場合:
  → 確認ダイアログ:「このファイルは大きいため動作が遅くなる可能性があります。WYSIWYG で開きますか？」
  → 承認後: WYSIWYG モードで開く（ユーザーの自己責任）
```

---

## 3. 仮想スクロール設計

### 3.1 仮想スクロールの必要性

ProseMirror は DOM ベースのエディタのため、ノード数が増えると **DOM ノードの総数** が直接レンダリング負荷に影響する。

```
1,000 段落 × 各段落の DOM ノード数（5〜20個）= 5,000〜20,000 DOM ノード
→ 再描画コストが増大し、タイピングが重くなる
```

### 3.2 ProseMirror の仮想スクロールアプローチ

ProseMirror には公式の仮想スクロールはないが、以下のアプローチで実現できる。

**採用方針: クリッピングによるビューポート外 NodeView の DOM 非描画**

```typescript
// src/renderer/wysiwyg/plugins/virtual-scroll.ts

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const VIEWPORT_MARGIN_PX = 500; // ビューポート外に追加で描画するマージン

/**
 * ビューポート外のブロックノードに 'hidden' デコレーションを付与し、
 * NodeView 側で DOM を最小化する（height: Xpx の空プレースホルダーに置き換える）。
 */
export const virtualScrollPlugin = new Plugin({
  key: new PluginKey('virtualScroll'),

  state: {
    init(_, state) {
      return buildDecorations(state, getViewportRange());
    },
    apply(tr, old, _, newState) {
      if (!tr.docChanged && !tr.getMeta('viewportChanged')) return old;
      return buildDecorations(newState, getViewportRange());
    },
  },

  view(editorView) {
    // スクロールイベントで仮想スクロールを更新
    const scrollHandler = throttle(() => {
      editorView.dispatch(
        editorView.state.tr.setMeta('viewportChanged', true)
      );
    }, 100); // 100ms でスロットル

    editorView.dom.closest('.editor-scroll-container')
      ?.addEventListener('scroll', scrollHandler);

    return {
      destroy() {
        editorView.dom.closest('.editor-scroll-container')
          ?.removeEventListener('scroll', scrollHandler);
      },
    };
  },

  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});

function getViewportRange(): { top: number; bottom: number } {
  const scrollContainer = document.querySelector('.editor-scroll-container');
  if (!scrollContainer) return { top: 0, bottom: window.innerHeight };
  const rect = scrollContainer.getBoundingClientRect();
  const scrollTop = scrollContainer.scrollTop;
  return {
    top: scrollTop - VIEWPORT_MARGIN_PX,
    bottom: scrollTop + rect.height + VIEWPORT_MARGIN_PX,
  };
}

function buildDecorations(state: EditorState, viewport: { top: number; bottom: number }): DecorationSet {
  const decorations: Decoration[] = [];
  let accumulatedHeight = 0;

  state.doc.forEach((node, offset) => {
    const nodeHeight = getNodeHeight(node);  // 推定高さ（キャッシュ済み）
    const nodeTop = accumulatedHeight;
    const nodeBottom = nodeTop + nodeHeight;

    if (nodeBottom < viewport.top || nodeTop > viewport.bottom) {
      // ビューポート外: 'virtuallyHidden' デコレーションを付与
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          'data-virtually-hidden': 'true',
          'data-height': String(nodeHeight),
        })
      );
    }

    accumulatedHeight += nodeHeight;
  });

  return DecorationSet.create(state.doc, decorations);
}
```

```tsx
// NodeView での仮想スクロール対応（例: ParagraphNodeView）
export function ParagraphNodeView({ node, decorations }: NodeViewProps) {
  const isVirtuallyHidden = decorations.some(
    (d) => d.spec['data-virtually-hidden'] === 'true'
  );

  if (isVirtuallyHidden) {
    const height = decorations.find((d) => d.spec['data-height'])?.spec['data-height'];
    // DOM を最小化: テキストのない高さ固定のプレースホルダー
    return (
      <div
        className="paragraph-placeholder"
        style={{ height: `${height}px`, minHeight: '1.5em' }}
        aria-hidden="true"
      />
    );
  }

  return <p>{/* 通常レンダリング */}</p>;
}
```

### 3.3 ノード高さのキャッシュ

仮想スクロールはノードの高さを事前に知る必要がある。完全に正確でなくてもよい（スクロール中に補正）。

```typescript
// src/renderer/wysiwyg/node-height-cache.ts

const heightCache = new Map<string, number>(); // nodeId → 高さ(px)
const DEFAULT_HEIGHTS: Record<string, number> = {
  paragraph: 28,        // 1行段落の推定高さ
  heading: 40,          // 見出しの推定高さ
  codeBlock: 100,       // コードブロックの推定高さ（4行分）
  table: 120,           // テーブルの推定高さ
  blockquote: 56,       // 引用ブロックの推定高さ
  mathBlock: 60,        // 数式ブロックの推定高さ
};

export function getEstimatedHeight(node: ProseMirrorNode, nodeId: string): number {
  // キャッシュヒット: 実測値を返す
  if (heightCache.has(nodeId)) return heightCache.get(nodeId)!;

  // キャッシュミス: ノードタイプのデフォルト値 + テキスト量に比例した推定
  const base = DEFAULT_HEIGHTS[node.type.name] ?? 28;
  const textLength = node.textContent.length;
  const lineEstimate = Math.ceil(textLength / 60); // 60文字 = 1行の目安
  return base * Math.max(1, lineEstimate);
}

/** DOM がレンダリングされた後に実測値をキャッシュ */
export function updateHeightCache(nodeId: string, dom: HTMLElement): void {
  heightCache.set(nodeId, dom.getBoundingClientRect().height);
}
```

### 3.4 仮想スクロールの有効化条件

仮想スクロールは常に有効にするのではなく、閾値超過時のみ有効にする。
（小規模ドキュメントではオーバーヘッドが無駄になるため）

```typescript
// src/core/editor.ts

const VIRTUAL_SCROLL_NODE_THRESHOLD = 500; // 500ノード以上で仮想スクロールを有効化

export function getEditorExtensions(nodeCount: number): Extension[] {
  const extensions = [
    // ... 基本エクステンション
  ];

  if (nodeCount >= VIRTUAL_SCROLL_NODE_THRESHOLD) {
    extensions.push(VirtualScrollExtension);
  }

  return extensions;
}
```

---

## 4. インクリメンタルパース設計

### 4.1 全文再パースの問題点

現在の設計では保存時に `tiptapToMarkdown(editor.getJSON())` で全文シリアライズを行う。
大きなドキュメントでは毎回の保存が重くなる可能性がある。

```
全文再パース（現状）:
  [TipTap doc 変更] → [getJSON()] → [tiptapToMarkdown(整文)] → [writeTextFile]

10,000行ファイルの場合:
  - getJSON(): ~5ms
  - tiptapToMarkdown(): ~50ms（文字列生成コスト）
  - writeTextFile(): ~30ms（ディスクI/O）
  合計: ~85ms / 500ms debounce ごとに発生
```

### 4.2 インクリメンタルシリアライズ（Phase 3 以降の改善）

Phase 1 では全文シリアライズで実装し、パフォーマンス計測後に以下の改善を検討する。

```typescript
// 将来的なインクリメンタルシリアライズのアイデア（設計案）

/**
 * ProseMirror のトランザクションから「変更されたブロック」を特定し、
 * そのブロックのみを再シリアライズして前回の Markdown に差し込む。
 *
 * ★ 実装難度が高く、ラウンドトリップの完全性が保証されてから検討する。
 * Phase 1 では全文シリアライズで問題ない（小〜中規模ファイルで 85ms 以下なら許容範囲）。
 */
export function incrementalSerialize(
  prevMarkdown: string,
  tr: Transaction,
  prevDoc: Node,
  newDoc: Node
): string {
  const changedRanges = getChangedBlockRanges(tr, prevDoc, newDoc);
  // changedRanges: 変更されたブロックの { from, to, newMarkdown } リスト

  let result = prevMarkdown;
  // 後ろから適用（前から適用するとオフセットがずれる）
  for (const range of changedRanges.reverse()) {
    result = result.slice(0, range.prevStart) + range.newMarkdown + result.slice(range.prevEnd);
  }
  return result;
}
```

**Phase 1 での方針**: 全文シリアライズを維持。500ms デバウンスで体感は問題ない。
300KB ファイルでの `tiptapToMarkdown` が 100ms を超えるようなら Web Worker への移行を検討する。

### 4.3 Web Worker へのシリアライズ移行（必要に応じて）

```typescript
// src/core/serializer-worker.ts（将来的な実装）

// Web Worker 内で実行（メインスレッドをブロックしない）
self.addEventListener('message', (e: MessageEvent<{ json: TipTapDoc }>) => {
  const markdown = tiptapToMarkdown(e.data.json);
  self.postMessage({ markdown });
});
```

```typescript
// メインスレッドからの呼び出し
const serializerWorker = new Worker(
  new URL('./core/serializer-worker.ts', import.meta.url),
  { type: 'module' }
);

export function serializeInBackground(doc: TipTapDoc): Promise<string> {
  return new Promise((resolve) => {
    serializerWorker.postMessage({ json: doc });
    serializerWorker.addEventListener('message', (e) => {
      resolve(e.data.markdown);
    }, { once: true });
  });
}
```

---

## 5. バックグラウンド保存と非同期 I/O

### 5.1 Rust バックエンドでの非同期書き込み

Tauri の `writeTextFile` は Rust の非同期 I/O を使用しており、フロントエンドの `await` 中も
JavaScript のメインスレッドはブロックされない（Promise ベースの非同期呼び出し）。

```
[JS: await writeTextFile(path, content)]
  │
  ├─ JS は await 中にイベントループを解放（他の処理が動ける）
  │
  └─ Rust: tokio::fs::write()（非同期I/O） → OS
                                               │
                                  ファイルシステムへの書き込み
                                               │
                                           完了通知
  │
  └─ JS: await が解決 → tabStore.markSaved()
```

**懸念点**: `tiptapToMarkdown()` による Markdown 文字列生成はメインスレッドで同期的に実行される。
これが主なレイテンシ要因になる。（前述の Web Worker 移行で解決）

### 5.2 保存の優先度管理

| 保存のトリガー | 優先度 | デバウンス |
|-------------|--------|----------|
| `Ctrl+S`（手動保存） | **最高** | なし（即時実行） |
| `onCloseRequested`（アプリ終了前） | **高** | なし（即時実行） |
| 自動保存（debounce 経過） | **通常** | 500ms〜2000ms |
| チェックポイント（クラッシュ対策） | **低** | 30秒ごと（インターバル） |

```typescript
// src/file/save-manager.ts

type SavePriority = 'immediate' | 'debounced' | 'checkpoint';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(
  filePath: string,
  content: string,
  priority: SavePriority = 'debounced'
): void {
  if (priority === 'immediate') {
    if (debounceTimer) clearTimeout(debounceTimer);
    performSave(filePath, content);
    return;
  }

  if (priority === 'debounced') {
    if (debounceTimer) clearTimeout(debounceTimer);
    const delay = getAutoSaveDebounce(new TextEncoder().encode(content).length);
    debounceTimer = setTimeout(() => performSave(filePath, content), delay);
    return;
  }
  // checkpoint は外部のインターバルで管理
}
```

---

## 6. 全文検索のパフォーマンス

### 6.1 単一ファイル内検索

現在開いているファイルの検索は TipTap / ProseMirror の組み込み検索機能（または `@tiptap/extension-search-and-replace`）で対応する。

```typescript
// src/renderer/wysiwyg/extensions/search.ts
// TipTap の公式拡張を活用

import SearchAndReplace from '@tiptap/extension-search-and-replace';

const extensions = [
  SearchAndReplace.configure({
    searchResultClass: 'search-highlight',
    caseSensitive: false,
    disableRegex: false,
  }),
];

// 検索の実行
editor.commands.setSearchTerm('検索ワード');
editor.commands.goToNextSearchResult();
```

**パフォーマンス**: 単一ファイル内の検索は TipTap が JavaScript で実行。
通常の Markdown ファイル（数百KB以下）では問題ない。

### 6.2 フォルダ内全文検索（Phase 4）

複数ファイルをまたぐ全文検索は **Rust バックエンド** で実行する。

```rust
// src-tauri/src/commands/search.rs

use std::path::PathBuf;
use std::fs;
use regex::Regex;

#[derive(serde::Serialize)]
pub struct SearchResult {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// フォルダ内の全 .md/.html ファイルを検索する（Rust で非同期実行）
#[tauri::command]
pub async fn search_in_folder(
    folder_path: String,
    query: String,
    case_sensitive: bool,
    use_regex: bool,
) -> Result<Vec<SearchResult>, String> {
    let pattern = if use_regex {
        if case_sensitive {
            Regex::new(&query).map_err(|e| e.to_string())?
        } else {
            Regex::new(&format!("(?i){}", query)).map_err(|e| e.to_string())?
        }
    } else {
        let escaped = regex::escape(&query);
        if case_sensitive {
            Regex::new(&escaped).map_err(|e| e.to_string())?
        } else {
            Regex::new(&format!("(?i){}", escaped)).map_err(|e| e.to_string())?
        }
    };

    let mut results = Vec::new();
    let walker = walkdir::WalkDir::new(&folder_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && matches!(
                    e.path().extension().and_then(|s| s.to_str()),
                    Some("md") | Some("markdown") | Some("html") | Some("htm")
                )
        });

    for entry in walker {
        let path = entry.path();
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue, // 読めないファイルはスキップ
        };

        for (line_idx, line) in content.lines().enumerate() {
            for m in pattern.find_iter(line) {
                results.push(SearchResult {
                    file_path: path.to_string_lossy().to_string(),
                    line_number: line_idx + 1,
                    line_content: line.to_string(),
                    match_start: m.start(),
                    match_end: m.end(),
                });
            }
        }

        // 結果が多すぎる場合は早期終了（UI を固まらせない）
        if results.len() > 10_000 {
            break;
        }
    }

    Ok(results)
}
```

**パフォーマンス特性**:
- Rust の `walkdir` + `regex` クレートは JavaScript の同等処理より 5〜20 倍高速
- 1,000ファイル × 平均 100KB = 100MB のコーパスで概ね 500ms 以内に完了する見込み
- 結果を 10,000件で打ち切る（UI のレンダリングコスト対策）

---

## 7. メモリ管理設計

### 7.1 画像の遅延読み込み

`ImageNodeView` はビューポート外の画像を `asset://` に変換しない（ `src` を空にする）。
`IntersectionObserver` でビューポートに入ったときに初めて読み込む。

```tsx
// src/renderer/wysiwyg/ImageNodeView.tsx（遅延読み込み対応版）

export function ImageNodeView({ node, getCurrentFilePath }: ImageNodeViewProps) {
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        // ビューポートに入ったら画像を読み込む
        const src = node.attrs.src as string;
        if (src.startsWith('http')) {
          setDisplaySrc(src); // 外部URL
        } else {
          const { resolve, dirname } = await import('@tauri-apps/api/path');
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          const mdDir = await dirname(getCurrentFilePath());
          const absolutePath = await resolve(mdDir, src);
          setDisplaySrc(convertFileSrc(absolutePath));
        }
      },
      { rootMargin: '200px' } // 200px 手前で事前読み込み
    );

    observer.observe(img);
    return () => observer.disconnect();
  }, [node.attrs.src]);

  return (
    <NodeViewWrapper>
      <img ref={imgRef} src={displaySrc || undefined} alt={node.attrs.alt} />
    </NodeViewWrapper>
  );
}
```

### 7.2 タブ切り替え時のメモリ解放

タブを切り替えた際、非アクティブなタブの TipTap インスタンスを **一時的に破棄** するか
**保持し続ける** かを選択する必要がある。

| 方針 | メリット | デメリット |
|------|--------|----------|
| 保持し続ける（現状） | タブ切り替えが速い | タブ数 × メモリ消費 |
| 非アクティブを破棄 | メモリ節約 | 切り替え時に再パースが必要（遅い） |
| 遅延破棄（LRU） | バランスが良い | 実装が複雑 |

**採用方針**: Phase 1 では「保持し続ける」シンプルな実装を採用。
タブ数が増えてメモリ問題が顕在化した場合（Phase 4 以降）に **LRU で最大 5 タブを保持** する方式に移行する。

```typescript
// src/store/tabStore.ts（将来的な LRU 実装の概要）

const MAX_ACTIVE_EDITORS = 5;

// LRU キャッシュ: 最近使ったタブの TipTap インスタンスを最大 5 個保持
// 6個目を開くと最も古いインスタンスを破棄（テキスト内容は Zustand に保持）
```

### 7.3 不要になった画像キャッシュの定期削除

外部 URL 画像のキャッシュ（`$APP_CACHE_DIR/images/`）は定期的に削除する。

```typescript
// src/app.tsx

useEffect(() => {
  // アプリ起動時に古い画像キャッシュを削除（500MB 上限）
  invoke('purge_image_cache', { maxBytes: 500 * 1024 * 1024 });
}, []);
```

---

## 8. パフォーマンス計測・プロファイリング方法

### 8.1 起動時間の計測

```typescript
// src/main.tsx

const startTime = performance.now();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// App コンポーネントの最初の useEffect で計測完了
useEffect(() => {
  const mountTime = performance.now() - startTime;
  console.log(`[Perf] App mount: ${mountTime.toFixed(1)}ms`);
}, []);
```

### 8.2 ファイルロード時間の計測

```typescript
// src/file/file-manager.ts

export async function openAndParseFile(path: string): Promise<TipTapDoc> {
  const t0 = performance.now();
  const markdown = await readTextFile(path);

  const t1 = performance.now();
  const doc = markdownToTipTap(markdown);

  const t2 = performance.now();
  console.log(`[Perf] File read: ${(t1 - t0).toFixed(1)}ms, Parse: ${(t2 - t1).toFixed(1)}ms`);

  return doc;
}
```

### 8.3 キー入力レイテンシの計測

Chrome DevTools の **Performance タブ** を使い、「タイピング中のフレームレート」を確認する。

```
計測手順:
1. Chrome DevTools → Performance → Record 開始
2. テキストを 10 文字入力
3. Record 停止
4. Frame rate グラフで 60fps (16ms/frame) を下回っていないか確認
5. Long Task（50ms 以上のタスク）が発生していないか確認
```

### 8.4 メモリ使用量の計測

Windows タスクマネージャー または Chrome DevTools の Memory タブ。

```
計測シナリオ:
1. アプリ起動直後のメモリ（ベースライン）
2. 1MB ファイルを開いた後
3. 3MB ファイルをソースモードで開いた後
4. タブを 5 つ開いた後
5. 大きなファイルを閉じた後（メモリが解放されているか確認）
```

### 8.5 パフォーマンスリグレッションの防止

```typescript
// tests/performance/load-time.bench.ts（Vitest Benchmark）

import { bench, describe } from 'vitest';
import { markdownToTipTap } from '../../src/core/converter/mdast-to-tiptap';
import { tiptapToMarkdown } from '../../src/core/converter/tiptap-to-mdast';

// テスト用フィクスチャ: 1,000行の Markdown
const FIXTURE_1000_LINES = '...' // テストフィクスチャ

describe('Parser performance', () => {
  bench('markdownToTipTap (1,000 lines)', () => {
    markdownToTipTap(FIXTURE_1000_LINES);
  });

  bench('tiptapToMarkdown (1,000 lines)', () => {
    const doc = markdownToTipTap(FIXTURE_1000_LINES);
    tiptapToMarkdown(doc);
  });
});
```

---

## 関連ドキュメント

- [system-design.md](./system-design.md) — システム全体設計（§2.2 ファイルサイズ閾値）
- [window-tab-session-design.md](./window-tab-session-design.md) — 自動保存の詳細仕様（§9）
- [image-storage-design.md](./image-storage-design.md) — 外部URL画像キャッシュ設計（§4）

---

*このドキュメントは実装フェーズでパフォーマンス計測結果に基づいて更新する。閾値の数値は仮値であり、実測後に調整すること。*
