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

/** オートコンプリートポップアップの状態 */
export interface WikilinkAutoState {
  active: boolean;
  query: string;
  /** `[[` の直後の位置 (ノード削除に使用) */
  from: number;
  coords: { top: number; left: number; bottom: number } | null;
}

export interface WikilinkOptions {
  /** リンクをクリックした時のコールバック（ファイルパスを開く） */
  onLinkClick?: (target: string) => void;
  /** オートコンプリート状態変化コールバック */
  onAutoStateChange?: (state: WikilinkAutoState) => void;
  /** リンクターゲットが実在するか判定するコールバック（解決済み=青/未解決=赤点線） */
  isTargetResolved?: (target: string) => boolean;
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
      onAutoStateChange: undefined,
      isTargetResolved: undefined,
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
      const target = node.attrs.target as string;
      const resolved = this.options.isTargetResolved?.(target);
      dom.className = [
        'wikilink',
        resolved === true ? 'wikilink--resolved' : resolved === false ? 'wikilink--unresolved' : '',
      ].filter(Boolean).join(' ');
      dom.title = `[[${target}]] — Ctrl+クリックで開く`;
      dom.textContent = (node.attrs.label ?? target) as string;

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

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey('wikilinkInput');
    const extension = this;
    /** `[[` が検出された位置（オートコンプリート開始） */
    let autoFrom = -1;

    const closeAuto = () => {
      autoFrom = -1;
      extension.options.onAutoStateChange?.({ active: false, query: '', from: -1, coords: null });
    };

    return [
      new Plugin({
        key: pluginKey,
        props: {
          handleTextInput(view, from, to, text) {
            if (view.composing) return false;

            const { state } = view;
            const before = state.doc.textBetween(Math.max(0, from - 100), from, '\n');

            // ─── ]] 入力: wikilink ノードに変換（オートコンプリートより優先） ───
            if (text === ']' && autoFrom >= 0) {
              const queryText = before.slice(before.lastIndexOf('[[') + 2);
              const match = queryText.match(/^([^\]]+?)(?:\|([^\]]+?))?$/);
              if (match) {
                const rawTarget = match[1].trim();
                const rawLabel = match[2]?.trim() ?? null;
                const matchStart = autoFrom;
                closeAuto();
                const tr = state.tr.replaceWith(
                  matchStart,
                  to + 1,
                  state.schema.nodes[extension.name].create({ target: rawTarget, label: rawLabel }),
                );
                view.dispatch(tr);
                return true;
              }
            }

            // ─── [[ 入力: オートコンプリートを開始 ───
            const fullAfter = before + text;
            if (fullAfter.endsWith('[[')) {
              autoFrom = to + 1; // `[[` の直後の位置
              const coords = view.coordsAtPos(to + 1);
              extension.options.onAutoStateChange?.({
                active: true,
                query: '',
                from: autoFrom,
                coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
              });
              return false; // `[[` 自体は通常どおり挿入
            }

            // ─── オートコンプリート中: クエリ更新 ───
            if (autoFrom >= 0) {
              const query = state.doc.textBetween(autoFrom, from, '') + text;
              if (query.includes(']') || query.includes('\n')) {
                closeAuto();
                return false;
              }
              const coords = view.coordsAtPos(from);
              extension.options.onAutoStateChange?.({
                active: true,
                query,
                from: autoFrom,
                coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
              });
              return false;
            }

            return false;
          },

          handleKeyDown(view, event) {
            if (autoFrom < 0) return false;
            if (event.isComposing || event.keyCode === 229) return false;

            if (event.key === 'Escape') {
              closeAuto();
              return true;
            }

            // ↑↓ Enter Tab をポップアップに委譲
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(event.key)) {
              event.preventDefault();
              window.dispatchEvent(new CustomEvent('wikilink-autocomplete-key', { detail: { key: event.key } }));
              return true;
            }

            // Backspace でクエリを縮小
            if (event.key === 'Backspace') {
              const { state } = view;
              const curFrom = state.selection.from;
              if (curFrom <= autoFrom) {
                closeAuto();
              } else {
                const query = state.doc.textBetween(autoFrom, curFrom - 1, '');
                const coords = view.coordsAtPos(curFrom - 1);
                extension.options.onAutoStateChange?.({
                  active: true,
                  query,
                  from: autoFrom,
                  coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                });
              }
              return false;
            }

            return false;
          },
        },
      }),
    ];
  },
});
