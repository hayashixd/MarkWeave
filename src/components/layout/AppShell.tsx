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
 * - Ctrl+S での即時保存（未保存ファイルは Save As へフォールバック）
 * - Ctrl+Shift+S での名前を付けて保存
 * - Ctrl+O でファイルを開くダイアログ
 * - Ctrl+N での新規タブ
 *
 * file-workspace-design.md §15 に準拠:
 * - ドラッグ&ドロップでファイルを開く
 * - ドラッグ中のオーバーレイ表示
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { TabBar } from '../tabs/TabBar';
import { Sidebar } from '../sidebar/Sidebar';
import type { SidebarTab } from '../sidebar/Sidebar';
import { MarkdownEditor } from '../editor';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { EditorErrorBoundary } from '../ErrorBoundary/EditorErrorBoundary';
import { ToastContainer } from '../toast/ToastContainer';
import { useTabStore } from '../../store/tabStore';
import type { FileEncoding, LineEnding } from '../../store/tabStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTitleBar } from '../../hooks/useTitleBar';
import { useCloseGuard } from '../../hooks/useCloseGuard';
import { useSessionRestore } from '../../hooks/useSessionRestore';
import { useFileOpenListener } from '../../hooks/useFileOpenListener';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDropListener } from '../../hooks/useDropListener';
import { useOpenFileDialog, useSaveAsDialog } from '../../hooks/useFileDialogs';
import { writeFile } from '../../lib/tauri-commands';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  // エディタインスタンスへの参照（アウトラインパネル等で使用）
  const [currentEditor, setCurrentEditor] = useState<Editor | null>(null);
  const { tabs, activeTabId, addTab, removeTab, updateContent, getActiveTab, getTab } =
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

  // ドラッグ&ドロップでファイルを開く
  const { isDragOver } = useDropListener();

  // ファイルダイアログ
  const openFileDialog = useOpenFileDialog();
  const saveAsDialog = useSaveAsDialog();
  const { openWorkspace } = useWorkspaceStore();

  // フォルダを開くダイアログ（Ctrl+Shift+O）
  const openFolderDialog = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === 'string') {
        openWorkspace(dir);
        setSidebarOpen(true);
        setSidebarTab('files');
      }
    } catch {
      // Tauri 外ではスキップ
    }
  }, [openWorkspace]);
  const openFolderDialogRef = useRef(openFolderDialog);
  openFolderDialogRef.current = openFolderDialog;

  // IME 変換中フラグ（useAutoSave に渡すため window レベルで追跡）
  const isComposingRef = useRef(false);

  // 自動保存フック（アクティブタブに対して動作）
  const { scheduleSave, saveNow, flushPendingSave } = useAutoSave({
    tabId: activeTabId ?? '',
    isComposing: () => isComposingRef.current,
    writeFn: writeFile,
  });

  // flushPendingSave を ref 経由で参照（useEffect の deps を最小化）
  const flushRef = useRef(flushPendingSave);
  flushRef.current = flushPendingSave;

  // saveAsDialog を ref で保持（keydown handler の deps を安定化）
  const saveAsDialogRef = useRef(saveAsDialog);
  saveAsDialogRef.current = saveAsDialog;

  // openFileDialog を ref で保持
  const openFileDialogRef = useRef(openFileDialog);
  openFileDialogRef.current = openFileDialog;

  // IME 変換イベントをキャプチャフェーズで監視
  // compositionend 後に pending になっている自動保存を即時スケジュール
  useEffect(() => {
    const handleStart = () => {
      isComposingRef.current = true;
    };
    const handleEnd = () => {
      isComposingRef.current = false;
      flushRef.current();
    };
    window.addEventListener('compositionstart', handleStart, true);
    window.addEventListener('compositionend', handleEnd, true);
    return () => {
      window.removeEventListener('compositionstart', handleStart, true);
      window.removeEventListener('compositionend', handleEnd, true);
    };
  }, []); // 空の依存配列: ref 経由のため再登録不要

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

  // エディタからのコンテンツ変更 → ストア更新 + 自動保存スケジュール
  const handleContentChange = useCallback(
    (markdown: string) => {
      if (!activeTabId) return;
      updateContent(activeTabId, markdown);
      scheduleSave();
    },
    [activeTabId, updateContent, scheduleSave],
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

      // Ctrl+Shift+O: フォルダを開くダイアログ
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        openFolderDialogRef.current();
        return;
      }

      // Ctrl+O: ファイルを開くダイアログ
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFileDialogRef.current();
        return;
      }

      // Ctrl+Shift+S: 名前を付けて保存
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveAsDialogRef.current();
        return;
      }

      // Ctrl+S: 即時保存（未保存ファイルは Save As にフォールバック）
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const tab = getActiveTab();
        if (!tab) return;

        if (!tab.filePath) {
          // 未保存ファイル（Untitled）: Save As ダイアログを開く
          saveAsDialogRef.current();
          return;
        }

        // useAutoSave の saveNow を呼び出してファイルを実際に書き込む
        saveNow();
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

      // Ctrl+Shift+L: サイドバー表示/非表示トグル
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }

      // Ctrl+Shift+1: アウトラインパネル表示
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '!') {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('outline');
        return;
      }

      // Ctrl+Shift+2: ファイルパネル表示
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '@') {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('files');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNewTab, handleCloseTab, getActiveTab, getTab, saveNow]);

  return (
    <div className="app-shell flex flex-col h-screen relative" role="application" aria-label="Markdown エディタ">
      {/* タブバー */}
      <TabBar onCloseTab={handleCloseTab} onNewTab={handleNewTab} />

      {/* メインエリア */}
      <main id="editor-panel" className="flex flex-1 min-h-0" role="main" aria-label="エディタ領域">
        {/* サイドバー */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          editor={currentEditor}
          onOpenFolder={openFolderDialog}
        />

        {/* エディタエリア */}
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTab ? (
            <EditorErrorBoundary key={activeTab.id}>
              <MarkdownEditor
                initialContent={activeTab.content}
                onContentChange={handleContentChange}
                onEditorReady={setCurrentEditor}
              />
            </EditorErrorBoundary>
          ) : (
            <EmptyState onNewTab={handleNewTab} onOpenFile={() => openFileDialogRef.current()} />
          )}
        </div>
      </main>

      {/* ステータスバー */}
      <StatusBar tab={activeTab ?? null} />

      {/* プリファレンスダイアログ */}
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />

      {/* トースト通知 */}
      <ToastContainer />

      {/* ドラッグ&ドロップオーバーレイ */}
      {isDragOver && <DropOverlay />}
    </div>
  );
}

/**
 * ドラッグ&ドロップ時のビジュアルフィードバックオーバーレイ。
 * file-workspace-design.md §15.3 に準拠。
 */
function DropOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-400 pointer-events-none">
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-xl px-10 py-8 shadow-lg">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-blue-500"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 12 15 15" />
        </svg>
        <p className="text-lg font-medium text-gray-700">
          ここにドロップして開く
        </p>
        <p className="text-sm text-gray-400">
          .md / .html ファイルに対応
        </p>
      </div>
    </div>
  );
}

/**
 * ファイルが開かれていない時の空状態
 */
function EmptyState({ onNewTab, onOpenFile }: { onNewTab: () => void; onOpenFile: () => void }) {
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
          <button
            type="button"
            onClick={onOpenFile}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
          >
            ファイルを開く
          </button>
          <p className="text-xs text-gray-400 mt-2">
            またはファイルをウィンドウにドラッグ&ドロップ
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
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
  const [encodingPopover, setEncodingPopover] = useState(false);
  const [lineEndingPopover, setLineEndingPopover] = useState(false);
  const [indentPopover, setIndentPopover] = useState(false);
  const { updateEncoding, updateLineEnding } = useTabStore();
  const { settings, updateSettings } = useSettingsStore();
  const encodingRef = useRef<HTMLDivElement>(null);
  const lineEndingRef = useRef<HTMLDivElement>(null);
  const indentRef = useRef<HTMLDivElement>(null);

  // ポップオーバー外クリックで閉じる
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (encodingPopover && encodingRef.current && !encodingRef.current.contains(e.target as Node)) {
        setEncodingPopover(false);
      }
      if (lineEndingPopover && lineEndingRef.current && !lineEndingRef.current.contains(e.target as Node)) {
        setLineEndingPopover(false);
      }
      if (indentPopover && indentRef.current && !indentRef.current.contains(e.target as Node)) {
        setIndentPopover(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [encodingPopover, lineEndingPopover, indentPopover]);

  const encodings: FileEncoding[] = ['UTF-8', 'UTF-8 BOM', 'Shift-JIS', 'EUC-JP'];
  const lineEndings: LineEnding[] = ['LF', 'CRLF'];

  const indentLabel = settings.editor.indentStyle === 'tabs'
    ? `タブ: ${settings.editor.sourceTabSize}`
    : `スペース: ${settings.editor.sourceTabSize}`;

  return (
    <div className="status-bar flex items-center justify-between px-4 py-1 bg-gray-100 border-t border-gray-200 text-xs text-gray-600" role="status" aria-live="polite">
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
        {/* インデント設定 */}
        <div ref={indentRef} className="relative">
          <button
            type="button"
            className="status-bar__button"
            onClick={() => { setIndentPopover((v) => !v); setEncodingPopover(false); setLineEndingPopover(false); }}
            title="インデント設定"
          >
            {indentLabel}
          </button>
          {indentPopover && (
            <div className="status-bar__popover">
              <div className="status-bar__popover-title">インデント設定</div>
              <div className="status-bar__popover-group">
                <div className="status-bar__popover-label">スタイル</div>
                {(['spaces', 'tabs'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`status-bar__popover-item${settings.editor.indentStyle === style ? ' status-bar__popover-item--active' : ''}`}
                    onClick={() => { updateSettings({ editor: { indentStyle: style } }); }}
                  >
                    {style === 'spaces' ? 'スペース' : 'タブ'}
                  </button>
                ))}
              </div>
              <div className="status-bar__popover-group">
                <div className="status-bar__popover-label">タブ幅</div>
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`status-bar__popover-item${settings.editor.sourceTabSize === size ? ' status-bar__popover-item--active' : ''}`}
                    onClick={() => { updateSettings({ editor: { sourceTabSize: size } }); }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 改行コード */}
        {tab && (
          <div ref={lineEndingRef} className="relative">
            <button
              type="button"
              className="status-bar__button"
              onClick={() => { setLineEndingPopover((v) => !v); setEncodingPopover(false); setIndentPopover(false); }}
              title="改行コード"
            >
              {tab.lineEnding}
            </button>
            {lineEndingPopover && (
              <div className="status-bar__popover">
                <div className="status-bar__popover-title">改行コード</div>
                {lineEndings.map((le) => (
                  <button
                    key={le}
                    type="button"
                    className={`status-bar__popover-item${tab.lineEnding === le ? ' status-bar__popover-item--active' : ''}`}
                    onClick={() => {
                      updateLineEnding(tab.id, le);
                      setLineEndingPopover(false);
                    }}
                  >
                    {le} {le === 'LF' ? '(Unix/macOS)' : '(Windows)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 文字コード */}
        {tab && (
          <div ref={encodingRef} className="relative">
            <button
              type="button"
              className="status-bar__button"
              onClick={() => { setEncodingPopover((v) => !v); setLineEndingPopover(false); setIndentPopover(false); }}
              title="文字コード"
            >
              {tab.encoding}
            </button>
            {encodingPopover && (
              <div className="status-bar__popover">
                <div className="status-bar__popover-title">文字コード</div>
                {encodings.map((enc) => (
                  <button
                    key={enc}
                    type="button"
                    className={`status-bar__popover-item${tab.encoding === enc ? ' status-bar__popover-item--active' : ''}`}
                    onClick={() => {
                      updateEncoding(tab.id, enc);
                      setEncodingPopover(false);
                    }}
                  >
                    {enc}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span>Markdown</span>
      </div>
    </div>
  );
}
