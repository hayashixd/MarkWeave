/**
 * Mermaid 図表 TipTap 拡張
 *
 * ````mermaid` コードブロックを検出し、Mermaid でレンダリングする。
 * Typora と同様にフォーカス時はソース表示、フォーカス外は図表表示。
 *
 * Phase 7 追加: ダブルクリックでソース編集ポップアップ（ライブプレビュー付き）
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';
import { sanitizeMermaidSvg } from '../utils/dompurify-config';

// Mermaid 初期化
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
    });
    mermaidInitialized = true;
  }
}

let mermaidIdCounter = 0;

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid-block]',
        getAttrs: (el) => ({
          code: (el as HTMLElement).getAttribute('data-code') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-mermaid-block': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView);
  },
});

/**
 * Mermaid ソース編集ポップアップ。
 * ダブルクリックで開き、ライブプレビュー付きで編集できる。
 */
function MermaidEditPopup({
  code,
  onSave,
  onClose,
}: {
  code: string;
  onSave: (code: string) => void;
  onClose: () => void;
}) {
  const [localCode, setLocalCode] = useState(code);
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ライブプレビュー（デバウンス付き）
  useEffect(() => {
    if (!localCode.trim()) {
      setPreviewSvg('');
      setPreviewError(null);
      return;
    }
    const timer = setTimeout(() => {
      ensureMermaidInit();
      const id = `mermaid-popup-${++mermaidIdCounter}`;
      mermaid
        .render(id, localCode)
        .then(({ svg }) => {
          setPreviewSvg(sanitizeMermaidSvg(svg));
          setPreviewError(null);
        })
        .catch((err) => {
          setPreviewSvg('');
          setPreviewError(err instanceof Error ? err.message : String(err));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [localCode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave(localCode);
      }
    },
    [localCode, onSave, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold">Mermaid ソース編集</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="閉じる">&times;</button>
        </div>
        <div className="flex flex-1 min-h-0">
          {/* ソースエディタ */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            <div className="text-xs text-gray-400 px-3 py-1 bg-gray-50">ソース</div>
            <textarea
              ref={textareaRef}
              className="flex-1 p-3 text-sm font-mono resize-none focus:outline-none"
              value={localCode}
              onChange={(e) => setLocalCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          </div>
          {/* ライブプレビュー */}
          <div className="flex-1 flex flex-col">
            <div className="text-xs text-gray-400 px-3 py-1 bg-gray-50">プレビュー</div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
              {previewError ? (
                <div className="text-red-500 text-xs">{previewError}</div>
              ) : previewSvg ? (
                <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="text-gray-400 text-sm">Mermaid コードを入力してください</div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-2 border-t border-gray-200">
          <button onClick={onClose} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">キャンセル</button>
          <button onClick={() => onSave(localCode)} className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded">適用</button>
        </div>
        <div className="text-xs text-gray-400 text-center pb-1">Ctrl+Enter で適用 / Esc でキャンセル</div>
      </div>
    </div>
  );
}

function MermaidBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [localCode, setLocalCode] = useState(node.attrs.code as string);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const code = node.attrs.code as string;

  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  // Mermaid レンダリング
  useEffect(() => {
    if (editing) return;
    if (!code.trim()) {
      setSvgHtml('');
      setRenderError(null);
      return;
    }

    ensureMermaidInit();
    const id = `mermaid-${++mermaidIdCounter}`;

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        setSvgHtml(sanitizeMermaidSvg(svg));
        setRenderError(null);
      })
      .catch((err) => {
        setSvgHtml('');
        setRenderError(err instanceof Error ? err.message : String(err));
      });
  }, [code, editing]);

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
    updateAttributes({ code: localCode });
    setEditing(false);
  }, [localCode, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        finishEditing();
      }
    },
    [finishEditing],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalCode(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    },
    [],
  );

  const handleDoubleClick = useCallback(() => {
    setPopupOpen(true);
  }, []);

  const handlePopupSave = useCallback(
    (newCode: string) => {
      updateAttributes({ code: newCode });
      setLocalCode(newCode);
      setPopupOpen(false);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="mermaid-block-wrapper" data-mermaid-block="">
      {editing ? (
        <div className="mermaid-block-editor">
          <div className="mermaid-block-editor__label">```mermaid</div>
          <textarea
            ref={textareaRef}
            className="mermaid-block-editor__textarea"
            value={localCode}
            onChange={handleTextareaChange}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            rows={5}
            spellCheck={false}
          />
          <div className="mermaid-block-editor__label">```</div>
          <div className="mermaid-block-editor__hint">
            Esc または Ctrl+Enter で確定 / ダブルクリックでポップアップ編集
          </div>
        </div>
      ) : (
        <div
          className={`mermaid-block-rendered${selected ? ' mermaid-block-rendered--selected' : ''}`}
          onClick={startEditing}
          onDoubleClick={handleDoubleClick}
          role="button"
          tabIndex={-1}
          aria-label="Mermaid 図表（ダブルクリックでポップアップ編集）"
        >
          {renderError ? (
            <div className="mermaid-block-error">
              <span className="mermaid-block-error__icon">⚠</span>
              <span className="mermaid-block-error__text">{renderError}</span>
            </div>
          ) : svgHtml ? (
            <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
          ) : (
            <div className="mermaid-block-placeholder">
              Mermaid 図表を入力してください
            </div>
          )}
        </div>
      )}
      {popupOpen && (
        <MermaidEditPopup
          code={code}
          onSave={handlePopupSave}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </NodeViewWrapper>
  );
}
