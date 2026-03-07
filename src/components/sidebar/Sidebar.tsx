/**
 * サイドバーコンポーネント
 *
 * app-shell-design.md §7 に準拠:
 * - タブ切替でアウトライン / ファイルパネルを表示
 * - Ctrl+Shift+1 でアウトライン
 * - Ctrl+Shift+L でサイドバー表示/非表示トグル
 *
 * Phase 3 追加:
 * - アウトラインパネル（見出しナビゲーション）
 *
 * Phase 8 追加:
 * - AI タブ（AIテンプレートパネル）
 * - ペルソナ: AIパワーユーザー — テンプレートからMarkdownの足場を高速生成
 *
 * Phase 7.5 追加:
 * - バックリンクタブ（知識管理者: 現在ファイルへの逆参照を表示）
 */

import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { OutlinePanel } from '../Outline/OutlinePanel';
import { FileTreePanel } from './FileTreePanel';
import { TemplatePanel } from '../AiPanel/TemplatePanel';
import { BacklinksPanel } from './BacklinksPanel';

export type SidebarTab = 'outline' | 'files' | 'ai' | 'backlinks';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  editor?: Editor | null;
  onOpenFolder?: () => void;
  /** バックリンクパネル用: アクティブなタブのファイルパス */
  currentFilePath?: string | null;
  /** バックリンクパネル用: アクティブなタブのファイル名 */
  currentFileName?: string;
}

export function Sidebar({
  isOpen,
  onToggle,
  activeTab: controlledTab,
  onTabChange,
  editor = null,
  onOpenFolder,
  currentFilePath = null,
  currentFileName = '',
}: SidebarProps) {
  const [internalTab, setInternalTab] = useState<SidebarTab>('outline');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  // テンプレートをエディタに挿入するハンドラー
  const handleTemplateInsert = useCallback(
    (markdown: string, mode: 'cursor' | 'replace') => {
      if (!editor) return;
      if (mode === 'replace') {
        editor.commands.setContent(markdown);
      } else {
        // カーソル位置に挿入（現在ブロックの後に追加）
        editor.chain().focus().insertContent(markdown).run();
      }
    },
    [editor],
  );

  if (!isOpen) {
    return (
      <div className="sidebar w-8 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-start pt-2 justify-center">
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
    <aside
      id="app-sidebar"
      className="sidebar w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col"
      aria-label="サイドバー"
    >
      {/* ヘッダー: タブ切替 + 閉じるボタン */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex overflow-x-auto" role="tablist" aria-label="サイドバーパネル">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outline'}
            aria-controls="sidebar-panel-outline"
            className={`sidebar-tab ${activeTab === 'outline' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setActiveTab('outline')}
            title="アウトライン (Ctrl+Shift+1)"
          >
            アウトライン
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'files'}
            aria-controls="sidebar-panel-files"
            className={`sidebar-tab ${activeTab === 'files' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setActiveTab('files')}
            title="ファイル (Ctrl+Shift+2)"
          >
            ファイル
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ai'}
            aria-controls="sidebar-panel-ai"
            className={`sidebar-tab ${activeTab === 'ai' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
            onClick={() => setActiveTab('ai')}
            title="AIテンプレート (Ctrl+Shift+3)"
          >
            ✨ AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backlinks'}
            aria-controls="sidebar-panel-backlinks"
            className={`sidebar-tab ${activeTab === 'backlinks' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
            onClick={() => setActiveTab('backlinks')}
            title="バックリンク (Ctrl+Shift+4)"
          >
            🔗 Links
          </button>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 flex-shrink-0"
          aria-label="サイドバーを閉じる"
          aria-expanded
          aria-controls="app-sidebar"
          title="サイドバーを閉じる"
        >
          <span aria-hidden="true">◀</span>
        </button>
      </div>

      {/* パネルコンテンツ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'outline' && (
          <div
            id="sidebar-panel-outline"
            role="tabpanel"
            aria-labelledby="tab-outline"
          >
            <OutlinePanel editor={editor} />
          </div>
        )}
        {activeTab === 'files' && (
          <div
            id="sidebar-panel-files"
            role="tabpanel"
            aria-labelledby="tab-files"
          >
            <FileTreePanel onOpenFolder={onOpenFolder ?? (() => {})} />
          </div>
        )}
        {activeTab === 'ai' && (
          <div
            id="sidebar-panel-ai"
            role="tabpanel"
            aria-labelledby="tab-ai"
            className="h-full"
          >
            <TemplatePanel
              onClose={() => setActiveTab('outline')}
              onInsert={handleTemplateInsert}
            />
          </div>
        )}
        {activeTab === 'backlinks' && (
          <div
            id="sidebar-panel-backlinks"
            role="tabpanel"
            aria-labelledby="tab-backlinks"
          >
            <BacklinksPanel
              currentFilePath={currentFilePath}
              currentFileName={currentFileName}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
