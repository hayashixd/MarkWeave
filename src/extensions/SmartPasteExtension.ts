/**
 * スマートペースト TipTap 拡張。
 *
 * smart-paste-design.md §8.2 に準拠。
 *
 * クリップボードに text/html が含まれる場合、
 * Markdown に変換してエディタに挿入する。
 * 動作は editor.smartPasteMode 設定で制御:
 * - 'auto': 即時変換（Phase 1 で実装）
 * - 'ask': 確認バー表示（Phase 3 で実装）
 * - 'never': スマートペースト無効
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { htmlToMarkdown } from '../core/converter/smart-paste';
import { markdownToTipTap } from '../lib/markdown-to-tiptap';
import { useSettingsStore } from '../store/settingsStore';

export const SmartPasteExtension = Extension.create({
  name: 'smartPaste',

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

            // 'auto' モード: 即時変換
            if (smartPasteMode === 'auto') {
              const md = htmlToMarkdown(html);
              const doc = markdownToTipTap(md);

              // 変換結果の content を現在位置に挿入
              if (doc.content && doc.content.length > 0) {
                editorInstance.commands.insertContent(
                  doc.content as unknown as Record<string, unknown>[],
                );
              }

              return true;
            }

            // 'ask' モード: Phase 3 で確認バー UI を実装予定
            // Phase 1 では auto と同じ動作にフォールバック
            if (smartPasteMode === 'ask') {
              const md = htmlToMarkdown(html);
              const doc = markdownToTipTap(md);

              if (doc.content && doc.content.length > 0) {
                editorInstance.commands.insertContent(
                  doc.content as unknown as Record<string, unknown>[],
                );
              }

              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
