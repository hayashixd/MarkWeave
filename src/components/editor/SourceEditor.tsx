/**
 * ソースモードエディタ（CodeMirror 6）
 *
 * editor-ux-design.md §11 に準拠:
 * - CodeMirror 6 ベースのソースコード編集
 * - rectangularSelection() による矩形選択（Alt+ドラッグ）
 * - crosshairCursor() による Alt キー押下時のクロスヘアカーソル
 *
 * keyboard-shortcuts.md §1-8 に準拠:
 * - Alt+ドラッグ: 矩形選択
 * - Alt+Shift+↑↓←→: キーボードによる矩形選択拡張
 * - Ctrl+Alt+↑/↓: マルチカーソル追加
 */

import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, rectangularSelection, crosshairCursor, drawSelection, highlightActiveLine, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { useSettingsStore } from '../../store/settingsStore';

export interface SourceEditorProps {
  /** Markdown テキスト */
  value: string;
  /** テキスト変更時のコールバック */
  onChange: (value: string) => void;
  /** 読み取り専用 */
  readOnly?: boolean;
}

export function SourceEditor({ value, onChange, readOnly = false }: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { settings } = useSettingsStore();
  const { sourceTabSize, showLineNumbers } = settings.editor;

  // エディタの初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const tabSize = EditorState.tabSize.of(sourceTabSize);

    const extensions = [
      // 基本拡張
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),

      // 矩形選択（Alt+ドラッグ）- editor-ux-design.md §11.2
      rectangularSelection(),
      crosshairCursor(),

      // Markdown シンタックスハイライト
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

      // キーマップ（Ctrl+F/H を除外してアプリ側の検索 UI に委譲）
      keymap.of([
        ...defaultKeymap.filter(
          (binding) =>
            binding.key !== 'Mod-f' &&
            binding.key !== 'Mod-h',
        ),
        ...historyKeymap,
        indentWithTab,
      ]),

      // タブサイズ
      tabSize,

      // テキスト変更リスナー
      updateListener,

      // 読み取り専用
      EditorState.readOnly.of(readOnly),

      // テーマ（基本スタイル）
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '14px',
        },
        '.cm-content': {
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          padding: '16px 0',
        },
        '.cm-gutters': {
          backgroundColor: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          color: '#9ca3af',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#f3f4f6',
        },
        '&.cm-focused .cm-cursor': {
          borderLeftColor: '#1f2937',
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: '#dbeafe',
        },
        // 矩形選択時のスタイル
        '.cm-selectionBackground': {
          backgroundColor: '#dbeafe !important',
        },
      }),

      // ワードラップ
      ...(settings.editor.wordWrap ? [EditorView.lineWrapping] : []),
    ];

    // 行番号表示
    if (showLineNumbers) {
      extensions.unshift(lineNumbers());
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 初期化は一度だけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部から value が変わった場合にエディタを同期
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Ctrl+/ によるモード切替はアプリレイヤーで処理するため、
  // CodeMirror には渡さない（keyboard-shortcuts.md §2-2 準拠）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      // CodeMirror に伝播させない（アプリの GlobalKeyHandler で処理される）
      return;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full bg-gray-50 overflow-auto source-editor"
      onKeyDown={handleKeyDown}
      data-testid="source-editor"
    />
  );
}
