/**
 * スラッシュコマンド TipTap 拡張
 *
 * slash-commands-design.md に準拠。
 *
 * ペルソナ対応:
 * - 一般ライター/ブロガー: / を入力するだけで要素挿入。Markdown記法不要
 * - テクニカルライター: キーボードだけで全要素を素早く挿入
 * - AIパワーユーザー: /ブログ 等でAIテンプレートを直接挿入
 *
 * 動作:
 * 1. 段落の先頭または空段落で / を入力するとメニュー表示
 * 2. その後の文字入力でリアルタイムフィルタリング
 * 3. ↑↓ で選択、Enter/Tab で実行、Esc または / 全削除で閉じる
 * 4. コマンド実行時は /クエリ をドキュメントから削除し要素を挿入
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface SlashCommandState {
  active: boolean;
  query: string;
  /** スラッシュ文字を含む範囲の開始位置（削除に使用） */
  from: number;
  /** カーソル位置のビューポート座標 */
  coords: { top: number; left: number; bottom: number } | null;
}

const pluginKey = new PluginKey<SlashCommandState>('slashCommands');

const INITIAL_STATE: SlashCommandState = {
  active: false,
  query: '',
  from: -1,
  coords: null,
};

export interface SlashCommandsOptions {
  /** メニューの表示/非表示/クエリ更新を通知するコールバック */
  onStateChange: (state: SlashCommandState) => void;
}

export const SlashCommandsExtension = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      onStateChange: () => {},
    };
  },

  addProseMirrorPlugins() {
    const self = this;

    return [
      new Plugin({
        key: pluginKey,

        state: {
          init(): SlashCommandState {
            return INITIAL_STATE;
          },

          apply(tr, prev): SlashCommandState {
            const meta = tr.getMeta(pluginKey) as SlashCommandState | null;
            if (meta !== undefined && meta !== null) {
              return meta;
            }
            // ドキュメント変更時は from 位置を mapping で追従
            if (tr.docChanged && prev.active) {
              const newFrom = tr.mapping.map(prev.from);
              return { ...prev, from: newFrom };
            }
            return prev;
          },
        },

        props: {
          handleKeyDown(view, event) {
            const state = pluginKey.getState(view.state);
            if (!state?.active) return false;

            if (event.key === 'Escape') {
              // メニューを閉じる（/クエリはそのまま残す）
              view.dispatch(view.state.tr.setMeta(pluginKey, INITIAL_STATE));
              return true;
            }

            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === 'Tab') {
              // キーボードナビゲーションはメニュー UI 側で処理
              // ここでは TipTap のデフォルト処理を抑制する
              window.dispatchEvent(new CustomEvent('slash-commands-key', { detail: { key: event.key } }));
              if (event.key !== 'Tab') {
                event.preventDefault();
                return true;
              }
              return true;
            }

            return false;
          },

          handleTextInput(view, _from, _to, text) {
            const { state } = view;
            const { $cursor } = state.selection as { $cursor?: ReturnType<typeof state.selection.$from> };
            if (!$cursor) return false;

            const pluginState = pluginKey.getState(state);

            if (!pluginState?.active) {
              // スラッシュコマンドトリガー判定
              // 条件: 入力が "/" で、かつカーソルが段落の先頭（textOffset === 0）
              if (text === '/') {
                const parentNode = $cursor.parent;
                const isAtStart = $cursor.parentOffset === 0;
                const isParagraph = parentNode.type.name === 'paragraph';
                const isEmptyParagraph = isParagraph && parentNode.textContent === '';

                if (isAtStart || isEmptyParagraph) {
                  // 少し遅延させてドキュメントに / が挿入されてから座標を取得
                  setTimeout(() => {
                    const coords = view.coordsAtPos(view.state.selection.from);
                    const newState: SlashCommandState = {
                      active: true,
                      query: '',
                      from: view.state.selection.from - 1, // / の位置
                      coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                    };
                    view.dispatch(view.state.tr.setMeta(pluginKey, newState));
                    self.options.onStateChange(newState);
                  }, 0);
                }
              }
              return false;
            }

            // アクティブ時: Backspace で / まで戻ったら閉じる
            // (handleTextInput はテキスト入力のみ。Backspace は handleKeyDown で処理)
            // アクティブ時: テキストでクエリを更新
            setTimeout(() => {
              const currentState = pluginKey.getState(view.state);
              if (!currentState?.active) return;

              // from 位置から現在のカーソル位置までのテキストを取得
              const { from: slashFrom } = currentState;
              const to = view.state.selection.from;
              const slice = view.state.doc.textBetween(slashFrom, to, '');

              if (!slice.startsWith('/')) {
                // / が削除されたので閉じる
                view.dispatch(view.state.tr.setMeta(pluginKey, INITIAL_STATE));
                self.options.onStateChange(INITIAL_STATE);
                return;
              }

              const query = slice.slice(1); // / の後の文字列
              const coords = view.coordsAtPos(view.state.selection.from);
              const newState: SlashCommandState = {
                ...currentState,
                query,
                coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
              };
              view.dispatch(view.state.tr.setMeta(pluginKey, newState));
              self.options.onStateChange(newState);
            }, 0);

            return false;
          },

          handleKeyDown(view, event) {
            const state = pluginKey.getState(view.state);
            if (!state?.active) return false;

            // Backspace: クエリの最後の文字を削除、/ まで戻ったら閉じる
            if (event.key === 'Backspace') {
              const { from: slashFrom } = state;
              const to = view.state.selection.from;

              if (to <= slashFrom + 1) {
                // / 自体を削除 → メニューを閉じる
                setTimeout(() => {
                  view.dispatch(view.state.tr.setMeta(pluginKey, INITIAL_STATE));
                  self.options.onStateChange(INITIAL_STATE);
                }, 0);
              } else {
                // クエリを1文字削除して更新
                setTimeout(() => {
                  const currentState = pluginKey.getState(view.state);
                  if (!currentState?.active) return;
                  const { from: sf } = currentState;
                  const newTo = view.state.selection.from;
                  const slice = view.state.doc.textBetween(sf, newTo, '');
                  if (!slice.startsWith('/')) {
                    view.dispatch(view.state.tr.setMeta(pluginKey, INITIAL_STATE));
                    self.options.onStateChange(INITIAL_STATE);
                    return;
                  }
                  const coords = view.coordsAtPos(newTo);
                  const newState = {
                    ...currentState,
                    query: slice.slice(1),
                    coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                  };
                  view.dispatch(view.state.tr.setMeta(pluginKey, newState));
                  self.options.onStateChange(newState);
                }, 0);
              }
              return false; // Backspace 自体は通常通り処理させる
            }

            return false;
          },
        },
      }),
    ];
  },
});

/**
 * エディタビュー経由でスラッシュコマンドの /クエリ を削除し、コマンドを実行するヘルパー。
 * SlashCommandMenu から呼ばれる。
 */
export function executeSlashCommand(
  editor: { view: { state: { tr: ReturnType<typeof editor.view.state.tr>; selection: { from: number }; doc: { textBetween: (...args: [number, number, string]) => string } }; dispatch: (tr: unknown) => void } },
  from: number,
  action: () => void,
): void {
  const { view } = editor;
  const to = view.state.selection.from;
  // /クエリ を削除
  const tr = view.state.tr.delete(from, to);
  view.dispatch(tr);
  // コマンドを実行
  action();
}
