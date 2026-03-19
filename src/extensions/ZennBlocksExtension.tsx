/**
 * Zenn 固有ブロック記法 TipTap 拡張
 *
 * :::message / :::message alert / :::details をカスタムノードとして扱い、
 * WYSIWYG でスタイル付きブロックとして表示する。
 * MermaidBlock と同じ atom ノード方式を採用。
 *
 * - zennMessageBlock: :::message / :::message alert
 * - zennDetailsBlock: :::details <title>
 *
 * クリックで内容を textarea 編集。Esc / Ctrl+Enter で確定。
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// zennMessageBlock
// ─────────────────────────────────────────────────────────────────────────────

export const ZennMessageBlock = Node.create({
  name: 'zennMessageBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      messageType: { default: 'message' },
      content: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-zenn-message]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-zenn-message': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ZennMessageBlockView);
  },
});

function ZennMessageBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [localContent, setLocalContent] = useState(node.attrs.content as string);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageType = node.attrs.messageType as 'message' | 'alert';

  useEffect(() => {
    setLocalContent(node.attrs.content as string);
  }, [node.attrs.content]);

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
    updateAttributes({ content: localContent });
    setEditing(false);
  }, [localContent, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Escape') { e.preventDefault(); finishEditing(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finishEditing(); }
    },
    [finishEditing],
  );

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }, []);

  const isAlert = messageType === 'alert';
  const label = isAlert ? ':::message alert' : ':::message';

  return (
    <NodeViewWrapper
      className={`zenn-message-block-wrapper${selected ? ' zenn-block--selected' : ''}`}
      data-zenn-message={messageType}
    >
      {editing ? (
        <div className={`zenn-message-editor zenn-message-editor--${messageType}`}>
          <div className="zenn-block-editor__label">{label}</div>
          <textarea
            ref={textareaRef}
            className="zenn-block-editor__textarea"
            value={localContent}
            onChange={handleTextareaChange}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            rows={3}
            spellCheck={false}
          />
          <div className="zenn-block-editor__label">:::</div>
          <div className="zenn-block-editor__hint">Esc または Ctrl+Enter で確定</div>
        </div>
      ) : (
        <div
          className={`zenn-message-rendered zenn-message-rendered--${messageType}`}
          onClick={startEditing}
          role="button"
          tabIndex={-1}
          aria-label={`${isAlert ? '警告ブロック' : 'メッセージブロック'}（クリックで編集）`}
        >
          <span className="zenn-message-icon">{isAlert ? '⚠' : '💬'}</span>
          <span className="zenn-message-content">{localContent || <em className="text-gray-400">（空のメッセージ）</em>}</span>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// zennDetailsBlock
// ─────────────────────────────────────────────────────────────────────────────

export const ZennDetailsBlock = Node.create({
  name: 'zennDetailsBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      title: { default: '' },
      content: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-zenn-details]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-zenn-details': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ZennDetailsBlockView);
  },
});

function ZennDetailsBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [localTitle, setLocalTitle] = useState(node.attrs.title as string);
  const [localContent, setLocalContent] = useState(node.attrs.content as string);
  const contentAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalTitle(node.attrs.title as string);
    setLocalContent(node.attrs.content as string);
  }, [node.attrs.title, node.attrs.content]);

  const startEditing = useCallback(() => {
    setEditing(true);
    setOpen(true);
    setTimeout(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.focus();
        contentAreaRef.current.style.height = 'auto';
        contentAreaRef.current.style.height = contentAreaRef.current.scrollHeight + 'px';
      }
    }, 0);
  }, []);

  const finishEditing = useCallback(() => {
    updateAttributes({ title: localTitle, content: localContent });
    setEditing(false);
  }, [localTitle, localContent, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Escape') { e.preventDefault(); finishEditing(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finishEditing(); }
    },
    [finishEditing],
  );

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  }, []);

  return (
    <NodeViewWrapper
      className={`zenn-details-block-wrapper${selected ? ' zenn-block--selected' : ''}`}
      data-zenn-details=""
    >
      {editing ? (
        <div className="zenn-details-editor">
          <div className="zenn-block-editor__label">
            :::details{' '}
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="タイトル"
              className="zenn-details-editor__title-input"
            />
          </div>
          <textarea
            ref={contentAreaRef}
            className="zenn-block-editor__textarea"
            value={localContent}
            onChange={handleContentChange}
            onBlur={finishEditing}
            onKeyDown={handleKeyDown}
            rows={3}
            spellCheck={false}
          />
          <div className="zenn-block-editor__label">:::</div>
          <div className="zenn-block-editor__hint">Esc または Ctrl+Enter で確定</div>
        </div>
      ) : (
        <div
          className="zenn-details-rendered"
          onClick={() => setOpen((v) => !v)}
          role="button"
          tabIndex={-1}
          aria-expanded={open}
          aria-label="アコーディオン（クリックで開閉 / ダブルクリックで編集）"
          onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
        >
          <div className="zenn-details-summary">
            <span className="zenn-details-arrow">{open ? '▼' : '▶'}</span>
            <span className="zenn-details-title">{localTitle || '（タイトルなし）'}</span>
            <span className="zenn-details-hint">ダブルクリックで編集</span>
          </div>
          {open && (
            <div className="zenn-details-body">
              {localContent || <em className="text-gray-400">（空のコンテンツ）</em>}
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
