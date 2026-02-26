/**
 * タブバーコンポーネント
 *
 * window-tab-session-design.md に準拠:
 * - タブの開く・閉じる・切り替え
 * - 未保存マーカー表示 (● filename.md)
 * - タブ閉じる時の未保存確認
 */

import { useTabStore } from '../../store/tabStore';

interface TabBarProps {
  onCloseTab?: (tabId: string, isDirty: boolean) => void;
  onNewTab?: () => void;
}

export function TabBar({ onCloseTab, onNewTab }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab } = useTabStore();

  return (
    <div className="tab-bar flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto">
      <div className="flex items-center min-w-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={`tab-item group flex items-center gap-1 px-3 py-2 cursor-pointer border-r border-gray-200 text-sm whitespace-nowrap select-none transition-colors ${
              tab.id === activeTabId
                ? 'bg-white text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate max-w-40">
              {tab.isDirty && (
                <span className="text-orange-500 mr-1" title="未保存">
                  ●
                </span>
              )}
              {tab.fileName}
            </span>
            <button
              type="button"
              className="ml-1 w-4 h-4 flex items-center justify-center rounded-sm text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab?.(tab.id, tab.isDirty);
              }}
              title="タブを閉じる"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 text-lg"
        onClick={onNewTab}
        title="新しいタブ"
      >
        +
      </button>
    </div>
  );
}
