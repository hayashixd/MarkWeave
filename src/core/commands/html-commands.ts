/**
 * html-commands.ts
 *
 * Phase 5: HTML 編集モード固有のコマンドヘルパー。
 *
 * 実際のコマンドは TipTap 拡張 (src/extensions/HtmlExtensions.ts) で定義されている。
 * このモジュールは TipTap Editor インスタンスに対するヘルパー関数を提供する。
 */

import type { Editor } from '@tiptap/core';

// ---------------------------------------------------------------------------
// インラインスタイルコマンド
// ---------------------------------------------------------------------------

/**
 * 選択テキストの文字色を設定する。
 */
export function setTextColor(editor: Editor, color: string): boolean {
  return (editor.commands as any).setTextColor(color);
}

/**
 * 選択テキストの背景色を設定する。
 */
export function setBackgroundColor(editor: Editor, color: string): boolean {
  return (editor.commands as any).setBackgroundColor(color);
}

/**
 * 選択テキストのフォントサイズを設定する。
 */
export function setFontSize(editor: Editor, size: string): boolean {
  return (editor.commands as any).setFontSize(size);
}

/**
 * テキストのハイライトをトグルする。
 */
export function toggleHighlight(editor: Editor): boolean {
  return (editor.commands as any).toggleHighlight();
}

// ---------------------------------------------------------------------------
// ブロックコマンド（HTML固有）
// ---------------------------------------------------------------------------

/**
 * div ブロックを挿入する。
 */
export function insertDiv(editor: Editor, className?: string): boolean {
  return (editor.commands as any).insertDivBlock({ class: className });
}

/**
 * セマンティック要素を挿入する。
 */
export function insertSemanticBlock(
  editor: Editor,
  tagName: 'section' | 'article' | 'header' | 'footer' | 'nav',
): boolean {
  return (editor.commands as any).insertSemanticBlock(tagName);
}

// ---------------------------------------------------------------------------
// テキスト配置コマンド
// ---------------------------------------------------------------------------

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * テキスト配置を設定する。
 */
export function setTextAlign(editor: Editor, align: TextAlign): boolean {
  return (editor.commands as any).setTextAlign(align);
}
