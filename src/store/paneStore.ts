/**
 * ペイン分割エディタ状態管理ストア (Zustand)
 *
 * split-editor-design.md §5 に準拠:
 * - ペインレイアウト（single / horizontal / vertical）管理
 * - 各ペインのタブ割り当て・アクティブタブ管理
 * - ペイン間フォーカス管理
 * - 分割比率（splitRatio）管理
 */

import { create } from 'zustand';

export type SplitDirection = 'horizontal' | 'vertical';
export type LayoutType = 'single' | SplitDirection;

export interface PaneLayout {
  type: LayoutType;
  /** 左/上ペインの割合（0.0〜1.0、デフォルト: 0.5） */
  splitRatio: number;
}

export interface PaneState {
  id: string;
  /** このペインに属するタブの ID 一覧 */
  tabs: string[];
  /** このペインで表示中のタブ ID */
  activeTabId: string | null;
}

interface SplitEditorStore {
  layout: PaneLayout;
  panes: PaneState[];
  activePaneId: string;
  /** 同一ファイル分割時のスクロール同期（split-editor-design.md §6） */
  scrollSyncEnabled: boolean;

  // アクション
  /** ペインを分割する。tabId を指定すると、そのタブを新ペインへ移動 */
  splitPane: (direction: SplitDirection, tabId?: string) => void;
  /** 指定ペインを閉じる（タブはもう片方のペインに統合） */
  closePane: (paneId: string) => void;
  /** タブをペイン間で移動する */
  moveTabToPane: (tabId: string, fromPaneId: string, toPaneId: string) => void;
  /** 分割比率を変更する */
  setSplitRatio: (ratio: number) => void;
  /** アクティブペインを変更する */
  setActivePaneId: (paneId: string) => void;
  /** ペインにタブを追加する */
  addTabToPane: (tabId: string, paneId?: string) => void;
  /** ペインからタブを削除する */
  removeTabFromPane: (tabId: string) => void;
  /** ペイン内のアクティブタブを設定する */
  setPaneActiveTab: (paneId: string, tabId: string | null) => void;
  /** スクロール同期の有効/無効を切り替える */
  setScrollSyncEnabled: (enabled: boolean) => void;

  // ヘルパー
  /** タブが属するペインを返す */
  getPaneForTab: (tabId: string) => PaneState | undefined;
  /** アクティブペインの情報を返す */
  getActivePane: () => PaneState | undefined;
}

const PANE_1 = 'pane-1';
const PANE_2 = 'pane-2';

export const usePaneStore = create<SplitEditorStore>((set, get) => ({
  layout: { type: 'single', splitRatio: 0.5 },
  panes: [{ id: PANE_1, tabs: [], activeTabId: null }],
  activePaneId: PANE_1,
  scrollSyncEnabled: true,

  splitPane: (direction, tabId) => {
    const state = get();
    // 既に分割済みの場合は何もしない
    if (state.layout.type !== 'single') return;

    const pane1 = state.panes[0];
    if (!pane1) return;

    // 新しいペインを作成
    const newPane: PaneState = {
      id: PANE_2,
      tabs: [],
      activeTabId: null,
    };

    if (tabId) {
      // 指定タブを新ペインへ移動
      const updatedPane1Tabs = pane1.tabs.filter((t) => t !== tabId);
      const updatedPane1ActiveTab =
        pane1.activeTabId === tabId
          ? updatedPane1Tabs[0] ?? null
          : pane1.activeTabId;

      newPane.tabs = [tabId];
      newPane.activeTabId = tabId;

      set({
        layout: { type: direction, splitRatio: 0.5 },
        panes: [
          { ...pane1, tabs: updatedPane1Tabs, activeTabId: updatedPane1ActiveTab },
          newPane,
        ],
        activePaneId: PANE_2,
      });
    } else {
      // タブ指定なし: 空の新ペインを作成
      set({
        layout: { type: direction, splitRatio: 0.5 },
        panes: [pane1, newPane],
        activePaneId: PANE_2,
      });
    }
  },

  closePane: (paneId) => {
    const state = get();
    if (state.layout.type === 'single') return;

    const closingPane = state.panes.find((p) => p.id === paneId);
    const remainingPane = state.panes.find((p) => p.id !== paneId);
    if (!closingPane || !remainingPane) return;

    // 閉じるペインのタブを残りのペインに統合
    const mergedTabs = [...remainingPane.tabs, ...closingPane.tabs];

    set({
      layout: { type: 'single', splitRatio: 0.5 },
      panes: [
        {
          id: PANE_1,
          tabs: mergedTabs,
          activeTabId: remainingPane.activeTabId ?? closingPane.activeTabId,
        },
      ],
      activePaneId: PANE_1,
    });
  },

  moveTabToPane: (tabId, fromPaneId, toPaneId) => {
    const state = get();
    const fromPane = state.panes.find((p) => p.id === fromPaneId);
    const toPane = state.panes.find((p) => p.id === toPaneId);
    if (!fromPane || !toPane) return;
    if (!fromPane.tabs.includes(tabId)) return;

    const newFromTabs = fromPane.tabs.filter((t) => t !== tabId);
    const newFromActive =
      fromPane.activeTabId === tabId
        ? newFromTabs[0] ?? null
        : fromPane.activeTabId;

    const newToTabs = toPane.tabs.includes(tabId)
      ? toPane.tabs
      : [...toPane.tabs, tabId];

    set({
      panes: state.panes.map((p) => {
        if (p.id === fromPaneId) {
          return { ...p, tabs: newFromTabs, activeTabId: newFromActive };
        }
        if (p.id === toPaneId) {
          return { ...p, tabs: newToTabs, activeTabId: tabId };
        }
        return p;
      }),
    });

    // 移動元ペインが空になった場合、そのペインを閉じる
    if (newFromTabs.length === 0 && state.layout.type !== 'single') {
      get().closePane(fromPaneId);
    }
  },

  setSplitRatio: (ratio) => {
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    set((state) => ({
      layout: { ...state.layout, splitRatio: clamped },
    }));
  },

  setActivePaneId: (paneId) => {
    set({ activePaneId: paneId });
  },

  addTabToPane: (tabId, paneId) => {
    const state = get();
    const targetPaneId = paneId ?? state.activePaneId;
    const targetPane = state.panes.find((p) => p.id === targetPaneId);
    if (!targetPane) return;

    // 既にどこかのペインに属しているタブは追加しない
    const existingPane = state.panes.find((p) => p.tabs.includes(tabId));
    if (existingPane) return;

    set({
      panes: state.panes.map((p) =>
        p.id === targetPaneId
          ? { ...p, tabs: [...p.tabs, tabId], activeTabId: tabId }
          : p,
      ),
    });
  },

  removeTabFromPane: (tabId) => {
    const state = get();
    const pane = state.panes.find((p) => p.tabs.includes(tabId));
    if (!pane) return;

    const newTabs = pane.tabs.filter((t) => t !== tabId);
    const newActive =
      pane.activeTabId === tabId
        ? newTabs[newTabs.length - 1] ?? null
        : pane.activeTabId;

    set({
      panes: state.panes.map((p) =>
        p.id === pane.id
          ? { ...p, tabs: newTabs, activeTabId: newActive }
          : p,
      ),
    });

    // 分割モードで空になったペインを閉じる
    if (newTabs.length === 0 && state.layout.type !== 'single') {
      get().closePane(pane.id);
    }
  },

  setPaneActiveTab: (paneId, tabId) => {
    set((state) => ({
      panes: state.panes.map((p) =>
        p.id === paneId ? { ...p, activeTabId: tabId } : p,
      ),
    }));
  },

  setScrollSyncEnabled: (enabled) => {
    set({ scrollSyncEnabled: enabled });
  },

  getPaneForTab: (tabId) => {
    return get().panes.find((p) => p.tabs.includes(tabId));
  },

  getActivePane: () => {
    const state = get();
    return (
      state.panes.find((p) => p.id === state.activePaneId) ?? state.panes[0]
    );
  },
}));
