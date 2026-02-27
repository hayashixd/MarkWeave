/**
 * サイドバーコンポーネント (Phase 1: 最小版)
 *
 * Phase 1 ではファイルツリーのプレースホルダーのみ。
 * Phase 3 でフォルダを開く機能・ファイルツリー表示を実装予定。
 */

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  if (!isOpen) {
    return (
      <div className="w-8 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-start pt-2 justify-center">
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="サイドバーを開く"
          aria-expanded={false}
          aria-controls="app-sidebar"
          title="サイドバーを開く"
        >
          <span aria-hidden="true">▶</span>
        </button>
      </div>
    );
  }

  return (
    <aside id="app-sidebar" className="w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col" aria-label="ファイルサイドバー">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          ファイル
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 text-sm"
          aria-label="サイドバーを閉じる"
          aria-expanded
          aria-controls="app-sidebar"
          title="サイドバーを閉じる"
        >
          <span aria-hidden="true">◀</span>
        </button>
      </div>
      <div className="flex-1 p-3 text-sm text-gray-400">
        <p>フォルダを開いてください</p>
        <p className="text-xs mt-2">Ctrl+Shift+O</p>
      </div>
    </aside>
  );
}
