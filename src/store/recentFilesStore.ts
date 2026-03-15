/**
 * 最近使ったファイル管理ストア
 *
 * ペルソナ対応:
 * - 全ペルソナ: 起動時にすぐ前回の作業を再開できる
 * - 一般ライター: 「どのファイルだったっけ？」という認知負荷を削減
 *
 * Phase 7 ロードマップ: 最近使ったファイル（Tauri ネイティブメニュー動的更新）
 *
 * 設計:
 * - 最大 10 件を維持
 * - 開く / 保存のたびに先頭に追加（重複は除去）
 * - plugin-store で永続化
 */

import { create } from 'zustand';

export interface RecentFileEntry {
  path: string;
  name: string;
  lastOpened: number; // Unix timestamp (ms)
}

const MAX_RECENT = 10;
const STORE_KEY = 'recent-files';

async function getStore() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('app-state.json');
}

interface RecentFilesStore {
  recentFiles: RecentFileEntry[];
  loaded: boolean;

  /** plugin-store から読み込む */
  loadRecentFiles: () => Promise<void>;

  /** ファイルを先頭に追加する（既存エントリは先頭に移動） */
  addRecentFile: (path: string, name: string) => Promise<void>;

  /** エントリを削除する */
  removeRecentFile: (path: string) => Promise<void>;

  /** 全エントリをクリア */
  clearRecentFiles: () => Promise<void>;
}

export const useRecentFilesStore = create<RecentFilesStore>((set, get) => ({
  recentFiles: [],
  loaded: false,

  loadRecentFiles: async () => {
    try {
      const store = await getStore();
      const raw = await store.get<RecentFileEntry[]>(STORE_KEY);
      set({ recentFiles: Array.isArray(raw) ? raw : [], loaded: true });
    } catch {
      set({ recentFiles: [], loaded: true });
    }
  },

  addRecentFile: async (path: string, name: string) => {
    const entry: RecentFileEntry = { path, name, lastOpened: Date.now() };
    const current = get().recentFiles.filter((r) => r.path !== path);
    const next = [entry, ...current].slice(0, MAX_RECENT);
    set({ recentFiles: next });

    try {
      const store = await getStore();
      await store.set(STORE_KEY, next);
      await store.save();
    } catch {
      // Tauri 外ではスキップ
    }
  },

  removeRecentFile: async (path: string) => {
    const next = get().recentFiles.filter((r) => r.path !== path);
    set({ recentFiles: next });

    try {
      const store = await getStore();
      await store.set(STORE_KEY, next);
      await store.save();
    } catch {
      // Tauri 外ではスキップ
    }
  },

  clearRecentFiles: async () => {
    set({ recentFiles: [] });

    try {
      const store = await getStore();
      await store.set(STORE_KEY, []);
      await store.save();
    } catch {
      // Tauri 外ではスキップ
    }
  },
}));
