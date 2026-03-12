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

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Editor } from '@tiptap/react';
import { TabBar } from '../tabs/TabBar';
import { Sidebar } from '../sidebar/Sidebar';
import type { SidebarTab } from '../sidebar/Sidebar';
import { MarkdownEditor } from '../editor';
import { HtmlEditor } from '../editor';
import { PreferencesDialog } from '../preferences/PreferencesDialog';
import { EditorErrorBoundary } from '../ErrorBoundary/EditorErrorBoundary';
import { ToastContainer } from '../toast/ToastContainer';
import { useTabStore } from '../../store/tabStore';
import type { FileEncoding, LineEnding } from '../../store/tabStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTitleBar } from '../../hooks/useTitleBar';
import { useCloseGuard } from '../../hooks/useCloseGuard';
import { useSessionRestore, useRecoveryCheck } from '../../hooks/useSessionRestore';
import { startCheckpointScheduler } from '../../store/crash-recovery';
import { RecoveryDialog } from '../RecoveryDialog';
import { useFileOpenListener } from '../../hooks/useFileOpenListener';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useWindowState } from '../../hooks/useWindowState';
import { useDropListener } from '../../hooks/useDropListener';
import { useOpenFileDialog, useSaveAsDialog } from '../../hooks/useFileDialogs';
import { writeFile } from '../../lib/tauri-commands';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { ExportDialog } from '../Export/ExportDialog';
import { PdfExportDialog } from '../Export/PdfExportDialog';
import { PandocExportDialog } from '../Export/PandocExportDialog';
import type { PandocFormat } from '../../file/export/pandoc-exporter';
import { ConversionDialog } from '../Conversion/ConversionDialog';
import { useConvertFile } from '../../hooks/useConvertFile';
import { useRecentFilesStore } from '../../store/recentFilesStore';
import { useOpenFileAsTab } from '../../hooks/useOpenFileAsTab';
import { parseFrontMatter, parseYamlFields } from '../../lib/frontmatter';
import { useWindowSync } from '../../hooks/useWindowSync';
import { useWriteAccessTransferHandler } from '../../hooks/useWriteAccessTransfer';
import { useDetachedTabInit } from '../../hooks/useDetachedTabInit';
import { detachTabToWindow } from '../../lib/tauri-commands';
import { requestWriteAccess } from '../../hooks/useWriteAccessTransfer';
import { SplitEditorLayout } from '../SplitEditor';
import { usePaneStore } from '../../store/paneStore';
import type { TabState } from '../../store/tabStore';
import { PomodoroTimer } from '../pomodoro/PomodoroTimer';
import { WordSprintWidget } from '../wordSprint/WordSprintWidget';
import { calculateReadability, getReadabilityLabel } from '../../lib/readability-score';
import { FloatingTocPanel } from '../Outline/FloatingTocPanel';
import { useMenuListener } from '../../hooks/useMenuListener';
import i18next, { useTranslation } from '../../i18n';
import { useGitStore } from '../../store/gitStore';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pdfExportDialogOpen, setPdfExportDialogOpen] = useState(false);
  const [pandocExportDialogOpen, setPandocExportDialogOpen] = useState(false);
  const [pandocExportFormat, setPandocExportFormat] = useState<PandocFormat>('docx');
  // エディタインスタンスへの参照（アウトラインパネル等で使用）
  const [currentEditor, setCurrentEditor] = useState<Editor | null>(null);
  // フローティング TOC パネルの表示状態
  const [floatingTocOpen, setFloatingTocOpen] = useState(false);

  // Zen Mode / 設定
  const { settings, updateSettings } = useSettingsStore();
  const zenMode = settings.editor.zenMode;

  // 最近使ったファイル
  const { recentFiles, loadRecentFiles, addRecentFile } = useRecentFilesStore();
  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);
  // タブストアの購読を分離:
  // - tabIds: タブ一覧の ID のみ（ペイン同期用）。content 変更では再レンダリングしない。
  // - activeTabId: アクティブタブ ID
  // - activeTab: アクティブタブのメタデータ（content 除外で比較）
  // - アクション関数は安定参照のため個別に取得
  const activeTabId = useTabStore((s) => s.activeTabId);
  const addTab = useTabStore((s) => s.addTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const updateContent = useTabStore((s) => s.updateContent);
  const getActiveTab = useTabStore((s) => s.getActiveTab);
  const getTab = useTabStore((s) => s.getTab);

  // タブ ID リストのみ購読（content 変更では再レンダリングしない）
  const tabIds = useTabStore(
    (s) => s.tabs.map((t) => t.id),
    (prev, next) => prev.length === next.length && prev.every((id, i) => id === next[i]),
  );

  // アクティブタブ: content/savedContent 以外のフィールドが変わったときのみ再レンダリング
  const activeTab = useTabStore(
    (s) => {
      if (!s.activeTabId) return undefined;
      return s.tabs.find((t) => t.id === s.activeTabId);
    },
    (prev, next) => {
      if (prev === next) return true;
      if (!prev || !next) return false;
      return (
        prev.id === next.id &&
        prev.fileName === next.fileName &&
        prev.fileType === next.fileType &&
        prev.isReadOnly === next.isReadOnly &&
        prev.isDirty === next.isDirty &&
        prev.filePath === next.filePath &&
        prev.encoding === next.encoding &&
        prev.lineEnding === next.lineEnding
      );
    },
  );

  // ペイン分割ストア
  const panes = usePaneStore((s) => s.panes);
  const activePaneId = usePaneStore((s) => s.activePaneId);
  const addTabToPane = usePaneStore((s) => s.addTabToPane);
  const removeTabFromPane = usePaneStore((s) => s.removeTabFromPane);
  const splitPane = usePaneStore((s) => s.splitPane);
  const setActivePaneId = usePaneStore((s) => s.setActivePaneId);
  const setPaneActiveTab = usePaneStore((s) => s.setPaneActiveTab);

  // タブストアとペインストアの同期:
  // 新しいタブが追加されたらアクティブペインに登録する
  const prevTabIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentIds = tabIds;
    const prevIds = prevTabIdsRef.current;

    // 追加されたタブをペインに登録
    const addedIds = currentIds.filter((id) => !prevIds.includes(id));
    for (const id of addedIds) {
      addTabToPane(id);
    }

    // 削除されたタブをペインから除去
    const removedIds = prevIds.filter((id) => !currentIds.includes(id));
    for (const id of removedIds) {
      removeTabFromPane(id);
    }

    prevTabIdsRef.current = currentIds;
  }, [tabIds, addTabToPane, removeTabFromPane]);

  // アクティブペインのアクティブタブを tabStore の activeTabId に同期
  const activePane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const effectiveActiveTabId = activePane?.activeTabId ?? activeTabId;
  useEffect(() => {
    // 新規タブ追加直後は paneStore への反映前に一時的な不整合が起きるため、
    // activePane がそのタブをまだ保持していない場合は tabStore の巻き戻しを行わない。
    if (activeTabId && activePane && !activePane.tabs.includes(activeTabId)) {
      return;
    }

    if (effectiveActiveTabId && effectiveActiveTabId !== activeTabId) {
      useTabStore.getState().setActiveTab(effectiveActiveTabId);
    }
  }, [effectiveActiveTabId, activeTabId, activePane]);

  // tabStore の activeTabId が変更された場合、ペインのアクティブタブも同期
  useEffect(() => {
    if (!activeTabId) return;
    const paneForTab = panes.find((p) => p.tabs.includes(activeTabId));
    if (paneForTab && paneForTab.activeTabId !== activeTabId) {
      setPaneActiveTab(paneForTab.id, activeTabId);
    }
  }, [activeTabId, panes, setPaneActiveTab]);

  // アクティブタブが保存済みのファイルになったら最近使ったファイルに追加
  useEffect(() => {
    if (activeTab?.filePath && !activeTab.isDirty) {
      addRecentFile(activeTab.filePath, activeTab.fileName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.filePath, activeTab?.isDirty]);

  // タイトルバーにアクティブタブの未保存マーカーを反映
  useTitleBar();

  // ウィンドウクローズ時の未保存ガード
  useCloseGuard();

  // ウィンドウ状態（位置・サイズ・最大化）の復元
  useWindowState();

  // セッション復元（前回開いていたタブを復元、なければ空タブ）
  useSessionRestore();

  // クラッシュリカバリ判定（§10）
  const { recoveryEntries, handleRestore, handleDiscard } = useRecoveryCheck();

  // チェックポイントスケジューラ（30 秒ごとに未保存タブの状態を保存）
  useEffect(() => {
    // Tauri 環境以外では何もしない
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    const cleanup = startCheckpointScheduler(() =>
      useTabStore.getState().tabs
        .filter((tab) => tab.filePath !== null)
        .map((tab) => ({
          filePath: tab.filePath!,
          content: tab.content,
          savedContent: tab.savedContent,
          checkpointAt: new Date().toISOString(),
        })),
    );
    return cleanup;
  }, []);

  // 外部ファイルオープンイベント受信（シングルインスタンス制御・CLI引数対応）
  useFileOpenListener();

  // ウィンドウ間同期（Phase 7: マルチウィンドウ対応）
  useWindowSync();
  useWriteAccessTransferHandler();
  useDetachedTabInit();

  // ドラッグ&ドロップでファイルを開く
  const { isDragOver } = useDropListener();

  // ファイルダイアログ
  const openFileDialog = useOpenFileDialog();
  const saveAsDialog = useSaveAsDialog();
  const { root: workspaceRoot, openWorkspace, loadRecentWorkspaces } = useWorkspaceStore();

  // 起動時に最近使ったワークスペース履歴を読み込む（Phase 7）
  useEffect(() => {
    loadRecentWorkspaces();
  }, [loadRecentWorkspaces]);

  // Git 統合: ワークスペース変更時に Git 状態を更新しポーリングを開始 (Phase 7.5)
  const gitSettings = useSettingsStore((s) => s.settings.git);
  useEffect(() => {
    const gitStore = useGitStore.getState();
    if (workspaceRoot && gitSettings.enabled) {
      gitStore.refreshAll(workspaceRoot);
      gitStore.startPolling(workspaceRoot, gitSettings.autoPollInterval);
    } else {
      gitStore.reset();
    }
    return () => {
      gitStore.stopPolling();
    };
  }, [workspaceRoot, gitSettings.enabled, gitSettings.autoPollInterval]);

  // HTML ↔ MD 変換フック（Phase 6）
  const {
    conversionState,
    startSaveAsMarkdown,
    startSaveAsHtml,
    closeDialog: closeConversionDialog,
    convertAndSave,
    convertAndOpenTab,
  } = useConvertFile();
  const startSaveAsMarkdownRef = useRef(startSaveAsMarkdown);
  startSaveAsMarkdownRef.current = startSaveAsMarkdown;
  const startSaveAsHtmlRef = useRef(startSaveAsHtml);
  startSaveAsHtmlRef.current = startSaveAsHtml;

  // スラッシュコマンドからAIパネルを開くイベント受信 (Phase 7/8)
  useEffect(() => {
    const handler = () => {
      setSidebarOpen(true);
      setSidebarTab('ai');
    };
    window.addEventListener('open-ai-templates', handler);
    return () => window.removeEventListener('open-ai-templates', handler);
  }, []);

  // Wikilink クリックでファイルを開く (Phase 7.5)
  const openFileAsTab = useOpenFileAsTab();
  useEffect(() => {
    const handler = (e: Event) => {
      const { target } = (e as CustomEvent<{ target: string }>).detail;
      // フルパスでなければワークスペース相対として解決を試みる（ベストエフォート）
      openFileAsTab(target);
    };
    window.addEventListener('open-wikilink', handler);
    return () => window.removeEventListener('open-wikilink', handler);
  }, [openFileAsTab]);

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
          i18next.t('confirm.unsavedChanges'),
        );
        if (!confirmed) return;
      }
      removeTab(tabId);
    },
    [removeTab],
  );

  // タブを新しいウィンドウに切り出す（Phase 7: マルチウィンドウ）
  const handleDetachTab = useCallback(
    async (tabId: string) => {
      const tab = getTab(tabId);
      if (!tab) return;

      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const sourceLabel = getCurrentWebviewWindow().label;

        await detachTabToWindow({
          sourceWindowLabel: sourceLabel,
          filePath: tab.filePath,
          fileName: tab.fileName,
          content: tab.content,
          encoding: tab.encoding,
          lineEnding: tab.lineEnding,
          fileType: tab.fileType,
        });

        // 元のウィンドウからタブを削除
        removeTab(tabId);
      } catch {
        // Tauri 外ではスキップ
      }
    },
    [getTab, removeTab],
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

      // Ctrl+Shift+3 / Ctrl+Shift+A: AIテンプレートパネル表示 (Phase 8)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '#' || e.key === 'A')) {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('ai');
        return;
      }

      // Ctrl+Shift+4 / Ctrl+Shift+B: バックリンクパネル表示 (Phase 7.5)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '$' || e.key === 'B')) {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('backlinks');
        return;
      }

      // Ctrl+Shift+5: タグビューパネル表示 (Phase 7)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '%' || e.key === '5')) {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('tags');
        return;
      }

      // Ctrl+Shift+T: フローティング TOC パネル表示/非表示トグル
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setFloatingTocOpen((v) => !v);
        return;
      }

      // Ctrl+Shift+M: Markdownとして保存（HTML→MD変換）(html-editing-design.md §5.3)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        startSaveAsMarkdownRef.current();
        return;
      }

      // Ctrl+Shift+H: HTMLとして保存（MD→HTML変換）(html-editing-design.md §5.3)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        startSaveAsHtmlRef.current();
        return;
      }

      // Ctrl+Shift+E: HTML エクスポートダイアログ (export-interop-design.md §4.2)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setExportDialogOpen(true);
        return;
      }

      // Ctrl+Alt+P: PDF エクスポートダイアログ (export-interop-design.md §3)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'p') {
        e.preventDefault();
        setPdfExportDialogOpen(true);
        return;
      }

      // Ctrl+Alt+W: Word (.docx) エクスポートダイアログ (export-interop-design.md §7)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'w') {
        e.preventDefault();
        setPandocExportFormat('docx');
        setPandocExportDialogOpen(true);
        return;
      }

      // Ctrl+Alt+D: デイリーノート作成 (知識管理者ペルソナ向け)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'd') {
        e.preventDefault();
        createDailyNote();
        return;
      }

      // F11: Zen モードのトグル (zen-mode-design.md に準拠)
      if (e.key === 'F11') {
        e.preventDefault();
        updateSettings({ editor: { zenMode: !settings.editor.zenMode } });
        return;
      }

      // Ctrl+\: ペイン分割（右に分割）
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        const tab = getActiveTab();
        if (tab) {
          splitPane('vertical', tab.id);
        }
        return;
      }

      // Ctrl+Alt+←/→/↑/↓: ペイン間フォーカス移動
      if ((e.ctrlKey || e.metaKey) && e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const currentPanes = usePaneStore.getState().panes;
        const currentActivePaneId = usePaneStore.getState().activePaneId;
        if (currentPanes.length < 2) return;

        const currentIndex = currentPanes.findIndex((p) => p.id === currentActivePaneId);
        const otherIndex = currentIndex === 0 ? 1 : 0;
        const otherPane = currentPanes[otherIndex];
        if (otherPane) {
          setActivePaneId(otherPane.id);
          // アクティブペインのアクティブタブを tabStore に同期
          if (otherPane.activeTabId) {
            useTabStore.getState().setActiveTab(otherPane.activeTabId);
          }
        }
        return;
      }

      // Escape: Zen モードを解除
      if (e.key === 'Escape' && settings.editor.zenMode) {
        e.preventDefault();
        updateSettings({ editor: { zenMode: false } });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleNewTab, handleCloseTab, getActiveTab, getTab, saveNow, settings.editor.zenMode, updateSettings, splitPane, setActivePaneId]);

  // デイリーノート作成関数 (知識管理者ペルソナ向け)
  const createDailyNote = useCallback(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayNames = i18next.t('editor:dailyNote.dayNames', { returnObjects: true }) as string[];
    const dayName = dayNames[now.getDay()];

    const content = [
      '---',
      `title: ${dateStr} (${dayName})`,
      `date: ${dateStr}`,
      'tags: [daily]',
      'draft: true',
      '---',
      '',
      `# ${dateStr} (${dayName})`,
      '',
      `## ${i18next.t('editor:dailyNote.todaysTasks')}`,
      '',
      '- [ ] ',
      '',
      `## ${i18next.t('editor:dailyNote.notes')}`,
      '',
      '',
      '',
      `## ${i18next.t('editor:dailyNote.reflection')}`,
      '',
      '',
    ].join('\n');

    addTab({
      filePath: null,
      fileName: `${dateStr}.md`,
      content,
      savedContent: '',
    });
  }, [addTab]);

  // カスタムイベント: create-daily-note (スラッシュコマンドから)
  useEffect(() => {
    const handler = () => createDailyNote();
    window.addEventListener('create-daily-note', handler);
    return () => window.removeEventListener('create-daily-note', handler);
  }, [createDailyNote]);

  // Tauri ネイティブメニューのイベントリスナー (app-shell-design.md §2)
  useMenuListener({
    file_new: handleNewTab,
    file_open: () => openFileDialogRef.current(),
    file_open_folder: () => openFolderDialogRef.current(),
    file_recent_files: () => { setSidebarOpen(true); setSidebarTab('files'); },
    file_recent_workspaces: () => { setSidebarOpen(true); setSidebarTab('files'); },
    file_save: () => {
      const tab = getActiveTab();
      if (!tab) return;
      if (!tab.filePath) {
        saveAsDialogRef.current();
      } else {
        saveNow();
      }
    },
    file_save_as: () => saveAsDialogRef.current(),
    file_export_html: () => setExportDialogOpen(true),
    file_export_pdf: () => setPdfExportDialogOpen(true),
    file_export_word: () => {
      setPandocExportFormat('docx');
      setPandocExportDialogOpen(true);
    },
    file_export_latex: () => {
      setPandocExportFormat('latex');
      setPandocExportDialogOpen(true);
    },
    file_export_epub: () => {
      setPandocExportFormat('epub');
      setPandocExportDialogOpen(true);
    },
    file_save_as_md: () => startSaveAsMarkdownRef.current(),
    file_save_as_html: () => startSaveAsHtmlRef.current(),
    file_template_new: () => {
      window.dispatchEvent(new CustomEvent('menu-template-new'));
    },
    file_daily_note: createDailyNote,
    file_print: () => { window.print(); },
    edit_paste_plain: () => {
      window.dispatchEvent(new CustomEvent('menu-paste-plain'));
    },
    edit_find: () => {
      window.dispatchEvent(new CustomEvent('menu-find'));
    },
    edit_find_replace: () => {
      window.dispatchEvent(new CustomEvent('menu-find-replace'));
    },
    edit_text_stats: () => {
      window.dispatchEvent(new CustomEvent('menu-text-stats'));
    },
    edit_preferences: () => setPreferencesOpen(true),
    view_mode_wysiwyg: () => {
      window.dispatchEvent(new CustomEvent('menu-editor-mode', { detail: { mode: 'wysiwyg' } }));
    },
    view_mode_source: () => {
      window.dispatchEvent(new CustomEvent('menu-editor-mode', { detail: { mode: 'source' } }));
    },
    view_sidebar_toggle: () => setSidebarOpen((v) => !v),
    view_outline: () => { setSidebarOpen(true); setSidebarTab('outline'); },
    view_files: () => { setSidebarOpen(true); setSidebarTab('files'); },
    view_ai_templates: () => { setSidebarOpen(true); setSidebarTab('ai'); },
    view_backlinks: () => { setSidebarOpen(true); setSidebarTab('backlinks'); },
    view_tags: () => { setSidebarOpen(true); setSidebarTab('tags'); },
    view_git: () => { setSidebarOpen(true); setSidebarTab('git'); },
    view_floating_toc: () => setFloatingTocOpen((v) => !v),
    view_split_pane: () => {
      const tab = getActiveTab();
      if (tab) splitPane('vertical', tab.id);
    },
    view_focus_mode: () => updateSettings({ editor: { focusMode: !settings.editor.focusMode } }),
    view_typewriter_mode: () => updateSettings({ editor: { typewriterMode: !settings.editor.typewriterMode } }),
    view_zen_mode: () => updateSettings({ editor: { zenMode: !settings.editor.zenMode } }),
    view_zoom_reset: () => {
      window.dispatchEvent(new CustomEvent('menu-zoom', { detail: { action: 'reset' } }));
    },
    view_zoom_in: () => {
      window.dispatchEvent(new CustomEvent('menu-zoom', { detail: { action: 'in' } }));
    },
    view_zoom_out: () => {
      window.dispatchEvent(new CustomEvent('menu-zoom', { detail: { action: 'out' } }));
    },
    help_shortcuts: () => {
      window.dispatchEvent(new CustomEvent('show-shortcuts-dialog'));
    },
    help_version: () => {
      // バージョン情報は PredefinedMenuItem::about で OS 標準ダイアログを使用
    },
    help_feedback: () => {
      window.dispatchEvent(new CustomEvent('show-feedback-dialog'));
    },
  });

  return (
    <div
      className={['app-shell flex flex-col h-screen relative', zenMode ? 'zen-mode' : ''].filter(Boolean).join(' ')}
      role="application"
      aria-label={i18next.t('editor:aria.markdownEditor')}
    >
      {/* タブバー */}
      <TabBar onCloseTab={handleCloseTab} onNewTab={handleNewTab} onDetachTab={handleDetachTab} />

      {/* メインエリア */}
      <main id="editor-panel" className="flex flex-1 min-h-0" role="main" aria-label={i18next.t('editor:aria.editorArea')}>
        {/* サイドバー */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          editor={currentEditor}
          onOpenFolder={openFolderDialog}
          currentFilePath={activeTab?.filePath ?? null}
          currentFileName={activeTab?.fileName ?? ''}
          workspaceRoot={workspaceRoot}
        />

        {/* エディタエリア - Phase 7: ペイン分割対応 */}
        <SplitEditorLayout
          renderEditor={(tab: TabState, _paneId: string) => {
            // content は shallow 比較で除外されるため、マウント時にストアから直接取得
            const freshContent = useTabStore.getState().getTab(tab.id)?.content ?? tab.content;
            return (
              <EditorErrorBoundary key={tab.id}>
                {tab.fileType === 'html' ? (
                  <HtmlEditor
                    initialContent={freshContent}
                    onContentChange={handleContentChange}
                    onEditorReady={setCurrentEditor}
                  />
                ) : (
                  <MarkdownEditor
                    initialContent={freshContent}
                    onContentChange={handleContentChange}
                    onEditorReady={setCurrentEditor}
                  />
                )}
              </EditorErrorBoundary>
            );
          }}
          renderEmpty={(_paneId: string) => (
            <EmptyState
              onNewTab={handleNewTab}
              onOpenFile={() => openFileDialogRef.current()}
              recentFiles={recentFiles}
            />
          )}
          renderReadOnlyBanner={(tab: TabState) => (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-800" role="status">
              <span>🔒 {i18next.t('editor:readOnly.label')}</span>
              <button
                type="button"
                className="ml-2 px-3 py-0.5 bg-amber-200 hover:bg-amber-300 rounded text-amber-900 text-xs font-medium transition-colors"
                onClick={() => {
                  if (tab.filePath) {
                    requestWriteAccess(tab.filePath);
                  }
                }}
              >
                {i18next.t('editor:readOnly.acquireEdit')}
              </button>
            </div>
          )}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
        />
      </main>

      {/* ステータスバー */}
      <StatusBar
        tab={activeTab ?? null}
        onSaveAsMarkdown={startSaveAsMarkdown}
        onSaveAsHtml={startSaveAsHtml}
      />

      {/* プリファレンスダイアログ */}
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />

      {/* HTML エクスポートダイアログ */}
      {exportDialogOpen && activeTab && (
        <ExportDialog
          markdown={useTabStore.getState().getActiveTab()?.content ?? ''}
          currentFilePath={activeTab.filePath ?? undefined}
          onClose={() => setExportDialogOpen(false)}
        />
      )}

      {/* PDF エクスポートダイアログ（Phase 7） */}
      {pdfExportDialogOpen && activeTab && (
        <PdfExportDialog
          markdown={useTabStore.getState().getActiveTab()?.content ?? ''}
          currentFilePath={activeTab.filePath ?? undefined}
          onClose={() => setPdfExportDialogOpen(false)}
        />
      )}

      {/* Pandoc エクスポートダイアログ（Phase 7: Word / LaTeX / ePub） */}
      {pandocExportDialogOpen && activeTab && (
        <PandocExportDialog
          markdown={useTabStore.getState().getActiveTab()?.content ?? ''}
          currentFilePath={activeTab.filePath ?? undefined}
          onClose={() => setPandocExportDialogOpen(false)}
          onOpenSettings={() => setPreferencesOpen(true)}
          pandocPath={settings.export.pandocPath}
          initialFormat={pandocExportFormat}
        />
      )}

      {/* HTML ↔ MD 変換ダイアログ（Phase 6） */}
      {conversionState.isOpen && activeTab && (
        <ConversionDialog
          direction={conversionState.direction}
          warnings={conversionState.warnings}
          currentFileName={activeTab.fileName}
          onClose={closeConversionDialog}
          onConvertAndSave={convertAndSave}
          onConvertAndOpenTab={convertAndOpenTab}
          isConverting={conversionState.isConverting}
        />
      )}

      {/* フローティング TOC パネル */}
      <FloatingTocPanel
        editor={currentEditor}
        isOpen={floatingTocOpen}
        onClose={() => setFloatingTocOpen(false)}
      />

      {/* トースト通知 */}
      <ToastContainer />

      {/* クラッシュリカバリダイアログ（§10.4） */}
      {recoveryEntries && (
        <RecoveryDialog
          entries={recoveryEntries}
          onRestore={handleRestore}
          onDiscard={handleDiscard}
        />
      )}

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
  const { t } = useTranslation('common');
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
          {t('dropOverlay.dropHere')}
        </p>
        <p className="text-sm text-gray-400">
          {t('dropOverlay.supportedFormats')}
        </p>
      </div>
    </div>
  );
}

/**
 * ファイルが開かれていない時のウェルカム画面
 *
 * ペルソナ対応:
 * - 全ペルソナ: 最近使ったファイルをすぐ再開できる
 * - 一般ライター: 操作ヒントで学習コストを削減
 * - AIパワーユーザー: AIコピー・テンプレート機能への導線
 */
function EmptyState({
  onNewTab,
  onOpenFile,
  recentFiles,
}: {
  onNewTab: () => void;
  onOpenFile: () => void;
  recentFiles: import('../../store/recentFilesStore').RecentFileEntry[];
}) {
  const openFileAsTab = useOpenFileAsTab();
  const { t } = useTranslation(['common', 'editor']);

  const handleOpenRecent = useCallback(async (path: string) => {
    await openFileAsTab(path);
  }, [openFileAsTab]);

  const formatRelativeTime = (ms: number) => {
    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('common:time.justNow');
    if (minutes < 60) return t('common:time.minutesAgo', { count: minutes });
    if (hours < 24) return t('common:time.hoursAgo', { count: hours });
    if (days < 7) return t('common:time.daysAgo', { count: days });
    return new Date(ms).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 overflow-y-auto">
      <div className="w-full max-w-2xl px-8 py-12">
        {/* ロゴ・キャッチコピー */}
        <div className="text-center mb-10">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto mb-4 text-blue-400">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">MarkWeave</h1>
          <p className="text-sm text-gray-400">{t('editor:welcome.tagline')}</p>
        </div>

        {/* アクション */}
        <div className="flex gap-3 justify-center mb-10">
          <button
            type="button"
            onClick={onNewTab}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
            {t('editor:welcome.newFile')}
          </button>
          <button
            type="button"
            onClick={onOpenFile}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {t('editor:welcome.openFile')}
          </button>
        </div>

        {/* 最近使ったファイル */}
        {recentFiles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('editor:welcome.recentFiles')}</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {recentFiles.slice(0, 8).map((entry) => {
                const fileExt = entry.name.split('.').pop()?.toUpperCase() ?? 'MD';
                const isHtml = fileExt === 'HTML' || fileExt === 'HTM';
                return (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => handleOpenRecent(entry.path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${isHtml ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {isHtml ? 'H' : 'M'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 font-medium truncate group-hover:text-blue-600 transition-colors">
                        {entry.name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{entry.path}</div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {formatRelativeTime(entry.lastOpened)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ヒント行 */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Ctrl+N</kbd>
            {' '}{t('editor:welcome.new')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Ctrl+O</kbd>
            {' '}{t('editor:welcome.open')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">F11</kbd>
            {' '}{t('editor:welcome.zenMode')}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono">Ctrl+Shift+F</kbd>
            {' '}{t('editor:welcome.focusMode')}
          </span>
          <span className="text-gray-300">{t('common:dropOverlay.orDropFile')}</span>
        </div>
      </div>
    </div>
  );
}

/** YAML Front Matter と Markdown 記号を除いた純テキスト文字数を返す */
function countWritingChars(content: string): number {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const text = body
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/\s+/g, '');
  return text.length;
}

/**
 * ステータスバー内の Git ブランチ情報ウィジェット。
 * git-integration-design.md §4.2 に準拠。
 */
function GitStatusBarWidget() {
  const showBranch = useSettingsStore((s) => s.settings.git.showStatusBarBranch);
  const isGitRepo = useGitStore((s) => s.isGitRepo);
  const branchInfo = useGitStore((s) => s.branchInfo);

  if (!showBranch || !isGitRepo || !branchInfo) return null;

  const parts: string[] = [];
  if (branchInfo.modifiedCount > 0) parts.push(`M:${branchInfo.modifiedCount}`);
  if (branchInfo.untrackedCount > 0) parts.push(`U:${branchInfo.untrackedCount}`);
  if (branchInfo.stagedCount > 0) parts.push(`S:${branchInfo.stagedCount}`);
  if (branchInfo.conflictedCount > 0) parts.push(`C:${branchInfo.conflictedCount}`);

  return (
    <span
      className="text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
      title={`ブランチ: ${branchInfo.branch ?? '(detached)'}\n${parts.join(' ') || '変更なし'}`}
    >
      ⎇ {branchInfo.branch ?? '(detached)'}
      {parts.length > 0 && (
        <span className="ml-1 text-orange-500">{parts.join(' ')}</span>
      )}
    </span>
  );
}

function StatusBar({ tab, onSaveAsMarkdown, onSaveAsHtml }: {
  tab: ReturnType<typeof useTabStore.getState>['tabs'][number] | null;
  onSaveAsMarkdown?: () => void;
  onSaveAsHtml?: () => void;
}) {
  const [encodingPopover, setEncodingPopover] = useState(false);
  const [lineEndingPopover, setLineEndingPopover] = useState(false);
  const [indentPopover, setIndentPopover] = useState(false);
  const [fileTypePopover, setFileTypePopover] = useState(false);
  const updateEncoding = useTabStore((s) => s.updateEncoding);
  const updateLineEnding = useTabStore((s) => s.updateLineEnding);
  const { settings, updateSettings } = useSettingsStore();
  const encodingRef = useRef<HTMLDivElement>(null);
  const lineEndingRef = useRef<HTMLDivElement>(null);
  const indentRef = useRef<HTMLDivElement>(null);
  const fileTypeRef = useRef<HTMLDivElement>(null);

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
      if (fileTypePopover && fileTypeRef.current && !fileTypeRef.current.contains(e.target as Node)) {
        setFileTypePopover(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [encodingPopover, lineEndingPopover, indentPopover, fileTypePopover]);

  const { t } = useTranslation(['common', 'editor']);
  const encodings: FileEncoding[] = ['UTF-8', 'UTF-8 BOM', 'Shift-JIS', 'EUC-JP'];
  const lineEndings: LineEnding[] = ['LF', 'CRLF'];

  const indentLabel = settings.editor.indentStyle === 'tabs'
    ? t('editor:statusBar.tab', { size: settings.editor.sourceTabSize })
    : t('editor:statusBar.spaces', { size: settings.editor.sourceTabSize });

  // 執筆目標文字数
  const writingGoal = settings.editor.writingGoal;
  const charCount = tab ? countWritingChars(tab.content) : 0;
  const goalProgress = writingGoal > 0 ? Math.min(charCount / writingGoal, 1) : 0;
  const goalReached = writingGoal > 0 && charCount >= writingGoal;

  // YAML Front Matter のドラフト状態（下書きバッジ表示）
  const isDraft = (() => {
    if (!tab || tab.fileType !== 'markdown') return false;
    try {
      const { yaml } = parseFrontMatter(tab.content);
      if (!yaml) return false;
      return parseYamlFields(yaml).draft === true;
    } catch {
      return false;
    }
  })();

  // 読了時間の推定（日本語: 約500文字/分）
  const readingTimeMin = charCount > 0 ? Math.max(1, Math.ceil(charCount / 500)) : 0;

  // 可読性スコア
  const readability = useMemo(
    () => (tab ? calculateReadability(tab.content) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab?.content],
  );

  return (
    <div className="status-bar flex items-center justify-between px-4 py-1 bg-gray-100 border-t border-gray-200 text-xs text-gray-600" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        {tab ? (
          <>
            <span>{tab.filePath ?? t('common:status.unsaved')}</span>
            {tab.isDirty && (
              <span className="text-orange-500">● {t('common:status.modified')}</span>
            )}
            {/* 下書きバッジ (YAML Front Matter: draft: true) */}
            {isDraft && (
              <span className="status-bar__draft-badge" title={t('editor:statusBar.draftTooltip')}>
                {t('common:status.draft')}
              </span>
            )}
            {/* 執筆目標進捗 */}
            {writingGoal > 0 && (
              <div className="flex items-center gap-1.5" title={t('editor:statusBar.writingGoal', { current: charCount.toLocaleString(), target: writingGoal.toLocaleString() })}>
                <span className={goalReached ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {t('editor:statusBar.writingGoalCount', { current: charCount.toLocaleString(), target: writingGoal.toLocaleString() })}
                </span>
                <div className="w-20 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${goalReached ? 'bg-green-500' : 'bg-blue-400'}`}
                    style={{ width: `${goalProgress * 100}%` }}
                  />
                </div>
                {goalReached && <span className="text-green-600">✓</span>}
              </div>
            )}
          </>
        ) : (
          <span>{t('common:status.ready')}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* ポモドーロタイマー */}
        <PomodoroTimer />
        {/* ワードスプリント */}
        <WordSprintWidget charCount={charCount} />
        {/* 読了時間 (ブロガー向け) */}
        {tab && readingTimeMin > 0 && (
          <span className="text-gray-400" title={t('editor:statusBar.readingTimeTooltip', { charCount: charCount.toLocaleString() })}>
            {t('editor:statusBar.readingTime', { minutes: readingTimeMin })}
          </span>
        )}
        {/* 可読性スコア */}
        {readability && readability.totalChars > 0 && (
          <span
            className={`readability-indicator readability-indicator--${readability.level}`}
            title={t('editor:statusBar.readabilityTooltip', { score: readability.score, label: getReadabilityLabel(readability.level), kanjiRatio: (readability.kanjiRatio * 100).toFixed(1), avgSentenceLength: readability.averageSentenceLength })}
          >
            {t('editor:statusBar.readability', { score: readability.score })}
          </span>
        )}
        {/* Git ブランチ情報 (git-integration-design.md §4.2) */}
        <GitStatusBarWidget />
        {/* インデント設定 */}
        <div ref={indentRef} className="relative">
          <button
            type="button"
            className="status-bar__button"
            onClick={() => { setIndentPopover((v) => !v); setEncodingPopover(false); setLineEndingPopover(false); }}
            title={t('editor:statusBar.indentSettings')}
          >
            {indentLabel}
          </button>
          {indentPopover && (
            <div className="status-bar__popover">
              <div className="status-bar__popover-title">{t('editor:statusBar.indentSettings')}</div>
              <div className="status-bar__popover-group">
                <div className="status-bar__popover-label">{t('editor:statusBar.indentStyle_label')}</div>
                {(['spaces', 'tabs'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`status-bar__popover-item${settings.editor.indentStyle === style ? ' status-bar__popover-item--active' : ''}`}
                    onClick={() => { updateSettings({ editor: { indentStyle: style } }); }}
                  >
                    {t(`editor:statusBar.indentStyle.${style}`)}
                  </button>
                ))}
              </div>
              <div className="status-bar__popover-group">
                <div className="status-bar__popover-label">{t('editor:statusBar.tabWidth')}</div>
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
              title={t('editor:statusBar.lineEnding')}
            >
              {tab.lineEnding}
            </button>
            {lineEndingPopover && (
              <div className="status-bar__popover">
                <div className="status-bar__popover-title">{t('editor:statusBar.lineEnding')}</div>
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
              title={t('editor:statusBar.encoding')}
            >
              {tab.encoding}
            </button>
            {encodingPopover && (
              <div className="status-bar__popover">
                <div className="status-bar__popover-title">{t('editor:statusBar.encoding')}</div>
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

        {/* ファイル形式 + 変換メニュー（Phase 6） */}
        <div ref={fileTypeRef} className="relative">
          <button
            type="button"
            className="status-bar__button"
            onClick={() => { setFileTypePopover((v) => !v); setEncodingPopover(false); setLineEndingPopover(false); setIndentPopover(false); }}
            title={t('editor:statusBar.fileFormat')}
          >
            {tab?.fileType === 'html' ? 'HTML' : 'Markdown'}
          </button>
          {fileTypePopover && tab && (
            <div className="status-bar__popover">
              <div className="status-bar__popover-title">{t('editor:statusBar.saveAsOther')}</div>
              {tab.fileType === 'html' ? (
                <button
                  type="button"
                  className="status-bar__popover-item"
                  onClick={() => {
                    setFileTypePopover(false);
                    onSaveAsMarkdown?.();
                  }}
                >
                  {t('editor:statusBar.saveAsMarkdown')}
                </button>
              ) : (
                <button
                  type="button"
                  className="status-bar__popover-item"
                  onClick={() => {
                    setFileTypePopover(false);
                    onSaveAsHtml?.();
                  }}
                >
                  {t('editor:statusBar.saveAsHtml')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
