/**
 * TemplatePicker.tsx
 *
 * テンプレートからページを新規作成するためのダイアログ。
 * ai-design.md §10.4 に準拠。
 *
 * Ctrl+N 長押し または メニュー → ファイル → テンプレートから新規作成 で表示。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDocumentTemplateStore, type DocumentTemplate } from '../../store/documentTemplateStore';

interface TemplatePickerProps {
  /** ダイアログが開いているか */
  open: boolean;
  /** 閉じるコールバック */
  onClose: () => void;
  /** テンプレート選択時のコールバック（展開済みMarkdownを渡す） */
  onSelect: (markdown: string) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { getAllTemplates, expandTemplate, loaded, loadTemplates } = useDocumentTemplateStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState('');

  useEffect(() => {
    if (open && !loaded) {
      loadTemplates();
    }
  }, [open, loaded, loadTemplates]);

  const templates = getAllTemplates();

  useEffect(() => {
    if (selectedId) {
      const t = templates.find((tpl) => tpl.id === selectedId);
      if (t) {
        setPreviewContent(expandTemplate(t));
      }
    } else {
      setPreviewContent('');
    }
  }, [selectedId, templates, expandTemplate]);

  const handleSelect = useCallback(
    (template: DocumentTemplate) => {
      const expanded = expandTemplate(template);
      onSelect(expanded);
      onClose();
    },
    [expandTemplate, onSelect, onClose],
  );

  const handleEmptyFile = useCallback(() => {
    onSelect('');
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="template-picker-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="テンプレートを選択"
    >
      <div
        className="template-picker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="template-picker__header">
          <h2>テンプレートから新規作成</h2>
          <button
            className="template-picker__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        <div className="template-picker__body">
          <div className="template-picker__list">
            {templates.map((t) => (
              <button
                key={t.id}
                className={`template-picker__item${selectedId === t.id ? ' template-picker__item--selected' : ''}`}
                onClick={() => setSelectedId(t.id)}
                onDoubleClick={() => handleSelect(t)}
              >
                <span className="template-picker__item-icon">
                  {t.id.startsWith('builtin-') ? '📄' : '📝'}
                </span>
                <span className="template-picker__item-name">{t.name}</span>
              </button>
            ))}
            <button
              className={`template-picker__item${selectedId === '__empty' ? ' template-picker__item--selected' : ''}`}
              onClick={() => {
                setSelectedId('__empty');
                setPreviewContent('');
              }}
              onDoubleClick={handleEmptyFile}
            >
              <span className="template-picker__item-icon">📃</span>
              <span className="template-picker__item-name">空のファイル（テンプレートなし）</span>
            </button>
          </div>

          <div className="template-picker__preview">
            <div className="template-picker__preview-label">プレビュー</div>
            <pre className="template-picker__preview-content">
              {previewContent || '（テンプレートを選択してください）'}
            </pre>
          </div>
        </div>

        <div className="template-picker__footer">
          <button
            className="template-picker__btn template-picker__btn--secondary"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            className="template-picker__btn template-picker__btn--primary"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId === '__empty') {
                handleEmptyFile();
              } else {
                const t = templates.find((tpl) => tpl.id === selectedId);
                if (t) handleSelect(t);
              }
            }}
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePicker;
