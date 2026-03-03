/**
 * HTML ソースモードエディタ（CodeMirror 6）
 *
 * Phase 5 ソースコードモード:
 * - HTML シンタックスハイライト
 * - HTML オートコンプリート（タグ補完）
 * - エラー表示（未閉じタグ等）
 *
 * 設計書: docs/05_Features/HTML/html-editing-design.md §3.1
 */

import { useEffect, useRef } from 'react';
import {
  EditorView,
  keymap,
  drawSelection,
  highlightActiveLine,
  lineNumbers,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import {
  autocompletion,
  completionKeymap,
} from '@codemirror/autocomplete';
import { linter, lintGutter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language';
import { useSettingsStore } from '../../store/settingsStore';

export interface HtmlSourceEditorProps {
  /** HTML テキスト */
  value: string;
  /** テキスト変更時のコールバック */
  onChange: (value: string) => void;
  /** 読み取り専用 */
  readOnly?: boolean;
}

// Compartment インスタンス
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
    // Lint エラー表示用
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      borderBottom: '2px wavy #ef4444',
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      borderBottom: '2px wavy #f59e0b',
    },
  });
}

/**
 * HTMLの簡易リンター: 未閉じタグや基本的な構文エラーを検出する。
 *
 * コメント (<!-- -->)、DOCTYPE、CDATA セクションはスキップし、
 * void 要素 (self-closing tags) は閉じタグ不要として扱う。
 */
function htmlLinter(view: EditorView): Diagnostic[] {
  const doc = view.state.doc.toString();
  const diagnostics: Diagnostic[] = [];

  // void 要素（閉じタグ不要）
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  // raw content を持つタグ（中身をパースしない）
  const rawContentTags = new Set(['script', 'style', 'textarea']);

  // コメント・DOCTYPE・CDATAを除外した上でタグを検出
  // まずコメント等の位置を記録
  const skipRanges: Array<{ from: number; to: number }> = [];
  const commentRegex = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = commentRegex.exec(doc)) !== null) {
    skipRanges.push({ from: cm.index, to: cm.index + cm[0].length });
  }

  const isInSkipRange = (pos: number): boolean =>
    skipRanges.some((r) => pos >= r.from && pos < r.to);

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
  const stack: { tag: string; from: number; to: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(doc)) !== null) {
    // コメント・DOCTYPE 内のタグはスキップ
    if (isInSkipRange(match.index)) continue;

    const fullMatch = match[0]!;
    const tagName = match[1]!.toLowerCase();
    const isClosing = fullMatch.startsWith('</');
    const isSelfClosing =
      fullMatch.endsWith('/>') || voidTags.has(tagName);

    // void 要素の開きタグはスキップ
    if (isSelfClosing && !isClosing) continue;

    // raw content タグの開きタグを検出した場合、対応する閉じタグまでスキップ
    if (!isClosing && rawContentTags.has(tagName)) {
      const closePattern = new RegExp(`</${tagName}\\s*>`, 'i');
      const rest = doc.slice(match.index + fullMatch.length);
      const closeMatch = closePattern.exec(rest);
      if (closeMatch) {
        // 閉じタグの直後まで regex のインデックスを進める
        tagRegex.lastIndex = match.index + fullMatch.length + closeMatch.index + closeMatch[0].length;
      }
      continue;
    }

    if (isClosing) {
      let lastIdx = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tagName) { lastIdx = i; break; }
      }
      if (lastIdx === -1) {
        diagnostics.push({
          from: match.index,
          to: match.index + fullMatch.length,
          severity: 'error',
          message: `対応する開きタグがありません: </${tagName}>`,
        });
      } else {
        const unclosed = stack.splice(lastIdx);
        for (let i = 1; i < unclosed.length; i++) {
          diagnostics.push({
            from: unclosed[i]!.from,
            to: unclosed[i]!.to,
            severity: 'warning',
            message: `未閉じタグ: <${unclosed[i]!.tag}>`,
          });
        }
      }
    } else {
      stack.push({
        tag: tagName,
        from: match.index,
        to: match.index + fullMatch.length,
      });
    }
  }

  // スタックに残ったタグは未閉じ
  for (const remaining of stack) {
    diagnostics.push({
      from: remaining.from,
      to: remaining.to,
      severity: 'warning',
      message: `未閉じタグ: <${remaining.tag}>`,
    });
  }

  return diagnostics;
}

export function HtmlSourceEditor({
  value,
  onChange,
  readOnly = false,
}: HtmlSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { settings } = useSettingsStore();
  const { sourceTabSize, showLineNumbers: showLn, wordWrap } = settings.editor;
  const { codeBlockFontFamily, codeBlockFontSize } = settings.appearance;

  // エディタの初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),

      // HTML シンタックスハイライト + オートコンプリート
      html(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompletion(),

      // HTMLリンター（エラー表示）- 入力中の過剰更新を防ぐためデバウンス
      lintGutter(),
      linter(htmlLinter, { delay: 500 }),

      // キーマップ
      keymap.of([
        ...defaultKeymap.filter(
          (binding) => binding.key !== 'Mod-f' && binding.key !== 'Mod-h',
        ),
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),

      // 動的再構成可能な設定
      tabSizeCompartment.of(EditorState.tabSize.of(sourceTabSize)),
      lineNumbersCompartment.of(showLn ? lineNumbers() : []),
      readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
      wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
      fontThemeCompartment.of(
        buildFontTheme(codeBlockFontSize, codeBlockFontFamily),
      ),

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 設定変更を動的に反映
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: tabSizeCompartment.reconfigure(
        EditorState.tabSize.of(sourceTabSize),
      ),
    });
  }, [sourceTabSize]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lineNumbersCompartment.reconfigure(
        showLn ? lineNumbers() : [],
      ),
    });
  }, [showLn]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wordWrapCompartment.reconfigure(
        wordWrap ? EditorView.lineWrapping : [],
      ),
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
      data-testid="html-source-editor"
    />
  );
}
