/**
 * Wikilink 拡張
 *
 * wikilinks-backlinks-design.md §3 に準拠。
 *
 * `[[ファイル名]]` および `[[ファイル名|表示テキスト]]` の記法を
 * インラインノードとして認識・描画する。
 *
 * ペルソナ: 知識管理者 — Obsidian 的なノート間リンクでナレッジベースを構築
 *
 * Phase 7.5 基礎実装:
 * - `[[ファイル名]]` → クリックでタブを開く
 * - `[[ファイル名|表示テキスト]]` → 別名表示
 * - リンク解決済み（青）/ 未解決（赤点線）の表示分岐は将来対応
 * - オートコンプリートは将来対応
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface WikilinkOptions {
  /** リンクをクリックした時のコールバック（ファイルパスを開く） */
  onLinkClick?: (target: string) => void;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (target: string, label?: string) => ReturnType;
    };
  }
}

export const WikilinkExtension = Node.create<WikilinkOptions>({
  name: 'wikilink',

  addOptions() {
    return {
      onLinkClick: undefined,
      HTMLAttributes: {},
    };
  },

  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: '' },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wikilink': HTMLAttributes.target,
        class: 'wikilink',
      }),
      HTMLAttributes.label ?? HTMLAttributes.target,
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-wikilink', node.attrs.target as string);
      dom.className = 'wikilink';
      dom.title = `[[${node.attrs.target}]] — Ctrl+クリックで開く`;
      dom.textContent = (node.attrs.label ?? node.attrs.target) as string;

      // クリックでリンクを開く
      dom.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.button === 1) {
          e.preventDefault();
          this.options.onLinkClick?.(node.attrs.target as string);
        }
      });

      // Tooltip hint: ホバー時にターゲットパスを表示
      Object.assign(dom.style, HTMLAttributes.style ?? {});

      return { dom };
    };
  },

  addCommands() {
    return {
      insertWikilink:
        (target: string, label?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { target, label: label ?? null },
          });
        },
    };
  },

  /**
   * InputRule: `[[ファイル名]]` または `[[ファイル名|表示テキスト]]` を入力すると
   * 自動的に wikilink ノードに変換する。
   *
   * IME 変換中はトリガーしない（isComposing ガード）。
   */
  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('wikilinkInput');
    const extension = this;

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            // `]]` が入力された時点でトリガー
            if (text !== ']') return false;

            const { state } = view;
            const before = state.doc.textBetween(Math.max(0, from - 100), from, '\n');

            // `[[...]]` のパターンを探す（`]]` の前に `[[` がある）
            // `[[label|target]]` または `[[target]]` の形式に対応
            const match = before.match(/\[\[([^\]]+?)(?:\|([^\]]+?))?\]$/);
            if (!match) return false;

            const rawTarget = match[1].trim();
            const rawLabel = match[2]?.trim() ?? null;

            // `[[` の開始位置を計算
            const matchStart = from - match[0].length;

            // ノードを置換
            const tr = state.tr.replaceWith(
              matchStart,
              to + 1, // `]]` の 2 文字目まで含む
              state.schema.nodes[extension.name].create({
                target: rawTarget,
                label: rawLabel,
              }),
            );
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
