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
 *
 * Phase 7 追加:
 * - タグビュータブ（知識管理者: YAML FM tags の横断収集・フィルタ）
 * - グラフビュータブ（知識管理者: Wikiリンク関係の可視化）
 *
 * A-2 (Phase A):
 * - sidebar.showAdvancedTabs 設定が false のとき ai/backlinks/tags/graph/git タブを非表示
 * - アクティブタブが非表示になった場合は outline にフォールバック
 */

import { useState, useCallback, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { OutlinePanel } from '../Outline/OutlinePanel';
import { FileTreePanel } from './FileTreePanel';
import { TemplatePanel } from '../AiPanel/TemplatePanel';
import { BacklinksPanel } from './BacklinksPanel';
import { TagViewPanel } from './TagViewPanel';
import { GraphViewPanel } from './GraphViewPanel';
import { GitPanel } from './GitPanel';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';

export type SidebarTab = 'outline' | 'files' | 'ai' | 'backlinks' | 'tags' | 'graph' | 'git';

const ADVANCED_TABS: SidebarTab[] = ['ai', 'backlinks', 'tags', 'graph', 'git'];

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
  /** ワークスペースルートパス（バックリンクパネル用） */
  workspaceRoot?: string | null;
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
  workspaceRoot = null,
}: SidebarProps) {
  const [internalTab, setInternalTab] = useState<SidebarTab>('outline');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  const showAdvancedTabs = useSettingsStore((s) => s.settings.sidebar.showAdvancedTabs);
  const { t } = useTranslation('editor');

  // 高度タブが非表示になったとき、アクティブタブを outline にフォールバック
  useEffect(() => {
    if (!showAdvancedTabs && ADVANCED_TABS.includes(activeTab)) {
      setActiveTab('outline');
    }
  }, [showAdvancedTabs, activeTab, setActiveTab]);

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
          aria-label={t('sidebar.open')}
          aria-expanded={false}
          aria-controls="app-sidebar"
          title={t('sidebar.open')}
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
      aria-label={t('sidebar.label')}
    >
      {/* ヘッダー: タブ切替 + 閉じるボタン */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex overflow-x-auto" role="tablist" aria-label={t('sidebar.label')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outline'}
            aria-controls="sidebar-panel-outline"
            className={`sidebar-tab ${activeTab === 'outline' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setActiveTab('outline')}
            title={`${t('sidebar.tabOutline')} (Ctrl+Shift+1)`}
          >
            {t('sidebar.tabOutline')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'files'}
            aria-controls="sidebar-panel-files"
            className={`sidebar-tab ${activeTab === 'files' ? 'sidebar-tab--active' : ''}`}
            onClick={() => setActiveTab('files')}
            title={`${t('sidebar.tabFiles')} (Ctrl+Shift+2)`}
          >
            {t('sidebar.tabFiles')}
          </button>
          {showAdvancedTabs && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ai'}
                aria-controls="sidebar-panel-ai"
                className={`sidebar-tab ${activeTab === 'ai' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
                onClick={() => setActiveTab('ai')}
                title={`${t('sidebar.tabAi')} (Ctrl+Shift+3)`}
              >
                ✨ {t('sidebar.tabAi')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'backlinks'}
                aria-controls="sidebar-panel-backlinks"
                className={`sidebar-tab ${activeTab === 'backlinks' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
                onClick={() => setActiveTab('backlinks')}
                title={`${t('sidebar.tabBacklinks')} (Ctrl+Shift+4)`}
              >
                🔗 {t('sidebar.tabBacklinks')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tags'}
                aria-controls="sidebar-panel-tags"
                className={`sidebar-tab ${activeTab === 'tags' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
                onClick={() => setActiveTab('tags')}
                title={`${t('sidebar.tabTags')} (Ctrl+Shift+5)`}
              >
                🏷 {t('sidebar.tabTags')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'graph'}
                aria-controls="sidebar-panel-graph"
                className={`sidebar-tab ${activeTab === 'graph' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
                onClick={() => setActiveTab('graph')}
                title={`${t('sidebar.tabGraph')} (Ctrl+Shift+6)`}
              >
                🕸 {t('sidebar.tabGraph')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'git'}
                aria-controls="sidebar-panel-git"
                className={`sidebar-tab ${activeTab === 'git' ? 'sidebar-tab--active' : ''} whitespace-nowrap`}
                onClick={() => setActiveTab('git')}
                title={`${t('sidebar.tabGit')} (Ctrl+Shift+7)`}
              >
                ⎇ {t('sidebar.tabGit')}
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 flex-shrink-0"
          aria-label={t('sidebar.close')}
          aria-expanded
          aria-controls="app-sidebar"
          title={t('sidebar.close')}
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
        {showAdvancedTabs && activeTab === 'ai' && (
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
        {showAdvancedTabs && activeTab === 'backlinks' && (
          <div
            id="sidebar-panel-backlinks"
            role="tabpanel"
            aria-labelledby="tab-backlinks"
          >
            <BacklinksPanel
              currentFilePath={currentFilePath}
              currentFileName={currentFileName}
              workspaceRoot={workspaceRoot}
            />
          </div>
        )}
        {showAdvancedTabs && activeTab === 'tags' && (
          <div
            id="sidebar-panel-tags"
            role="tabpanel"
            aria-labelledby="tab-tags"
          >
            <TagViewPanel />
          </div>
        )}
        {showAdvancedTabs && activeTab === 'graph' && (
          <div
            id="sidebar-panel-graph"
            role="tabpanel"
            aria-labelledby="tab-graph"
            className="h-full"
          >
            <GraphViewPanel />
          </div>
        )}
        {showAdvancedTabs && activeTab === 'git' && (
          <div
            id="sidebar-panel-git"
            role="tabpanel"
            aria-labelledby="tab-git"
            className="h-full"
          >
            <GitPanel workspaceRoot={workspaceRoot} />
          </div>
        )}
      </div>
    </aside>
  );
}
