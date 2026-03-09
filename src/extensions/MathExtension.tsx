/**
 * 数式（KaTeX）TipTap 拡張
 *
 * インライン数式（$...$）とブロック数式（$$...$$）を KaTeX でレンダリングする。
 * Typora と同様にフォーカス時はソース表示、フォーカス外はレンダリング表示。
 *
 * editor-ux-design.md §2 に準拠。
 * Phase 7 追加: ダブルクリックで LaTeX ソース編集ポップアップ
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import katex from 'katex';

// ============================================================
// 共通: 数式編集ポップアップ
// ============================================================

function MathEditPopup({
  latex,
  displayMode,
  onSave,
  onClose,
}: {
  latex: string;
  displayMode: boolean;
  onSave: (latex: string) => void;
  onClose: () => void;
}) {
  const [localLatex, setLocalLatex] = useState(latex);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ライブプレビュー
  useEffect(() => {
    if (!localLatex.trim()) {
      setPreviewHtml('');
      setPreviewError(null);
      return;
    }
    try {
      const html = katex.renderToString(localLatex, {
        throwOnError: true,
        displayMode,
      });
      setPreviewHtml(html);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
  }, [localLatex, displayMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave(localLatex);
      }
    },
    [localLatex, onSave, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[500px] max-w-[90vw] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold">
            {displayMode ? 'ブロック数式' : 'インライン数式'} - LaTeX 編集
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="閉じる">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">LaTeX ソース</label>
            <textarea
              ref={inputRef}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              value={localLatex}
              onChange={(e) => setLocalLatex(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={displayMode ? 5 : 2}
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">プレビュー</label>
            <div className="min-h-[40px] p-3 bg-gray-50 rounded border border-gray-200 flex items-center justify-center overflow-auto">
              {previewError ? (
                <span className="text-red-500 text-xs">{previewError}</span>
              ) : previewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <span className="text-gray-400 text-sm">LaTeX を入力してください</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-2 border-t border-gray-200">
          <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">キャンセル</button>
          <button onClick={() => onSave(localLatex)} className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded">適用</button>
        </div>
        <div className="text-xs text-gray-400 text-center pb-1">Ctrl+Enter で適用 / Esc でキャンセル</div>
      </div>
    </div>
  );
}

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
  const [popupOpen, setPopupOpen] = useState(false);
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

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPopupOpen(true);
  }, []);

  const handlePopupSave = useCallback(
    (newLatex: string) => {
      updateAttributes({ latex: newLatex });
      setLocalLatex(newLatex);
      setPopupOpen(false);
    },
    [updateAttributes],
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
          onDoubleClick={handleDoubleClick}
          role="button"
          tabIndex={-1}
          aria-label={`数式: ${latex}（ダブルクリックでポップアップ編集）`}
        />
      )}
      {popupOpen && (
        <MathEditPopup
          latex={latex}
          displayMode={false}
          onSave={handlePopupSave}
          onClose={() => setPopupOpen(false)}
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
  const [popupOpen, setPopupOpen] = useState(false);
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

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPopupOpen(true);
  }, []);

  const handlePopupSave = useCallback(
    (newLatex: string) => {
      updateAttributes({ latex: newLatex });
      setLocalLatex(newLatex);
      setPopupOpen(false);
    },
    [updateAttributes],
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
            Esc または Ctrl+Enter で確定 / ダブルクリックでポップアップ編集
          </div>
        </div>
      ) : (
        <div
          ref={renderedRef}
          className={`math-block-rendered${selected ? ' math-block-rendered--selected' : ''}`}
          onClick={startEditing}
          onDoubleClick={handleDoubleClick}
          role="button"
          tabIndex={-1}
          aria-label={`数式ブロック: ${latex}（ダブルクリックでポップアップ編集）`}
        />
      )}
      {popupOpen && (
        <MathEditPopup
          latex={latex}
          displayMode={true}
          onSave={handlePopupSave}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
