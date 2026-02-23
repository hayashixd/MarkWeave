/**
 * TableEditor Component - テーブル編集UIコンポーネント
 *
 * Excelライクなテーブル編集UIを提供する。
 * ProseMirrorのNodeViewとして実装される。
 *
 * 機能:
 * - Tab/Shift+Tabでセル間移動
 * - 行・列の追加・削除（コンテキストメニュー）
 * - 行・列のドラッグ&ドロップ並び替え
 * - 列幅のリサイズ（ドラッグ）
 * - 列の配置変更（左/中央/右）
 *
 * TODO: Phase 2 で実装
 */

// import React from 'react';
// import { TableCell } from './TableCell';
// import { TableContextMenu } from './TableContextMenu';

export interface TableData {
  rows: string[][];
  align: ('left' | 'center' | 'right' | null)[];
}

/**
 * テーブル編集コンポーネント
 *
 * TODO: Phase 2 で実装
 */
export function TableEditor(_props: { data: TableData }) {
  // TODO: Phase 2 で実装
  return null;
}
