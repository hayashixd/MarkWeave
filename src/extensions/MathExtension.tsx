/**
 * 数式（KaTeX）TipTap 拡張
 *
 * インライン数式（$...$）とブロック数式（$$...$$）を KaTeX でレンダリングする。
 * Typora と同様にフォーカス時はソース表示、フォーカス外はレンダリング表示。
 *
 * editor-ux-design.md §2 に準拠。
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';

// ============================================================
// インライン数式ノード: $...$
// ============================================================

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-inline]',
        getAttrs: (el) => ({
          latex: (el as HTMLElement).getAttribute('data-latex') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },
});

function MathInlineView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [localLatex, setLocalLatex] = useState(node.attrs.latex as string);
  const inputRef = useRef<HTMLInputElement>(null);
  const renderedRef = useRef<HTMLSpanElement>(null);

  const latex = node.attrs.latex as string;

  useEffect(() => {
    setLocalLatex(latex);
  }, [latex]);

  // KaTeX レンダリング
  useEffect(() => {
    if (!editing && renderedRef.current) {
      try {
        katex.render(latex || '\\text{数式}', renderedRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        renderedRef.current.textContent = latex || '数式';
      }
    }
  }, [latex, editing]);

  const startEditing = useCallback(() => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const finishEditing = useCallback(() => {
    updateAttributes({ latex: localLatex });
    setEditing(false);
  }, [localLatex, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setLocalLatex(latex);
        setEditing(false);
      }
    },
    [finishEditing, latex],
  );

  return (
    <NodeViewWrapper as="span" className="math-inline-wrapper" data-math-inline="">
      {editing ? (
        <span className="math-inline-editor">
          <span className="math-inline-editor__dollar">$</span>
          <input
            ref={inputRef}
            type="text"
            className="math-inline-editor__input"
            value={localLatex}
            onChange={(e) => setLocalLatex(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
          />
          <span className="math-inline-editor__dollar">$</span>
        </span>
      ) : (
        <span
          ref={renderedRef}
          className={`math-inline-rendered${selected ? ' math-inline-rendered--selected' : ''}`}
          onClick={startEditing}
          role="button"
          tabIndex={-1}
          aria-label={`数式: ${latex}`}
        />
      )}
    </NodeViewWrapper>
  );
}

// ============================================================
// ブロック数式ノード: $$...$$
// ============================================================

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (el) => ({
          latex: (el as HTMLElement).getAttribute('data-latex') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-math-block': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});

function MathBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [localLatex, setLocalLatex] = useState(node.attrs.latex as string);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderedRef = useRef<HTMLDivElement>(null);

  const latex = node.attrs.latex as string;

  useEffect(() => {
    setLocalLatex(latex);
  }, [latex]);

  // KaTeX レンダリング
  useEffect(() => {
    if (!editing && renderedRef.current) {
      try {
        katex.render(latex || '\\text{数式ブロック}', renderedRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        renderedRef.current.textContent = latex || '数式ブロック';
      }
    }
  }, [latex, editing]);

  const startEditing = useCallback(() => {
    setEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    }, 0);
  }, []);

  const finishEditing = useCallback(() => {
    updateAttributes({ latex: localLatex });
    setEditing(false);
  }, [localLatex, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // IME 変換中は処理しない
      if (e.nativeEvent.isComposing) return;

      // Esc でプレビューに戻る
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing();
      }
      // Ctrl+Enter で確定
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        finishEditing();
      }
    },
    [finishEditing],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalLatex(e.target.value);
      // 自動高さ調整
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    },
    [],
  );

  return (
    <NodeViewWrapper className="math-block-wrapper" data-math-block="">
      {editing ? (
        <div className="math-block-editor">
          <div className="math-block-editor__label">$$</div>
          <textarea
            ref={textareaRef}
            className="math-block-editor__textarea"
            value={localLatex}
            onChange={handleTextareaChange}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            rows={3}
            spellCheck={false}
          />
          <div className="math-block-editor__label">$$</div>
          <div className="math-block-editor__hint">
            Esc または Ctrl+Enter で確定
          </div>
        </div>
      ) : (
        <div
          ref={renderedRef}
          className={`math-block-rendered${selected ? ' math-block-rendered--selected' : ''}`}
          onClick={startEditing}
          role="button"
          tabIndex={-1}
          aria-label={`数式ブロック: ${latex}`}
        />
      )}
    </NodeViewWrapper>
  );
}
