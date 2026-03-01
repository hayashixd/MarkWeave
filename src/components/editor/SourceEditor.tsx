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

import { useEffect, useRef } from 'react';
import {
  EditorView,
  keymap,
  rectangularSelection,
  crosshairCursor,
  drawSelection,
  highlightActiveLine,
  lineNumbers,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language';
import { useSettingsStore } from '../../store/settingsStore';

export interface SourceEditorProps {
  /** Markdown テキスト */
  value: string;
  /** テキスト変更時のコールバック */
  onChange: (value: string) => void;
  /** 読み取り専用 */
  readOnly?: boolean;
}

// Compartment インスタンス（動的に再構成可能なエクステンション領域）
const tabSizeCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const fontThemeCompartment = new Compartment();

function buildFontTheme(fontSize: number, fontFamily: string) {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontSize: `${fontSize}px`,
    },
    '.cm-content': {
      fontFamily:
        fontFamily ||
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
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
  });
}

export function SourceEditor({ value, onChange, readOnly = false }: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { settings } = useSettingsStore();
  const { sourceTabSize, showLineNumbers: showLn, wordWrap } = settings.editor;
  const { codeBlockFontFamily, codeBlockFontSize } = settings.appearance;

  // エディタの初期化（一度だけ実行）
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

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
          (binding) => binding.key !== 'Mod-f' && binding.key !== 'Mod-h',
        ),
        ...historyKeymap,
        indentWithTab,
      ]),

      // 動的再構成可能な設定（Compartment）
      tabSizeCompartment.of(EditorState.tabSize.of(sourceTabSize)),
      lineNumbersCompartment.of(showLn ? lineNumbers() : []),
      readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
      wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      fontThemeCompartment.of(buildFontTheme(codeBlockFontSize, codeBlockFontFamily)),

      // テキスト変更リスナー
      updateListener,
    ];

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
    // 初期化は一度だけ。設定変更は Compartment 経由で反映する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 設定変更を Compartment で動的に反映 ---

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(sourceTabSize)),
    });
  }, [sourceTabSize]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lineNumbersCompartment.reconfigure(showLn ? lineNumbers() : []),
    });
  }, [showLn]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: fontThemeCompartment.reconfigure(
        buildFontTheme(codeBlockFontSize, codeBlockFontFamily),
      ),
    });
  }, [codeBlockFontSize, codeBlockFontFamily]);

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

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full bg-gray-50 overflow-auto source-editor"
      data-testid="source-editor"
    />
  );
}
