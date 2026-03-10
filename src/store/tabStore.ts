/**
 * タブ状態管理ストア (Zustand)
 *
 * window-tab-session-design.md に準拠:
 * - タブの追加・削除・切り替え
 * - 未保存状態 (isDirty) の管理
 * - タブタイトルへの未保存マーカー表示
 *
 * CLAUDE.md の制約:
 * - 未保存のファイルが外部で変更された場合、自動リロードしない
 */

import { create } from 'zustand';

export type FileEncoding = 'UTF-8' | 'UTF-8 BOM' | 'Shift-JIS' | 'EUC-JP';
export type LineEnding = 'LF' | 'CRLF';
export type FileType = 'markdown' | 'html';

export interface TabState {
  id: string;
  filePath: string | null; // null = 新規未保存ファイル
  fileName: string;
  isDirty: boolean;
  content: string; // 現在のエディタ内容 (Markdown or HTML)
  savedContent: string; // 最後に保存した内容
  encoding: FileEncoding; // ファイルの文字コード
  lineEnding: LineEnding; // 改行コード
  fileType: FileType; // ファイル種別（Phase 5: HTML WYSIWYG 編集）
  isReadOnly: boolean; // 別ウィンドウが編集中のため読み取り専用（Phase 7: マルチウィンドウ）
}

interface TabStore {
  tabs: TabState[];
  activeTabId: string | null;

  // タブ操作
  addTab: (
    tab: Omit<
      TabState,
      'id' | 'isDirty' | 'encoding' | 'lineEnding' | 'fileType' | 'isReadOnly'
    > & {
      encoding?: FileEncoding;
      lineEnding?: LineEnding;
      fileType?: FileType;
      isReadOnly?: boolean;
    },
  ) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // コンテンツ更新
  updateContent: (tabId: string, content: string) => void;

  // 保存関連
  markSaved: (tabId: string, filePath?: string) => void;

  // エンコーディング・改行コード更新
  updateEncoding: (tabId: string, encoding: FileEncoding) => void;
  updateLineEnding: (tabId: string, lineEnding: LineEnding) => void;

  // ファイルパス更新（名前を付けて保存後）
  updateFilePath: (oldPath: string, newPath: string) => void;

  // Read-Only 状態の切り替え（マルチウィンドウ対応）
  setReadOnly: (filePath: string, isReadOnly: boolean) => void;

  // ヘルパー
  getTab: (tabId: string) => TabState | undefined;
  getActiveTab: () => TabState | undefined;
  getTabByPath: (filePath: string) => TabState | undefined;

  // Untitled カウンタ
  _untitledCounter: number;
}

let nextId = 1;
function generateTabId(): string {
  return `tab-${nextId++}`;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  _untitledCounter: 0,

  addTab: (tabData) => {
    const state = get();

    // 同じファイルパスのタブが既に開いている場合はそちらにフォーカス
    if (tabData.filePath) {
      const existing = state.tabs.find((t) => t.filePath === tabData.filePath);
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }

    const id = generateTabId();

    // Untitled の場合は連番を付ける
    let fileName = tabData.fileName;
    if (!tabData.filePath) {
      const counter = state._untitledCounter + 1;
      fileName = `Untitled-${counter}`;
      set({ _untitledCounter: counter });
    }

    // ファイル拡張子からファイル種別を自動判定
    const detectedFileType: FileType =
      tabData.fileType ?? detectFileType(tabData.filePath ?? fileName);

    const newTab: TabState = {
      id,
      filePath: tabData.filePath,
      fileName,
      isDirty: false,
      content: tabData.content,
      savedContent: tabData.savedContent,
      encoding: tabData.encoding ?? 'UTF-8',
      lineEnding: tabData.lineEnding ?? 'LF',
      fileType: detectedFileType,
      isReadOnly: tabData.isReadOnly ?? false,
    };

    set({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    });

    return id;
  },

  removeTab: (tabId) => {
    const state = get();
    const newTabs = state.tabs.filter((t) => t.id !== tabId);
    let newActiveId = state.activeTabId;

    if (state.activeTabId === tabId) {
      // 閉じたタブがアクティブだった場合、隣のタブをアクティブにする
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      if (newTabs.length > 0) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        newActiveId = newTabs[newIdx]!.id;
      } else {
        newActiveId = null;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateContent: (tabId, content) => {
    set((state) => {
      let changed = false;
      const nextTabs = state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        if (tab.content === content) return tab;

        changed = true;
        return {
          ...tab,
          content,
          isDirty: content !== tab.savedContent,
        };
      });

      return changed ? { tabs: nextTabs } : state;
    });
  },

  markSaved: (tabId, filePath) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              isDirty: false,
              savedContent: tab.content,
              ...(filePath
                ? {
                    filePath,
                    fileName: filePath.split(/[/\\]/).pop() ?? tab.fileName,
                  }
                : {}),
            }
          : tab,
      ),
    }));
  },

  updateEncoding: (tabId, encoding) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, encoding } : tab)),
    }));
  },

  updateLineEnding: (tabId, lineEnding) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, lineEnding, isDirty: true } : tab,
      ),
    }));
  },

  updateFilePath: (oldPath, newPath) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.filePath === oldPath
          ? {
              ...tab,
              filePath: newPath,
              fileName: newPath.split(/[/\\]/).pop() ?? tab.fileName,
            }
          : tab,
      ),
    }));
  },

  setReadOnly: (filePath, isReadOnly) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.filePath === filePath ? { ...tab, isReadOnly } : tab)),
    }));
  },

  getTab: (tabId) => {
    return get().tabs.find((t) => t.id === tabId);
  },

  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) return undefined;
    return state.tabs.find((t) => t.id === state.activeTabId);
  },

  getTabByPath: (filePath) => {
    return get().tabs.find((t) => t.filePath === filePath);
  },
}));

/**
 * ファイルパスまたはファイル名からファイル種別を判定する。
 * Phase 5: 拡張子による編集モード自動切替
 */
function detectFileType(pathOrName: string): FileType {
  const ext = pathOrName.split('.').pop()?.toLowerCase();
  if (ext === 'html' || ext === 'htm') {
    return 'html';
  }
  return 'markdown';
}
