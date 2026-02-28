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

export interface TabState {
  id: string;
  filePath: string | null; // null = 新規未保存ファイル
  fileName: string;
  isDirty: boolean;
  content: string; // 現在のエディタ内容 (Markdown)
  savedContent: string; // 最後に保存した内容
  encoding: FileEncoding; // ファイルの文字コード
  lineEnding: LineEnding; // 改行コード
}

interface TabStore {
  tabs: TabState[];
  activeTabId: string | null;

  // タブ操作
  addTab: (tab: Omit<TabState, 'id' | 'isDirty' | 'encoding' | 'lineEnding'> & { encoding?: FileEncoding; lineEnding?: LineEnding }) => string;
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

    const newTab: TabState = {
      id,
      filePath: tabData.filePath,
      fileName,
      isDirty: false,
      content: tabData.content,
      savedContent: tabData.savedContent,
      encoding: tabData.encoding ?? 'UTF-8',
      lineEnding: tabData.lineEnding ?? 'LF',
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
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              content,
              isDirty: content !== tab.savedContent,
            }
          : tab,
      ),
    }));
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
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, encoding } : tab,
      ),
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
