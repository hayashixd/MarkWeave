/**
 * ブロックドラッグハンドル拡張
 *
 * ホバー時に各トップレベルブロックの左側に ⠿ ハンドルを表示し、
 * ポインターイベントベースのドラッグ&ドロップでブロックを並び替える。
 *
 * 実装方針:
 * - ProseMirror Plugin として実装（TipTap Extension 経由）
 * - DOM PointerEvents で drag 検知（HTML5 DragEvent は使わない）
 * - setPointerCapture でエディタ外に出ても追跡
 * - ドラッグ中は水平ラインでドロップ先を表示
 * - drop 時に ProseMirror transaction でブロックを移動
 *
 * 考慮事項:
 * - readOnly 時はハンドル非表示 (view.editable チェック)
 * - source モード時は EditorContent が非表示のため自然に無効化
 * - ネストしたブロック（リスト内段落等）は最上位ブロックのみ対象
 * - IME は drag と無関係なのでガード不要
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const DRAG_HANDLE_KEY = new PluginKey('blockDragHandle');

interface BlockInfo {
  node: ProseMirrorNode;
  from: number; // position before the block's opening token
  to: number;   // from + nodeSize
}

interface DragState {
  blockInfo: BlockInfo;
  dropPos: number;        // insertion position (adjusted after delete)
  dropAbsPos: number;     // original document position before deletion
  dropLineEl: HTMLElement | null;
}

// モジュールレベルの状態（TipTap と同一パターン: TableDragExtension 参照）
let handleEl: HTMLElement | null = null;
let activeView: EditorView | null = null;
let currentBlockInfo: BlockInfo | null = null;
let activeDrag: DragState | null = null;

// ============================================================
// DOM ヘルパー
// ============================================================

function removeHandle() {
  if (handleEl) {
    handleEl.remove();
    handleEl = null;
  }
  currentBlockInfo = null;
}

function removeDropLine() {
  if (activeDrag?.dropLineEl) {
    activeDrag.dropLineEl.remove();
    activeDrag.dropLineEl = null;
  }
}

function cleanup() {
  removeDropLine();
  handleEl?.classList.remove('block-drag-handle--dragging');
  activeDrag = null;
}

/**
 * クライアント座標からトップレベルブロックを解決する。
 * elementFromPoint → エディタ直下の要素まで walk up → posAtDOM で pos 解決。
 */
function resolveTopLevelBlock(
  view: EditorView,
  clientX: number,
  clientY: number,
): BlockInfo | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!el) return null;

  // ハンドル自身やドロップラインは無視
  if (el.classList.contains('block-drag-handle') || el.classList.contains('block-drag-drop-indicator')) {
    return currentBlockInfo;
  }

  // エディタ直下の要素まで walk up
  let blockEl = el;
  while (blockEl.parentElement && blockEl.parentElement !== view.dom) {
    blockEl = blockEl.parentElement as HTMLElement;
  }
  if (blockEl.parentElement !== view.dom) return null;

  try {
    const pos = view.posAtDOM(blockEl, 0);
    const resolved = view.state.doc.resolve(pos);
    if (resolved.depth < 1) return null;

    const node = resolved.node(1);
    const from = resolved.before(1);
    const to = from + node.nodeSize;

    return { node, from, to };
  } catch {
    return null;
  }
}

/**
 * ブロック DOM 要素の getBoundingClientRect を返す。
 * ブロック情報から DOM 要素を逆引きする。
 */
function getBlockRect(view: EditorView, blockInfo: BlockInfo): DOMRect | null {
  try {
    const domAtPos = view.domAtPos(blockInfo.from + 1);
    let el = domAtPos.node as HTMLElement;
    if (el.nodeType === Node.TEXT_NODE) {
      el = el.parentElement as HTMLElement;
    }
    // エディタ直下まで walk up
    while (el.parentElement && el.parentElement !== view.dom) {
      el = el.parentElement as HTMLElement;
    }
    if (el.parentElement !== view.dom) return null;
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

/** ドロップインジケーターライン要素を作成 */
function createDropLine(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'block-drag-drop-indicator';
  document.body.appendChild(line);
  return line;
}

/**
 * ドロップ先を解決してインジケーターラインを更新する。
 * @returns ドロップ先の絶対 pos（blockInfo の from/to ベース）
 */
function updateDropIndicator(
  view: EditorView,
  clientX: number,
  clientY: number,
  dragBlockInfo: BlockInfo,
): number | null {
  const target = resolveTopLevelBlock(view, clientX, clientY);
  if (!target) return null;

  // ドラッグ元ブロック自身の場合はスキップ
  if (target.from === dragBlockInfo.from) return null;

  const rect = getBlockRect(view, target);
  if (!rect) return null;

  const isUpperHalf = clientY < rect.top + rect.height / 2;
  const dropAbsPos = isUpperHalf ? target.from : target.to;
  const lineY = isUpperHalf ? rect.top : rect.bottom;

  if (activeDrag?.dropLineEl) {
    const editorRect = view.dom.getBoundingClientRect();
    const lineEl = activeDrag.dropLineEl;
    lineEl.style.cssText = `
      position: fixed;
      left: ${editorRect.left}px;
      top: ${lineY - 1}px;
      width: ${editorRect.width}px;
      height: 2px;
      background: var(--color-accent, #3b82f6);
      pointer-events: none;
      z-index: 200;
      border-radius: 1px;
    `;
  }

  return dropAbsPos;
}

// ============================================================
// ハンドル要素の初期化（一度だけ、view が確定したタイミングで作成）
// ============================================================

function ensureHandle(_view: EditorView): HTMLElement {
  if (handleEl) return handleEl;

  const el = document.createElement('div');
  el.className = 'block-drag-handle';
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('title', 'ドラッグして並び替え');
  el.innerHTML =
    '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="3" cy="3.5" r="1.5"/><circle cx="7" cy="3.5" r="1.5"/>' +
    '<circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>' +
    '<circle cx="3" cy="12.5" r="1.5"/><circle cx="7" cy="12.5" r="1.5"/>' +
    '</svg>';
  document.body.appendChild(el);

  // ハンドルからエディタへのマウス移動では消さない
  el.addEventListener('mouseleave', () => {
    if (!activeDrag) removeHandle();
  });

  // ドラッグ開始
  el.addEventListener('pointerdown', (pe: PointerEvent) => {
    if (!currentBlockInfo || !activeView) return;
    pe.preventDefault();
    pe.stopPropagation();

    el.setPointerCapture(pe.pointerId);

    const line = createDropLine();
    activeDrag = {
      blockInfo: currentBlockInfo,
      dropPos: currentBlockInfo.from,
      dropAbsPos: currentBlockInfo.from,
      dropLineEl: line,
    };
    el.classList.add('block-drag-handle--dragging');
  });

  // ドラッグ中: ドロップ先を更新
  el.addEventListener('pointermove', (pe: PointerEvent) => {
    if (!activeDrag || !activeView) return;

    const absPos = updateDropIndicator(activeView, pe.clientX, pe.clientY, activeDrag.blockInfo);
    if (absPos !== null) {
      activeDrag.dropAbsPos = absPos;
    }
  });

  // ドロップ: ブロックを移動
  el.addEventListener('pointerup', (_pe: PointerEvent) => {
    if (!activeDrag || !activeView) {
      cleanup();
      return;
    }

    const { blockInfo, dropAbsPos } = activeDrag;
    cleanup();
    removeHandle();

    // ドロップ先がドラッグ元ブロックと同じなら何もしない
    if (dropAbsPos === blockInfo.from || dropAbsPos === blockInfo.to) return;

    const { from, to, node } = blockInfo;
    const tr = activeView.state.tr;

    // 削除後の pos を計算
    // dropAbsPos が to より後にある場合: 削除で前にずれる
    let insertPos = dropAbsPos;
    if (dropAbsPos > to) {
      insertPos = dropAbsPos - node.nodeSize;
    }
    // dropAbsPos が from 以前: ずれなし

    tr.delete(from, to);
    tr.insert(insertPos, node);
    activeView.dispatch(tr);
  });

  // キャンセル
  el.addEventListener('pointercancel', () => {
    cleanup();
    removeHandle();
  });

  handleEl = el;
  return el;
}

// ============================================================
// Extension
// ============================================================

export const DragHandleExtension = Extension.create({
  name: 'blockDragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: DRAG_HANDLE_KEY,

        props: {
          handleDOMEvents: {
            /**
             * マウス移動: ブロックを検出してハンドルを表示・移動する
             */
            mousemove(view: EditorView, event: Event) {
              if (!view.editable || activeDrag) return false;

              const e = event as MouseEvent;
              activeView = view;

              const block = resolveTopLevelBlock(view, e.clientX, e.clientY);
              if (!block) {
                // カーソルがブロック外（エディタ余白など）に来たら非表示
                removeHandle();
                return false;
              }

              // 同じブロックなら位置だけ更新
              const sameBlock = currentBlockInfo?.from === block.from;
              currentBlockInfo = block;

              const handle = ensureHandle(view);

              if (!sameBlock) {
                // ブロックが変わったら位置を再計算
                const rect = getBlockRect(view, block);
                if (!rect) {
                  removeHandle();
                  return false;
                }
                handle.style.cssText = `
                  position: fixed;
                  left: ${rect.left - 26}px;
                  top: ${rect.top + rect.height / 2 - 8}px;
                  z-index: 50;
                  cursor: grab;
                `;
              }

              return false;
            },

            /**
             * エディタ領域からマウスが出たらハンドルを非表示にする
             */
            mouseleave(_view: EditorView, event: Event) {
              const e = event as MouseEvent;
              const relatedTarget = e.relatedTarget as HTMLElement | null;
              // ハンドルへのマウス移動では消さない
              if (relatedTarget && handleEl?.contains(relatedTarget)) return false;
              if (!activeDrag) removeHandle();
              return false;
            },
          },
        },
      }),
    ];
  },
});
