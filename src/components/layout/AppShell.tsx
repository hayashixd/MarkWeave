/**
 * App Shell - アプリケーション全体レイアウト
 *
 * 左: サイドバー（ファイルツリー）— Phase 1 では初期非表示
 * 上: タブバー
 * 中央: エディタ（メインコンテンツ領域を最大化）
 *
 * window-tab-session-design.md に準拠:
 * - タブの追加・削除・切り替え
 * - 未保存確認ダイアログ
 * - Ctrl+S での即時保存
 * - Ctrl+N での新規タブ
 */

import { useState, useCallback, useEffect } from 'react';
import { TabBar } from '../tabs/TabBar';
import { Sidebar } from '../sidebar/Sidebar';
import { MarkdownEditor } from '../editor';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { EditorErrorBoundary } from '../ErrorBoundary/EditorErrorBoundary';
import { ToastContainer } from '../toast/ToastContainer';
import { useTabStore } from '../../store/tabStore';
import { useTitleBar } from '../../hooks/useTitleBar';
import { useCloseGuard } from '../../hooks/useCloseGuard';
import { useSessionRestore } from '../../hooks/useSessionRestore';
import { useFileOpenListener } from '../../hooks/useFileOpenListener';

export function AppShell() {
  // Phase 1 ではサイドバーはデフォルト非表示（機能がないため）
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { tabs, activeTabId, addTab, removeTab, updateContent, getActiveTab, getTab, markSaved } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // タイトルバーにアクティブタブの未保存マーカーを反映
  useTitleBar();

  // ウィンドウクローズ時の未保存ガード
  useCloseGuard();

  // セッション復元（前回開いていたタブを復元、なければ空タブ）
  useSessionRestore();

  // 外部ファイルオープンイベント受信（シングルインスタンス制御・CLI引数対応）
  useFileOpenListener();

  // 新しいタブを開く
  const handleNewTab = useCallback(() => {
    addTab({
      filePath: null,
      fileName: 'Untitled',
      content: '',
      savedContent: '',
    });
  }, [addTab]);

  // タブを閉じる（未保存確認つき）
  const handleCloseTab = useCallback(
    (tabId: string, isDirty: boolean) => {
      if (isDirty) {
        // Phase 1 では window.confirm を使用。
        // Phase 3 以降で Tauri ダイアログに置き換え。
        const confirmed = window.confirm(
          '変更が保存されていません。閉じてもよろしいですか？',
        );
        if (!confirmed) return;
      }
      removeTab(tabId);
    },
    [removeTab],
  );

  // エディタからのコンテンツ変更
  const handleContentChange = useCallback(
    (markdown: string) => {
      if (!activeTabId) return;
      updateContent(activeTabId, markdown);
    },
    [activeTabId, updateContent],
  );

  // キーボードショートカット
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // IME 変換中はショートカットを無視
      if (e.isComposing || e.keyCode === 229) return;

      // Ctrl+,: 設定ダイアログを開く
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setPreferencesOpen(true);
        return;
      }

      // Ctrl+N: 新しいタブ
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewTab();
        return;
      }

      // Ctrl+S: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const tab = getActiveTab();
        if (!tab) return;

        if (!tab.filePath) {
          // 未保存ファイル: Phase 1 ではまだ Save As 未実装
          // Phase 3 で Tauri ダイアログを使って実装
          return;
        }

        // 即時保存（Tauri コマンド呼び出しはここでは省略、
        // useAutoSave フックが実際のプロジェクトで統合される）
        markSaved(tab.id);
        return;
      }

      // Ctrl+W: タブを閉じる
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        const tab = getActiveTab();
        if (tab) {
          handleCloseTab(tab.id, tab.isDirty);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewTab, handleCloseTab, getActiveTab, getTab, markSaved]);

  return (
    <div className="app-shell flex flex-col h-screen">
      {/* タブバー */}
      <TabBar onCloseTab={handleCloseTab} onNewTab={handleNewTab} />

      {/* メインエリア */}
      <div className="flex flex-1 min-h-0">
        {/* サイドバー */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* エディタエリア */}
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab ? (
            <EditorErrorBoundary key={activeTab.id}>
              <MarkdownEditor
                initialContent={activeTab.content}
                onContentChange={handleContentChange}
              />
            </EditorErrorBoundary>
          ) : (
            <EmptyState onNewTab={handleNewTab} />
          )}
        </div>
      </div>

      {/* ステータスバー */}
      <StatusBar tab={activeTab ?? null} />

      {/* プリファレンスダイアログ */}
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />

      {/* トースト通知 */}
      <ToastContainer />
    </div>
  );
}

/**
 * ファイルが開かれていない時の空状態
 */
function EmptyState({ onNewTab }: { onNewTab: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-8">
        <div className="text-6xl mb-6 text-gray-300">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <p className="text-lg text-gray-500 mb-2">ファイルが開かれていません</p>
        <p className="text-sm text-gray-400 mb-6">
          新しいファイルを作成するか、既存のファイルを開いてください
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onNewTab}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
          >
            新しいファイルを作成
          </button>
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Ctrl+N</kbd>
              {' '}新規作成
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Ctrl+O</kbd>
              {' '}ファイルを開く
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ tab }: { tab: ReturnType<typeof useTabStore.getState>['tabs'][number] | null }) {
  return (
    <div className="status-bar flex items-center justify-between px-4 py-1 bg-gray-100 border-t border-gray-200 text-xs text-gray-500">
      <div className="flex items-center gap-3">
        {tab ? (
          <>
            <span>{tab.filePath ?? '未保存'}</span>
            {tab.isDirty && (
              <span className="text-orange-500">● 変更あり</span>
            )}
          </>
        ) : (
          <span>準備完了</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>Markdown</span>
      </div>
    </div>
  );
}
