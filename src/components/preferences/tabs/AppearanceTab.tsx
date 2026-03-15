/**
 * 外観設定タブ。
 *
 * user-settings-design.md §5.1 に準拠。
 * テーマ・フォント・行間・段落余白の設定。
 * 変更は即時反映・即時保存（OK/キャンセルなし）。
 *
 * Phase 7: テーマシステム拡張
 * - ビルトインテーマ一覧（light / dark / system / github / solarized-light / solarized-dark）
 * - テーマカスタマイザー（CSS 変数のオーバーライド GUI）
 */

import { useState } from 'react';
import { useSettingsStore } from '../../../store/settingsStore';
import type { AppearanceSettings } from '../../../settings/types';
import { BUILTIN_THEMES, themeManager } from '../../../themes/theme-manager';
import type { AppTheme } from '../../../themes/theme-manager';
import { ThemeCustomizer } from '../../ThemeCustomizer/ThemeCustomizer';
import { useTranslation } from '../../../i18n';

export function AppearanceTab() {
  const { settings, updateSettings } = useSettingsStore();
  const appearance = settings.appearance;
  const [showCustomizer, setShowCustomizer] = useState(false);
  const { t } = useTranslation('settings');

  const update = (partial: Partial<AppearanceSettings>) => {
    updateSettings({ appearance: partial });

    // テーマ変更時は即時反映
    if (partial.theme) {
      themeManager.applyTheme(partial.theme);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">外観</h2>

      {/* カラーテーマ */}
      <fieldset>
        <legend className="text-sm font-medium mb-2">カラーテーマ</legend>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_THEMES.map(({ id, label, description }) => (
            <label
              key={id}
              className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                appearance.theme === id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={id}
                checked={appearance.theme === id}
                onChange={() => update({ theme: id as AppTheme })}
                className="accent-blue-600 mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">{label}</span>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* テーマカスタマイザートグル */}
      <div>
        <button
          type="button"
          onClick={() => setShowCustomizer(!showCustomizer)}
          className="text-sm text-blue-600 hover:underline"
        >
          {showCustomizer ? 'カスタマイザーを閉じる' : 'テーマをカスタマイズ...'}
        </button>
        {showCustomizer && <ThemeCustomizer />}
      </div>

      {/* エディタフォント */}
      <div>
        <label className="block text-sm font-medium mb-1">エディタフォント</label>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={appearance.editorFontFamily}
            onChange={(e) => update({ editorFontFamily: e.target.value })}
            placeholder="テーマデフォルト"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <label className="text-sm whitespace-nowrap">
            サイズ:
            <input
              type="number"
              min={10}
              max={32}
              value={appearance.editorFontSize}
              onChange={(e) => update({ editorFontSize: Number(e.target.value) })}
              className="ml-1 w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* 行間 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          行間: {appearance.editorLineHeight}
        </label>
        <input
          type="range"
          min={1.0}
          max={3.0}
          step={0.1}
          value={appearance.editorLineHeight}
          onChange={(e) => update({ editorLineHeight: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* 段落間余白 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          段落間余白: {appearance.paragraphSpacing}px
        </label>
        <input
          type="range"
          min={0}
          max={40}
          step={2}
          value={appearance.paragraphSpacing}
          onChange={(e) => update({ paragraphSpacing: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* UI フォントサイズ */}
      <div>
        <label className="block text-sm font-medium mb-1">UI フォントサイズ</label>
        <input
          type="number"
          min={10}
          max={24}
          value={appearance.uiFontSize}
          onChange={(e) => update({ uiFontSize: Number(e.target.value) })}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* コードブロックフォント */}
      <div>
        <label className="block text-sm font-medium mb-1">コードブロックフォント</label>
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={appearance.codeBlockFontFamily}
            onChange={(e) => update({ codeBlockFontFamily: e.target.value })}
            placeholder="OS モノスペース"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <label className="text-sm whitespace-nowrap">
            サイズ:
            <input
              type="number"
              min={10}
              max={24}
              value={appearance.codeBlockFontSize}
              onChange={(e) => update({ codeBlockFontSize: Number(e.target.value) })}
              className="ml-1 w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* サイドバー詳細設定 */}
      <fieldset>
        <legend className="text-sm font-medium mb-2">サイドバー</legend>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.sidebar.showAdvancedTabs}
            onChange={(e) => updateSettings({ sidebar: { showAdvancedTabs: e.target.checked } })}
            className="accent-blue-600"
          />
          <span className="text-sm">{t('sidebar.showAdvancedTabs')}</span>
        </label>
      </fieldset>
    </div>
  );
}
