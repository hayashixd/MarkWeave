/**
 * エディタ動作設定タブ。
 *
 * user-settings-design.md §5.1 に準拠。
 * オートフォーマット・ソースモード関連の設定。
 * 変更は即時反映・即時保存。
 */

import { useSettingsStore } from '../../../store/settingsStore';
import type { EditorSettings } from '../../../settings/types';

export function EditorTab() {
  const { settings, updateSettings } = useSettingsStore();
  const editor = settings.editor;

  const update = (partial: Partial<EditorSettings>) => {
    updateSettings({ editor: partial });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">エディタ</h2>

      {/* トグル設定 */}
      <div className="space-y-3">
        <CheckboxRow
          label="オートフォーマット"
          description="# → 見出し、- → リスト等の自動変換"
          checked={editor.autoFormat}
          onChange={(v) => update({ autoFormat: v })}
        />
        <CheckboxRow
          label="スマートクォーテーション"
          description={'" → \u201c\u201d に自動変換'}
          checked={editor.smartQuotes}
          onChange={(v) => update({ smartQuotes: v })}
        />
        <CheckboxRow
          label="行番号を表示（ソースモード）"
          checked={editor.showLineNumbers}
          onChange={(v) => update({ showLineNumbers: v })}
        />
        <CheckboxRow
          label="折り返し（ソースモード）"
          checked={editor.wordWrap}
          onChange={(v) => update({ wordWrap: v })}
        />
        <CheckboxRow
          label="現在行のハイライト（ソースモード）"
          checked={editor.highlightCurrentLine}
          onChange={(v) => update({ highlightCurrentLine: v })}
        />
      </div>

      {/* スマートペーストモード */}
      <div>
        <label className="block text-sm font-medium mb-1">スマートペースト</label>
        <select
          value={editor.smartPasteMode}
          onChange={(e) =>
            update({ smartPasteMode: e.target.value as EditorSettings['smartPasteMode'] })
          }
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="auto">自動変換</option>
          <option value="ask">毎回確認</option>
          <option value="never">無効</option>
        </select>
      </div>

      {/* タブ幅 */}
      <div>
        <label className="block text-sm font-medium mb-1">タブ幅（ソースモード）</label>
        <input
          type="number"
          min={1}
          max={8}
          value={editor.sourceTabSize}
          onChange={(e) => update({ sourceTabSize: Number(e.target.value) })}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

function CheckboxRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-blue-600"
      />
      <div>
        <span className="text-sm">{label}</span>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
    </label>
  );
}
