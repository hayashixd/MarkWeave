/**
 * html-editor-setup.ts
 *
 * Phase 5: HTML 編集モードの設定型定義と初期化。
 *
 * 実際の HTML エディタは TipTap ベースの React コンポーネント
 * (src/components/editor/HtmlEditor.tsx) として実装されている。
 * このモジュールは設定型定義とユーティリティを提供する。
 */

export type HtmlEditorMode = 'wysiwyg' | 'source' | 'split';

export interface HtmlEditorConfig {
  /** 初期編集モード */
  mode: HtmlEditorMode;
  /** インラインスタイル編集を有効にするか */
  allowInlineStyles: boolean;
  /** divブロック編集を有効にするか */
  allowDivBlocks: boolean;
  /** セマンティック要素編集を有効にするか */
  allowSemanticElements: boolean;
}

export const defaultHtmlEditorConfig: HtmlEditorConfig = {
  mode: 'wysiwyg',
  allowInlineStyles: true,
  allowDivBlocks: true,
  allowSemanticElements: true,
};
