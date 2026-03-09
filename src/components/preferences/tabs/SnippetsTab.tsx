/**
 * スニペット管理タブ
 *
 * よく使うフレーズの登録・編集・削除を行う。
 * 登録したスニペットはスラッシュコマンドメニューから挿入可能。
 */

import { useState } from 'react';
import { useSnippetStore, type Snippet } from '../../../store/snippetStore';

/** スニペット編集フォームの状態 */
interface SnippetFormData {
  name: string;
  content: string;
  keywords: string;
}

const EMPTY_FORM: SnippetFormData = { name: '', content: '', keywords: '' };

function SnippetForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: SnippetFormData;
  onSubmit: (data: SnippetFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<SnippetFormData>(initial);

  const isValid = form.name.trim() !== '' && form.content.trim() !== '';

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">名前</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="例: 署名"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">内容（Markdown）</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="挿入するテキストを入力…"
          rows={4}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          キーワード（スペース区切り、任意）
        </label>
        <input
          type="text"
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          placeholder="例: sign 署名 サイン"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
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

function SnippetItem({
  snippet,
  onEdit,
  onDelete,
}: {
  snippet: Snippet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-base mt-0.5">📌</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{snippet.name}</div>
        <p className="text-xs text-gray-500 mt-0.5 truncate font-mono">{snippet.content}</p>
        {snippet.keywords && (
          <p className="text-xs text-gray-400 mt-0.5">キーワード: {snippet.keywords}</p>
        )}
      </div>
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
    </div>
  );
}

export function SnippetsTab() {
  const { snippets, addSnippet, updateSnippet, deleteSnippet } = useSnippetStore();
  const [mode, setMode] = useState<'list' | 'add' | { editing: string }>('list');

  const handleAdd = async (data: SnippetFormData) => {
    await addSnippet(data);
    setMode('list');
  };

  const handleUpdate = async (id: string, data: SnippetFormData) => {
    await updateSnippet(id, data);
    setMode('list');
  };

  const handleDelete = async (id: string) => {
    await deleteSnippet(id);
  };

  const editingId = typeof mode === 'object' ? mode.editing : null;
  const editingSnippet = editingId ? snippets.find((s) => s.id === editingId) : null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        スニペット
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        よく使うフレーズを登録しておくと、エディタで <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">/</kbd> を入力してスラッシュコマンドメニューから素早く挿入できます。
      </p>

      {mode === 'list' && (
        <>
          <button
            type="button"
            onClick={() => setMode('add')}
            className="mb-4 px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
          >
            + 新規スニペット
          </button>

          {snippets.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-lg">
              スニペットはまだ登録されていません
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg px-4">
              {snippets.map((snippet) => (
                <SnippetItem
                  key={snippet.id}
                  snippet={snippet}
                  onEdit={() => setMode({ editing: snippet.id })}
                  onDelete={() => handleDelete(snippet.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'add' && (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-2">新規スニペット</h3>
          <SnippetForm
            initial={EMPTY_FORM}
            onSubmit={handleAdd}
            onCancel={() => setMode('list')}
            submitLabel="登録"
          />
        </>
      )}

      {editingSnippet && (
        <>
          <h3 className="text-sm font-medium text-gray-700 mb-2">スニペットを編集</h3>
          <SnippetForm
            initial={{
              name: editingSnippet.name,
              content: editingSnippet.content,
              keywords: editingSnippet.keywords,
            }}
            onSubmit={(data) => handleUpdate(editingSnippet.id, data)}
            onCancel={() => setMode('list')}
            submitLabel="更新"
          />
        </>
      )}

      <div className="text-xs text-gray-500 space-y-1.5 bg-blue-50 rounded-lg px-4 py-3 mt-6">
        <p>・登録したスニペットは行頭で <code>/</code> を入力するとメニューに表示されます</p>
        <p>・スニペット名やキーワードで絞り込み検索ができます</p>
        <p>・内容にはMarkdown記法が使えます</p>
      </div>
    </div>
  );
}
