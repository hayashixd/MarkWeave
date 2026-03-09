/**
 * プリファレンスダイアログ。
 *
 * user-settings-design.md §5.1 に準拠。
 * - 左ペイン: カテゴリ一覧（縦ナビゲーション）
 * - 右ペイン: 選択カテゴリの設定項目
 * - 閉じるボタンのみ（OK/キャンセルなし）。設定は即時反映・即時保存
 * - Phase 1 では外観・エディタのみ
 */

import { useState, useEffect, useCallback } from 'react';
import { AppearanceTab } from './tabs/AppearanceTab';
import { EditorTab } from './tabs/EditorTab';
import { WritingTab } from './tabs/WritingTab';
import { PluginsTab } from './tabs/PluginsTab';
import { SnippetsTab } from './tabs/SnippetsTab';

type TabId = 'appearance' | 'editor' | 'writing' | 'snippets' | 'plugins';

const TABS: { id: TabId; label: string }[] = [
  { id: 'appearance', label: '外観' },
  { id: 'editor', label: 'エディタ' },
  { id: 'writing', label: '執筆スタイル' },
  { id: 'snippets', label: 'スニペット' },
  { id: 'plugins', label: 'プラグイン' },
];

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('appearance');

  // Escape キーで閉じる
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        // バックドロップクリックで閉じる
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[640px] max-w-[90vw] h-[480px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h1 className="text-base font-semibold">設定</h1>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
            aria-label="閉じる"
          >
            &times;
          </button>
        </div>

        {/* 本体: 左ペイン + 右ペイン */}
        <div className="flex flex-1 min-h-0">
          {/* 左ペイン: カテゴリナビゲーション */}
          <nav className="w-36 border-r border-gray-200 py-2 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-1.5 text-sm ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* 右ペイン: 設定項目 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'editor' && <EditorTab />}
            {activeTab === 'writing' && <WritingTab />}
            {activeTab === 'snippets' && <SnippetsTab />}
            {activeTab === 'plugins' && <PluginsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
