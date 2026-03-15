/**
 * テーブル行・列ドラッグ&ドロップ並び替え拡張
 *
 * PointerEvents ベースで行・列のドラッグ&ドロップ並び替えを実装する。
 * テーブルのセルにホバーすると行ハンドル・列ハンドルが表示され、
 * ドラッグ操作で並び替えができる。
 *
 * Phase 2: 行のドラッグ&ドロップ並び替え / 列のドラッグ&ドロップ並び替え
 *
 * 実装方針:
 * - ProseMirror Plugin として実装（TipTap Extension 経由）
 * - DOM PointerEvents で drag 検知
 * - ドラッグ中はゴースト行/列ハイライトを表示
 * - drop 時に ProseMirror transaction で行/列を入れ替え
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const TABLE_DRAG_KEY = new PluginKey('tableDrag');

/** テーブル内の位置情報 */
interface TablePos {
  /** テーブルノード自体の pos */
  tableStart: number;
  tableNode: ProseMirrorNode;
  /** 対象の行インデックス（-1: 列操作） */
  rowIndex: number;
  /** 対象の列インデックス（-1: 行操作） */
  colIndex: number;
}

/** ドラッグ中の状態 */
interface DragState {
  type: 'row' | 'col';
  fromIndex: number;
  toIndex: number;
  tableStart: number;
  tableNode: ProseMirrorNode;
  /** ゴーストハイライト要素 */
  ghostEl: HTMLElement | null;
}

let currentDrag: DragState | null = null;

/**
 * テーブル行を `fromIndex` から `toIndex` に移動する ProseMirror transaction を返す。
 * ヘッダー行（index 0）は移動対象から除外する。
 */
function moveTableRow(
  view: EditorView,
  tableStart: number,
  tableNode: ProseMirrorNode,
  fromIndex: number,
  toIndex: number,
): boolean {
  if (fromIndex === toIndex) return false;
  if (fromIndex === 0 || toIndex === 0) return false; // ヘッダー行は不可

  const rowCount = tableNode.childCount;
  if (fromIndex < 0 || fromIndex >= rowCount) return false;
  if (toIndex < 0 || toIndex >= rowCount) return false;

  const { tr } = view.state;
  const rows: ProseMirrorNode[] = [];
  tableNode.forEach((row) => rows.push(row));

  // 行を入れ替え
  const moved = rows.splice(fromIndex, 1)[0]!;
  rows.splice(toIndex, 0, moved);

  // テーブルノードを再構築
  const newTable = tableNode.type.create(tableNode.attrs, rows);
  tr.replaceWith(tableStart - 1, tableStart - 1 + tableNode.nodeSize, newTable);

  view.dispatch(tr);
  return true;
}

/**
 * テーブル列を `fromIndex` から `toIndex` に移動する ProseMirror transaction を返す。
 */
function moveTableCol(
  view: EditorView,
  tableStart: number,
  tableNode: ProseMirrorNode,
  fromIndex: number,
  toIndex: number,
): boolean {
  if (fromIndex === toIndex) return false;

  const { tr } = view.state;
  const newRows: ProseMirrorNode[] = [];

  tableNode.forEach((row) => {
    const cells: ProseMirrorNode[] = [];
    row.forEach((cell) => cells.push(cell));

    if (fromIndex < 0 || fromIndex >= cells.length) {
      newRows.push(row);
      return;
    }

    const moved = cells.splice(fromIndex, 1)[0]!;
    cells.splice(toIndex, 0, moved);

    newRows.push(row.type.create(row.attrs, cells));
  });

  const newTable = tableNode.type.create(tableNode.attrs, newRows);
  tr.replaceWith(tableStart - 1, tableStart - 1 + tableNode.nodeSize, newTable);

  view.dispatch(tr);
  return true;
}

/**
 * クリック位置からテーブルの行・列インデックスを解決する。
 */
function resolveTablePos(view: EditorView, event: MouseEvent): TablePos | null {
  const target = event.target as HTMLElement;
  const cellEl = target.closest('td, th') as HTMLElement | null;
  if (!cellEl) return null;

  const tableEl = cellEl.closest('table') as HTMLElement | null;
  if (!tableEl) return null;

  // DOM の位置から ProseMirror の pos を解決
  const pos = view.posAtDOM(cellEl, 0);
  if (pos < 0) return null;

  const resolved = view.state.doc.resolve(pos);

  // テーブルノードまで上に辿る
  let tableStart = -1;
  let tableNode: ProseMirrorNode | null = null;

  for (let depth = resolved.depth; depth >= 0; depth--) {
    const node = resolved.node(depth);
    if (node.type.name === 'table') {
      tableStart = resolved.start(depth);
      tableNode = node;
      break;
    }
  }

  if (!tableNode || tableStart < 0) return null;

  // rowIndex: テーブル内の何行目か
  const tableRows = Array.from(tableEl.querySelectorAll<HTMLTableRowElement>('tr'));
  const rowEl = cellEl.closest('tr') as HTMLTableRowElement | null;
  const rowIndex = rowEl ? tableRows.indexOf(rowEl) : -1;

  // colIndex: 行内の何列目か
  const rowCells = rowEl ? Array.from(rowEl.querySelectorAll('td, th')) : [];
  const colIndex = rowCells.indexOf(cellEl);

  return { tableStart, tableNode, rowIndex, colIndex };
}

/**
 * ゴーストハイライトを作成する（ドラッグ中の視覚フィードバック）
 */
function createGhost(rect: DOMRect, type: 'row' | 'col'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'table-drag-ghost';
  el.style.cssText = `
    position: fixed;
    background: rgba(59, 130, 246, 0.15);
    border: 2px dashed #3b82f6;
    border-radius: 2px;
    pointer-events: none;
    z-index: 9999;
    transition: none;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${type === 'row' ? rect.width : rect.width}px;
    height: ${type === 'col' ? rect.height : rect.height}px;
  `;
  document.body.appendChild(el);
  return el;
}

/**
 * ドラッグハンドル要素を作成する
 */
function createHandle(type: 'row' | 'col', rect: DOMRect): HTMLElement {
  const handle = document.createElement('div');
  handle.className = `table-drag-handle table-drag-handle--${type}`;
  handle.setAttribute('data-drag-type', type);
  handle.title = type === 'row' ? '行をドラッグして並び替え' : '列をドラッグして並び替え';

  if (type === 'row') {
    handle.style.cssText = `
      position: fixed;
      left: ${rect.left - 20}px;
      top: ${rect.top + rect.height / 2 - 8}px;
      width: 16px;
      height: 16px;
      cursor: grab;
      z-index: 100;
    `;
  } else {
    handle.style.cssText = `
      position: fixed;
      left: ${rect.left + rect.width / 2 - 8}px;
      top: ${rect.top - 20}px;
      width: 16px;
      height: 16px;
      cursor: grab;
      z-index: 100;
    `;
  }

  handle.innerHTML = type === 'row'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="#9ca3af"><circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="#9ca3af"><circle cx="4" cy="5" r="1.5"/><circle cx="4" cy="11" r="1.5"/><circle cx="8" cy="5" r="1.5"/><circle cx="8" cy="11" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="11" r="1.5"/></svg>';

  document.body.appendChild(handle);
  return handle;
}

/** 現在表示中のハンドル要素 */
let currentHandles: HTMLElement[] = [];

function removeHandles() {
  currentHandles.forEach((h) => h.remove());
  currentHandles = [];
}

function removeGhost() {
  if (currentDrag?.ghostEl) {
    currentDrag.ghostEl.remove();
    currentDrag = null;
  }
}

export const TableDragExtension = Extension.create({
  name: 'tableDrag',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: TABLE_DRAG_KEY,

        props: {
          handleDOMEvents: {
            /**
             * セルにカーソルが入ったときドラッグハンドルを表示する
             */
            mouseover(view: EditorView, event: Event) {
              const mouseEvent = event as MouseEvent;
              const target = mouseEvent.target as HTMLElement;
              const cellEl = target.closest('td, th') as HTMLElement | null;
              if (!cellEl) {
                removeHandles();
                return false;
              }

              // ハンドルが既に対象セルのものなら再作成しない
              if (
                currentHandles.length > 0 &&
                currentHandles[0]?.dataset.targetCell === cellEl.dataset.tableDragCell
              ) {
                return false;
              }

              removeHandles();

              const tableEl = cellEl.closest('table');
              if (!tableEl) return false;

              // ヘッダー行の行ドラッグは禁止（th の tr の rowIndex が 0 かチェック）
              const rowEl = cellEl.closest('tr') as HTMLTableRowElement | null;
              const tableRows = tableEl.querySelectorAll('tr');
              const rowIndex = rowEl ? Array.from(tableRows).indexOf(rowEl) : -1;

              const cellRect = cellEl.getBoundingClientRect();

              // 行ハンドル（ヘッダー行以外）
              if (rowIndex > 0) {
                const rowHandle = createHandle('row', cellRect);
                rowHandle.dataset.targetCell = String(rowIndex);

                rowHandle.addEventListener('pointerdown', (e) => {
                  e.preventDefault();
                  const tablePos = resolveTablePos(view, mouseEvent);
                  if (!tablePos) return;

                  const rowRect = rowEl?.getBoundingClientRect();
                  const ghost = rowRect ? createGhost(rowRect, 'row') : null;

                  currentDrag = {
                    type: 'row',
                    fromIndex: rowIndex,
                    toIndex: rowIndex,
                    tableStart: tablePos.tableStart,
                    tableNode: tablePos.tableNode,
                    ghostEl: ghost,
                  };

                  rowHandle.style.cursor = 'grabbing';
                });

                currentHandles.push(rowHandle);
              }

              // 列ハンドル（全行）
              const colHandle = createHandle('col', cellRect);
              const colIndex = rowEl
                ? Array.from(rowEl.querySelectorAll('td, th')).indexOf(cellEl)
                : -1;
              colHandle.dataset.targetCell = `col-${colIndex}`;

              colHandle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const tablePos = resolveTablePos(view, mouseEvent);
                if (!tablePos) return;

                const colRect = cellEl.getBoundingClientRect();
                const ghost = createGhost(
                  new DOMRect(colRect.left, tableEl.getBoundingClientRect().top, colRect.width, tableEl.getBoundingClientRect().height),
                  'col',
                );

                currentDrag = {
                  type: 'col',
                  fromIndex: colIndex,
                  toIndex: colIndex,
                  tableStart: tablePos.tableStart,
                  tableNode: tablePos.tableNode,
                  ghostEl: ghost,
                };

                colHandle.style.cursor = 'grabbing';
              });

              currentHandles.push(colHandle);

              return false;
            },

            mouseleave(_view: EditorView, event: Event) {
              const mouseEvent = event as MouseEvent;
              const relatedTarget = mouseEvent.relatedTarget as HTMLElement | null;
              // ハンドル自体へのマウス移動では消さない
              if (
                relatedTarget &&
                currentHandles.some((h) => h.contains(relatedTarget))
              ) {
                return false;
              }
              if (currentDrag) return false; // ドラッグ中は消さない
              removeHandles();
              return false;
            },

            /**
             * ポインター移動: ドラッグ中のゴーストを追随させ、
             * drop 先の行/列を更新する
             */
            pointermove(_view: EditorView, event: Event) {
              if (!currentDrag) return false;
              const pe = event as PointerEvent;

              // ゴーストをカーソル位置に追随
              if (currentDrag.ghostEl) {
                if (currentDrag.type === 'row') {
                  currentDrag.ghostEl.style.top = `${pe.clientY - 10}px`;
                } else {
                  currentDrag.ghostEl.style.left = `${pe.clientX - 10}px`;
                }
              }

              // ドロップ先の行/列インデックスを解決
              const el = document.elementFromPoint(pe.clientX, pe.clientY);
              if (!el) return false;

              const cellEl = el.closest('td, th') as HTMLElement | null;
              if (!cellEl) return false;

              const tableEl = cellEl.closest('table');
              if (!tableEl) return false;

              if (currentDrag.type === 'row') {
                const rowEl = cellEl.closest('tr') as HTMLTableRowElement | null;
                if (rowEl) {
                  const tableRows = Array.from(tableEl.querySelectorAll<HTMLTableRowElement>('tr'));
                  const idx = tableRows.indexOf(rowEl);
                  if (idx > 0) currentDrag.toIndex = idx;
                }
              } else {
                const rowEl = cellEl.closest('tr') as HTMLElement | null;
                if (rowEl) {
                  const rowCells = Array.from(rowEl.querySelectorAll('td, th'));
                  const idx = rowCells.indexOf(cellEl);
                  if (idx >= 0) currentDrag.toIndex = idx;
                }
              }

              return false;
            },

            /**
             * ポインターリリース: ドラッグ完了、行/列を入れ替える
             */
            pointerup(view: EditorView) {
              if (!currentDrag) return false;

              const { type, fromIndex, toIndex, tableStart, tableNode } = currentDrag;
              removeGhost();
              removeHandles();

              if (type === 'row') {
                moveTableRow(view, tableStart, tableNode, fromIndex, toIndex);
              } else {
                moveTableCol(view, tableStart, tableNode, fromIndex, toIndex);
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
