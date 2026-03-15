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
 *   - カスタムテンプレートの作成・編集・削除
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  listTemplates,
  searchTemplates,
  fillTemplate,
  getMissingRequired,
  isCustomTemplate,
  type AiTemplate,
  type TemplateCategory,
  type Placeholder,
} from '../../ai/templates/template-registry';
import {
  useCustomAiTemplateStore,
  type CustomAiTemplateInput,
} from '../../store/customAiTemplateStore';

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
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AiTemplate | null>(null);

  // カスタムテンプレートストアの購読（必要なアクションのみ）
  const deleteCustomAiTemplate = useCustomAiTemplateStore((s) => s.deleteCustomAiTemplate);

  // テンプレートリストの再取得トリガー用（カスタムテンプレート変更時）
  const customTemplates = useCustomAiTemplateStore((s) => s.templates);

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
    // customTemplates を依存に含めて、カスタムテンプレート追加・削除時にリストを更新
  }, [selectedCategory, searchQuery, customTemplates]);

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

  const handleNewTemplate = useCallback(() => {
    setEditingTemplate(null);
    setShowEditor(true);
  }, []);

  const handleEditTemplate = useCallback((template: AiTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  }, []);

  const handleDeleteTemplate = useCallback(async (template: AiTemplate) => {
    await deleteCustomAiTemplate(template.id);
    if (selectedTemplate?.id === template.id) {
      setSelectedTemplate(null);
    }
  }, [deleteCustomAiTemplate, selectedTemplate]);

  const handleEditorClose = useCallback(() => {
    setShowEditor(false);
    setEditingTemplate(null);
  }, []);

  return (
    <div className="template-panel" role="dialog" aria-label="AIテンプレート">
      {/* ヘッダー */}
      <div className="template-panel__header">
        <h2>AI テンプレート</h2>
        <div className="template-panel__header-actions">
          <button
            className="template-panel__new-btn"
            onClick={handleNewTemplate}
            aria-label="新規テンプレート"
            title="カスタムテンプレートを作成"
          >
            +
          </button>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>
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
              <div className="template-panel__list-item-content">
                <strong className="template-panel__template-name">
                  {template.name}
                  {isCustomTemplate(template.id) && (
                    <span className="template-panel__custom-badge">カスタム</span>
                  )}
                </strong>
                <p className="template-panel__template-desc">{template.description}</p>
              </div>
              {isCustomTemplate(template.id) && (
                <div className="template-panel__item-actions">
                  <button
                    className="template-panel__item-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTemplate(template);
                    }}
                    aria-label={`${template.name} を編集`}
                    title="編集"
                  >
                    ✎
                  </button>
                  <button
                    className="template-panel__item-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template);
                    }}
                    aria-label={`${template.name} を削除`}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              )}
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

      {/* カスタムテンプレート作成・編集ダイアログ */}
      {showEditor && (
        <CustomTemplateEditor
          template={editingTemplate}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// サブコンポーネント: カスタムテンプレート作成・編集ダイアログ
// ---------------------------------------------------------------------------

interface CustomTemplateEditorProps {
  /** 編集対象（null = 新規作成） */
  template: AiTemplate | null;
  onClose: () => void;
}

const EMPTY_PLACEHOLDER: Placeholder = {
  key: '',
  label: '',
  description: '',
  type: 'text',
  required: false,
};

const CustomTemplateEditor: React.FC<CustomTemplateEditorProps> = ({
  template,
  onClose,
}) => {
  const addCustomAiTemplate = useCustomAiTemplateStore((s) => s.addCustomAiTemplate);
  const updateCustomAiTemplate = useCustomAiTemplateStore((s) => s.updateCustomAiTemplate);

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'general');
  const [tags, setTags] = useState(template?.tags.join(', ') ?? '');
  const [content, setContent] = useState(template?.content ?? '');
  const [placeholders, setPlaceholders] = useState<Placeholder[]>(
    template?.placeholders ?? [],
  );
  const [error, setError] = useState('');

  const isEditing = template !== null;

  const canSave = name.trim() !== '' && content.trim() !== '';

  const handleAddPlaceholder = () => {
    setPlaceholders((prev) => [...prev, { ...EMPTY_PLACEHOLDER, key: `FIELD_${prev.length + 1}` }]);
  };

  const handleUpdatePlaceholder = (index: number, field: keyof Placeholder, value: string | boolean) => {
    setPlaceholders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  };

  const handleRemovePlaceholder = (index: number) => {
    setPlaceholders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!canSave) {
      setError('テンプレート名と内容は必須です');
      return;
    }

    // プレースホルダーの key が空のものは除外
    const validPlaceholders = placeholders.filter((p) => p.key.trim() !== '');

    const data: CustomAiTemplateInput = {
      name: name.trim(),
      description: description.trim(),
      category,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      content,
      placeholders: validPlaceholders,
    };

    if (isEditing) {
      await updateCustomAiTemplate(template.id, data);
    } else {
      await addCustomAiTemplate(data);
    }
    onClose();
  };

  return (
    <div className="custom-template-editor" role="dialog" aria-label={isEditing ? 'テンプレートを編集' : '新規テンプレート'}>
      <div className="custom-template-editor__backdrop" onClick={onClose} />
      <div className="custom-template-editor__content">
        <div className="custom-template-editor__header">
          <h3>{isEditing ? 'テンプレートを編集' : '新規テンプレート'}</h3>
          <button onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="custom-template-editor__body">
          {/* テンプレート名 */}
          <div className="custom-template-editor__field">
            <label htmlFor="ct-name">名前 *</label>
            <input
              id="ct-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="テンプレート名"
            />
          </div>

          {/* 説明 */}
          <div className="custom-template-editor__field">
            <label htmlFor="ct-desc">説明</label>
            <input
              id="ct-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このテンプレートの概要"
            />
          </div>

          {/* カテゴリ */}
          <div className="custom-template-editor__field">
            <label htmlFor="ct-category">カテゴリ</label>
            <select
              id="ct-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as (TemplateCategory | 'all')[])
                .filter((c) => c !== 'all')
                .map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
            </select>
          </div>

          {/* タグ */}
          <div className="custom-template-editor__field">
            <label htmlFor="ct-tags">タグ（カンマ区切り）</label>
            <input
              id="ct-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="タグ1, タグ2, タグ3"
            />
          </div>

          {/* 内容 */}
          <div className="custom-template-editor__field">
            <label htmlFor="ct-content">
              内容 *
              <span className="custom-template-editor__hint">
                {' '}（{'{{KEY}}'} でプレースホルダーを定義）
              </span>
            </label>
            <textarea
              id="ct-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="Markdownテンプレート内容を入力..."
            />
          </div>

          {/* プレースホルダー定義 */}
          <div className="custom-template-editor__placeholders">
            <div className="custom-template-editor__placeholders-header">
              <label>プレースホルダー</label>
              <button
                className="custom-template-editor__add-ph-btn"
                onClick={handleAddPlaceholder}
                type="button"
              >
                + 追加
              </button>
            </div>

            {placeholders.map((ph, index) => (
              <div key={index} className="custom-template-editor__ph-row">
                <input
                  type="text"
                  value={ph.key}
                  onChange={(e) => handleUpdatePlaceholder(index, 'key', e.target.value)}
                  placeholder="KEY"
                  className="custom-template-editor__ph-key"
                />
                <input
                  type="text"
                  value={ph.label}
                  onChange={(e) => handleUpdatePlaceholder(index, 'label', e.target.value)}
                  placeholder="ラベル"
                  className="custom-template-editor__ph-label"
                />
                <select
                  value={ph.type}
                  onChange={(e) => handleUpdatePlaceholder(index, 'type', e.target.value)}
                  className="custom-template-editor__ph-type"
                >
                  <option value="text">テキスト</option>
                  <option value="textarea">テキストエリア</option>
                  <option value="select">選択</option>
                  <option value="code">コード</option>
                </select>
                <label className="custom-template-editor__ph-required">
                  <input
                    type="checkbox"
                    checked={ph.required}
                    onChange={(e) => handleUpdatePlaceholder(index, 'required', e.target.checked)}
                  />
                  必須
                </label>
                <button
                  className="custom-template-editor__ph-remove"
                  onClick={() => handleRemovePlaceholder(index)}
                  aria-label="削除"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {error && <p className="custom-template-editor__error">{error}</p>}
        </div>

        <div className="custom-template-editor__footer">
          <button onClick={onClose}>キャンセル</button>
          <button
            className="custom-template-editor__save-btn"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isEditing ? '更新' : '作成'}
          </button>
        </div>
      </div>
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
