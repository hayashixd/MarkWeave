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
 * ask モード: Phase 3 で確認 UI を実装予定。
 *   現時点では auto と同様に変換し、トーストで通知する。
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { htmlToMarkdown } from '../core/converter/smart-paste';
import { markdownToTipTap } from '../lib/markdown-to-tiptap';
import { useSettingsStore } from '../store/settingsStore';
import { useToastStore } from '../store/toastStore';

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

            // auto / ask モード: Markdown に変換して挿入
            const md = htmlToMarkdown(html);
            const doc = markdownToTipTap(md);

            if (doc.content && doc.content.length > 0) {
              editorInstance.commands.insertContent(
                doc.content as unknown as Record<string, unknown>[],
              );
            }

            // ask モード: Phase 3 で確認 UI を実装するまでの暫定通知
            if (smartPasteMode === 'ask') {
              useToastStore
                .getState()
                .show('info', 'HTMLをMarkdownに変換して貼り付けました（確認UIはPhase 3で実装予定）');
            }

            return true;
          },
        },
      }),
    ];
  },
});
