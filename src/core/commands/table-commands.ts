/**
 * Table Commands - テーブル操作コマンド
 *
 * テーブルの行・列の追加、削除、並び替え、配置変更などの操作を提供する。
 * ProseMirrorのトランザクションとして実行される。
 *
 * TODO: Phase 2 で実装
 */

export type ColumnAlignment = 'left' | 'center' | 'right' | null;

export interface TablePosition {
  rowIndex: number;
  colIndex: number;
}

/**
 * テーブルコマンド群
 */
export const TableCommands = {
  /**
   * 行を追加する
   */
  addRow(pos: 'before' | 'after', rowIndex: number): void {
    // TODO: ProseMirrorトランザクションで実装
    throw new Error('Not implemented');
  },

  /**
   * 行を削除する
   */
  removeRow(rowIndex: number): void {
    throw new Error('Not implemented');
  },

  /**
   * 列を追加する
   */
  addColumn(pos: 'before' | 'after', colIndex: number): void {
    throw new Error('Not implemented');
  },

  /**
   * 列を削除する
   */
  removeColumn(colIndex: number): void {
    throw new Error('Not implemented');
  },

  /**
   * 行を並び替える
   */
  moveRow(from: number, to: number): void {
    throw new Error('Not implemented');
  },

  /**
   * 列を並び替える
   */
  moveColumn(from: number, to: number): void {
    throw new Error('Not implemented');
  },

  /**
   * 列の配置を設定する
   */
  setAlignment(colIndex: number, align: ColumnAlignment): void {
    throw new Error('Not implemented');
  },
};
