/**
 * html-editor-setup.ts
 *
 * HTML編集モード用のProseMirrorエディタをセットアップするモジュール。
 *
 * Markdownエディタ（prosemirror-setup.ts）と対になるHTML版エントリポイント。
 * HTMLスキーマ・HTMLツールバー・HTML固有プラグインを設定する。
 */

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Root } from 'hast';

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

const defaultConfig: HtmlEditorConfig = {
  mode: 'wysiwyg',
  allowInlineStyles: true,
  allowDivBlocks: true,
  allowSemanticElements: true,
};

/**
 * HTML編集モード用のProseMirrorエディタを初期化する。
 *
 * @param container - マウント先のDOM要素
 * @param ast       - 初期ドキュメント（hast Root）
 * @param config    - エディタ設定
 * @returns ProseMirror EditorView インスタンス
 *
 * @example
 * const view = setupHtmlEditor(document.getElementById('editor'), ast);
 */
export function setupHtmlEditor(
  container: HTMLElement,
  ast: Root,
  config: Partial<HtmlEditorConfig> = {}
): EditorView {
  const _config = { ...defaultConfig, ...config };
  // TODO:
  // 1. buildHtmlSchema(config) でProseMirrorスキーマを構築
  // 2. hastAstToProseMirrorDoc(ast, schema) でドキュメントに変換
  // 3. EditorState.create({ doc, plugins }) でステートを作成
  // 4. EditorView を作成して返す
  void container;
  void ast;
  throw new Error('setupHtmlEditor: not implemented yet');
}

/**
 * エディタの表示モードを切り替える。
 *
 * @param view - 現在のEditorView
 * @param mode - 切替先のモード
 */
export function switchHtmlEditorMode(
  view: EditorView,
  mode: HtmlEditorMode
): void {
  // TODO: モードに応じてビューを切り替え
  // - 'wysiwyg': ProseMirrorのWYSIWYGビュー
  // - 'source': CodeMirrorのソースビュー
  // - 'split': 両方を並列表示
  void view;
  void mode;
  throw new Error('switchHtmlEditorMode: not implemented yet');
}

/**
 * EditorViewの現在のドキュメントをhast Rootとして取得する。
 *
 * @param view - 対象のEditorView
 * @returns hast Root ノード
 */
export function getHtmlAst(view: EditorView): Root {
  // TODO: ProseMirrorドキュメント → hast Root 変換
  void view;
  throw new Error('getHtmlAst: not implemented yet');
}
