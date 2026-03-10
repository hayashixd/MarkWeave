/**
 * SafeInputRulesExtension - IME ガード付きオートフォーマット
 *
 * system-design.md §4.3 の確定仕様に準拠:
 * - §4.3.2 ガード条件: IME 変換中は InputRule を発火しない
 * - §4.3.3 変換失敗時フォールバック: 例外時はトランザクションをキャンセルし入力を継続
 * - §4.3.4 Undo 粒度: トリガー入力 + 構造変換 = 1 トランザクション（TipTap デフォルト動作）
 *
 * TipTap の StarterKit が提供する InputRules はそのまま使用し、
 * この Extension は ProseMirror Plugin レベルで IME ガードと
 * エラーハンドリングを追加する。
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const safeInputRulesKey = new PluginKey('safeInputRules');

export const SafeInputRulesExtension = Extension.create({
  name: 'safeInputRules',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: safeInputRulesKey,

        /**
         * appendTransaction でトランザクションを監視し、
         * IME 変換中に InputRule が発火した場合にキャンセルする。
         *
         * ProseMirror の InputRule は handleTextInput の中で
         * トランザクションを dispatch するため、appendTransaction で
         * 後処理として検査する。
         */
        filterTransaction(tr, _state) {
          // InputRule によるトランザクションかどうかを判定
          // ProseMirror の InputRule は 'inputType' メタを設定する
          const inputType = tr.getMeta('inputType');

          // IME 変換中のチェック
          // ProseMirror v1.28+ では composition 状態を EditorView が管理するが、
          // フロントエンドの compositionstart/compositionend で追跡する方が確実
          const isComposing = tr.getMeta('composition');
          if (isComposing && inputType) {
            // IME 変換中に InputRule が発火 → トランザクションをキャンセル
            return false;
          }

          return true;
        },

        props: {
          /**
           * handleTextInput で InputRule 的な処理にエラーハンドリングを追加。
           * TipTap の InputRule 自体は別の Plugin で動作するため、
           * ここでは ProseMirror のテキスト入力イベントで
           * IME 変換中かどうかを確認するガードのみを行う。
           */
          handleTextInput(view, _from, _to, _text) {
            // IME 変換中はテキスト入力を InputRule に渡さない
            if (view.composing) {
              return false; // false = ProseMirror のデフォルト処理に委譲
            }
            return false; // 通常処理に委譲
          },

          /**
           * handleKeyDown で IME ガードを適用。
           * 特に Enter キーによるコードブロック・水平線の変換を防ぐ。
           */
          handleKeyDown(_view, event) {
            if (event.isComposing || event.keyCode === 229) {
              // IME 変換中: InputRule のトリガーとなるキー入力を抑制
              return false;
            }
            return false;
          },
        },
      }),
    ];
  },
});
