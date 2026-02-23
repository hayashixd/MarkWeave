/**
 * html-commands.ts
 *
 * HTML編集モード固有のProseMirrorコマンド群。
 *
 * Markdown編集と共通のコマンド（太字・見出し等）は text-commands.ts / block-commands.ts を参照。
 * ここではHTMLのみに存在する操作を定義する。
 */

import type { Command } from 'prosemirror-state';

// ---------------------------------------------------------------------------
// インラインスタイルコマンド
// ---------------------------------------------------------------------------

/**
 * 選択テキストの文字色を設定する。
 * <span style="color: {color}"> を適用する。
 *
 * @param color - CSS color値（例: '#ff0000', 'red'）
 */
export function setTextColor(color: string): Command {
  // TODO: ProseMirrorのmarkを使ってspanにstyle属性を付与
  void color;
  return (_state, _dispatch) => false;
}

/**
 * 選択テキストの背景色を設定する。
 * <span style="background-color: {color}"> を適用する。
 *
 * @param color - CSS color値
 */
export function setBackgroundColor(color: string): Command {
  void color;
  return (_state, _dispatch) => false;
}

/**
 * 選択テキストのフォントサイズを設定する。
 * <span style="font-size: {size}"> を適用する。
 *
 * @param size - CSSフォントサイズ（例: '16px', '1.2em'）
 */
export function setFontSize(size: string): Command {
  void size;
  return (_state, _dispatch) => false;
}

/**
 * テキストに <mark> タグを付与してハイライトする。
 */
export const toggleMark: Command = (_state, _dispatch) => {
  // TODO: <mark> の toggle
  return false;
};

// ---------------------------------------------------------------------------
// ブロックコマンド（HTML固有）
// ---------------------------------------------------------------------------

/**
 * カーソル位置に <div> ブロックを挿入する。
 *
 * @param className - 付与するクラス名（省略可）
 */
export function insertDiv(className?: string): Command {
  void className;
  return (_state, _dispatch) => false;
}

/**
 * カーソル位置にセマンティック要素を挿入する。
 *
 * @param tagName - 'section' | 'article' | 'header' | 'footer' | 'nav'
 */
export function insertSemanticBlock(
  tagName: 'section' | 'article' | 'header' | 'footer' | 'nav'
): Command {
  void tagName;
  return (_state, _dispatch) => false;
}

// ---------------------------------------------------------------------------
// テキスト配置コマンド
// ---------------------------------------------------------------------------

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * 現在のブロックにテキスト配置スタイルを設定する。
 *
 * @param align - 配置方向
 */
export function setTextAlign(align: TextAlign): Command {
  void align;
  return (_state, _dispatch) => false;
}
