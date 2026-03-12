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
 * - 入力レイテンシ < 16ms を維持するため、スクロールイベントは 100ms スロットル
 * - IME 入力中のトランザクションは通常通り処理（仮想スクロールはデコレーションのみ）
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

/** スクロールイベントのスロットル間隔（ms） */
const SCROLL_THROTTLE_MS = 100;

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
 * スクロールコンテナからビューポート範囲を取得する。
 * エディタのラッパー div（overflow-y-auto）を scrollContainer として使用。
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
  // editorView.dom がドキュメントに接続されていない場合は検出不可
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

  // フォールバック: 祖先を走査して実際にスクロール可能な要素を探す。
  // レイアウト差異（SplitEditor など）で専用クラスが無い場合でも動作させる。
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
 * ビューポート外のトップレベルノードに hidden デコレーションを付与する。
 */
function buildDecorations(
  state: EditorState,
  viewport: ViewportRange,
  docChanged: boolean,
): DecorationSet {
  if (docChanged) {
    invalidateHeightCache();
  }

  const decorations: Decoration[] = [];
  let accumulatedHeight = 0;

  state.doc.forEach((node, offset) => {
    const nodeHeight = getEstimatedHeight(node, offset);
    const nodeTop = accumulatedHeight;
    const nodeBottom = nodeTop + nodeHeight;

    if (nodeBottom < viewport.top || nodeTop > viewport.bottom) {
      // ビューポート外: hidden デコレーションを付与
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'virtual-scroll-hidden',
          style: `height: ${nodeHeight}px; min-height: ${nodeHeight}px; overflow: hidden; contain: strict;`,
          'data-virtually-hidden': 'true',
          'data-estimated-height': String(nodeHeight),
        }),
      );
    }

    accumulatedHeight += nodeHeight;
  });

  return DecorationSet.create(state.doc, decorations);
}

/** シンプルなスロットル関数 */
function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    const now = Date.now();
    const remaining = ms - (now - lastCall);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
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
          init(_: unknown, state: EditorState): DecorationSet {
            // 初期化時: ノード数が閾値未満なら空のデコレーション
            if (state.doc.childCount < threshold) {
              return DecorationSet.empty;
            }
            return buildDecorations(state, getViewportRange(null), false);
          },

          apply(
            tr: Transaction,
            oldDecos: DecorationSet,
            _oldState: EditorState,
            newState: EditorState,
          ): DecorationSet {
            // ノード数が閾値未満なら無効化
            if (newState.doc.childCount < threshold) {
              return DecorationSet.empty;
            }

            // ドキュメント変更またはビューポート変更時にデコレーション再構築
            if (tr.docChanged || tr.getMeta('viewportChanged') || tr.getMeta('recalculateHeights')) {
              const scrollContainer = tr.getMeta('scrollContainer') as Element | null ?? null;
              return buildDecorations(newState, getViewportRange(scrollContainer), tr.docChanged);
            }

            // ドキュメント変更なし・ビューポート変更なし → 前回のデコレーションを再利用
            return oldDecos;
          },
        },

        view(editorView: EditorView) {
          // スクロールコンテナの遅延検出:
          // useEditor() が DOM 接続前に EditorView を作成するため、
          // view() 時点ではスクロールコンテナが見つからないことがある。
          // リトライ付きの遅延検出で DOM マウント後にスクロールハンドラを接続する。
          let scrollContainer: HTMLElement | null = null;
          let detectTimer: ReturnType<typeof setInterval> | null = null;
          let detectRetries = 0;
          let postDocChangeTimer: ReturnType<typeof setTimeout> | null = null;

          // スクロールイベントで仮想スクロールを更新
          const handleScroll = throttle(() => {
            if (editorView.isDestroyed) return;
            if (editorView.state.doc.childCount < threshold) return;
            editorView.dispatch(
              editorView.state.tr
                .setMeta('viewportChanged', true)
                .setMeta('scrollContainer', scrollContainer),
            );
          }, SCROLL_THROTTLE_MS);

          // スクロール終了後に高さキャッシュを更新
          let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
          const handleScrollEnd = () => {
            if (scrollEndTimer) clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(() => {
              if (editorView.isDestroyed) return;
              if (editorView.state.doc.childCount < threshold) return;

              // ビューポート内の全ノードの実測高さをキャッシュ
              recalculateVisibleHeights(editorView, scrollContainer);

              editorView.dispatch(
                editorView.state.tr
                  .setMeta('recalculateHeights', true)
                  .setMeta('scrollContainer', scrollContainer),
              );
            }, SCROLL_END_DEBOUNCE_MS);
          };

          /** スクロールコンテナにイベントリスナーを接続する */
          const attachListeners = (container: HTMLElement) => {
            container.addEventListener('scroll', handleScroll as EventListener, { passive: true });
            container.addEventListener('scroll', handleScrollEnd as EventListener, { passive: true });
          };

          /** スクロールコンテナからイベントリスナーを解除する */
          const detachListeners = (container: HTMLElement) => {
            container.removeEventListener('scroll', handleScroll as EventListener);
            container.removeEventListener('scroll', handleScrollEnd as EventListener);
          };

          /** ビューポートを再計算するトランザクションをディスパッチする */
          const dispatchViewportRecalc = () => {
            if (editorView.isDestroyed) return;
            if (editorView.state.doc.childCount < threshold) return;
            editorView.dispatch(
              editorView.state.tr
                .setMeta('viewportChanged', true)
                .setMeta('scrollContainer', scrollContainer),
            );
          };

          /**
           * スクロールコンテナの検出を試みる。
           * 見つかったらリスナーを接続し、初回ビューポート再計算を実行する。
           */
          const tryDetectContainer = () => {
            if (editorView.isDestroyed) return true; // stop retrying

            const found = findScrollContainer(editorView);
            if (!found) return false;

            scrollContainer = found;
            attachListeners(scrollContainer);

            // 初回ビューポート再計算
            if (editorView.state.doc.childCount >= threshold) {
              // RAF で次フレームに実行し、レイアウト確定後の正確なビューポートを使う
              window.requestAnimationFrame(() => {
                if (!editorView.isDestroyed) {
                  dispatchViewportRecalc();
                }
              });
            }

            return true;
          };

          // 即座に検出を試みる
          if (!tryDetectContainer()) {
            // DOM 未接続の場合、定期的にリトライ
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
              // ドキュメントが変更され、かつ閾値を超えている場合、
              // 遅延後にビューポート再計算をスケジュールする。
              // setContent/paste 後に正しいスクロール位置でデコレーションを再構築するため。
              if (view.state.doc !== prevState.doc && view.state.doc.childCount >= threshold) {
                // スクロールコンテナが未検出なら再検出を試みる
                if (!scrollContainer) {
                  tryDetectContainer();
                }

                if (postDocChangeTimer) clearTimeout(postDocChangeTimer);
                postDocChangeTimer = setTimeout(() => {
                  postDocChangeTimer = null;
                  dispatchViewportRecalc();
                  // 実測高さを取得して精度を上げる
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
            return pluginKey.getState(state) as DecorationSet | undefined;
          },
        },
      }),
    ];
  },
});

/**
 * ビューポート内の表示されているノードの実測高さをキャッシュする。
 * スクロール終了後に呼ばれ、推定値を実測値で更新する。
 */
function recalculateVisibleHeights(
  editorView: EditorView,
  scrollContainer: Element | null,
): void {
  const viewport = getViewportRange(scrollContainer);
  const doc = editorView.state.doc;
  let accumulatedHeight = 0;

  doc.forEach((node, offset) => {
    const nodeHeight = getEstimatedHeight(node, offset);
    const nodeTop = accumulatedHeight;
    const nodeBottom = nodeTop + nodeHeight;
    accumulatedHeight += nodeHeight;

    // ビューポート内のノードのみ実測
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
