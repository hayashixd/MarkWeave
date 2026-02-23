/**
 * Editor Component - メインエディタコンポーネント
 *
 * WYSIWYGマークダウンエディタのルートコンポーネント。
 * サイドバー、ツールバー、エディタ本体を統合する。
 *
 * TODO: Phase 1 で実装
 */

// import React from 'react';
// import { Toolbar } from './Toolbar';
// import { StatusBar } from './StatusBar';
// import { Sidebar } from '../Sidebar/Sidebar';

/**
 * エディタのプロパティ
 */
export interface EditorProps {
  /** 初期ファイルパス */
  filePath?: string;
  /** テーマ名 */
  theme?: string;
  /** ソースモードで起動するか */
  sourceMode?: boolean;
}

/**
 * メインエディタコンポーネント
 *
 * TODO: React + ProseMirror で実装
 */
export function Editor(_props: EditorProps) {
  // TODO: Phase 1 で実装
  return null;
}
