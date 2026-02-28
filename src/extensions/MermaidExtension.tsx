/**
 * Mermaid 図表 TipTap 拡張
 *
 * ````mermaid` コードブロックを検出し、Mermaid でレンダリングする。
 * Typora と同様にフォーカス時はソース表示、フォーカス外は図表表示。
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';

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

function MermaidBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
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
        setSvgHtml(svg);
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
            Esc または Ctrl+Enter で確定
          </div>
        </div>
      ) : (
        <div
          className={`mermaid-block-rendered${selected ? ' mermaid-block-rendered--selected' : ''}`}
          onClick={startEditing}
          role="button"
          tabIndex={-1}
          aria-label="Mermaid 図表"
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
    </NodeViewWrapper>
  );
}
