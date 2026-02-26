/**
 * App Shell - アプリケーション全体レイアウト
 *
 * 左: サイドバー（ファイルツリー）
 * 上: タブバー
 * 中央: エディタ
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
import { MarkdownEditor } from '../editor/Editor';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { useTabStore } from '../../store/tabStore';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { tabs, activeTabId, addTab, removeTab, updateContent, getActiveTab, getTab, markSaved } =
    useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // 初回起動: 空のタブを 1 つ開く
  useEffect(() => {
    if (tabs.length === 0) {
      addTab({
        filePath: null,
        fileName: 'Untitled',
        content: '',
        savedContent: '',
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
            <MarkdownEditor
              key={activeTab.id}
              initialContent={activeTab.content}
              onContentChange={handleContentChange}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg">ファイルが開かれていません</p>
                <p className="text-sm mt-2">
                  Ctrl+N で新しいファイルを作成
                </p>
              </div>
            </div>
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
