/**
 * スマートペースト TipTap 拡張。
 *
 * smart-paste-design.md §8.2, §4.3 に準拠。
 *
 * Ctrl+V: クリップボードに text/html が含まれる場合、
 *   Markdown に変換してエディタに挿入する。
 *   動作は editor.smartPasteMode 設定で制御。
 *
 * Ctrl+Shift+V: 常にプレーンテキストとして貼り付け（Typora 互換）。
 *
 * ask モード: 確認バー UI を表示してユーザーに選択させる。
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { htmlToMarkdown } from '../core/converter/smart-paste';
import { markdownToTipTap } from '../lib/markdown-to-tiptap';
import { useSettingsStore } from '../store/settingsStore';

/**
 * ask モードのペースト待機データを伝えるカスタムイベント
 * TipTapEditor でリッスンして確認バーを表示する
 */
export interface SmartPasteAskEvent {
  html: string;
  plainText: string;
}

export const SmartPasteExtension = Extension.create({
  name: 'smartPaste',

  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+V: プレーンテキストとして貼り付け
      'Mod-Shift-v': () => {
        navigator.clipboard.readText().then((text) => {
          if (text) {
            this.editor.commands.insertContent(text);
          }
        });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editorInstance = this.editor;

    return [
      new Plugin({
        key: new PluginKey('smartPaste'),
        props: {
          handlePaste(_view, event) {
            const { smartPasteMode } =
              useSettingsStore.getState().settings.editor;

            // 'never' モードではスマートペーストを無効化
            if (smartPasteMode === 'never') return false;

            const html = event.clipboardData?.getData('text/html');
            if (!html) return false;

            const plainText = event.clipboardData?.getData('text/plain') ?? '';

            // ask モード: カスタムイベントを発行して確認バーを表示
            if (smartPasteMode === 'ask') {
              event.preventDefault();
              const detail: SmartPasteAskEvent = { html, plainText };
              window.dispatchEvent(
                new CustomEvent('smart-paste-ask', { detail }),
              );
              return true;
            }

            // auto モード: Markdown に変換して挿入
            const md = htmlToMarkdown(html);
            const doc = markdownToTipTap(md);

            if (doc.content && doc.content.length > 0) {
              editorInstance.commands.insertContent(
                doc.content as unknown as Record<string, unknown>[],
              );
            }

            return true;
          },
        },
      }),
    ];
  },
});
