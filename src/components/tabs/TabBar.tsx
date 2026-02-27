/**
 * タブバーコンポーネント
 *
 * window-tab-session-design.md に準拠:
 * - タブの開く・閉じる・切り替え
 * - 未保存マーカー表示 (● filename.md)
 * - タブ閉じる時の未保存確認
 *
 * UI 改善:
 * - 閉じるボタンを常時表示（ホバー時のみだと見つけにくい）
 * - アクティブタブの視認性向上（下ボーダーに青色アクセント）
 */

import { useTabStore } from '../../store/tabStore';

interface TabBarProps {
  onCloseTab?: (tabId: string, isDirty: boolean) => void;
  onNewTab?: () => void;
}

export function TabBar({ onCloseTab, onNewTab }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab } = useTabStore();

  return (
    <div className="tab-bar flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto flex-shrink-0">
      <div className="flex items-center min-w-0 flex-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`tab-item flex items-center gap-1.5 px-3 py-2 cursor-pointer border-r border-gray-200 text-sm whitespace-nowrap select-none transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium border-b-2 border-b-blue-500'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="truncate max-w-40">
                {tab.isDirty && (
                  <span className="text-orange-500 mr-1" title="未保存の変更があります">
                    ●
                  </span>
                )}
                {tab.fileName}
              </span>
              <button
                type="button"
                className={`ml-1 w-5 h-5 flex items-center justify-center rounded-sm transition-colors ${
                  isActive
                    ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'
                    : 'text-gray-300 hover:text-gray-600 hover:bg-gray-200'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(tab.id, tab.isDirty);
                }}
                title="タブを閉じる"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="px-3 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 text-lg flex-shrink-0"
        onClick={onNewTab}
        title="新しいタブ (Ctrl+N)"
      >
        +
      </button>
    </div>
  );
}
