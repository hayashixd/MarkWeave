/**
 * テンプレート管理タブ
 *
 * ai-design.md §10.2 に準拠。
 * ドキュメントテンプレートの登録・編集・削除を行う。
 */

import { useState, useEffect } from 'react';
import { useDocumentTemplateStore, type DocumentTemplate } from '../../../store/documentTemplateStore';

interface TemplateFormData {
  name: string;
  content: string;
}

const EMPTY_FORM: TemplateFormData = { name: '', content: '' };

function TemplateForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: TemplateFormData;
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<TemplateFormData>(initial);

  const isValid = form.name.trim() !== '' && form.content.trim() !== '';

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">名前</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="例: プロジェクト提案書"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">内容（Markdown）</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="テンプレートの内容を入力…"
          rows={10}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y font-mono"
        />
      </div>
      <div className="text-xs text-gray-500">
        使用可能な変数: <code className="bg-gray-200 px-1 rounded">{'{{date}}'}</code>,{' '}
        <code className="bg-gray-200 px-1 rounded">{'{{datetime}}'}</code>,{' '}
        <code className="bg-gray-200 px-1 rounded">{'{{filename}}'}</code>,{' '}
        <code className="bg-gray-200 px-1 rounded">{'{{cursor}}'}</code>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={() => onSubmit(form)}
          className="px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function TemplateItem({
  template,
  onEdit,
  onDelete,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isBuiltin = template.id.startsWith('builtin-');

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-base mt-0.5">📄</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">
          {template.name}
          {isBuiltin && (
            <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              組み込み
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate font-mono">
          {template.content.slice(0, 80)}...
        </p>
      </div>
      {!isBuiltin && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            編集
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}

export function TemplatesTab() {
  const {
    getAllTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    loaded,
    loadTemplates,
  } = useDocumentTemplateStore();
  const [mode, setMode] = useState<'list' | 'add' | { editing: string }>('list');

  useEffect(() => {
    if (!loaded) loadTemplates();
  }, [loaded, loadTemplates]);

  const allTemplates = getAllTemplates();

  const handleAdd = async (data: TemplateFormData) => {
    await addTemplate(data);
    setMode('list');
  };

  const handleUpdate = async (id: string, data: TemplateFormData) => {
    await updateTemplate(id, data);
    setMode('list');
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
  };

  const editingId = typeof mode === 'object' ? mode.editing : null;
  const editingTemplate = editingId
    ? allTemplates.find((t) => t.id === editingId)
    : null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        ドキュメントテンプレート
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        新規ファイル作成時に使用するテンプレートを管理します。
        メニュー → ファイル → テンプレートから新規作成 で利用できます。
      </p>

      {mode === 'list' && (
        <>
          <button
            type="button"
            onClick={() => setMode('add')}
            className="mb-4 px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
          >
            + 新規テンプレート
          </button>

          <div className="bg-gray-50 rounded-lg px-4">
            {allTemplates.map((template) => (
              <TemplateItem
                key={template.id}
                template={template}
                onEdit={() => setMode({ editing: template.id })}
                onDelete={() => handleDelete(template.id)}
              />
            ))}
          </div>
        </>
      )}

      {mode === 'add' && (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-2">新規テンプレート</h3>
          <TemplateForm
            initial={EMPTY_FORM}
            onSubmit={handleAdd}
            onCancel={() => setMode('list')}
            submitLabel="登録"
          />
        </>
      )}

      {editingTemplate && (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-2">テンプレートを編集</h3>
          <TemplateForm
            initial={{
              name: editingTemplate.name,
              content: editingTemplate.content,
            }}
            onSubmit={(data) => handleUpdate(editingTemplate.id, data)}
            onCancel={() => setMode('list')}
            submitLabel="保存"
          />
        </>
      )}

      <div className="text-xs text-gray-500 space-y-1.5 bg-blue-50 rounded-lg px-4 py-3 mt-6">
        <p>・組み込みテンプレートは編集・削除できません</p>
        <p>・テンプレート変数は新規作成時に自動展開されます</p>
        <p>・<code>{'{{date}}'}</code>: 現在日付、<code>{'{{datetime}}'}</code>: 現在日時、<code>{'{{filename}}'}</code>: ファイル名、<code>{'{{cursor}}'}</code>: カーソル位置</p>
      </div>
    </div>
  );
}
