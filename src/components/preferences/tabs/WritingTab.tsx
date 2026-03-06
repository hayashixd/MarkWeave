/**
 * 執筆スタイル設定タブ
 *
 * ペルソナ対応:
 * - 知識管理者・一般ライター: フォーカスモード / タイプライターモード / Zen Mode の設定
 *
 * Phase 7 ロードマップ: フォーカスモード・タイプライターモード・Zen モード
 */

import { useSettingsStore } from '../../../store/settingsStore';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  shortcut,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  shortcut?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">
              {shortcut}
            </kbd>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0 mt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={[
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            checked ? 'bg-blue-500' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
            ].join(' ')}
          />
        </button>
      </div>
    </label>
  );
}

export function WritingTab() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">集中・執筆モード</h2>
      <div className="bg-gray-50 rounded-lg px-4 mb-6">
        <ToggleRow
          label="フォーカスモード"
          description="カーソルのあるブロック以外を薄く表示し、今書いている箇所に集中できます。"
          checked={settings.editor.focusMode}
          onChange={(v) => updateSettings({ editor: { focusMode: v } })}
          shortcut="Ctrl+Shift+F"
        />
        <ToggleRow
          label="タイプライターモード"
          description="カーソル行を常に画面の中央に保ちます。長文執筆で首や目の疲れを軽減します。"
          checked={settings.editor.typewriterMode}
          onChange={(v) => updateSettings({ editor: { typewriterMode: v } })}
          shortcut="Ctrl+Shift+T"
        />
        <ToggleRow
          label="Zen モード"
          description="タブバー・サイドバー・ステータスバーを非表示にして執筆に没頭できます。F11 でトグルできます。"
          checked={settings.editor.zenMode}
          onChange={(v) => updateSettings({ editor: { zenMode: v } })}
          shortcut="F11"
        />
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ヒント</h2>
      <div className="text-xs text-gray-500 space-y-1.5 bg-blue-50 rounded-lg px-4 py-3">
        <p>・フォーカスモード + タイプライターモードを同時に使うと最大限集中できます</p>
        <p>・Zen モード中は Escape キーで通常表示に戻れます</p>
        <p>・ツールバーの集中ボタン群でもこれらの設定をトグルできます</p>
      </div>
    </div>
  );
}
