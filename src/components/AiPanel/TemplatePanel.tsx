/**
 * TemplatePanel.tsx
 *
 * AIテンプレートブラウザ・選択・プレースホルダー入力ダイアログのコンポーネント群。
 *
 * 機能:
 *   - カテゴリフィルタ・キーワード検索でテンプレートを絞り込み
 *   - テンプレートを選択するとプレビュー表示
 *   - [挿入] でプレースホルダー入力ダイアログを開く
 *   - 値を入力して [OK] でエディタにMarkdownを挿入
 */

import React, { useState, useMemo } from 'react';
import {
  listTemplates,
  searchTemplates,
  fillTemplate,
  getMissingRequired,
  type AiTemplate,
  type TemplateCategory,
  type Placeholder,
} from '../../ai/templates/template-registry';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface TemplatePanelProps {
  /** パネルを閉じるコールバック */
  onClose: () => void;
  /**
   * テンプレートをエディタに挿入するコールバック。
   * @param markdown - プレースホルダーを埋めた完成Markdownテキスト
   * @param mode     - カーソル位置に挿入 or ドキュメント全体を置換
   */
  onInsert: (markdown: string, mode: 'cursor' | 'replace') => void;
}

// カテゴリの表示名
const CATEGORY_LABELS: Record<TemplateCategory | 'all', string> = {
  all: 'すべて',
  blog: 'ブログ',
  code: 'コード',
  summary: '要約',
  reasoning: '推論',
  general: '汎用',
  meeting: '議事録',
  translate: '翻訳',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as (TemplateCategory | 'all')[];

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

/**
 * AIテンプレートブラウザパネル。
 *
 * @example
 * <TemplatePanel
 *   onClose={() => setPanelOpen(false)}
 *   onInsert={(md, mode) => insertMarkdown(editorView, md, mode)}
 * />
 */
export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  onClose,
  onInsert,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<AiTemplate | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // フィルタリング済みテンプレート一覧
  const filteredTemplates = useMemo(() => {
    let templates: AiTemplate[];
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    } else if (selectedCategory === 'all') {
      templates = listTemplates();
    } else {
      templates = listTemplates(selectedCategory);
    }
    return templates;
  }, [selectedCategory, searchQuery]);

  const handleInsert = () => {
    if (!selectedTemplate) return;
    setShowDialog(true);
  };

  const handleDialogConfirm = (values: Record<string, string>, mode: 'cursor' | 'replace') => {
    if (!selectedTemplate) return;
    const markdown = fillTemplate(selectedTemplate, values);
    onInsert(markdown, mode);
    setShowDialog(false);
    onClose();
  };

  return (
    <div className="template-panel" role="dialog" aria-label="AIテンプレート">
      {/* ヘッダー */}
      <div className="template-panel__header">
        <h2>AI テンプレート</h2>
        <button onClick={onClose} aria-label="閉じる">×</button>
      </div>

      {/* 検索 */}
      <div className="template-panel__search">
        <input
          type="search"
          placeholder="テンプレートを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="テンプレートを検索"
        />
      </div>

      {/* カテゴリフィルタ */}
      <div className="template-panel__categories" role="tablist">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={selectedCategory === cat}
            className={`template-panel__category-tab ${selectedCategory === cat ? 'is-active' : ''}`}
            onClick={() => {
              setSelectedCategory(cat);
              setSearchQuery('');
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* メインレイアウト（リスト + プレビュー） */}
      <div className="template-panel__body">
        {/* テンプレートリスト */}
        <ul className="template-panel__list" role="listbox">
          {filteredTemplates.length === 0 && (
            <li className="template-panel__empty">テンプレートが見つかりません</li>
          )}
          {filteredTemplates.map((template) => (
            <li
              key={template.id}
              className={`template-panel__list-item ${selectedTemplate?.id === template.id ? 'is-selected' : ''}`}
              role="option"
              aria-selected={selectedTemplate?.id === template.id}
              onClick={() => setSelectedTemplate(template)}
            >
              <strong className="template-panel__template-name">{template.name}</strong>
              <p className="template-panel__template-desc">{template.description}</p>
            </li>
          ))}
        </ul>

        {/* プレビューペイン */}
        <div className="template-panel__preview">
          {selectedTemplate ? (
            <>
              <div className="template-panel__preview-header">
                <h3>{selectedTemplate.name}</h3>
                <div className="template-panel__tags">
                  {selectedTemplate.tags.map((tag) => (
                    <span key={tag} className="template-panel__tag">{tag}</span>
                  ))}
                </div>
              </div>
              <pre className="template-panel__preview-content">
                {selectedTemplate.content}
              </pre>
            </>
          ) : (
            <p className="template-panel__preview-empty">
              テンプレートを選択するとプレビューが表示されます
            </p>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="template-panel__footer">
        <button
          className="template-panel__insert-btn"
          onClick={handleInsert}
          disabled={!selectedTemplate}
        >
          カーソル位置に挿入
        </button>
        <button
          className="template-panel__replace-btn"
          onClick={() => {
            if (selectedTemplate) setShowDialog(true);
          }}
          disabled={!selectedTemplate}
        >
          ドキュメント全体に適用
        </button>
      </div>

      {/* プレースホルダー入力ダイアログ */}
      {showDialog && selectedTemplate && (
        <PlaceholderDialog
          template={selectedTemplate}
          onConfirm={handleDialogConfirm}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント: プレースホルダー入力ダイアログ
// ---------------------------------------------------------------------------

interface PlaceholderDialogProps {
  template: AiTemplate;
  onConfirm: (values: Record<string, string>, mode: 'cursor' | 'replace') => void;
  onCancel: () => void;
}

const PlaceholderDialog: React.FC<PlaceholderDialogProps> = ({
  template,
  onConfirm,
  onCancel,
}) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    // デフォルト値で初期化
    const init: Record<string, string> = {};
    for (const p of template.placeholders) {
      if (p.defaultValue) init[p.key] = p.defaultValue;
    }
    return init;
  });
  const [insertMode, setInsertMode] = useState<'cursor' | 'replace'>('cursor');

  const missingRequired = getMissingRequired(template, values);
  const canConfirm = missingRequired.length === 0;

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="placeholder-dialog" role="dialog" aria-label="テンプレートの設定">
      <div className="placeholder-dialog__backdrop" onClick={onCancel} />
      <div className="placeholder-dialog__content">
        <div className="placeholder-dialog__header">
          <h3>{template.name} - 設定</h3>
          <button onClick={onCancel} aria-label="キャンセル">×</button>
        </div>

        <div className="placeholder-dialog__body">
          {template.placeholders.map((placeholder) => (
            <PlaceholderField
              key={placeholder.key}
              placeholder={placeholder}
              value={values[placeholder.key] ?? ''}
              onChange={(v) => handleChange(placeholder.key, v)}
            />
          ))}
        </div>

        <div className="placeholder-dialog__footer">
          <label>
            <input
              type="radio"
              name="insertMode"
              value="cursor"
              checked={insertMode === 'cursor'}
              onChange={() => setInsertMode('cursor')}
            />
            カーソル位置に挿入
          </label>
          <label>
            <input
              type="radio"
              name="insertMode"
              value="replace"
              checked={insertMode === 'replace'}
              onChange={() => setInsertMode('replace')}
            />
            ドキュメント全体を置換
          </label>

          {missingRequired.length > 0 && (
            <p className="placeholder-dialog__error">
              必須項目が未入力です: {missingRequired.map((p) => p.label).join('、')}
            </p>
          )}

          <button onClick={onCancel}>キャンセル</button>
          <button
            className="placeholder-dialog__confirm-btn"
            onClick={() => onConfirm(values, insertMode)}
            disabled={!canConfirm}
          >
            挿入
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント: プレースホルダーフィールド
// ---------------------------------------------------------------------------

interface PlaceholderFieldProps {
  placeholder: Placeholder;
  value: string;
  onChange: (value: string) => void;
}

const PlaceholderField: React.FC<PlaceholderFieldProps> = ({
  placeholder,
  value,
  onChange,
}) => {
  const id = `placeholder-${placeholder.key}`;

  return (
    <div className="placeholder-field">
      <label htmlFor={id} className="placeholder-field__label">
        {placeholder.label}
        {placeholder.required && <span className="placeholder-field__required"> *</span>}
      </label>
      {placeholder.description && (
        <p className="placeholder-field__description">{placeholder.description}</p>
      )}

      {placeholder.type === 'select' && placeholder.options ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">選択してください</option>
          {placeholder.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : placeholder.type === 'textarea' || placeholder.type === 'code' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={placeholder.type === 'code' ? 8 : 4}
          placeholder={placeholder.type === 'code' ? 'コードを貼り付けてください' : ''}
          className={placeholder.type === 'code' ? 'placeholder-field__code-input' : ''}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${placeholder.label}を入力`}
        />
      )}
    </div>
  );
};

export default TemplatePanel;
