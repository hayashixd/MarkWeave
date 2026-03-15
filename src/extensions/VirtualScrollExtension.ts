/**
 * 仮想スクロール TipTap 拡張
 *
 * performance-design.md §3 に基づく実装。
 * ビューポート外のトップレベルブロックノードに 'data-virtually-hidden' デコレーションを付与し、
 * CSS で高さ固定のプレースホルダーに置き換えることで DOM ノード数を削減する。
 *
 * 500 ノード以上のドキュメントでのみ有効化する（閾値は TipTapEditor 側で制御）。
 *
 * CLAUDE.md 制約:
 * - 入力レイテンシ < 16ms を維持するため、スクロールイベントは適応スロットル
 * - IME 入力中のトランザクションは通常通り処理（仮想スクロールはデコレーションのみ）
 *
 * ## インクリメンタル更新戦略
 *
 * | イベント          | 処理                                      | コスト         |
 * |-------------------|-------------------------------------------|----------------|
 * | docChanged        | DecorationSet.map() + heightAccum 差分再構築 | O(N) + O(K log N) |
 * | viewportChanged   | インクリメンタル差分更新                    | O(K log N)     |
 * | recalculateHeights| 高さ配列再構築 + 全再構築                   | O(N log N)     |
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { getEstimatedHeight, invalidateHeightCache, updateHeightCache } from './node-height-cache';

const pluginKey = new PluginKey('virtualScroll');

/** ビューポート外に追加で描画するマージン（px） */
const VIEWPORT_MARGIN_PX = 500;

/** スクロール終了後の高さ再計測デバウンス（ms） */
const SCROLL_END_DEBOUNCE_MS = 200;

/** スクロールコンテナ検出リトライの間隔 (ms) */
const CONTAINER_DETECT_INTERVAL_MS = 50;

/** スクロールコンテナ検出の最大リトライ回数 */
const CONTAINER_DETECT_MAX_RETRIES = 20;

/** docChanged 後にビューポートを再計算するまでの遅延 (ms) */
const POST_DOC_CHANGE_RECALC_DELAY_MS = 30;

interface ViewportRange {
  top: number;
  bottom: number;
}

/**
 * ノードごとの累積高さエントリ。インクリメンタル差分更新で参照する。
 */
interface HeightAccumEntry {
  offset: number;
  nodeSize: number;
  top: number;    // このノードの上端（累積高さ）
  height: number; // このノードの推定高さ
}

/**
 * プラグイン内部状態。DecorationSet に加えて差分更新に必要な情報を保持する。
 */
interface VirtualScrollPluginState {
  decoSet: DecorationSet;
  /** offset → Decoration マップ（差分更新時の remove 用） */
  hiddenDecoMap: Map<number, Decoration>;
  /** ノードごとの累積高さ（スクロール差分更新のバイナリサーチ基盤） */
  heightAccum: HeightAccumEntry[] | null;
  /** 最後に計算したビューポート範囲 */
  viewport: ViewportRange;
}

const EMPTY_PLUGIN_STATE: VirtualScrollPluginState = {
  decoSet: DecorationSet.empty,
  hiddenDecoMap: new Map(),
  heightAccum: null,
  viewport: { top: 0, bottom: 0 },
};

/**
 * スクロールイベントのスロットル間隔をノード数に応じて決定する。
 * 大規模ドキュメントほど 1 回のビルドコストが高いため、頻度を抑える。
 *
 * | ノード数   | スロットル | 備考                        |
 * |-----------|-----------|----------------------------|
 * | < 1000    | 100ms     | インクリメンタル更新で十分速い |
 * | 1000〜1999 | 150ms     | 差分更新でも念のため間引く     |
 * | ≥ 2000    | 300ms     | docChanged は高コストなので保守的に |
 */
function getScrollThrottleMs(nodeCount: number): number {
  if (nodeCount >= 2000) return 300;
  if (nodeCount >= 1000) return 150;
  return 100;
}

/**
 * スクロールコンテナからビューポート範囲を取得する。
 */
function getViewportRange(scrollContainer: Element | null): ViewportRange {
  if (!scrollContainer) {
    return { top: 0, bottom: window.innerHeight };
  }
  const scrollTop = scrollContainer.scrollTop;
  const height = scrollContainer.clientHeight;
  return {
    top: scrollTop - VIEWPORT_MARGIN_PX,
    bottom: scrollTop + height + VIEWPORT_MARGIN_PX,
  };
}

function findScrollContainer(editorView: EditorView): HTMLElement | null {
  if (!editorView.dom.isConnected) {
    return null;
  }

  const direct = editorView.dom.closest('.editor-scroll-container');
  if (direct instanceof HTMLElement) {
    return direct;
  }

  const parentMatch = editorView.dom.parentElement?.closest('.editor-scroll-container');
  if (parentMatch instanceof HTMLElement) {
    return parentMatch;
  }

  let current: HTMLElement | null = editorView.dom.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * hidden デコレーションを生成する（ノードオブジェクト不要）。
 */
function createHiddenDecoration(offset: number, nodeSize: number, height: number): Decoration {
  return Decoration.node(offset, offset + nodeSize, {
    class: 'virtual-scroll-hidden',
    style: `height: ${height}px; min-height: ${height}px; overflow: hidden; contain: strict;`,
    'data-virtually-hidden': 'true',
    'data-estimated-height': String(height),
  });
}

/**
 * 全ノードを走査してプラグイン状態を完全再構築する。
 * 初回構築（init）および recalculateHeights で使用。
 * O(N log N) — DecorationSet.create の B-tree 構築コストを含む。
 */
function buildFullState(
  state: EditorState,
  viewport: ViewportRange,
  clearHeightCache: boolean,
): VirtualScrollPluginState {
  if (clearHeightCache) {
    invalidateHeightCache();
  }

  const heightAccum: HeightAccumEntry[] = [];
  const decorations: Decoration[] = [];
  const hiddenDecoMap = new Map<number, Decoration>();
  let accumulatedHeight = 0;

  state.doc.forEach((node, offset) => {
    const height = getEstimatedHeight(node, offset);
    const top = accumulatedHeight;
    const bottom = top + height;

    heightAccum.push({ offset, nodeSize: node.nodeSize, top, height });

    if (bottom < viewport.top || top > viewport.bottom) {
      const deco = createHiddenDecoration(offset, node.nodeSize, height);
      decorations.push(deco);
      hiddenDecoMap.set(offset, deco);
    }

    accumulatedHeight += height;
  });

  return {
    decoSet: DecorationSet.create(state.doc, decorations),
    hiddenDecoMap,
    heightAccum,
    viewport,
  };
}

/**
 * docChanged 時の差分更新。
 *
 * DecorationSet.map(tr.mapping) でデコレーションの位置をマッピングした後、
 * heightAccum を新しいドキュメントから再構築し、ビューポート境界の変化に
 * 対応してデコレーションの追加・削除を行う。
 *
 * これにより O(N log N) の DecorationSet.create() を回避し、
 * O(N) の走査 + O(K log N) の差分操作に削減する。
 */
function applyDocChangedUpdate(
  prevState: VirtualScrollPluginState,
  tr: Transaction,
  newState: EditorState,
  viewport: ViewportRange,
): VirtualScrollPluginState {
  invalidateHeightCache();

  // DecorationSet.map() でトランザクションのマッピングを適用
  // これにより挿入・削除によるオフセット変化がデコレーションに反映される
  const mappedDecoSet = prevState.decoSet.map(tr.mapping, newState.doc);

  // 新しいドキュメントから heightAccum を再構築
  const heightAccum: HeightAccumEntry[] = [];
  let accumulatedHeight = 0;

  // マッピング後の hiddenDecoMap を構築（オフセットを更新）
  const mappedHiddenOffsets = new Set<number>();
  for (const oldOffset of prevState.hiddenDecoMap.keys()) {
    const newOffset = tr.mapping.map(oldOffset);
    mappedHiddenOffsets.add(newOffset);
  }

  const toRemove: Decoration[] = [];
  const toAdd: Decoration[] = [];
  const newHiddenDecoMap = new Map<number, Decoration>();

  newState.doc.forEach((node, offset) => {
    const height = getEstimatedHeight(node, offset);
    const top = accumulatedHeight;
    const bottom = top + height;

    heightAccum.push({ offset, nodeSize: node.nodeSize, top, height });

    const shouldHide = bottom < viewport.top || top > viewport.bottom;
    const wasHidden = mappedHiddenOffsets.has(offset);

    if (shouldHide && !wasHidden) {
      // 新たに非表示になるノード → デコレーションを追加
      const deco = createHiddenDecoration(offset, node.nodeSize, height);
      toAdd.push(deco);
      newHiddenDecoMap.set(offset, deco);
    } else if (!shouldHide && wasHidden) {
      // 新たに表示されるノード → マッピング済みデコレーションから該当するものを削除
      // mappedDecoSet から offset 位置のデコレーションを探す
      const decos = mappedDecoSet.find(offset, offset + node.nodeSize);
      for (const d of decos) {
        if ((d as unknown as { from: number }).from === offset) {
          toRemove.push(d);
        }
      }
    } else if (shouldHide && wasHidden) {
      // 引き続き非表示 — mappedDecoSet に既にデコレーションがある
      // 高さが変わった場合はデコレーションを入れ替える
      const decos = mappedDecoSet.find(offset, offset + node.nodeSize);
      let existingDeco: Decoration | null = null;
      for (const d of decos) {
        if ((d as unknown as { from: number }).from === offset) {
          existingDeco = d;
          break;
        }
      }
      if (existingDeco) {
        const existingHeight = (existingDeco as unknown as { type: { attrs: Record<string, string> } }).type.attrs['data-estimated-height'];
        if (existingHeight !== String(height)) {
          toRemove.push(existingDeco);
          const deco = createHiddenDecoration(offset, node.nodeSize, height);
          toAdd.push(deco);
          newHiddenDecoMap.set(offset, deco);
        } else {
          newHiddenDecoMap.set(offset, existingDeco);
        }
      } else {
        // デコレーションが見つからない場合は新規作成
        const deco = createHiddenDecoration(offset, node.nodeSize, height);
        toAdd.push(deco);
        newHiddenDecoMap.set(offset, deco);
      }
    }
    // shouldHide === false && wasHidden === false → 何もしない

    accumulatedHeight += height;
  });

  let newDecoSet = mappedDecoSet;
  if (toRemove.length > 0 || toAdd.length > 0) {
    newDecoSet = mappedDecoSet.remove(toRemove).add(newState.doc, toAdd);
  }

  return {
    decoSet: newDecoSet,
    hiddenDecoMap: newHiddenDecoMap,
    heightAccum,
    viewport,
  };
}

/**
 * スクロール（viewportChanged）時のインクリメンタル差分更新。
 *
 * 既存の heightAccum を再利用し、ビューポート境界を通過したノードのみを
 * remove()/add() で更新する。
 * O(N) の走査 + O(K log N) の DecorationSet 操作（K = 境界通過ノード数）。
 *
 * 典型的なスクロールでは K = 1〜5 なので実質 O(log N)。
 */
function applyIncrementalViewportUpdate(
  prevState: VirtualScrollPluginState,
  doc: EditorState['doc'],
  viewport: ViewportRange,
): VirtualScrollPluginState {
  // heightAccum が無い（初期化直後等）場合はフォールバック
  if (!prevState.heightAccum) {
    return buildFullState({ doc } as EditorState, viewport, false);
  }

  const toRemove: Decoration[] = [];
  const toAdd: Decoration[] = [];
  const newHiddenDecoMap = new Map(prevState.hiddenDecoMap);

  for (const { offset, nodeSize, top, height } of prevState.heightAccum) {
    const bottom = top + height;
    const shouldHide = bottom < viewport.top || top > viewport.bottom;
    const wasHidden = prevState.hiddenDecoMap.has(offset);

    if (shouldHide && !wasHidden) {
      // 新たに非表示になるノード → デコレーションを追加
      const deco = createHiddenDecoration(offset, nodeSize, height);
      toAdd.push(deco);
      newHiddenDecoMap.set(offset, deco);
    } else if (!shouldHide && wasHidden) {
      // 新たに表示されるノード → デコレーションを削除
      toRemove.push(prevState.hiddenDecoMap.get(offset)!);
      newHiddenDecoMap.delete(offset);
    }
  }

  // 変化なし → 同一オブジェクトを返して ProseMirror の差分検出を最適化
  if (toRemove.length === 0 && toAdd.length === 0) {
    return { ...prevState, viewport };
  }

  const newDecoSet = prevState.decoSet.remove(toRemove).add(doc, toAdd);
  return {
    decoSet: newDecoSet,
    hiddenDecoMap: newHiddenDecoMap,
    heightAccum: prevState.heightAccum,
    viewport,
  };
}

/**
 * 高さキャッシュ更新後（recalculateHeights）に heightAccum を再構築して
 * デコレーションを再計算する。
 * スクロール停止後 200ms で 1 度だけ呼ばれるため O(N log N) でも許容できる。
 */
function rebuildHeightsAndApply(
  state: EditorState,
  viewport: ViewportRange,
): VirtualScrollPluginState {
  const heightAccum: HeightAccumEntry[] = [];
  const decorations: Decoration[] = [];
  const hiddenDecoMap = new Map<number, Decoration>();
  let accumulatedHeight = 0;

  state.doc.forEach((node, offset) => {
    const height = getEstimatedHeight(node, offset);
    const top = accumulatedHeight;
    const bottom = top + height;

    heightAccum.push({ offset, nodeSize: node.nodeSize, top, height });

    if (bottom < viewport.top || top > viewport.bottom) {
      const deco = createHiddenDecoration(offset, node.nodeSize, height);
      decorations.push(deco);
      hiddenDecoMap.set(offset, deco);
    }

    accumulatedHeight += height;
  });

  return {
    decoSet: DecorationSet.create(state.doc, decorations),
    hiddenDecoMap,
    heightAccum,
    viewport,
  };
}

/**
 * ノード数に応じた適応スロットル関数を生成する。
 * getNodeCount() を呼び出してリアルタイムのノード数に基づきスロットル間隔を決定する。
 */
function makeAdaptiveThrottle(
  fn: () => void,
  getNodeCount: () => number,
): () => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    const ms = getScrollThrottleMs(getNodeCount());
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn();
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn();
      }, remaining);
    }
  };
}

export interface VirtualScrollOptions {
  /** 仮想スクロールを有効にする閾値（ノード数） */
  nodeThreshold: number;
}

/**
 * 仮想スクロール拡張。
 * ドキュメントのノード数が閾値以上の場合にビューポート外ノードの DOM を最小化する。
 */
export const VirtualScrollExtension = Extension.create<VirtualScrollOptions>({
  name: 'virtualScroll',

  addOptions() {
    return {
      nodeThreshold: 500,
    };
  },

  addProseMirrorPlugins() {
    const threshold = this.options.nodeThreshold;

    return [
      new Plugin({
        key: pluginKey,

        state: {
          init(_: unknown, state: EditorState): VirtualScrollPluginState {
            if (state.doc.childCount < threshold) {
              return { ...EMPTY_PLUGIN_STATE };
            }
            const viewport = getViewportRange(null);
            return buildFullState(state, viewport, false);
          },

          apply(
            tr: Transaction,
            oldPluginState: VirtualScrollPluginState,
            _oldState: EditorState,
            newState: EditorState,
          ): VirtualScrollPluginState {
            if (newState.doc.childCount < threshold) {
              return { ...EMPTY_PLUGIN_STATE };
            }

            const scrollContainer = tr.getMeta('scrollContainer') as Element | null ?? null;
            const viewport = getViewportRange(scrollContainer);

            if (tr.docChanged) {
              // ドキュメント変更: DecorationSet.map() + heightAccum 差分再構築
              // 以前の状態がある場合は差分更新、なければフル構築
              if (oldPluginState.heightAccum) {
                return applyDocChangedUpdate(oldPluginState, tr, newState, viewport);
              }
              return buildFullState(newState, viewport, true);
            }

            if (tr.getMeta('recalculateHeights')) {
              // スクロール停止後の高さ再計測: heightAccum 再構築 + 全デコレーション更新
              return rebuildHeightsAndApply(newState, viewport);
            }

            if (tr.getMeta('viewportChanged')) {
              // スクロール: インクリメンタル差分更新（★ 主要最適化）
              return applyIncrementalViewportUpdate(oldPluginState, newState.doc, viewport);
            }

            return oldPluginState;
          },
        },

        view(editorView: EditorView) {
          let scrollContainer: HTMLElement | null = null;
          let detectTimer: ReturnType<typeof setInterval> | null = null;
          let detectRetries = 0;
          let postDocChangeTimer: ReturnType<typeof setTimeout> | null = null;

          // 適応スロットル付きスクロールハンドラ
          const dispatchScroll = () => {
            if (editorView.isDestroyed) return;
            if (editorView.state.doc.childCount < threshold) return;
            editorView.dispatch(
              editorView.state.tr
                .setMeta('viewportChanged', true)
                .setMeta('scrollContainer', scrollContainer),
            );
          };

          // ノード数に応じてスロットル間隔を動的調整
          const handleScroll = makeAdaptiveThrottle(
            dispatchScroll,
            () => editorView.state.doc.childCount,
          );

          // スクロール終了後に高さキャッシュを更新
          let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
          const handleScrollEnd = () => {
            if (scrollEndTimer) clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
              if (editorView.isDestroyed) return;
              if (editorView.state.doc.childCount < threshold) return;

              recalculateVisibleHeights(editorView, scrollContainer);

              editorView.dispatch(
                editorView.state.tr
                  .setMeta('recalculateHeights', true)
                  .setMeta('scrollContainer', scrollContainer),
              );
            }, SCROLL_END_DEBOUNCE_MS);
          };

          const attachListeners = (container: HTMLElement) => {
            container.addEventListener('scroll', handleScroll as EventListener, { passive: true });
            container.addEventListener('scroll', handleScrollEnd as EventListener, { passive: true });
          };

          const detachListeners = (container: HTMLElement) => {
            container.removeEventListener('scroll', handleScroll as EventListener);
            container.removeEventListener('scroll', handleScrollEnd as EventListener);
          };

          const dispatchViewportRecalc = () => {
            if (editorView.isDestroyed) return;
            if (editorView.state.doc.childCount < threshold) return;
            editorView.dispatch(
              editorView.state.tr
                .setMeta('viewportChanged', true)
                .setMeta('scrollContainer', scrollContainer),
            );
          };

          const tryDetectContainer = () => {
            if (editorView.isDestroyed) return true;

            const found = findScrollContainer(editorView);
            if (!found) return false;

            scrollContainer = found;
            attachListeners(scrollContainer);

            if (editorView.state.doc.childCount >= threshold) {
              window.requestAnimationFrame(() => {
                if (!editorView.isDestroyed) {
                  dispatchViewportRecalc();
                }
              });
            }

            return true;
          };

          if (!tryDetectContainer()) {
            detectTimer = setInterval(() => {
              detectRetries++;
              if (tryDetectContainer() || detectRetries >= CONTAINER_DETECT_MAX_RETRIES) {
                if (detectTimer) {
                  clearInterval(detectTimer);
                  detectTimer = null;
                }
              }
            }, CONTAINER_DETECT_INTERVAL_MS);
          }

          return {
            update(view: EditorView, prevState: EditorState) {
              if (view.state.doc !== prevState.doc && view.state.doc.childCount >= threshold) {
                if (!scrollContainer) {
                  tryDetectContainer();
                }

                if (postDocChangeTimer) clearTimeout(postDocChangeTimer);
                postDocChangeTimer = setTimeout(() => {
                  postDocChangeTimer = null;
                  dispatchViewportRecalc();
                  setTimeout(() => {
                    if (!editorView.isDestroyed && scrollContainer) {
                      recalculateVisibleHeights(view, scrollContainer);
                      dispatchViewportRecalc();
                    }
                  }, SCROLL_END_DEBOUNCE_MS);
                }, POST_DOC_CHANGE_RECALC_DELAY_MS);
              }
            },

            destroy() {
              if (detectTimer) {
                clearInterval(detectTimer);
              }
              if (postDocChangeTimer) {
                clearTimeout(postDocChangeTimer);
              }
              if (scrollContainer) {
                detachListeners(scrollContainer);
              }
              if (scrollEndTimer) clearTimeout(scrollEndTimer);
            },
          };
        },

        props: {
          decorations(state: EditorState): DecorationSet | undefined {
            const pluginState = pluginKey.getState(state) as VirtualScrollPluginState | undefined;
            return pluginState?.decoSet;
          },
        },
      }),
    ];
  },
});

/**
 * ビューポート内の表示されているノードの実測高さをキャッシュする。
 * スクロール終了後に呼ばれ、推定値を実測値で更新する。
 *
 * P2 最適化: プラグイン状態の heightAccum を利用してビューポート内のノードのみを
 * 効率的に特定し、全ノード走査での高さ累積計算を回避する。
 */
function recalculateVisibleHeights(
  editorView: EditorView,
  scrollContainer: Element | null,
): void {
  const viewport = getViewportRange(scrollContainer);
  const pluginState = pluginKey.getState(editorView.state) as VirtualScrollPluginState | undefined;

  // heightAccum がある場合はそれを利用して全ノード走査を回避
  if (pluginState?.heightAccum) {
    for (const { offset, top, height } of pluginState.heightAccum) {
      const bottom = top + height;
      // ビューポート外のノードはスキップ
      if (bottom < viewport.top) continue;
      if (top > viewport.bottom) break; // heightAccum はソート済みなので早期終了可能

      try {
        const domNode = editorView.nodeDOM(offset);
        if (domNode instanceof HTMLElement) {
          const node = editorView.state.doc.nodeAt(offset);
          if (node) {
            updateHeightCache(node, offset, domNode);
          }
        }
      } catch {
        // nodeDOM が失敗するケースは無視（ノードが破棄済み等）
      }
    }
    return;
  }

  // フォールバック: heightAccum がない場合は全ノード走査（従来動作）
  const doc = editorView.state.doc;
  let accumulatedHeight = 0;

  doc.forEach((node, offset) => {
    const nodeHeight = getEstimatedHeight(node, offset);
    const nodeTop = accumulatedHeight;
    const nodeBottom = nodeTop + nodeHeight;
    accumulatedHeight += nodeHeight;

    if (nodeBottom >= viewport.top && nodeTop <= viewport.bottom) {
      try {
        const domNode = editorView.nodeDOM(offset);
        if (domNode instanceof HTMLElement) {
          updateHeightCache(node, offset, domNode);
        }
      } catch {
        // nodeDOM が失敗するケースは無視（ノードが破棄済み等）
      }
    }
  });
}
