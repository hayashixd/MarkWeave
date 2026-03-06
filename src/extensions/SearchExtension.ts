/**
 * 検索・置換 TipTap 拡張
 *
 * search-design.md §2 に準拠:
 * - ProseMirror Decoration API によるハイライト
 * - インクリメンタル検索（デバウンスはUI側で実施）
 * - 大文字/小文字区別、正規表現、単語単位検索オプション
 * - 現在マッチの強調表示（search-match--current）
 * - 置換・全置換
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchState {
  query: string;
  options: SearchOptions;
  currentIndex: number;
  matches: Array<{ from: number; to: number }>;
}

export const searchPluginKey = new PluginKey<SearchState>('search');

/** 正規表現特殊文字のエスケープ */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ドキュメントテキスト内のクエリにマッチする全位置を返す。
 * WYSIWYG モードのため、テキストノードのみを検索対象とする。
 */
export function findMatches(
  doc: ProseMirrorNode,
  query: string,
  options: SearchOptions,
): Array<{ from: number; to: number }> {
  if (!query) return [];

  const matches: Array<{ from: number; to: number }> = [];

  let pattern: RegExp;
  try {
    const flags = options.caseSensitive ? 'g' : 'gi';
    if (options.regex) {
      const rawPattern = options.wholeWord ? `\\b${query}\\b` : query;
      pattern = new RegExp(rawPattern, flags);
    } else {
      const escaped = escapeRegex(query);
      const rawPattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
      pattern = new RegExp(rawPattern, flags);
    }
  } catch {
    // 無効な正規表現の場合は空を返す
    return [];
  }

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
      // 空文字マッチの無限ループ防止
      if (match[0].length === 0) break;
    }
  });

  return matches;
}

/**
 * 検索ハイライト ProseMirror プラグイン。
 * 検索クエリにマッチする位置に Decoration を付与する。
 */
const searchPlugin = new Plugin<SearchState>({
  key: searchPluginKey,

  state: {
    init: () => ({
      query: '',
      options: { caseSensitive: false, wholeWord: false, regex: false },
      currentIndex: 0,
      matches: [],
    }),

    apply(tr: Transaction, prev: SearchState) {
      const meta = tr.getMeta(searchPluginKey) as Partial<SearchState> | undefined;
      if (meta) {
        return { ...prev, ...meta };
      }
      // ドキュメントが変更された場合、マッチ位置を再計算
      if (tr.docChanged && prev.query) {
        const matches = findMatches(tr.doc, prev.query, prev.options);
        const currentIndex = Math.min(
          prev.currentIndex,
          Math.max(0, matches.length - 1),
        );
        return { ...prev, matches, currentIndex };
      }
      return prev;
    },
  },

  props: {
    decorations(state: EditorState) {
      const pluginState = searchPluginKey.getState(state);
      if (
        !pluginState ||
        !pluginState.query ||
        pluginState.matches.length === 0
      ) {
        return DecorationSet.empty;
      }

      const { currentIndex, matches } = pluginState;
      const decorations = matches.map((match: { from: number; to: number }, i: number) =>
        Decoration.inline(match.from, match.to, {
          class:
            i === currentIndex
              ? 'search-match search-match--current'
              : 'search-match',
        }),
      );

      return DecorationSet.create(state.doc, decorations);
    },
  },
});

/**
 * TipTap Search 拡張。
 * エディタに検索・置換のための ProseMirror プラグインを追加する。
 */
export const SearchExtension = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    return [searchPlugin];
  },
});

// --- ヘルパー関数（SearchBar から呼ぶ） ---

/** 検索クエリを設定し、マッチを計算する */
export function setSearchQuery(
  view: EditorView,
  query: string,
  options: SearchOptions,
): SearchState {
  const matches = findMatches(view.state.doc, query, options);
  const newState: SearchState = {
    query,
    options,
    currentIndex: matches.length > 0 ? 0 : -1,
    matches,
  };
  const tr = view.state.tr.setMeta(searchPluginKey, newState);
  view.dispatch(tr);
  return newState;
}

/** 次のマッチへ移動 */
export function gotoNextMatch(view: EditorView): number {
  const state = searchPluginKey.getState(view.state);
  if (!state || state.matches.length === 0) return -1;

  const nextIndex = (state.currentIndex + 1) % state.matches.length;
  const tr = view.state.tr.setMeta(searchPluginKey, {
    currentIndex: nextIndex,
  });
  view.dispatch(tr);

  const nextMatch = state.matches[nextIndex];
  if (nextMatch) scrollToMatch(view, nextMatch);
  return nextIndex;
}

/** 前のマッチへ移動 */
export function gotoPrevMatch(view: EditorView): number {
  const state = searchPluginKey.getState(view.state);
  if (!state || state.matches.length === 0) return -1;

  const prevIndex =
    (state.currentIndex - 1 + state.matches.length) % state.matches.length;
  const tr = view.state.tr.setMeta(searchPluginKey, {
    currentIndex: prevIndex,
  });
  view.dispatch(tr);

  const prevMatch = state.matches[prevIndex];
  if (prevMatch) scrollToMatch(view, prevMatch);
  return prevIndex;
}

/** 現在のマッチを置換 */
export function replaceCurrentMatch(
  view: EditorView,
  replacement: string,
  options: SearchOptions,
): void {
  const state = searchPluginKey.getState(view.state);
  if (!state || state.matches.length === 0) return;

  const match = state.matches[state.currentIndex];
  if (!match) return;

  const textNode = view.state.schema.text(replacement);
  let tr = view.state.tr.replaceWith(match.from, match.to, textNode);

  // 置換後にマッチを再計算
  const newMatches = findMatches(tr.doc, state.query, options);
  const newIndex = Math.min(
    state.currentIndex,
    Math.max(0, newMatches.length - 1),
  );
  tr = tr.setMeta(searchPluginKey, {
    ...state,
    matches: newMatches,
    currentIndex: newIndex,
  });

  view.dispatch(tr);
}

/** 全マッチを置換 */
export function replaceAllMatches(
  view: EditorView,
  replacement: string,
): number {
  const state = searchPluginKey.getState(view.state);
  if (!state || state.matches.length === 0) return 0;

  const count = state.matches.length;

  let tr = view.state.tr;
  // 後ろから置換してオフセットのズレを防ぐ
  const sorted = [...state.matches].sort((a, b) => b.from - a.from);
  for (const match of sorted) {
    tr = tr.replaceWith(
      match.from,
      match.to,
      view.state.schema.text(replacement),
    );
  }

  tr = tr.setMeta(searchPluginKey, {
    ...state,
    matches: [],
    currentIndex: -1,
  });

  view.dispatch(tr);
  return count;
}

/** 検索をクリア */
export function clearSearch(view: EditorView): void {
  const tr = view.state.tr.setMeta(searchPluginKey, {
    query: '',
    options: { caseSensitive: false, wholeWord: false, regex: false },
    currentIndex: -1,
    matches: [],
  });
  view.dispatch(tr);
}

/** マッチ位置にスクロール */
function scrollToMatch(
  view: EditorView,
  match: { from: number; to: number },
): void {
  try {
    const coords = view.coordsAtPos(match.from);
    if (coords) {
      const editorDom = view.dom as HTMLElement;
      const scrollParent =
        editorDom.closest('.overflow-y-auto') ?? editorDom.parentElement;
      if (scrollParent) {
        const rect = scrollParent.getBoundingClientRect();
        if (coords.top < rect.top || coords.bottom > rect.bottom) {
          scrollParent.scrollTo({
            top:
              scrollParent.scrollTop +
              coords.top -
              rect.top -
              rect.height / 3,
            behavior: 'smooth',
          });
        }
      }
    }
  } catch {
    // スクロール失敗は無視
  }
}
