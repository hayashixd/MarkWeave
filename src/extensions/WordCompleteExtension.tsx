/**
 * 単語補完拡張（Phase 3）
 *
 * editor-ux-design.md §14 に準拠:
 * - Ctrl+Space で手動トリガー
 * - ドキュメント内の単語をサジェスト
 * - Tab / Enter で確定、Esc で閉じる
 * - 最大10件、出現頻度降順ソート
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { buildWordList, getSuggestions } from '../core/word-completer';

export const wordCompletePluginKey = new PluginKey('wordComplete');

interface WordCompleteState {
  active: boolean;
  prefix: string;
  suggestions: { word: string; count: number }[];
  selectedIndex: number;
  coords: { left: number; top: number } | null;
}

const INITIAL_STATE: WordCompleteState = {
  active: false,
  prefix: '',
  suggestions: [],
  selectedIndex: 0,
  coords: null,
};

/**
 * カーソル手前の単語プレフィックスを取得
 */
function getPrefix(view: EditorView): string {
  const { state } = view;
  const { from } = state.selection;
  const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '');
  // 末尾から連続する単語文字を取得
  const match = textBefore.match(/[\p{L}\p{N}ー々〆〇]+$/u);
  return match ? match[0] : '';
}

/**
 * ポップアップのDOM要素を管理するクラス
 */
class WordCompleteView {
  private container: HTMLDivElement;
  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.container = document.createElement('div');
    this.container.className = 'word-complete-popup';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  update(state: WordCompleteState) {
    if (!state.active || state.suggestions.length === 0) {
      this.container.style.display = 'none';
      return;
    }

    // 位置計算
    if (state.coords) {
      this.container.style.left = `${state.coords.left}px`;
      this.container.style.top = `${state.coords.top + 24}px`;
    }

    // 候補リストを描画
    this.container.innerHTML = '';
    state.suggestions.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = `word-complete-popup__item${i === state.selectedIndex ? ' word-complete-popup__item--selected' : ''}`;
      item.textContent = s.word;

      const countSpan = document.createElement('span');
      countSpan.className = 'word-complete-popup__count';
      countSpan.textContent = `(×${s.count})`;
      item.appendChild(countSpan);

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.acceptSuggestion(s.word, getPrefix(this.view));
      });
      this.container.appendChild(item);
    });

    this.container.style.display = 'block';

    // ビューポート端でのはみ出し補正
    const rect = this.container.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      // 上方向に表示
      if (state.coords) {
        this.container.style.top = `${state.coords.top - rect.height - 4}px`;
      }
    }
    if (rect.right > window.innerWidth) {
      this.container.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
  }

  acceptSuggestion(word: string, prefix: string) {
    const { state, dispatch } = this.view;
    const { from } = state.selection;
    const insertText = word.slice(prefix.length);
    const tr = state.tr.insertText(insertText, from);
    dispatch(tr);
    // 閉じる
    this.view.dispatch(
      this.view.state.tr.setMeta(wordCompletePluginKey, { type: 'close' }),
    );
  }

  destroy() {
    this.container.remove();
  }
}

export const WordCompleteExtension = Extension.create({
  name: 'wordComplete',

  addProseMirrorPlugins() {
    let popupView: WordCompleteView | null = null;
    let wordMap: Map<string, number> = new Map();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin<WordCompleteState>({
        key: wordCompletePluginKey,

        state: {
          init(): WordCompleteState {
            return INITIAL_STATE;
          },

          apply(tr, prev): WordCompleteState {
            const meta = tr.getMeta(wordCompletePluginKey) as
              | { type: 'open' | 'close' | 'navigate'; direction?: 'up' | 'down' }
              | undefined;

            if (meta?.type === 'close') {
              return INITIAL_STATE;
            }

            if (meta?.type === 'navigate' && prev.active) {
              const len = prev.suggestions.length;
              if (len === 0) return prev;

              let newIndex = prev.selectedIndex;
              if (meta.direction === 'down') {
                newIndex = (newIndex + 1) % len;
              } else {
                newIndex = (newIndex - 1 + len) % len;
              }
              return { ...prev, selectedIndex: newIndex };
            }

            if (meta?.type === 'open') {
              return { ...prev, active: true };
            }

            return prev;
          },
        },

        view(editorView) {
          popupView = new WordCompleteView(editorView);

          // 初期の単語リスト構築
          wordMap = buildWordList(editorView.state.doc.textContent);

          return {
            update(view) {
              const pluginState = wordCompletePluginKey.getState(view.state);
              if (!pluginState) return;

              // ドキュメント変更時に単語リストを更新（デバウンス）
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => {
                wordMap = buildWordList(view.state.doc.textContent);
              }, 500);

              if (pluginState.active) {
                const prefix = getPrefix(view);
                if (prefix.length < 1) {
                  popupView?.update(INITIAL_STATE);
                  view.dispatch(
                    view.state.tr.setMeta(wordCompletePluginKey, { type: 'close' }),
                  );
                  return;
                }

                const suggestions = getSuggestions(wordMap, prefix);
                const coords = view.coordsAtPos(view.state.selection.from);

                const updatedState: WordCompleteState = {
                  ...pluginState,
                  prefix,
                  suggestions,
                  coords: { left: coords.left, top: coords.top },
                  selectedIndex: Math.min(
                    pluginState.selectedIndex,
                    Math.max(0, suggestions.length - 1),
                  ),
                };
                popupView?.update(updatedState);
              } else {
                popupView?.update(INITIAL_STATE);
              }
            },
            destroy() {
              popupView?.destroy();
              popupView = null;
              if (debounceTimer) clearTimeout(debounceTimer);
            },
          };
        },

        props: {
          handleKeyDown(view, event) {
            const pluginState = wordCompletePluginKey.getState(view.state);
            if (!pluginState?.active) return false;

            // IME 変換中はスキップ
            if (event.isComposing || event.keyCode === 229) return false;

            // Esc: 閉じる
            if (event.key === 'Escape') {
              view.dispatch(
                view.state.tr.setMeta(wordCompletePluginKey, { type: 'close' }),
              );
              return true;
            }

            // ArrowDown / ArrowUp: 候補選択
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(wordCompletePluginKey, {
                  type: 'navigate',
                  direction: 'down',
                }),
              );
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              view.dispatch(
                view.state.tr.setMeta(wordCompletePluginKey, {
                  type: 'navigate',
                  direction: 'up',
                }),
              );
              return true;
            }

            // Tab / Enter: 確定
            if (event.key === 'Tab' || event.key === 'Enter') {
              event.preventDefault();
              const { suggestions, selectedIndex } = pluginState;
              if (suggestions.length > 0 && selectedIndex < suggestions.length) {
                const selected = suggestions[selectedIndex];
                if (selected) {
                  const prefix = getPrefix(view);
                  popupView?.acceptSuggestion(selected.word, prefix);
                }
              }
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl+Space: 補完メニューを開く
      'Mod-Space': ({ editor }) => {
        const { state, view } = editor;
        const prefix = getPrefix(view);
        if (prefix.length < 1) return false;

        view.dispatch(
          state.tr.setMeta(wordCompletePluginKey, { type: 'open' }),
        );
        return true;
      },
    };
  },
});
